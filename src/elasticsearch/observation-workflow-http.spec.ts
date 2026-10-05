import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { ElasticsearchService } from './elasticsearch.service';
import { TestElasticsearch } from './test-elasticsearch';
import { appConfig } from '../config/app.config';
import { Role } from '../common/constants/roles.constant';

describe('Observation workflow through authenticated HTTP routes', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const es = new TestElasticsearch();
  const service = new ElasticsearchService();
  const accounts = [
    { _id: 'creator', role: Role.OFFICIER, desk: 'terrain' },
    { _id: 'reviewer', role: Role.OFFICIER, desk: 'cord_intel' },
    { _id: 'recipient', role: Role.CONSEILLER, desk: 'desk_est' },
    { _id: 'outsider', role: Role.ANALYSTE, desk: 'desk_ouest' },
    { _id: 'admin', role: Role.ADMIN, desk: '' },
  ].map(user => ({ ...user, email: `${user._id}@example.test`, actif: true }));
  const token = (id: string) => jwt.sign({ sub: id, role: Role.ADMIN, desk: 'cord_intel' });
  beforeAll(async () => {
    jest.spyOn(service as any, 'requestToElasticsearch').mockImplementation(es.request);
    for (const account of accounts) es.documents.set(`/${appConfig.elasticsearch.indexes.users}/_doc/${account._id}`, account);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ElasticsearchService).useValue(service)
      .overrideProvider(UsersService).useValue({ findById: async (id: string) => accounts.find(u => u._id === id) })
      .compile();
    app = module.createNestApplication({ logger: false });
    jwt = module.get(JwtService);
    await app.init();
  });
  afterAll(async () => { await app.close(); jest.restoreAllMocks(); });

  it('submits, reviews and distributes with no API bypass for other desks or a forged token desk', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/observations').send({}).expect(401);
    const created = await request(server).post('/api/observations').set('Authorization', `Bearer ${token('creator')}`)
      .send({ obs_type: 'autre', summary: 'À valider', workflow: { status: 'validated', target_desks: ['desk_est'] } }).expect(201);
    const id = created.body.id;
    for (const account of ['creator', 'recipient', 'outsider', 'admin']) {
      await request(server).get(`/api/observations/${id}`).set('Authorization', `Bearer ${token(account)}`).expect(403);
      await request(server).get('/api/observations/desks').set('Authorization', `Bearer ${token(account)}`).expect(403);
      await request(server).put(`/api/observations/${id}/validation`).set('Authorization', `Bearer ${token(account)}`)
        .send({ target_desks: ['desk_est'] }).expect(403);
      await request(server).put(`/api/observations/${id}`).set('Authorization', `Bearer ${token(account)}`).send({}).expect(403);
      await request(server).delete(`/api/observations/${id}`).set('Authorization', `Bearer ${token(account)}`).expect(403);
    }
    await request(server).post('/api/observations/search').set('Authorization', `Bearer ${token('reviewer')}`)
      .send({ status: 'pending' }).expect(201).expect(res => expect(res.body.count).toBe(1));
    await request(server).get('/api/observations/desks').set('Authorization', `Bearer ${token('reviewer')}`)
      .expect(200).expect(res => expect(res.body.items).toEqual(['desk_est', 'desk_ouest']));
    const detail = await request(server).get(`/api/observations/${id}`).set('Authorization', `Bearer ${token('reviewer')}`).expect(200);
    const validation = { target_desks: ['desk_est'], _seq_no: detail.body._seq_no, _primary_term: detail.body._primary_term };
    await request(server).put(`/api/observations/${id}/validation`).set('Authorization', `Bearer ${token('reviewer')}`)
      .send(validation).expect(200);
    await request(server).put(`/api/observations/${id}/validation`).set('Authorization', `Bearer ${token('reviewer')}`)
      .send(validation).expect(409);
    await request(server).get(`/api/observations/${id}`).set('Authorization', `Bearer ${token('recipient')}`).expect(200);
    for (const account of ['outsider', 'creator', 'admin']) {
      await request(server).post('/api/observations/search').set('Authorization', `Bearer ${token(account)}`)
        .send({}).expect(201).expect(res => expect(res.body.count).toBe(0));
    }
    // Desk changes apply immediately, without waiting for JWT expiry.
    accounts.find(user => user._id === 'recipient')!.desk = 'desk_ouest';
    await request(server).get(`/api/observations/${id}`).set('Authorization', `Bearer ${token('recipient')}`).expect(403);
  });
});
