import {
  dashboardPeriod,
  dashboardRequest,
  dashboardResponse,
  intelImpactFilter,
} from './intel-dashboard';
import { ElasticsearchService } from './elasticsearch.service';

describe('CCOC dashboard periods and complete statistics', () => {
  const period = dashboardPeriod(
    { dateFrom: '2026-10-05', dateTo: '2026-11-03' },
    new Date('2026-11-03T10:00:00Z'),
  );

  it('compares equally long adjacent periods, including leap days', () => {
    expect(period).toMatchObject({
      days: 30,
      previous_from: '2026-09-05',
      previous_to: '2026-10-04',
      interval: 'day',
      includes_today: true,
    });
    expect(
      dashboardPeriod({ dateFrom: '2024-02-28', dateTo: '2024-03-01' }),
    ).toMatchObject({
      days: 3,
      previous_from: '2024-02-25',
      previous_to: '2024-02-27',
    });
  });

  it('uses Kinshasa calendar days and bounded adaptive intervals', () => {
    expect(dashboardPeriod({}, new Date('2026-11-02T23:30:00Z'))).toMatchObject(
      { from: '2026-10-05', to: '2026-11-03' },
    );
    expect(
      dashboardPeriod({ dateFrom: '2026-01-01', dateTo: '2026-04-01' })
        .interval,
    ).toBe('week');
    expect(
      dashboardPeriod({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })
        .interval,
    ).toBe('month');
  });

  it.each([
    { dateFrom: '2026-02-30', dateTo: '2026-03-02' },
    { dateFrom: '2026-11-04', dateTo: '2026-11-03' },
    { dateFrom: '2000-01-01', dateTo: '2026-11-03' },
    { dateTo: 42 },
    { province: ['bad'] },
  ])('rejects invalid dashboard filters with a client error: %j', (input) => {
    try {
      dashboardRequest(input as any);
      throw new Error('Expected a client error');
    } catch (error) {
      expect((error as any).getStatus()).toBe(400);
    }
  });

  it('gets all totals from aggregations rather than a limited list of hits', async () => {
    const service = new ElasticsearchService();
    const request = jest
      .spyOn(service as any, 'requestToElasticsearch')
      .mockResolvedValue({
        hits: { hits: [], total: { value: 10000, relation: 'gte' } },
        aggregations: {
          current: {
            doc_count: 12543,
            morts_civils: { value: 52 },
            morts_allies: { value: 3 },
            morts_ennemis: { value: 2 },
            blesses_civils: { value: 7 },
            enleves_disparus: { value: 4 },
            degat_batiments: { value: 9 },
            timeline: {
              buckets: [{ key: 1, key_as_string: '2026-10-05', doc_count: 0 }],
            },
            with_actor: { doc_count: 10000 },
            without_territory: { doc_count: 54 },
            latest: {
              hits: {
                hits: [
                  {
                    _id: 'one',
                    _source: { event: { description: 'Fiche fictive' } },
                  },
                ],
              },
            },
          },
          previous: { doc_count: 12000, morts_civils: { value: 42 } },
        },
      });
    const result = await service.getIntelDashboardSummary({
      province: 'Nord-Kivu',
      territoire: 'Beni',
      dateFrom: period.from,
      dateTo: period.to,
    });
    expect(result.totals).toMatchObject({
      incidents: 12543,
      deaths: 57,
      injured: 7,
      morts_civils: 52,
      degat_batiments: 9,
    });
    expect(result.previous).toMatchObject({
      incidents: 12000,
      morts_civils: 42,
    });
    expect(result.quality).toMatchObject({
      without_actor: 2543,
      without_territory: 54,
    });
    expect(result.timeline).toEqual([{ date: '2026-10-05', incidents: 0 }]);
    expect(result.latest).toHaveLength(1);
    const [path, method, body] = request.mock.calls[0] as [string, string, any];
    expect(path).toContain('allow_partial_search_results=false');
    expect(method).toBe('POST');
    expect(body.size).toBe(0);
    expect(body.query.bool.filter).toContainEqual({
      term: { 'location.territoire_ville': 'Beni' },
    });
    expect(body.aggs.current.filter.range['event.date_event']).toMatchObject({
      gte: period.from,
      lt: '2026-11-04',
      time_zone: 'Africa/Kinshasa',
    });
    request.mockRestore();
  });

  it('uses parent record counts for actors and keeps homonymous territories in separate provinces', () => {
    const result = dashboardResponse(
      {
        aggregations: {
          current: {
            doc_count: 4,
            actors: {
              names: {
                buckets: [
                  { key: 'Alpha', doc_count: 8, records: { doc_count: 2 } },
                  { key: 'Bravo', doc_count: 3, records: { doc_count: 3 } },
                ],
              },
            },
            territories: {
              buckets: [
                { key: ['Province A', 'Centre'], doc_count: 2 },
                { key: ['Province B', 'Centre'], doc_count: 2 },
              ],
            },
            natures: { buckets: [{ key: 'attaque', doc_count: 4 }] },
          },
          previous: {
            natures: { buckets: [{ key: 'enlèvement', doc_count: 2 }] },
          },
        },
      },
      period,
    );
    expect(result.actors).toEqual([
      { name: 'Bravo', incidents: 3 },
      { name: 'Alpha', incidents: 2 },
    ]);
    expect(result.territories.map((item) => item.province)).toEqual([
      'Province A',
      'Province B',
    ]);
    expect(result.natures).toContainEqual({
      name: 'enlèvement',
      incidents: 0,
      previous: 2,
    });
  });

  it('rejects partial Elasticsearch results rather than showing incomplete totals', () => {
    expect(() => dashboardResponse({ timed_out: true }, period)).toThrow(
      'incomplet',
    );
    expect(() => dashboardResponse({ _shards: { failed: 1 } }, period)).toThrow(
      'incomplet',
    );
    expect(dashboardResponse({}, period).totals.incidents).toBe(0);
  });

  it('rejects unknown impact filters and combines significant impact criteria with OR', () => {
    expect(() => intelImpactFilter('constructor')).toThrow('inconnu');
    expect(() => intelImpactFilter('unknown')).toThrow('inconnu');
    expect(intelImpactFilter('significant')).toEqual({
      bool: {
        should: [
          { range: { 'degats_humains.morts_civils': { gt: 0 } } },
          { range: { 'degats_humains.enleves_disparus': { gt: 0 } } },
        ],
        minimum_should_match: 1,
      },
    });
  });
});
