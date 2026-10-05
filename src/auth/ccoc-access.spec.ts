import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../app.module';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { Role } from '../common/constants/roles.constant';
import { UsersService } from '../users/users.service';

describe('CCOC access through authenticated API routes', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let profile: any;
  const service = {
    searchIntel: jest.fn().mockResolvedValue({ items: [] }),
    getIntelById: jest.fn().mockResolvedValue({ _id: 'test' }),
    saveIntel: jest.fn().mockResolvedValue({ id: 'test' }),
    deleteIntel: jest.fn().mockResolvedValue({ result: 'deleted' }),
    getIntelProvinces: jest.fn().mockResolvedValue([]),
    getIntelTerritoires: jest.fn().mockResolvedValue([]),
    getIntelDashboard: jest.fn().mockResolvedValue({ items: [] }),
    searchObservations: jest.fn().mockResolvedValue({ items: [] }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UsersService).useValue({ findById: () => Promise.resolve(profile) })
      .overrideProvider(ElasticsearchService).useValue(service).compile();
    app = module.createNestApplication({ logger: false });
    jwt = module.get(JwtService);
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { jest.clearAllMocks(); });

  it.each([
    [Role.ADMIN, '', true], [Role.ADMIN, 'desk_est', true],
    [Role.ANALYSTE, 'CCOC', true], [Role.ANALYSTE, ' ccoc ', true],
    [Role.ANALYSTE, 'desk_est', false], [Role.ANALYSTE, '', false],
    [Role.ANALYSTE, 'CCOC_EST', false], [Role.OFFICIER, 'CCOC', false],
    [Role.CONSEILLER, 'CCOC', false], [Role.COORDINATEUR, 'CCOC', false],
  ])('applies the rule to role %s and desk %s', async (role, desk, allowed) => {
    profile = { _id: 'user', role, desk, email: 'test@example.test', actif: true };
    const token = jwt.sign({ sub: 'user', email: 'test@example.test', role, desk });
    const calls: Array<['get' | 'post' | 'put', string]> = [
      ['get', '/api/intel'], ['post', '/api/intel/search'], ['get', '/api/intel/test'],
      ['post', '/api/intel'], ['put', '/api/intel/test'],
      ['get', '/api/intel-dashboard/provinces'],
      ['get', '/api/intel-dashboard/territoires?province=Test'],
      ['get', '/api/intel-dashboard/data'], ['post', '/api/intel-dashboard/data'],
    ];
    for (const [method, url] of calls) {
      await request(app.getHttpServer())[method](url)
        .set('Authorization', `Bearer ${token}`).send({})
        .expect(allowed ? (method === 'post' ? 201 : 200) : 403);
    }
    if (!allowed) {
      expect(service.searchIntel).not.toHaveBeenCalled();
      expect(service.saveIntel).not.toHaveBeenCalled();
      expect(service.getIntelDashboard).not.toHaveBeenCalled();
    }
    // This rule does not restrict the Informations module.
    await request(app.getHttpServer()).post('/api/observations/search')
      .set('Authorization', `Bearer ${token}`).send({}).expect(201);
  });

  it('keeps deleting CCOC records reserved for administrators', async () => {
    profile = { _id: 'user', role: Role.ANALYSTE, desk: 'CCOC', actif: true };
    const token = jwt.sign({ sub: 'user', role: Role.ANALYSTE, desk: 'CCOC' });
    await request(app.getHttpServer()).delete('/api/intel/test')
      .set('Authorization', `Bearer ${token}`).expect(403);
    expect(service.deleteIntel).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests before reaching the data service', async () => {
    await request(app.getHttpServer()).post('/api/intel/search').send({}).expect(401);
    expect(service.searchIntel).not.toHaveBeenCalled();
  });
});
