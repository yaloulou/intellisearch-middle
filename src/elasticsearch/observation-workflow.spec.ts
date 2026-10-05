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

  it('forces pending state and denies creator, admins and other desks both listing and direct access', async () => {
    const created = await service.saveObservation({ ...payload, _id: 'forged-id', owner_id: 'forged',
      workflow: { status: 'validated', target_desks: ['desk_est'] } }, undefined, officer);
    expect(created.id).not.toBe('forged-id');
    expect(created.item.workflow).toMatchObject({ status: 'pending', target_desks: [] });
    expect(created.item.owner_id).toBe(officer.sub);
    for (const account of [officer, analyst, adviser, user(Role.ADMIN), user(Role.COORDINATEUR, 'desk_est')]) {
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
      expect((await service.searchObservations({}, account)).count).toBe(0);
      await expect(service.validateObservation(created.id, { target_desks: ['desk_est'] }, account)).rejects.toThrow('cord_intel');
      await expect(service.saveObservation(payload, created.id, account)).rejects.toThrow('cord_intel');
      await expect(service.deleteObservation(created.id, account)).rejects.toThrow('cord_intel');
    }
    await validate(created.id, ['desk_ouest']);
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
    for (const [context, id] of [[undefined, undefined], ['events', 'some-event'], ['observations', created.id]]) {
      await expect(service.getEvidenceById(docId, officer, context, id)).rejects.toThrow('Accès refusé');
    }
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
