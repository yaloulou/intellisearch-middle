import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import requestHttp from 'supertest';
import { AppModule } from '../app.module';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { appConfig } from '../config/app.config';
import { Role } from '../common/constants/roles.constant';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ElasticsearchService } from './elasticsearch.service';
import { normalizeEvidence, describeEvidenceFile } from './evidence';
import type { EvidenceRef } from './evidence';
import { TestElasticsearch } from './test-elasticsearch';
import { UsersService } from '../users/users.service';

describe('Evidence uploads and record persistence', () => {
  let service: ElasticsearchService;
  let directory: string;
  let documents: Map<string, Record<string, any>>;
  let request: jest.SpyInstance;
  const uploader: JwtPayload = { sub: 'owner', email: 'owner@example.test', role: Role.COORDINATEUR, desk: 'cord_intel' };

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'intellisearch-evidence-'));
    jest.replaceProperty(appConfig.uploads, 'evidenceDir', directory);
    service = new ElasticsearchService();
    const es = new TestElasticsearch();
    documents = es.documents;
    // Exercise the real upload, save, normalization and access-control code
    // with a local Elasticsearch substitute; no production index is written.
    request = jest.spyOn(service as any, 'requestToElasticsearch').mockImplementation(es.request);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it.each([
    ['image', 'image.png', 'image/png'],
    ['video', 'video.mp4', 'video/mp4'],
    ['audio', 'audio.mp3', 'audio/mpeg'],
    ['document', 'report.pdf', 'application/pdf'],
    ['document', 'report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ])('uploads and retrieves a %s file with its hash and private URL', async (type, name, mime) => {
    const buffer = Buffer.from('sample file bytes');
    const upload = await service.uploadEvidence({ originalname: name, mimetype: 'application/octet-stream', buffer }, 'events', '{"level":"SECRET"}', uploader);
    expect(upload.evidence).toEqual({ doc_id: upload.document._id, type, sha256: createHash('sha256').update(buffer).digest('hex') });
    expect(upload.document.file?.mime).toBe(mime);
    expect(upload.document.file?.url).toBe(`/api/evidence/${upload.evidence.doc_id}/file`);
    expect(upload.document.classification?.level).toBe('SECRET');
    expect(upload.document.owner_id).toBe(uploader.sub);
    const file = await service.getEvidenceFile(upload.evidence.doc_id, uploader);
    expect(await readFile(file.path)).toEqual(buffer);
  });

  it.each(['events', 'observations'] as const)('persists several evidence types on %s, preserves them on unrelated edits, and supports unlinking', async (context) => {
    const refs: EvidenceRef[] = [];
    for (const name of ['image.jpg', 'audio.wav', 'video.webm', 'report.pdf']) {
      refs.push((await service.uploadEvidence({ originalname: name, mimetype: '', buffer: Buffer.from('sample') }, context, undefined, uploader)).evidence);
    }
    const payload = context === 'events' ? { title: 'Test', event_type: 'Incident' } : { obs_type: 'autre', summary: 'Test' };
    const save = context === 'events' ? service.saveEvent.bind(service) : service.saveObservation.bind(service);
    const created = await save({ ...payload, evidence: refs }, undefined, uploader);
    expect(created.item.evidence).toEqual(refs);
    const updated = await save({ ...payload }, created.id, uploader);
    expect(updated.item.evidence).toEqual(refs);
    const removed = await save({ ...payload, evidence: [] }, created.id, uploader);
    expect(removed.item.evidence).toEqual([]);
    expect(await readdir(directory)).toHaveLength(4);
  });

  it('allows an officer to upload observations but denies event uploads', async () => {
    const officer = { ...uploader, role: Role.OFFICIER };
    const file = { originalname: 'audio.mp3', mimetype: 'audio/mpeg', buffer: Buffer.from('sample') };
    await expect(service.uploadEvidence(file, 'observations', undefined, officer)).resolves.toHaveProperty('evidence.type', 'audio');
    await expect(service.uploadEvidence(file, 'events', undefined, officer)).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects empty files, unsupported active content, oversized files, and malformed references', async () => {
    const file = { originalname: 'page.html', mimetype: 'text/html', buffer: Buffer.from('<script>') };
    await expect(service.uploadEvidence(file, 'events', undefined, uploader)).rejects.toThrow('Format non accepté');
    expect(() => describeEvidenceFile({ ...file, originalname: 'image.png', buffer: Buffer.alloc(0) })).toThrow('fichier vide');
    expect(() => describeEvidenceFile({ ...file, originalname: 'video.mp4', buffer: Buffer.alloc(100 * 1024 * 1024 + 1) })).toThrow('100 Mo');
    expect(() => normalizeEvidence([{ doc_id: '' }])).toThrow('vide');
    expect(() => normalizeEvidence([{ doc_id: 'same' }, { doc_id: 'same' }])).toThrow('dupliqué');
    expect(() => normalizeEvidence(Array.from({ length: 21 }, (_, i) => ({ doc_id: String(i) })))).toThrow('20');
    expect(await readdir(directory)).toHaveLength(0);
  });

  it('removes the newly written file if document indexing fails', async () => {
    request.mockRejectedValueOnce(new Error('Elasticsearch unavailable'));
    await expect(service.uploadEvidence({ originalname: 'report.pdf', mimetype: 'application/pdf', buffer: Buffer.from('sample') }, 'events', undefined, uploader)).rejects.toThrow('Elasticsearch unavailable');
    expect(await readdir(directory)).toHaveLength(0);
  });

  it('restricts unattached files and checks the parent record before sharing', async () => {
    const upload = await service.uploadEvidence({ originalname: 'image.png', mimetype: 'image/png', buffer: Buffer.from('sample') }, 'observations', undefined, uploader);
    const officer = { ...uploader, sub: 'other', role: Role.OFFICIER, desk: 'desk_est' };
    const analyst = { ...officer, role: Role.ANALYSTE };
    await expect(service.getEvidenceById(upload.evidence.doc_id, analyst)).rejects.toThrow('Accès refusé');
    const observation = await service.saveObservation({ obs_type: 'autre', summary: 'Test', evidence: [upload.evidence] }, undefined, uploader);
    await expect(service.getEvidenceById(upload.evidence.doc_id, officer, 'observations', observation.id)).rejects.toThrow('Accès refusé');
    await expect(service.getEvidenceById(upload.evidence.doc_id, analyst, 'observations', observation.id)).rejects.toThrow('Accès refusé');
    await expect(service.getEvidenceById(upload.evidence.doc_id, uploader, 'observations', observation.id)).resolves.toHaveProperty('title', 'image.png');
    await expect(service.saveObservation({ obs_type: 'autre', summary: 'Test', evidence: [upload.evidence] }, undefined, officer)).rejects.toThrow('Accès refusé');
  });

  it('rejects stored paths escaping the evidence directory', async () => {
    const upload = await service.uploadEvidence({ originalname: 'report.pdf', mimetype: '', buffer: Buffer.from('sample') }, 'events', undefined, uploader);
    const key = `/${appConfig.elasticsearch.indexes.documents}/_doc/${upload.evidence.doc_id}`;
    documents.get(key)!.file.path = '../outside.pdf';
    await expect(service.getEvidenceFile(upload.evidence.doc_id, uploader)).rejects.toThrow('Chemin');
  });

  it('serves authenticated multipart uploads and file ranges through the real controller', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UsersService).useValue({ findById: async () => ({ _id: uploader.sub, ...uploader, actif: true }) })
      .overrideProvider(ElasticsearchService).useValue(service).compile();
    const app = module.createNestApplication({ logger: false });
    await app.init();
    try {
      const token = module.get(JwtService).sign(uploader);
      const server = app.getHttpServer();
      await requestHttp(server).post('/api/uploads/evidence').field('context', 'events')
        .attach('file', Buffer.from('sample'), 'report.pdf').expect(401);
      const uploaded = await requestHttp(server).post('/api/uploads/evidence')
        .set('Authorization', `Bearer ${token}`).field('context', 'events')
        .field('classification', '{"level":"SECRET"}')
        .attach('file', Buffer.from('sample file'), 'report.pdf').expect(201);
      const { evidence } = uploaded.body;
      const saved = await requestHttp(server).post('/api/events').set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test', event_type: 'Incident', evidence: [evidence] }).expect(201);
      expect(saved.body.item.evidence).toEqual([evidence]);
      await requestHttp(server).get(`/api/evidence/${evidence.doc_id}/file`).expect(401);
      await requestHttp(server).get(`/api/evidence/${evidence.doc_id}/file`).set('Authorization', `Bearer ${token}`)
        .set('Range', 'bytes=0-3').expect(206).expect('Content-Range', 'bytes 0-3/11')
        .expect('X-Content-Type-Options', 'nosniff');
      await requestHttp(server).get(`/api/evidence/${evidence.doc_id}`).set('Authorization', `Bearer ${token}`)
        .expect(200).expect(res => expect(res.body.title).toBe('report.pdf'));
    } finally { await app.close(); }
  });
});
