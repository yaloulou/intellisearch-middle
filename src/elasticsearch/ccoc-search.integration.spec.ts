import 'dotenv/config';
import { appConfig } from '../config/app.config';
import { Role } from '../common/constants/roles.constant';
import { ElasticsearchService } from './elasticsearch.service';

// Opt in with CCOC_SEARCH_INTEGRATION=1. Only synthetic documents are written,
// in a unique temporary index; the configured application's indexes stay intact.
const integration = process.env.CCOC_SEARCH_INTEGRATION === '1' ? describe : describe.skip;

integration('CCOC description search with the configured Elasticsearch analyzer', () => {
  const index = `codex_ccoc_search_test_${process.pid}_${Date.now()}`;
  const service = new ElasticsearchService();
  let created = false;
  let spy: jest.SpyInstance;

  async function request(path: string, method = 'GET', body?: unknown) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (appConfig.elasticsearch.username) {
      headers.Authorization = `Basic ${Buffer.from(`${appConfig.elasticsearch.username}:${appConfig.elasticsearch.password ?? ''}`).toString('base64')}`;
    }
    const response = await fetch(`${appConfig.elasticsearch.url}${path}`, {
      method, headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Elasticsearch ${response.status}: ${JSON.stringify(data.error)}`);
    return data;
  }

  beforeAll(async () => {
    const configuredIndex = appConfig.elasticsearch.indexes.intel;
    const mappings = await request(`/${configuredIndex}/_mapping`);
    const settings = await request(`/${configuredIndex}/_settings`);
    await request(`/${index}`, 'PUT', {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: settings[configuredIndex].settings.index.analysis,
      },
      mappings: mappings[configuredIndex].mappings,
    });
    created = true;
    const documents = [
      { id: 'near', description: 'Attaque ADF Beni.', date: '2026-01-01', owner: 'owner-a' },
      { id: 'far', description: `Attaque ${'rapport détaillé '.repeat(20)} ADF ${'rapport détaillé '.repeat(20)} Beni.`, date: '2026-10-31', owner: 'owner-b' },
      { id: 'reversed', description: 'Beni : ADF, attaque.', date: '2026-10-30', owner: 'owner-b' },
      { id: 'partial', description: 'Attaque à Beni.', date: '2026-10-29' },
      { id: 'similar', description: 'Attaque ADN Beni.', date: '2026-10-28' },
      { id: 'substring', description: 'Attaque XADFY Beni.', date: '2026-10-27' },
      { id: 'other-fields', description: 'Incident sans précision.', date: '2026-10-26', actor: 'ADF' },
      { id: 'fardc', description: 'Les FARDC effectuent des patrouilles.', date: '2026-10-25' },
      { id: 'pnc', description: 'La PNC effectue des patrouilles.', date: '2026-10-24' },
      { id: 'html', description: 'ADF <script>alert("test")</script> & rapport.', date: '2026-10-23' },
    ];
    for (const document of documents) {
      await request(`/${index}/_doc/${document.id}`, 'PUT', {
        event: { description: document.description, date_event: document.date, event_type: document.actor ?? 'incident' },
        location: { province_region: document.id === 'far' ? 'ituri' : 'nord-kivu', territoire_ville: 'beni' },
        owner_id: document.owner ?? 'owner-a',
        ...(document.actor ? { actors: [{ nom: document.actor }], source: { source_name: document.actor } } : {}),
      });
    }
    await request(`/${index}/_refresh`, 'POST');
    spy = jest.spyOn(service as any, 'requestToElasticsearch').mockImplementation((path: unknown, method: unknown, body: unknown) => {
      if (path !== `/${configuredIndex}/_search`) throw new Error('Unexpected integration test route');
      return request(`/${index}/_search`, String(method), body);
    });
  }, 30000);

  afterAll(async () => {
    spy?.mockRestore();
    if (created) await request(`/${index}`, 'DELETE');
  });

  it('requires every significant word and ranks close matches ahead of recent distant matches', async () => {
    const result = await service.searchIntel({ search: 'attaque ADF Beni' });
    expect(result.count).toBe(3);
    expect(result.items.map(item => item._id).sort()).toEqual(['far', 'near', 'reversed']);
    expect(result.items[0]._id).toBe('near');
  });

  it('matches ADF as an analyzed word, excluding similar terms, substrings and other fields', async () => {
    const result = await service.searchIntel({ search: 'adf' });
    expect(result.items.map(item => item._id).sort()).toEqual(['far', 'html', 'near', 'reversed']);
  });

  it.each([['fardc', 'fardc'], ['FARDC', 'fardc'], ['pnc', 'pnc'], ['PNC', 'pnc']])(
    'applies the same case-insensitive rule to %s without a list of acronyms', async (search, id) => {
      const result = await service.searchIntel({ search });
      expect(result.items.map(item => item._id)).toEqual([id]);
    },
  );

  it('keeps French inflections and ignores French connecting words', async () => {
    const result = await service.searchIntel({ search: 'les attaques des ADF à Beni' });
    expect(result.items.map(item => item._id).sort()).toEqual(['far', 'near', 'reversed']);
  });

  it('does not treat punctuation as query operators or expand a search with no results', async () => {
    expect((await service.searchIntel({ search: 'ADF | FARDC' })).count).toBe(0);
    expect((await service.searchIntel({ search: 'ADF -FARDC' })).count).toBe(0);
    expect((await service.searchIntel({ search: 'les de à' })).count).toBe(0);
    expect((await service.searchIntel({ search: 'termeinexistant' })).count).toBe(0);
  });

  it('keeps geographic, nature, date and ownership constraints when ranking by relevance', async () => {
    const result = await service.searchIntel({
      search: 'attaque ADF Beni', province_region: 'nord-kivu', territoire_ville: 'beni',
      event: 'incident', dateFrom: '2026-01-01', dateTo: '2026-10-31',
    }, { sub: 'owner-a', role: Role.OFFICIER } as any);
    expect(result.items.map(item => item._id)).toEqual(['near']);
    expect((await service.searchIntel({ search: 'ADF', province_region: 'ituri' })).items.map(item => item._id)).toEqual(['far']);
    expect((await service.searchIntel({ search: 'ADF', event: 'autre' })).count).toBe(0);
    expect((await service.searchIntel({ search: 'ADF', dateFrom: '2027-01-01' })).count).toBe(0);
  });

  it('returns escaped highlighted excerpts while preserving the full original description', async () => {
    const result = await service.searchIntel({ search: 'ADF' });
    const html = result.items.find(item => item._id === 'html')!;
    expect(html.event.description).toContain('<script>');
    expect(html.search_highlights?.join(' ')).toContain('<mark>ADF</mark>');
    expect(html.search_highlights?.join(' ')).toContain('&lt;script&gt;');
    expect(html.search_highlights?.join(' ')).not.toContain('<script>');
  });

  it('keeps date ordering and the original result shape when the search bar is empty', async () => {
    const result = await service.searchIntel({ search: '   ', size: 2 });
    expect(result.count).toBe(10);
    expect(result.items.map(item => item._id)).toEqual(['far', 'reversed']);
    expect(result.items[0]).not.toHaveProperty('search_highlights');
  });
});
