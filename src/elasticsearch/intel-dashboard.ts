import { HttpException, HttpStatus } from '@nestjs/common';

type Query = Record<string, unknown>;
export interface DashboardInput {
  province?: string;
  territoire?: string;
  dateFrom?: string;
  dateTo?: string;
}
const DAY = 86400000;
const ZONE = 'Africa/Kinshasa';
export const humanFields = [
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
] as const;
export const materialFields = [
  'degat_vehicules',
  'degat_batiments',
  'degat_infrastructures',
] as const;
const dayString = (time: number) => new Date(time).toISOString().slice(0, 10);
const shift = (day: string, days: number) =>
  dayString(Date.parse(day) + days * DAY);
function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string')
    throw new HttpException(
      'Les filtres du tableau de bord doivent être du texte.',
      HttpStatus.BAD_REQUEST,
    );
  return value.trim();
}
export const dashboardToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export function dashboardPeriod(input: DashboardInput, now = new Date()) {
  const validate = (value: string) => {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      dayString(Date.parse(value)) !== value
    ) {
      throw new HttpException(
        'Choisissez une date valide au format AAAA-MM-JJ.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return value;
  };
  const to = validate(text(input.dateTo) || dashboardToday(now));
  const from = validate(text(input.dateFrom) || shift(to, -29));
  const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
  if (days < 1 || days > 3660)
    throw new HttpException(
      'Choisissez une période ordonnée de dix ans maximum.',
      HttpStatus.BAD_REQUEST,
    );
  return {
    from,
    to,
    days,
    previous_from: shift(from, -days),
    previous_to: shift(from, -1),
    interval: days <= 45 ? 'day' : days <= 210 ? 'week' : 'month',
    time_zone: ZONE,
    includes_today: from <= dashboardToday(now) && to >= dashboardToday(now),
  };
}

const periodFilter = (from: string, to: string): Query => ({
  range: {
    'event.date_event': { gte: from, lt: shift(to, 1), time_zone: ZONE },
  },
});
const sum = (field: string): Query => ({ sum: { field } });
const totals = () =>
  Object.fromEntries([
    ...humanFields.map((field) => [field, sum(`degats_humains.${field}`)]),
    ...materialFields.map((field) => [field, sum(`degats_materiels.${field}`)]),
  ]);
const missing = (field: string): Query => ({
  bool: {
    should: [
      { bool: { must_not: [{ exists: { field } }] } },
      { term: { [field]: '' } },
    ],
    minimum_should_match: 1,
  },
});
const actorExists: Query = {
  nested: {
    path: 'actors',
    query: {
      bool: {
        filter: [{ exists: { field: 'actors.nom' } }],
        must_not: [{ term: { 'actors.nom': '' } }],
      },
    },
  },
};
const source = [
  'event',
  'location.province_region',
  'location.territoire_ville',
  'degats_humains',
  'degats_materiels',
];
const natures = (): Query => ({
  terms: {
    field: 'event.event_type',
    size: 1000,
    shard_size: 4000,
    exclude: '',
  },
});

export function dashboardRequest(input: DashboardInput, now = new Date()) {
  const period = dashboardPeriod(input, now);
  const filter: Query[] = [];
  const province = text(input.province),
    territoire = text(input.territoire);
  if (province) filter.push({ term: { 'location.province_region': province } });
  if (territoire)
    filter.push({ term: { 'location.territoire_ville': territoire } });
  filter.push(periodFilter(period.previous_from, period.to));
  return {
    period,
    body: {
      size: 0,
      query: filter.length ? { bool: { filter } } : { match_all: {} },
      aggs: {
        current: {
          filter: periodFilter(period.from, period.to),
          aggs: {
            ...totals(),
            provinces: {
              terms: {
                field: 'location.province_region',
                size: 12,
                shard_size: 4000,
                exclude: '',
              },
            },
            territories: {
              multi_terms: {
                terms: [
                  { field: 'location.province_region' },
                  { field: 'location.territoire_ville' },
                ],
                size: 12,
                shard_size: 4000,
              },
              aggs: {
                civilian_deaths: sum('degats_humains.morts_civils'),
                missing: sum('degats_humains.enleves_disparus'),
              },
            },
            natures: natures(),
            timeline: {
              date_histogram: {
                field: 'event.date_event',
                calendar_interval: period.interval,
                time_zone: ZONE,
                min_doc_count: 0,
                extended_bounds: { min: period.from, max: period.to },
                format: 'yyyy-MM-dd',
              },
            },
            actors: {
              nested: { path: 'actors' },
              aggs: {
                names: {
                  terms: {
                    field: 'actors.nom',
                    size: 1000,
                    shard_size: 4000,
                    exclude: '',
                  },
                  aggs: { records: { reverse_nested: {} } },
                },
              },
            },
            with_actor: { filter: actorExists },
            without_territory: { filter: missing('location.territoire_ville') },
            without_province: { filter: missing('location.province_region') },
            without_coordinates: {
              filter: {
                bool: {
                  must_not: [
                    {
                      bool: {
                        should: [
                          { exists: { field: 'location.geo' } },
                          {
                            bool: {
                              filter: [
                                {
                                  range: {
                                    'location.latitude': { gte: -90, lte: 90 },
                                  },
                                },
                                {
                                  range: {
                                    'location.longitude': {
                                      gte: -180,
                                      lte: 180,
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        ],
                        minimum_should_match: 1,
                      },
                    },
                  ],
                },
              },
            },
            latest_update: { max: { field: 'audit.updated_at' } },
            latest: {
              top_hits: {
                size: 6,
                sort: [{ 'event.date_event': 'desc' }],
                _source: source,
              },
            },
            impact: {
              filter: {
                bool: {
                  should: [
                    { range: { 'degats_humains.morts_civils': { gt: 0 } } },
                    { range: { 'degats_humains.enleves_disparus': { gt: 0 } } },
                  ],
                  minimum_should_match: 1,
                },
              },
              aggs: {
                records: {
                  top_hits: {
                    size: 5,
                    sort: [
                      {
                        'degats_humains.morts_civils': {
                          order: 'desc',
                          missing: '_last',
                        },
                      },
                      {
                        'degats_humains.enleves_disparus': {
                          order: 'desc',
                          missing: '_last',
                        },
                      },
                      { 'event.date_event': 'desc' },
                    ],
                    _source: source,
                  },
                },
              },
            },
          },
        },
        previous: {
          filter: periodFilter(period.previous_from, period.previous_to),
          aggs: { ...totals(), natures: natures() },
        },
      },
    },
  };
}

// The response is decoded at the Elasticsearch boundary; unknown aggregation
// names and absent optional metrics fall back to empty lists or zero sums.
type Agg = {
  doc_count?: number;
  value?: number | null;
  value_as_string?: string;
  sum_other_doc_count?: number;
  doc_count_error_upper_bound?: number;
  buckets?: Bucket[];
  hits?: { hits?: Array<{ _id: string; _source?: Query }> };
  [name: string]: unknown;
};
type Bucket = Agg & { key: string | string[]; key_as_string?: string };
const agg = (value: unknown): Agg =>
  value && typeof value === 'object' ? (value as Agg) : {};
const count = (value: unknown) => agg(value).doc_count ?? 0;
const value = (input: unknown) => agg(input).value ?? 0;
const buckets = (input: unknown) => agg(input).buckets ?? [];
const hits = (input: unknown) =>
  (agg(input).hits?.hits ?? []).map((hit) => ({
    ...hit._source,
    _id: hit._id,
  }));
const numericTotals = (input: Agg) => ({
  incidents: input.doc_count ?? 0,
  ...Object.fromEntries(
    [...humanFields, ...materialFields].map((field) => [
      field,
      value(input[field]),
    ]),
  ),
  deaths:
    value(input.morts_civils) +
    value(input.morts_allies) +
    value(input.morts_ennemis),
  injured:
    value(input.blesses_civils) +
    value(input.blesses_allies) +
    value(input.blesses_ennemis),
});

export function dashboardResponse(
  raw: {
    aggregations?: Record<string, unknown>;
    timed_out?: boolean;
    _shards?: { failed?: number };
  },
  period: ReturnType<typeof dashboardPeriod>,
  generated = new Date(),
) {
  if (raw.timed_out || (raw._shards?.failed ?? 0) > 0)
    throw new HttpException(
      'Le calcul du tableau de bord est incomplet. Réessayez.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  const current = agg(raw.aggregations?.current),
    previous = agg(raw.aggregations?.previous);
  const oldNatures = new Map(
    buckets(previous.natures).map((bucket) => [
      String(bucket.key),
      bucket.doc_count ?? 0,
    ]),
  );
  const currentNatures = new Map(
    buckets(current.natures).map((bucket) => [
      String(bucket.key),
      bucket.doc_count ?? 0,
    ]),
  );
  const actors = agg(agg(current.actors).names);
  return {
    period,
    generated_at: generated.toISOString(),
    totals: numericTotals(current),
    previous: numericTotals(previous),
    provinces: buckets(current.provinces).map((bucket) => ({
      name: String(bucket.key),
      incidents: bucket.doc_count ?? 0,
    })),
    territories: buckets(current.territories)
      .filter(
        (bucket) => Array.isArray(bucket.key) && bucket.key.every(Boolean),
      )
      .map((bucket) => ({
        province: String(bucket.key[0]),
        name: String(bucket.key[1]),
        incidents: bucket.doc_count ?? 0,
        civilian_deaths: value(bucket.civilian_deaths),
        missing: value(bucket.missing),
      })),
    natures: [...new Set([...currentNatures.keys(), ...oldNatures.keys()])]
      .map((name) => ({
        name,
        incidents: currentNatures.get(name) ?? 0,
        previous: oldNatures.get(name) ?? 0,
      }))
      .sort(
        (a, b) => b.incidents - a.incidents || a.name.localeCompare(b.name),
      ),
    timeline: buckets(current.timeline).map((bucket) => ({
      date: bucket.key_as_string ?? String(bucket.key),
      incidents: bucket.doc_count ?? 0,
    })),
    actors: buckets(actors)
      .map((bucket) => ({
        name: String(bucket.key),
        incidents: count(bucket.records),
      }))
      .sort((a, b) => b.incidents - a.incidents || a.name.localeCompare(b.name))
      .slice(0, 8),
    quality: {
      without_territory: count(current.without_territory),
      without_province: count(current.without_province),
      without_coordinates: count(current.without_coordinates),
      without_actor: Math.max(0, count(current) - count(current.with_actor)),
      latest_update: agg(current.latest_update).value
        ? new Date(value(current.latest_update)).toISOString()
        : null,
      breakdowns_approximate: [
        current.provinces,
        current.territories,
        current.natures,
        previous.natures,
        actors,
      ].some((item) => (agg(item).doc_count_error_upper_bound ?? 0) !== 0),
      actors_truncated: (actors.sum_other_doc_count ?? 0) > 0,
    },
    latest: hits(current.latest),
    significant: hits(agg(current.impact).records),
  };
}

export function intelImpactFilter(impact?: string): Query | undefined {
  const fields: Record<string, string[]> = {
    civilian_deaths: ['morts_civils'],
    deaths: ['morts_civils', 'morts_allies', 'morts_ennemis'],
    injured: ['blesses_civils', 'blesses_allies', 'blesses_ennemis'],
    missing: ['enleves_disparus'],
    significant: ['morts_civils', 'enleves_disparus'],
  };
  if (!impact) return undefined;
  if (typeof impact !== 'string' || !Object.hasOwn(fields, impact))
    throw new HttpException('Filtre de bilan inconnu.', HttpStatus.BAD_REQUEST);
  return {
    bool: {
      should: fields[impact].map((field) => ({
        range: { [`degats_humains.${field}`]: { gt: 0 } },
      })),
      minimum_should_match: 1,
    },
  };
}
