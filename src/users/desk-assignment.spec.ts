import { UsersService } from './users.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { TestElasticsearch } from '../elasticsearch/test-elasticsearch';
import { appConfig } from '../config/app.config';
import { Role } from '../common/constants/roles.constant';

describe('User desk assignment and observation distribution', () => {
  let users: UsersService;
  let observations: ElasticsearchService;
  let es: TestElasticsearch;
  let searchable: TestElasticsearch;
  const reviewer = { sub: 'reviewer', role: Role.COORDINATEUR, desk: 'cord_intel', email: 'reviewer@example.test' };
  const create = (role: Role, desk: string, email = 'new@example.test') => users.createUser({
    role, desk, email, password: 'test-password-only',
  });

  beforeEach(() => {
    users = new UsersService();
    observations = new ElasticsearchService();
    es = new TestElasticsearch();
    searchable = new TestElasticsearch();
    // GET is real-time in Elasticsearch; searches see only refreshed writes.
    // This catches confirmation of an assignment before it can appear in the desk list.
    const request = async (path: string, method: string, body?: unknown) => {
      const url = new URL(path, 'http://test');
      const [, index, operation] = url.pathname.split('/');
      if (index === appConfig.elasticsearch.indexes.users && operation === '_search') return searchable.request(path, method, body);
      const result = await es.request(path, method, body);
      if (index === appConfig.elasticsearch.indexes.users && method === 'POST' && url.searchParams.get('refresh') === 'wait_for') {
        searchable.documents = new Map([...es.documents].map(([key, value]) => [key, structuredClone(value)]));
      }
      return result;
    };
    jest.spyOn(users as any, 'esRequest').mockImplementation(request);
    jest.spyOn(observations as any, 'requestToElasticsearch').mockImplementation(request);
  });
  afterEach(() => jest.restoreAllMocks());

  it('makes a new analyst desk available immediately after creation and validates a distribution to it', async () => {
    const account = await create(Role.ANALYSTE, ' Desk_Nouveau ');
    expect(account.desk).toBe('Desk_Nouveau');
    expect((await users.findAll()).find(user => user._id === account._id)?.desk).toBe('Desk_Nouveau');
    expect(await observations.listObservationDesks(reviewer)).toEqual({ items: ['desk_nouveau'], eligible_desks: ['desk_nouveau'] });
    const created = await observations.saveObservation({ obs_type: 'autre', summary: 'À distribuer' }, undefined, reviewer);
    const current = await observations.getObservationById(created.id, reviewer);
    await observations.validateObservation(created.id, { target_desks: ['desk_nouveau'], _seq_no: current._seq_no, _primary_term: current._primary_term }, reviewer);
    const recipient = { ...reviewer, sub: account._id, role: account.role, desk: account.desk! };
    expect((await observations.getObservationById(created.id, recipient)).workflow?.status).toBe('validated');
  });

  it('lists desks assigned to other roles or disabled users without granting them distribution or read access', async () => {
    await create(Role.OFFICIER, 'desk_terrain', 'officer@example.test');
    const account = await create(Role.CONSEILLER, 'desk_inactif', 'adviser@example.test');
    await users.deactivateUser(account._id);
    expect(await observations.listObservationDesks(reviewer)).toEqual({ items: ['desk_inactif', 'desk_terrain'], eligible_desks: [] });
    const created = await observations.saveObservation({ obs_type: 'autre', summary: 'Privé' }, undefined, reviewer);
    const current = await observations.getObservationById(created.id, reviewer);
    await expect(observations.validateObservation(created.id, { target_desks: ['desk_terrain'], _seq_no: current._seq_no, _primary_term: current._primary_term }, reviewer)).rejects.toThrow('analyste ou conseiller actif');
    await expect(observations.getObservationById(created.id, { ...reviewer, sub: 'unrelated-officer', desk: 'desk_terrain' })).rejects.toThrow('Accès refusé');
  });

  it('immediately updates desk eligibility on reassignment and account reactivation', async () => {
    const account = await create(Role.CONSEILLER, 'desk_est');
    await create(Role.OFFICIER, 'desk_est', 'officer@example.test');
    await users.updateUser(account._id, { desk: ' desk_ouest ' });
    expect(await observations.listObservationDesks(reviewer)).toEqual({ items: ['desk_est', 'desk_ouest'], eligible_desks: ['desk_ouest'] });
    await users.deactivateUser(account._id);
    expect((await observations.listObservationDesks(reviewer)).eligible_desks).toEqual([]);
    await users.updateUser(account._id, { actif: true });
    expect((await observations.listObservationDesks(reviewer)).eligible_desks).toEqual(['desk_ouest']);
  });

  it('merges equivalent desk names and excludes blank names and cord_intel', async () => {
    await create(Role.COORDINATEUR, ' DESK_EST ', 'coordinator@example.test');
    await create(Role.ANALYSTE, 'desk_est', 'analyst@example.test');
    await create(Role.CONSEILLER, 'cord_intel', 'reviewer@example.test');
    await create(Role.ANALYSTE, '   ', 'blank@example.test');
    expect(await observations.listObservationDesks(reviewer)).toEqual({ items: ['desk_est'], eligible_desks: ['desk_est'] });
  });

  it('rejects structured desk values and permits clearing an assignment', async () => {
    await expect(create(Role.ANALYSTE, { text: 'desk_est' } as unknown as string)).rejects.toThrow('desk doit être un nom');
    const account = await create(Role.ANALYSTE, 'desk_est');
    await users.updateUser(account._id, { desk: '' });
    expect(await observations.listObservationDesks(reviewer)).toEqual({ items: [], eligible_desks: [] });
  });
});
