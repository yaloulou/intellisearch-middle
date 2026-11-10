import { ElasticsearchService } from './elasticsearch.service';
import { dashboardRequest } from './intel-dashboard';

const integration =
  process.env.CCOC_DASHBOARD_INTEGRATION === '1' ? describe : describe.skip;
integration(
  'CCOC statistics on an isolated Elasticsearch index with more than 10000 records',
  () => {
    const base = process.env.DASHBOARD_TEST_URL!;
    const index = `codex_dashboard_test_${process.pid}_${Date.now()}`;
    const service = new ElasticsearchService();
    let created = false;
    let spy: jest.SpyInstance;
    const period = { dateFrom: '2026-10-01', dateTo: '2026-10-03' };
    async function request(
      path: string,
      method = 'GET',
      body?: unknown,
      ndjson = false,
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': ndjson ? 'application/x-ndjson' : 'application/json',
        },
        ...(body === undefined
          ? {}
          : { body: ndjson ? String(body) : JSON.stringify(body) }),
        signal: AbortSignal.timeout(30000),
      });
      const value = await response.json();
      if (!response.ok || value.errors)
        throw new Error(JSON.stringify(value.error ?? value));
      return value;
    }
    beforeAll(async () => {
      if (!base || !/^https?:\/\//.test(base))
        throw new Error(
          'Set DASHBOARD_TEST_URL explicitly for this integration test',
        );
      const numeric = (names: string[]) =>
        Object.fromEntries(names.map((name) => [name, { type: 'long' }]));
      await request(`/${index}`, 'PUT', {
        settings: {
          number_of_shards: 2,
          number_of_replicas: 0,
          analysis: {
            normalizer: { lc: { type: 'custom', filter: ['lowercase'] } },
            analyzer: { fr_text: { type: 'french' } },
          },
        },
        mappings: {
          dynamic: 'strict',
          properties: {
            event: {
              properties: {
                date_event: {
                  type: 'date',
                  format: 'yyyy-MM-dd||strict_date_optional_time',
                },
                event_type: { type: 'keyword', normalizer: 'lc' },
                description: { type: 'text', analyzer: 'fr_text' },
              },
            },
            location: {
              properties: {
                province_region: { type: 'keyword', normalizer: 'lc' },
                territoire_ville: { type: 'keyword', normalizer: 'lc' },
                geo: { type: 'geo_point' },
                latitude: { type: 'double' },
                longitude: { type: 'double' },
              },
            },
            actors: {
              type: 'nested',
              properties: { nom: { type: 'keyword', normalizer: 'lc' } },
            },
            degats_humains: {
              properties: numeric([
                'morts_civils',
                'morts_allies',
                'morts_ennemis',
                'blesses_civils',
                'blesses_allies',
                'blesses_ennemis',
                'enleves_disparus',
                'expulses',
                'arrestations_interpellations',
                'violences_sexuelles',
              ]),
            },
            degats_materiels: {
              properties: numeric([
                'degat_batiments',
                'degat_vehicules',
                'degat_infrastructures',
              ]),
            },
            audit: { properties: { updated_at: { type: 'date' } } },
          },
        },
      });
      created = true;
      const document = (
        date: string,
        deaths = 0,
        missing = 0,
        province = 'Province A',
      ) => ({
        event: {
          date_event: date,
          event_type: 'Attaque',
          description: 'Fait fictif de validation',
        },
        location: { province_region: province, territoire_ville: 'Centre' },
        actors: [{ nom: 'Alpha' }],
        degats_humains: { morts_civils: deaths, enleves_disparus: missing },
        audit: { updated_at: '2026-10-04T08:00:00Z' },
      });
      for (let start = 0; start < 10020; start += 1000) {
        const lines: string[] = [];
        for (let i = start; i < Math.min(start + 1000, 10020); i++) {
          const source: any = document(
            '2026-10-01',
            i === 0 ? 3 : 0,
            i === 0 ? 1 : 0,
          );
          if (i === 0) {
            source.actors.push({ nom: 'ALPHA' });
            source.location.geo = { lat: 0, lon: 20 };
            source.degats_humains.blesses_civils = 2;
            source.degats_materiels = { degat_batiments: 2 };
          }
          lines.push(
            JSON.stringify({ index: { _index: index, _id: `bulk-${i}` } }),
            JSON.stringify(source),
          );
        }
        await request('/_bulk', 'POST', lines.join('\n') + '\n', true);
      }
      await request(`/${index}/_doc/late`, 'PUT', {
        ...document('2026-10-03T22:59:59Z', 2, 4),
        actors: [{ nom: 'Bravo' }],
      });
      const otherProvince = document('2026-10-01', 1, 0, 'Province B');
      await request(`/${index}/_doc/other-province`, 'PUT', {
        ...otherProvince,
        actors: [{ nom: 'Bravo' }],
        location: { ...otherProvince.location, latitude: 0, longitude: 20 },
      });
      await request(`/${index}/_doc/no-metadata`, 'PUT', {
        event: {
          date_event: '2026-10-02',
          event_type: 'Autre',
          description: 'Données incomplètes fictives',
        },
      });
      await request(
        `/${index}/_doc/previous-1`,
        'PUT',
        document('2026-09-29', 2),
      );
      await request(
        `/${index}/_doc/previous-2`,
        'PUT',
        document('2026-09-30', 1),
      );
      await request(
        `/${index}/_doc/outside`,
        'PUT',
        document('2026-10-03T23:00:00Z', 100),
      );
      await request(`/${index}/_refresh`, 'POST');
      spy = jest
        .spyOn(service as any, 'requestToElasticsearch')
        .mockImplementation((_path: unknown, method: unknown, body: unknown) =>
          request(
            `/${index}/_search?allow_partial_search_results=false`,
            String(method),
            body,
          ),
        );
    }, 120000);
    afterAll(async () => {
      spy?.mockRestore();
      if (created) await request(`/${index}`, 'DELETE');
    });

    it('includes every matching record, respects the last local day, and compares equal preceding days', async () => {
      const result = await service.getIntelDashboardSummary(period);
      expect(result.totals).toMatchObject({
        incidents: 10023,
        morts_civils: 6,
        injured: 2,
        enleves_disparus: 5,
        degat_batiments: 2,
      });
      expect(result.previous).toMatchObject({ incidents: 2, morts_civils: 3 });
      expect(result.latest).toHaveLength(6);
      expect(result.significant).toHaveLength(3);
      expect(result.significant[0]._id).toBe('bulk-0');
      expect(
        result.actors.find((actor) => actor.name === 'alpha')?.incidents,
      ).toBe(10020);
      expect(result.quality).toMatchObject({
        without_actor: 1,
        without_territory: 1,
        without_province: 1,
        without_coordinates: 10021,
        actors_truncated: false,
        breakdowns_approximate: false,
      });
      expect(result.territories).toHaveLength(2);
      expect(result.timeline).toEqual([
        { date: '2026-10-01', incidents: 10021 },
        { date: '2026-10-02', incidents: 1 },
        { date: '2026-10-03', incidents: 1 },
      ]);
    });
    it('applies geography to both periods and keeps homonymous territories separate', async () => {
      const result = await service.getIntelDashboardSummary({
        ...period,
        province: 'province a',
        territoire: 'centre',
      });
      expect(result.totals.incidents).toBe(10021);
      expect(result.previous.incidents).toBe(2);
      expect(result.territories.map((item) => item.province)).toEqual([
        'province a',
      ]);
    });
    it('emits zero days, week and month buckets without truncating the chosen time range', async () => {
      for (const [from, to, interval] of [
        ['2026-10-01', '2026-10-05', 'day'],
        ['2026-08-01', '2026-11-03', 'week'],
        ['2026-01-01', '2026-12-31', 'month'],
      ]) {
        const result = await service.getIntelDashboardSummary({
          dateFrom: from,
          dateTo: to,
        });
        expect(result.period.interval).toBe(interval);
        expect(
          result.timeline.reduce((sum, item) => sum + item.incidents, 0),
        ).toBe(result.totals.incidents);
        expect(result.timeline.some((item) => item.incidents === 0)).toBe(true);
      }
    });
    it('builds valid aggregation queries for the supported Elasticsearch schema', async () => {
      const { body } = dashboardRequest(period);
      expect(body.size).toBe(0);
      expect(
        (await request(`/${index}/_search`, 'POST', body)).aggregations.current
          .doc_count,
      ).toBe(10023);
    });
    it('opens matching records with exact actor, impact and inclusive local-day filters', async () => {
      expect(
        (
          await service.searchIntel({
            ...period,
            actor: 'ALPHA',
            impact: 'civilian_deaths',
          })
        ).items.map((item) => item._id),
      ).toEqual(['bulk-0']);
      expect(
        (await service.searchIntel({ ...period, impact: 'significant' })).count,
      ).toBe(3);
      expect(
        (
          await service.searchIntel({ ...period, dateFrom: '2026-10-03' })
        ).items.map((item) => item._id),
      ).toEqual(['late']);
      expect((await service.searchIntel({ ...period, size: 1 })).count).toBe(
        10023,
      );
    });
  },
);
