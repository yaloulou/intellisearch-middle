import { ElasticsearchService } from './elasticsearch.service';
import { TestElasticsearch } from './test-elasticsearch';
import { Role } from '../common/constants/roles.constant';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { appConfig } from '../config/app.config';
import { JwtStrategy } from '../auth/jwt.strategy';
import { UsersService } from '../users/users.service';
import { NotFoundException } from '@nestjs/common';

const user = (role: Role, desk = '', sub = `${role}-${desk}`): JwtPayload => ({ sub, role, desk, email: 'test@example.test' });
const reviewer = user(Role.OFFICIER, ' CORD_INTEL ');
const officer = user(Role.OFFICIER, 'desk_est');
const analyst = user(Role.ANALYSTE, 'desk_est');
const adviser = user(Role.CONSEILLER, 'desk_ouest');
const payload = { obs_type: 'autre', summary: 'Information à contrôler' };

describe('Observation validation and desk distribution', () => {
  let service: ElasticsearchService;
  let es: TestElasticsearch;
  beforeEach(() => {
    service = new ElasticsearchService();
    es = new TestElasticsearch();
    jest.spyOn(service as any, 'requestToElasticsearch').mockImplementation(es.request);
    for (const account of [analyst, adviser, reviewer]) {
      es.documents.set(`/${appConfig.elasticsearch.indexes.users}/_doc/${account.sub}`, { ...account, actif: true });
    }
  });
  afterEach(() => jest.restoreAllMocks());
  const validate = async (id: string, targets = ['desk_est']) => {
    const current = await service.getObservationById(id, reviewer);
    return service.validateObservation(id, { target_desks: targets, _seq_no: current._seq_no, _primary_term: current._primary_term }, reviewer);
  };

  it('forces pending state and permits the author while denying unrelated users and admins', async () => {
    const created = await service.saveObservation({ ...payload, _id: 'forged-id', owner_id: 'forged',
      workflow: { status: 'validated', target_desks: ['desk_est'] } }, undefined, officer);
    expect(created.id).not.toBe('forged-id');
    expect(created.item.workflow).toMatchObject({ status: 'pending', target_desks: [] });
    expect(created.item.owner_id).toBe(officer.sub);
    expect((await service.searchObservations({}, officer)).count).toBe(1);
    await expect(service.getObservationById(created.id, officer)).resolves.toHaveProperty('summary', payload.summary);
    for (const account of [analyst, adviser, user(Role.ADMIN), user(Role.COORDINATEUR, 'desk_est')]) {
      expect((await service.searchObservations({}, account)).count).toBe(0);
      await expect(service.getObservationById(created.id, account)).rejects.toThrow('Accès refusé');
    }
    expect((await service.searchObservations({ status: 'pending' }, reviewer)).count).toBe(1);
  });

  it('distributes to multiple desks exclusively for analysts and advisers and permits redistribution', async () => {
    const created = await service.saveObservation(payload, undefined, officer);
    await validate(created.id, [' DESK_EST ', 'desk_ouest', 'desk_est']);
    for (const account of [analyst, adviser]) {
      expect((await service.searchObservations({}, account)).count).toBe(1);
      expect((await service.getObservationById(created.id, account)).workflow?.target_desks).toEqual(['desk_est', 'desk_ouest']);
    }
    for (const account of [officer, user(Role.ANALYSTE, 'desk_sud'), user(Role.COORDINATEUR, 'desk_est'), user(Role.ADMIN, 'desk_est')]) {
      expect((await service.searchObservations({}, account)).count).toBe(account.sub === officer.sub ? 1 : 0);
      await expect(service.validateObservation(created.id, { target_desks: ['desk_est'] }, account)).rejects.toThrow('cord_intel');
      await expect(service.saveObservation(payload, created.id, account)).rejects.toThrow('cord_intel');
      await expect(service.deleteObservation(created.id, account)).rejects.toThrow('cord_intel');
    }
    await validate(created.id, ['desk_ouest']);
    await expect(service.getObservationById(created.id, officer)).resolves.toHaveProperty('summary', payload.summary);
    await expect(service.getObservationById(created.id, analyst)).rejects.toThrow('Accès refusé');
    expect((await service.searchObservations({}, adviser)).count).toBe(1);
  });

  it('invalidates distribution when content changes and preserves the original creator', async () => {
    const created = await service.saveObservation(payload, undefined, officer);
    await validate(created.id);
    const edited = await service.saveObservation({ ...payload, summary: 'Correction' }, created.id, reviewer);
    expect(edited.item.owner_id).toBe(officer.sub);
    expect(edited.item.audit.created_by).toBe(officer.sub);
    expect(edited.item.workflow.status).toBe('pending');
    await expect(service.getObservationById(created.id, officer)).resolves.toHaveProperty('summary', 'Correction');
    await expect(service.getObservationById(created.id, analyst)).rejects.toThrow('Accès refusé');
    await validate(created.id);
    expect((await service.getObservationById(created.id, analyst)).summary).toBe('Correction');
  });

  it('keeps legacy records private until reviewed, rejects missing desks and stale review versions', async () => {
    const key = `/${appConfig.elasticsearch.indexes.observations}/_doc/legacy`;
    es.documents.set(key, payload);
    expect((await service.searchObservations({ status: 'pending' }, reviewer)).count).toBe(1);
    await expect(service.getObservationById('legacy', analyst)).rejects.toThrow('Accès refusé');
    await expect(validate('legacy', [])).rejects.toThrow('Choisissez');
    await expect(validate('legacy', ['cord_intel'])).rejects.toThrow('Choisissez');
    await expect(validate('legacy', ['unknown'])).rejects.toThrow('Choisissez');
    const old = await service.getObservationById('legacy', reviewer);
    await service.saveObservation(payload, 'legacy', reviewer);
    await expect(service.validateObservation('legacy', { target_desks: ['desk_est'], _seq_no: old._seq_no, _primary_term: old._primary_term }, reviewer)).rejects.toThrow('a changé');
    await validate('legacy');
    expect((await service.searchObservations({}, analyst)).count).toBe(1);
  });

  it('protects evidence even against uploader and alternate-context bypasses', async () => {
    const docId = 'evidence-test';
    es.documents.set(`/${appConfig.elasticsearch.indexes.documents}/_doc/${docId}`, {
      owner_id: officer.sub, doc_type: 'evidence_video', title: 'secret.mp4', tags: ['evidence', 'observations'], file: { path: 'secret.mp4' },
    });
    const created = await service.saveObservation({ ...payload, evidence: [{ doc_id: docId }] }, undefined, officer);
    for (const [context, id] of [[undefined, undefined], ['events', 'some-event']]) {
      await expect(service.getEvidenceById(docId, officer, context, id)).rejects.toThrow('associée');
    }
    await expect(service.getEvidenceById(docId, officer, 'observations', created.id)).resolves.toHaveProperty('title', 'secret.mp4');
    await expect(service.getEvidenceById(docId, analyst, 'observations', created.id)).rejects.toThrow('Accès refusé');
    await expect(service.getPublicDocument(docId)).rejects.toThrow('pièces jointes');
    expect((await service.searchDocuments({})).count).toBe(0);
    await expect(service.savePublicDocument({ doc_type: 'rapport', title: 'hack' }, docId)).rejects.toThrow('pièces jointes');
    await expect(service.deletePublicDocument(docId)).rejects.toThrow('pièces jointes');
    await validate(created.id);
    expect((await service.getEvidenceById(docId, analyst, 'observations', created.id)).title).toBe('secret.mp4');
    await service.deleteObservation(created.id, reviewer);
    await expect(service.getObservationById(created.id, reviewer)).rejects.toThrow('introuvable');
  });

  it.each([Role.OFFICIER, Role.COORDINATEUR, Role.ADMIN])('lets a %s author read their pending and redistributed records without editing rights', async role => {
    const author = user(role, 'desk_terrain', `author-${role}`);
    const colleague = { ...author, sub: 'colleague' };
    const created = await service.saveObservation(payload, undefined, author);
    expect((await service.searchObservations({ status: 'pending' }, author)).count).toBe(1);
    expect((await service.searchObservations({}, colleague)).count).toBe(0);
    await expect(service.getObservationById(created.id, colleague)).rejects.toThrow('Accès refusé');
    await validate(created.id, ['desk_est']);
    const reassigned = { ...author, desk: 'nouveau_desk' };
    expect((await service.searchObservations({ status: 'validated' }, reassigned)).count).toBe(1);
    await expect(service.getObservationById(created.id, reassigned)).resolves.toHaveProperty('owner_id', author.sub);
    await expect(service.saveObservation(payload, created.id, author)).rejects.toThrow('cord_intel');
    await expect(service.deleteObservation(created.id, author)).rejects.toThrow('cord_intel');
    await expect(service.validateObservation(created.id, { target_desks: ['desk_est'] }, author)).rejects.toThrow('cord_intel');
  });

  it('combines own pending information with validated information distributed to the current analyst desk', async () => {
    const own = await service.saveObservation(payload, undefined, officer);
    const received = await service.saveObservation(payload, undefined, { ...officer, sub: 'another-author' });
    await service.saveObservation(payload, undefined, { ...officer, sub: 'private-author' });
    await validate(received.id);
    const promoted = { ...officer, role: Role.ANALYSTE };
    expect((await service.searchObservations({}, promoted)).items.map(item => item._id).sort()).toEqual([own.id, received.id].sort());
    expect((await service.searchObservations({ status: 'pending' }, promoted)).items.map(item => item._id)).toEqual([own.id]);
  });

  it('uses legacy creator audit only when no owner exists and fails closed without an identified author', async () => {
    const key = `/${appConfig.elasticsearch.indexes.observations}/_doc/`;
    es.documents.set(key + 'legacy-own', { ...payload, audit: { created_by: officer.sub } });
    es.documents.set(key + 'conflicting-owner', { ...payload, owner_id: 'someone-else', audit: { created_by: officer.sub } });
    es.documents.set(key + 'unidentified', payload);
    expect((await service.searchObservations({}, officer)).items.map(item => item._id)).toEqual(['legacy-own']);
    await expect(service.getObservationById('legacy-own', officer)).resolves.toHaveProperty('summary', payload.summary);
    for (const id of ['conflicting-owner', 'unidentified']) await expect(service.getObservationById(id, officer)).rejects.toThrow('Accès refusé');
    expect((await service.searchObservations({})).count).toBe(0);
    await expect(service.getObservationById('legacy-own')).rejects.toThrow('Accès refusé');
    const edited = await service.saveObservation({ ...payload, summary: 'Correction de l’ancienne information' }, 'legacy-own', reviewer);
    expect(edited.item.owner_id).toBe(officer.sub);
    await expect(service.getObservationById('legacy-own', officer)).resolves.toHaveProperty('summary', 'Correction de l’ancienne information');
  });

  it('uses current account assignments instead of stale JWT desks and refuses disabled accounts', async () => {
    const profile = { _id: 'test', email: 'test@example.test', role: Role.CONSEILLER, desk: 'desk_ouest', actif: true };
    const users = { findById: jest.fn().mockResolvedValue(profile) };
    const strategy = new JwtStrategy(users as unknown as UsersService);
    const resolved = await strategy.validate({ ...reviewer, sub: 'test' });
    expect(resolved).toMatchObject({ role: Role.CONSEILLER, desk: 'desk_ouest' });
    users.findById.mockResolvedValue({ ...profile, actif: false });
    await expect(strategy.validate(reviewer)).rejects.toThrow('Compte inactif');
    users.findById.mockRejectedValue(new NotFoundException());
    await expect(strategy.validate(reviewer)).rejects.toThrow('Compte introuvable');
  });
});
