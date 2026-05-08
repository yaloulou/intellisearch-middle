import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Role } from '../common/constants/roles.constant';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

type UnknownRecord = Record<string, unknown>;

interface ElasticsearchHit<TSource> {
  _id: string;
  _source: TSource;
}

interface ElasticsearchSearchResponse<TSource> {
  hits?: {
    total?: {
      value?: number;
    };
    hits?: Array<ElasticsearchHit<TSource>>;
  };
}

interface ElasticsearchDocumentResponse<TSource> {
  _id: string;
  _source?: TSource;
  result?: string;
  found?: boolean;
}

interface ElasticsearchAggBucket {
  key: string;
  doc_count: number;
}

interface ElasticsearchAggregationResponse {
  hits?: {
    total?: { value?: number };
    hits?: Array<{ _id: string; _source: Record<string, unknown> }>;
  };
  aggregations?: Record<string, { buckets?: ElasticsearchAggBucket[] }>;
}

interface EntityDocument {
  entity_type?: string;
  name?: string;
  aliases?: string[];
  attributes?: {
    person?: {
      sexe?: string;
      naissance?: string | null;
      lieu_nais?: string;
      etat_civil?: string;
      profession?: string;
      nom_pere?: string;
      nom_mere?: string;
    };
    organisation?: {
      type_org?: string;
      secteur_activite?: string;
      pays_enregistrement?: string;
      date_creation?: string | null;
      parent_entity_id?: string;
    };
    lieu?: {
      type_lieu?: string;
      province?: string;
      territoire?: string;
      geo?: { lat: number; lon: number } | null;
    };
  };
  identifiers?: Array<{ id_type: string; id_value: string; country?: string }>;
  contacts?: Array<{ type: string; value: string; valid_from?: string | null; valid_to?: string | null }>;
  locations?: Array<{
    role?: string;
    address?: string;
    province?: string;
    territoire?: string;
    groupement?: string;
    secteur?: string;
    geo?: { lat: number; lon: number } | null;
    valid_from?: string | null;
    valid_to?: string | null;
  }>;
  media_refs?: Array<{ doc_id: string; media_type?: string; role?: string }>;
  risk?: {
    risk_score?: number | null;
    risk_level?: string;
    watchlist?: boolean;
  };
  status?: string;
  labels?: string[];
  tags?: string[];
  classification?: {
    level?: string;
    compartments?: string[];
  };
  audit?: {
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string;
    updated_by?: string;
  };
}

interface LinkDocument {
  from_entity?: string;
  to_entity?: string;
  link_type?: string;
  role_from?: string;
  role_to?: string;
  time?: {
    start?: string | null;
    end?: string | null;
  };
  source?: {
    source_type?: string;
    source_name?: string;
    source_ref?: string;
    collector?: string;
    unit?: string;
    collection_method?: string;
  };
  evaluation?: {
    confidence?: number;
    source_reliability?: string;
    info_credibility?: string;
  };
  notes?: string;
  tags?: string[];
  classification?: {
    level?: string;
    compartments?: string[];
  };
  audit?: {
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string;
    updated_by?: string;
  };
  owner_id?: string;
}

interface IntelIncidentDocument {
  location: {
    province_region: string;
    territoire_ville: string;
    secteur_chefferie_commune?: string;
    groupement_quartier?: string;
    localite_village_lieuprecis: string;
    latitude?: number | null;
    longitude?: number | null;
    pays: string;
    geo?: { lat: number; lon: number } | null;
    geoprecision?: string;
  };
  event: {
    date_event: string;
    event_type: string;
    categorie?: string;
    description: string;
  };
  actors?: Array<{ nom: string; role?: string; assoc?: string }>;
  source?: {
    source_type?: string;
    source_name?: string;
    source_ref?: string;
  };
  degats_humains: {
    morts: number;
    blesses: number;
    enleves_disparus: number;
    expulses: number;
  };
  degats_materiels: {
    degat_vehicules: number;
    degat_batiments: number;
    degat_infrastructures: number;
    autres_degats: string;
  };
  classification?: {
    level?: string;
    compartments?: string[];
  };
  audit?: {
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string;
    updated_by?: string;
  };
  owner_id?: string;
  desk?: string;
}

export interface SearchEntitiesInput {
  query?: string;
  q?: string;
  size?: number;
}

export interface SearchLinksInput {
  linkType?: string;
  selectedLinkType?: string;
  fromEntity?: string;
  selectedFromEntity?: string;
  toEntity?: string;
  selectedToEntity?: string;
  search?: string;
  size?: number;
}

export interface SearchIntelInput {
  search?: string;
  province_region?: string;
  territoire_ville?: string;
  event?: string;
  dateFrom?: string;
  dateTo?: string;
  size?: number;
}

export interface IntelDashboardInput {
  province?: string;
  territoire?: string;
  dateFrom?: string;
  dateTo?: string;
  size?: number;
}

export interface SearchObservationsInput {
  search?: string;
  obs_type?: string;
  source_reliability?: string;
  dateFrom?: string;
  dateTo?: string;
  size?: number;
}

export interface SearchEventsInput {
  search?: string;
  event_type?: string;
  classification_level?: string;
  dateFrom?: string;
  dateTo?: string;
  size?: number;
}

export interface SearchDocumentsInput {
  search?: string;
  doc_type?: string;
  dateFrom?: string;
  dateTo?: string;
  size?: number;
}

interface EventDocument {
  title: string;
  description: string;
  event_type: string;
  time: {
    start: string;
    end: string;
  };
  location: {
    province: string;
    territoire: string;
    address: string;
    groupement?: string;
    secteur?: string;
    geo: { lat: number; lon: number };
  };
  impact: {
    morts: number;
    blesses: number;
    enleves_disparus: number;
    expulses: number;
    degat_vehicules: number;
    degat_batiments: number;
    degat_infrastructures: number;
    autres_degats: string;
  };
  participants: Array<{ entity_id: string; role: string }>;
  source?: {
    source_type?: string;
    source_name?: string;
    source_ref?: string;
    collector?: string;
    unit?: string;
    collection_method?: string;
  };
  evaluation?: {
    source_reliability?: string;
    info_credibility?: string;
    confidence?: number;
  };
  tags: string[];
  classification: {
    level: string;
    compartments: string[];
  };
  audit?: {
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string;
    updated_by?: string;
  };
  owner_id?: string;
}

interface DocumentDocument {
  title?: string;
  doc_type?: string;
  origin?: {
    source_type?: string;
    source_name?: string;
    source_ref?: string;
  };
  file?: {
    sha256?: string;
    mime?: string;
    path?: string;
    url?: string;
  };
  extracted_text?: string;
  tags?: string[];
  classification?: {
    level?: string;
    compartments?: string[];
  };
  audit?: {
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string;
    updated_by?: string;
  };
}

interface ObservationDocument {
  obs_type: string;
  summary: string;
  entity_refs: Array<{ entity_id: string; role: string }>;
  event_ref?: string;
  time: {
    observed_at: string;
    reported_at: string;
  };
  location: {
    address: string;
    province: string;
    territoire: string;
    groupement?: string;
    secteur?: string;
    geo?: { lat: number; lon: number } | null;
  };
  source: {
    source_type: string;
    source_name: string;
    source_ref: string;
    collector: string;
    unit: string;
    collection_method: string;
  };
  evaluation: {
    source_reliability: string;
    info_credibility: string;
    confidence: number;
  };
  evidence?: Array<{ doc_id: string; type?: string; sha256?: string }>;
  tags?: string[];
  classification?: {
    level?: string;
    compartments?: string[];
  };
  audit?: {
    created_at?: string | null;
    created_by?: string;
    updated_at?: string | null;
    updated_by?: string;
  };
  owner_id?: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class ElasticsearchService {
  private readonly esBaseUrl = (process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200').replace(/\/+$/, '');
  private readonly esUsername = process.env.ELASTICSEARCH_USERNAME;
  private readonly esPassword = process.env.ELASTICSEARCH_PASSWORD;
  private readonly linksIndex = process.env.ELASTICSEARCH_INDEX_LINKS ?? 'links_v1';
  private readonly entitiesIndex = process.env.ELASTICSEARCH_INDEX_ENTITIES ?? 'entities_v1';
  private readonly intelIndex = process.env.ELASTICSEARCH_INDEX_INTEL ?? 'intel_v1';
  private readonly observationsIndex = process.env.ELASTICSEARCH_INDEX_OBSERVATIONS ?? 'observations_v1';
  private readonly eventsIndex = process.env.ELASTICSEARCH_INDEX_EVENTS ?? 'events_v1';
  private readonly documentsIndex = process.env.ELASTICSEARCH_INDEX_DOCUMENTS ?? 'documents_v1';

  async searchEntities(input: SearchEntitiesInput) {
    const queryText = this.normalizeString(input.query ?? input.q);
    if (!queryText) {
      return {
        count: 0,
        items: [],
      };
    }

    const size = this.resolveSize(input.size, 20, 100);
    const body = {
      query: {
        bool: {
          should: [
            {
              match: {
                name: {
                  query: queryText,
                  fuzziness: 'AUTO',
                },
              },
            },
            {
              match: {
                aliases: {
                  query: queryText,
                  fuzziness: 'AUTO',
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      size,
      _source: ['name', 'entity_type', 'entity_id', 'aliases'],
    };

    const response = await this.requestToElasticsearch<ElasticsearchSearchResponse<EntityDocument>>(
      `/${this.entitiesIndex}/_search`,
      'POST',
      body,
    );

    const hits = response.hits?.hits ?? [];

    return {
      count: response.hits?.total?.value ?? hits.length,
      items: hits.map((hit) => ({
        id: hit._id,
        value: hit._id,
        text: hit._source?.name ?? 'Sans nom',
        name: hit._source?.name ?? 'Sans nom',
        entity_type: hit._source?.entity_type ?? 'unknown',
        aliases: hit._source?.aliases ?? [],
      })),
    };
  }

  async getEntityById(id: string) {
    const entityId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<EntityDocument>>(
      `/${this.entitiesIndex}/_doc/${encodeURIComponent(entityId)}`,
      'GET',
    );

    if (response.found === false) {
      throw new HttpException('Entité introuvable', HttpStatus.NOT_FOUND);
    }

    return {
      id: response._id,
      ...(response._source ?? {}),
    };
  }

  async saveEntity(payload: UnknownRecord, documentId?: string) {
    const normalizedPayload = this.buildEntityPayload(payload);
    const explicitId = this.normalizeString(documentId);
    const payloadId = this.normalizeString((payload._id as string | undefined) ?? undefined);
    const entityId = explicitId ?? payloadId ?? this.generateEntityId();

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<EntityDocument>>(
      `/${this.entitiesIndex}/_doc/${encodeURIComponent(entityId)}`,
      'POST',
      normalizedPayload,
    );

    return {
      _id: response._id ?? entityId,
      id: response._id ?? entityId,
      result: response.result ?? 'updated',
      item: {
        ...normalizedPayload,
        _id: response._id ?? entityId,
      },
    };
  }

  async deleteEntity(id: string) {
    const entityId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<unknown>>(
      `/${this.entitiesIndex}/_doc/${encodeURIComponent(entityId)}`,
      'DELETE',
    );

    return {
      id: response._id ?? entityId,
      result: response.result ?? 'deleted',
    };
  }

  async searchLinks(input: SearchLinksInput, user?: JwtPayload) {
    const linkType = this.normalizeString(input.linkType ?? input.selectedLinkType);
    const fromEntity = this.normalizeString(input.fromEntity ?? input.selectedFromEntity);
    const toEntity = this.normalizeString(input.toEntity ?? input.selectedToEntity);
    const textSearch = this.normalizeString(input.search);
    const size = this.resolveSize(input.size, 500, 1000);

    const must: UnknownRecord[] = [];
    const filters: UnknownRecord[] = [];

    if (linkType) {
      must.push({ term: { link_type: linkType } });
    }

    if (fromEntity) {
      must.push({ term: { from_entity: fromEntity } });
    }

    if (toEntity) {
      must.push({ term: { to_entity: toEntity } });
    }

    if (textSearch) {
      must.push({
        multi_match: {
          query: textSearch,
          fields: ['notes^2', 'link_type', 'role_from', 'role_to'],
          fuzziness: 'AUTO',
        },
      });
    }

    // ── Permission-level data filtering ─────────────────────────────
    if (user?.role === Role.ANALYSTE) {
      filters.push({ term: { owner_id: user.sub } });
    }

    const hasFilter = filters.length > 0;
    const query: UnknownRecord = must.length > 0 || hasFilter
      ? { bool: { ...(must.length > 0 ? { must } : {}), ...(hasFilter ? { filter: filters } : {}) } }
      : { match_all: {} };

    const body: UnknownRecord = {
      query,
      sort: [{ 'time.start': { order: 'desc' } }],
      size,
    };

    const response = await this.requestToElasticsearch<ElasticsearchSearchResponse<LinkDocument>>(
      `/${this.linksIndex}/_search`,
      'POST',
      body,
    );

    const hits = response.hits?.hits ?? [];

    return {
      count: response.hits?.total?.value ?? hits.length,
      items: hits.map((hit) => ({
        ...(hit._source ?? {}),
        _id: hit._id,
      })),
    };
  }

  async getLinkById(id: string, user?: JwtPayload) {
    const linkId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<LinkDocument>>(
      `/${this.linksIndex}/_doc/${encodeURIComponent(linkId)}`,
      'GET',
    );

    if (response.found === false) {
      throw new HttpException('Lien introuvable', HttpStatus.NOT_FOUND);
    }

    if (user?.role === Role.ANALYSTE && response._source?.owner_id !== user.sub) {
      throw new HttpException('Accès refusé', HttpStatus.FORBIDDEN);
    }

    return {
      ...(response._source ?? {}),
      _id: response._id,
    };
  }

  async saveLink(payload: UnknownRecord, documentId?: string, user?: JwtPayload) {
    const normalizedPayload = this.buildLinkPayload(payload);
    const explicitId = this.normalizeString(documentId);
    const payloadId = this.normalizeString((payload._id as string | undefined) ?? undefined);
    const linkId = explicitId ?? payloadId ?? this.generateLinkId();
    const now = new Date().toISOString();

    const docToSave: UnknownRecord = {
      ...normalizedPayload,
      ...(user ? {
        owner_id: user.sub,
        audit: {
          ...(normalizedPayload.audit ?? {}),
          ...(!explicitId ? { created_at: now, created_by: user.sub } : {}),
          updated_at: now,
          updated_by: user.sub,
        },
      } : {}),
    };

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<LinkDocument>>(
      `/${this.linksIndex}/_doc/${encodeURIComponent(linkId)}`,
      'POST',
      docToSave,
    );

    return {
      id: response._id ?? linkId,
      result: response.result ?? 'updated',
      item: {
        ...docToSave,
        _id: response._id ?? linkId,
      },
    };
  }

  async deleteLink(id: string) {
    const linkId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<unknown>>(
      `/${this.linksIndex}/_doc/${encodeURIComponent(linkId)}`,
      'DELETE',
    );

    return {
      id: response._id ?? linkId,
      result: response.result ?? 'deleted',
    };
  }

  async searchIntel(input: SearchIntelInput, user?: JwtPayload) {
    const search = this.normalizeString(input.search);
    const provinceRegion = this.normalizeString(input.province_region);
    const territoireVille = this.normalizeString(input.territoire_ville);
    const eventType = this.normalizeString(input.event);
    const size = this.resolveSize(input.size, 250, 1000);

    const must: UnknownRecord[] = [];
    const filters: UnknownRecord[] = [];

    if (search) {
      must.push({
        multi_match: {
          query: search,
          fields: [
            'event.description^3',
            'event.event_type^2',
            'actors.nom^2',
            'actors.assoc',
            'event.categorie',
            'source.source_name',
            'location.province_region',
            'location.territoire_ville',
            'location.localite_village_lieuprecis',
          ],
          fuzziness: 'AUTO',
        },
      });
    }

    if (provinceRegion) {
      filters.push({ term: { 'location.province_region': provinceRegion } });
    }

    if (territoireVille) {
      filters.push({ term: { 'location.territoire_ville': territoireVille } });
    }

    if (eventType) {
      filters.push({ term: { 'event.event_type': eventType } });
    }

    const dateRange: Record<string, string> = {};
    const dateFrom = this.toIsoDate(input.dateFrom);
    const dateTo = this.toIsoDate(input.dateTo);

    if (dateFrom) dateRange.gte = dateFrom;
    if (dateTo) dateRange.lte = dateTo;

    if (Object.keys(dateRange).length > 0) {
      filters.push({ range: { 'event.date_event': dateRange } });
    }

    // ── Permission-level data filtering ─────────────────────────────
    if (user) {
      if (user.role === Role.OFFICIER) {
        filters.push({ term: { owner_id: user.sub } });
      } else if (user.role === Role.ANALYSTE || user.role === Role.CONSEILLER) {
        if (user.desk) filters.push({ term: { desk: user.desk } });
      }
    }

    const hasConstraints = must.length > 0 || filters.length > 0;

    const body: UnknownRecord = {
      query: hasConstraints
        ? {
            bool: {
              ...(must.length > 0 ? { must } : {}),
              ...(filters.length > 0 ? { filter: filters } : {}),
            },
          }
        : { match_all: {} },
      sort: [{ 'event.date_event': { order: 'desc' } }],
      size,
    };

    const response = await this.requestToElasticsearch<ElasticsearchSearchResponse<IntelIncidentDocument>>(
      `/${this.intelIndex}/_search`,
      'POST',
      body,
    );

    const hits = response.hits?.hits ?? [];

    return {
      count: response.hits?.total?.value ?? hits.length,
      items: hits.map((hit) => ({
        ...(hit._source ?? {}),
        _id: hit._id,
      })),
    };
  }

  async getIntelById(id: string, user?: JwtPayload) {
    const intelId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<IntelIncidentDocument>>(
      `/${this.intelIndex}/_doc/${encodeURIComponent(intelId)}`,
      'GET',
    );

    if (response.found === false) {
      throw new HttpException('Incident introuvable', HttpStatus.NOT_FOUND);
    }

    if (user) {
      const src = response._source;
      if (user.role === Role.OFFICIER && src?.owner_id !== user.sub) {
        throw new HttpException('Accès refusé', HttpStatus.FORBIDDEN);
      }
      if ((user.role === Role.ANALYSTE || user.role === Role.CONSEILLER) && src?.desk !== user.desk) {
        throw new HttpException('Accès refusé', HttpStatus.FORBIDDEN);
      }
    }

    return {
      ...(response._source ?? {}),
      _id: response._id,
    };
  }

  async saveIntel(payload: UnknownRecord, documentId?: string, user?: JwtPayload) {
    const normalizedPayload = this.buildIntelPayload(payload);
    const explicitId = this.normalizeString(documentId);
    const payloadId = this.normalizeString((payload._id as string | undefined) ?? undefined);
    const intelId = explicitId ?? payloadId ?? this.generateIntelId();
    const now = new Date().toISOString();

    const docToSave: UnknownRecord = {
      ...normalizedPayload,
      ...(user ? {
        owner_id: user.sub,
        desk: user.role === Role.OFFICIER
          ? (user.desk ?? '')
          : (this.normalizeString(payload.desk as string | undefined) ?? user.desk ?? ''),
        audit: {
          ...(normalizedPayload.audit ?? {}),
          ...(!explicitId ? { created_at: now, created_by: user.sub } : {}),
          updated_at: now,
          updated_by: user.sub,
        },
      } : {}),
    };

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<IntelIncidentDocument>>(
      `/${this.intelIndex}/_doc/${encodeURIComponent(intelId)}`,
      'POST',
      docToSave,
    );

    return {
      _id: response._id ?? intelId,
      id: response._id ?? intelId,
      result: response.result ?? 'updated',
      item: {
        ...docToSave,
        _id: response._id ?? intelId,
      },
    };
  }

  async deleteIntel(id: string) {
    const intelId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<unknown>>(
      `/${this.intelIndex}/_doc/${encodeURIComponent(intelId)}`,
      'DELETE',
    );

    return {
      id: response._id ?? intelId,
      result: response.result ?? 'deleted',
    };
  }

  async getIntelProvinces() {
    const body = {
      size: 0,
      aggs: {
        provinces: { terms: { field: 'location.province_region', size: 1000 } },
      },
    };

    const response = await this.requestToElasticsearch<ElasticsearchAggregationResponse>(
      `/${this.intelIndex}/_search`,
      'POST',
      body,
    );

    const buckets = response.aggregations?.provinces?.buckets ?? [];

    return {
      items: buckets.map((b) => b.key).filter(Boolean),
    };
  }

  async getIntelTerritoires(province: string) {
    const provinceValue = this.normalizeRequired(province, 'province');

    const body = {
      size: 0,
      query: {
        bool: {
          filter: [{ term: { 'location.province_region': provinceValue } }],
        },
      },
      aggs: {
        territoires: { terms: { field: 'location.territoire_ville', size: 2000 } },
      },
    };

    const response = await this.requestToElasticsearch<ElasticsearchAggregationResponse>(
      `/${this.intelIndex}/_search`,
      'POST',
      body,
    );

    const buckets = response.aggregations?.territoires?.buckets ?? [];

    return {
      province: provinceValue,
      items: buckets.map((b) => b.key).filter(Boolean),
    };
  }

  async getIntelDashboard(input: IntelDashboardInput) {
    const province = this.normalizeString(input.province);
    const territoire = this.normalizeString(input.territoire);
    const size = this.resolveSize(input.size, 10000, 10000);

    const filters: UnknownRecord[] = [];

    if (province) {
      filters.push({ term: { 'location.province_region': province } });
    }

    if (territoire && province) {
      filters.push({ term: { 'location.territoire_ville': territoire } });
    }

    const dateRange: Record<string, string> = {};
    const dateFrom = this.toIsoDate(input.dateFrom);
    const dateTo = this.toIsoDate(input.dateTo);

    if (dateFrom) dateRange.gte = dateFrom;
    if (dateTo) dateRange.lte = dateTo;

    if (Object.keys(dateRange).length > 0) {
      filters.push({ range: { 'event.date_event': dateRange } });
    }

    const body: UnknownRecord = {
      size,
      _source: [
        'event.date_event',
        'event.event_type',
        'event.description',
        'location.province_region',
        'location.territoire_ville',
        'degats_humains.morts',
        'degats_humains.blesses',
      ],
      sort: [{ 'event.date_event': { order: 'desc' } }],
      query: filters.length > 0
        ? { bool: { filter: filters } }
        : { match_all: {} },
    };

    const response = await this.requestToElasticsearch<ElasticsearchSearchResponse<UnknownRecord>>(
      `/${this.intelIndex}/_search`,
      'POST',
      body,
    );

    const hits = response.hits?.hits ?? [];

    return {
      count: response.hits?.total?.value ?? hits.length,
      items: hits.map((hit) => ({
        ...(hit._source ?? {}),
        _id: hit._id,
      })),
    };
  }

  async searchObservations(input: SearchObservationsInput, user?: JwtPayload) {
    const search = this.normalizeString(input.search);
    const obsType = this.normalizeString(input.obs_type);
    const sourceReliability = this.normalizeString(input.source_reliability);
    const size = this.resolveSize(input.size, 500, 2000);

    const must: UnknownRecord[] = [];
    const filters: UnknownRecord[] = [];

    if (search) {
      must.push({
        multi_match: {
          query: search,
          fields: ['summary^3', 'obs_type', 'location.address', 'location.province', 'source.source_name'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (obsType) {
      filters.push({ term: { obs_type: obsType } });
    }

    if (sourceReliability) {
      filters.push({ term: { 'evaluation.source_reliability': sourceReliability } });
    }

    const dateRange: Record<string, string> = {};
    const dateFrom = this.toIsoDate(input.dateFrom);
    const dateTo = this.toIsoDate(input.dateTo);

    if (dateFrom) {
      dateRange.gte = dateFrom;
    }

    if (dateTo) {
      dateRange.lte = dateTo;
    }

    if (Object.keys(dateRange).length > 0) {
      filters.push({ range: { 'time.observed_at': dateRange } });
    }

    // ── Permission-level data filtering ─────────────────────────────
    if (user?.role === Role.OFFICIER) {
      filters.push({ term: { owner_id: user.sub } });
    }

    const hasConstraints = must.length > 0 || filters.length > 0;

    const body: UnknownRecord = {
      query: hasConstraints
        ? {
            bool: {
              ...(must.length > 0 ? { must } : {}),
              ...(filters.length > 0 ? { filter: filters } : {}),
            },
          }
        : { match_all: {} },
      sort: [{ 'time.observed_at': { order: 'desc' } }],
      size,
    };

    const response = await this.requestToElasticsearch<ElasticsearchSearchResponse<ObservationDocument>>(
      `/${this.observationsIndex}/_search`,
      'POST',
      body,
    );

    const hits = response.hits?.hits ?? [];

    return {
      count: response.hits?.total?.value ?? hits.length,
      items: hits.map((hit) => ({
        ...(hit._source ?? {}),
        _id: hit._id,
      })),
    };
  }

  async getObservationById(id: string, user?: JwtPayload) {
    const obsId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<ObservationDocument>>(
      `/${this.observationsIndex}/_doc/${encodeURIComponent(obsId)}`,
      'GET',
    );

    if (response.found === false) {
      throw new HttpException('Observation introuvable', HttpStatus.NOT_FOUND);
    }

    if (user?.role === Role.OFFICIER && response._source?.owner_id !== user.sub) {
      throw new HttpException('Accès refusé', HttpStatus.FORBIDDEN);
    }

    return {
      ...(response._source ?? {}),
      _id: response._id,
    };
  }

  async saveObservation(payload: UnknownRecord, documentId?: string, user?: JwtPayload) {
    const normalizedPayload = this.buildObservationPayload(payload);
    const explicitId = this.normalizeString(documentId);
    const payloadId = this.normalizeString((payload._id as string | undefined) ?? undefined);
    const obsId = explicitId ?? payloadId ?? this.generateObsId();
    const now = new Date().toISOString();

    const docToSave: UnknownRecord = {
      ...normalizedPayload,
      ...(user ? {
        owner_id: user.sub,
        audit: {
          ...(normalizedPayload.audit ?? {}),
          ...(!explicitId ? { created_at: now, created_by: user.sub } : {}),
          updated_at: now,
          updated_by: user.sub,
        },
      } : {}),
    };

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<ObservationDocument>>(
      `/${this.observationsIndex}/_doc/${encodeURIComponent(obsId)}`,
      'POST',
      docToSave,
    );

    return {
      _id: response._id ?? obsId,
      id: response._id ?? obsId,
      result: response.result ?? 'updated',
      item: {
        ...docToSave,
        _id: response._id ?? obsId,
      },
    };
  }

  async deleteObservation(id: string) {
    const obsId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<unknown>>(
      `/${this.observationsIndex}/_doc/${encodeURIComponent(obsId)}`,
      'DELETE',
    );

    return {
      id: response._id ?? obsId,
      result: response.result ?? 'deleted',
    };
  }

  // ── Events (events_v1) ─────────────────────────────────────────────

  async searchEvents(input: SearchEventsInput, user?: JwtPayload) {
    const search = this.normalizeString(input.search);
    const eventType = this.normalizeString(input.event_type);
    const classificationLevel = this.normalizeString(input.classification_level);
    const size = this.resolveSize(input.size, 500, 2000);

    const must: UnknownRecord[] = [];
    const filters: UnknownRecord[] = [];

    if (search) {
      must.push({
        multi_match: {
          query: search,
          fields: ['title^3', 'description^2', 'tags', 'location.province', 'location.territoire'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (eventType) {
      filters.push({ term: { event_type: eventType } });
    }

    if (classificationLevel) {
      filters.push({ term: { 'classification.level': classificationLevel } });
    }

    const dateRange: Record<string, string> = {};
    const dateFrom = this.toIsoDate(input.dateFrom);
    const dateTo = this.toIsoDate(input.dateTo);

    if (dateFrom) {
      dateRange.gte = dateFrom;
    }

    if (dateTo) {
      dateRange.lte = dateTo;
    }

    if (Object.keys(dateRange).length > 0) {
      filters.push({ range: { 'time.start': dateRange } });
    }

    // ── Permission-level data filtering ─────────────────────────────
    if (user?.role === Role.ANALYSTE || user?.role === Role.CONSEILLER) {
      filters.push({ term: { owner_id: user.sub } });
    }

    const hasConstraints = must.length > 0 || filters.length > 0;

    const body: UnknownRecord = {
      query: hasConstraints
        ? {
            bool: {
              ...(must.length > 0 ? { must } : {}),
              ...(filters.length > 0 ? { filter: filters } : {}),
            },
          }
        : { match_all: {} },
      sort: [{ 'time.start': { order: 'desc' } }],
      size,
    };

    const response = await this.requestToElasticsearch<ElasticsearchSearchResponse<EventDocument>>(
      `/${this.eventsIndex}/_search`,
      'POST',
      body,
    );

    const hits = response.hits?.hits ?? [];

    return {
      count: response.hits?.total?.value ?? hits.length,
      items: hits.map((hit) => ({
        ...(hit._source ?? {}),
        _id: hit._id,
      })),
    };
  }

  async getEventById(id: string, user?: JwtPayload) {
    const eventId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<EventDocument>>(
      `/${this.eventsIndex}/_doc/${encodeURIComponent(eventId)}`,
      'GET',
    );

    if (response.found === false) {
      throw new HttpException('Événement introuvable', HttpStatus.NOT_FOUND);
    }

    if ((user?.role === Role.ANALYSTE || user?.role === Role.CONSEILLER) &&
        response._source?.owner_id !== user.sub) {
      throw new HttpException('Accès refusé', HttpStatus.FORBIDDEN);
    }

    return {
      ...(response._source ?? {}),
      _id: response._id,
    };
  }

  async saveEvent(payload: UnknownRecord, documentId?: string, user?: JwtPayload) {
    const normalizedPayload = this.buildEventPayload(payload);
    const explicitId = this.normalizeString(documentId);
    const payloadId = this.normalizeString((payload._id as string | undefined) ?? undefined);
    const eventId = explicitId ?? payloadId ?? this.generateEventId();
    const now = new Date().toISOString();

    const docToSave: UnknownRecord = {
      ...normalizedPayload,
      ...(user ? {
        owner_id: user.sub,
        audit: {
          ...(normalizedPayload.audit ?? {}),
          ...(!explicitId ? { created_at: now, created_by: user.sub } : {}),
          updated_at: now,
          updated_by: user.sub,
        },
      } : {}),
    };

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<EventDocument>>(
      `/${this.eventsIndex}/_doc/${encodeURIComponent(eventId)}`,
      'POST',
      docToSave,
    );

    return {
      _id: response._id ?? eventId,
      id: response._id ?? eventId,
      result: response.result ?? 'updated',
      item: {
        ...docToSave,
        _id: response._id ?? eventId,
      },
    };
  }

  async deleteEvent(id: string) {
    const eventId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<unknown>>(
      `/${this.eventsIndex}/_doc/${encodeURIComponent(eventId)}`,
      'DELETE',
    );

    return {
      id: response._id ?? eventId,
      result: response.result ?? 'deleted',
    };
  }

  private async requestToElasticsearch<TResponse>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: unknown,
  ): Promise<TResponse> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.esUsername && this.esPassword) {
      headers.Authorization = `Basic ${Buffer.from(`${this.esUsername}:${this.esPassword}`).toString('base64')}`;
    }

    let response: Response;

    try {
      response = await fetch(`${this.esBaseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new HttpException(
        `Impossible de joindre Elasticsearch à ${this.esBaseUrl}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const rawBody = await response.text();
    const parsedBody = this.tryParseJson(rawBody);

    if (!response.ok) {
      throw new HttpException(
        this.extractElasticsearchError(parsedBody, response.statusText),
        this.mapUpstreamStatus(response.status),
      );
    }

    return parsedBody as TResponse;
  }

  private buildLinkPayload(payload: UnknownRecord): LinkDocument {
    const time = isRecord(payload.time) ? payload.time : {};
    const source = isRecord(payload.source) ? payload.source : {};
    const evaluation = isRecord(payload.evaluation) ? payload.evaluation : {};
    const classification = isRecord(payload.classification) ? payload.classification : {};
    const audit = isRecord(payload.audit) ? payload.audit : {};

    const normalized: LinkDocument = {
      from_entity: this.normalizeString((payload.from_entity as string | undefined) ?? undefined) ?? '',
      to_entity: this.normalizeString((payload.to_entity as string | undefined) ?? undefined) ?? '',
      link_type: this.normalizeString((payload.link_type as string | undefined) ?? undefined) ?? '',
      role_from: this.normalizeString((payload.role_from as string | undefined) ?? undefined) ?? 'collaborateur',
      role_to: this.normalizeString((payload.role_to as string | undefined) ?? undefined) ?? 'collaborateur',
      time: {
        start: this.toIsoDate(time.start),
        end: this.toIsoDate(time.end),
      },
      source: {
        source_type: this.normalizeString((source.source_type as string | undefined) ?? undefined) ?? '',
        source_name: this.normalizeString((source.source_name as string | undefined) ?? undefined) ?? '',
        source_ref: this.normalizeString((source.source_ref as string | undefined) ?? undefined) ?? '',
        collector: this.normalizeString((source.collector as string | undefined) ?? undefined) ?? '',
        unit: this.normalizeString((source.unit as string | undefined) ?? undefined) ?? '',
        collection_method: this.normalizeString((source.collection_method as string | undefined) ?? undefined) ?? '',
      },
      evaluation: {
        confidence: this.toConfidence(evaluation.confidence),
        source_reliability:
          this.normalizeString((evaluation.source_reliability as string | undefined) ?? undefined) ?? '',
        info_credibility:
          this.normalizeString((evaluation.info_credibility as string | undefined) ?? undefined) ?? '',
      },
      notes: this.normalizeString((payload.notes as string | undefined) ?? undefined) ?? '',
      tags: this.toStringArray(payload.tags),
      classification: {
        level: this.normalizeString((classification.level as string | undefined) ?? undefined) ?? 'OUVERT',
        compartments: this.toStringArray(classification.compartments),
      },
      audit: {
        created_at: this.toIsoDate(audit.created_at) ?? undefined,
        updated_at: this.toIsoDate(audit.updated_at) ?? undefined,
        created_by: this.normalizeString((audit.created_by as string | undefined) ?? undefined),
        updated_by: this.normalizeString((audit.updated_by as string | undefined) ?? undefined),
      },
    };

    if (!normalized.from_entity || !normalized.to_entity || !normalized.link_type) {
      throw new HttpException(
        'Les champs from_entity, to_entity et link_type sont obligatoires',
        HttpStatus.BAD_REQUEST,
      );
    }

    return normalized;
  }

  private buildIntelPayload(payload: UnknownRecord): IntelIncidentDocument {
    // Accepte la nouvelle structure imbriquée OU l'ancienne structure plate
    const loc = isRecord(payload.location) ? payload.location : payload;
    const evt = isRecord(payload.event) ? payload.event : payload;
    const srcObj = isRecord(payload.source) ? payload.source : null;
    const classification = isRecord(payload.classification) ? payload.classification : {};
    const audit = isRecord(payload.audit) ? payload.audit : {};
    const degatsHumains = isRecord(payload.degats_humains) ? payload.degats_humains : {};
    const degatsMateriels = isRecord(payload.degats_materiels) ? payload.degats_materiels : {};

    // Actors : nouveau format tableau OU ancien format plat (acteur1/acteur2)
    let actors: Array<{ nom: string; role?: string; assoc?: string }> | undefined;
    if (Array.isArray(payload.actors)) {
      actors = (payload.actors as UnknownRecord[]).filter(isRecord).map((a) => ({
        nom: this.normalizeString((a.nom as string | undefined) ?? undefined) ?? '',
        role: this.normalizeString((a.role as string | undefined) ?? undefined),
        assoc: this.normalizeString((a.assoc as string | undefined) ?? undefined),
      })).filter((a) => a.nom);
    } else {
      const acteur1 = this.normalizeString((payload.acteur1 as string | undefined) ?? undefined);
      const acteur2 = this.normalizeString((payload.acteur2 as string | undefined) ?? undefined);
      const assoc1 = this.normalizeString((payload.assoc_acteur1 as string | undefined) ?? undefined);
      const assoc2 = this.normalizeString((payload.assoc_acteur2 as string | undefined) ?? undefined);
      actors = [
        ...(acteur1 ? [{ nom: acteur1, role: 'acteur1', assoc: assoc1 }] : []),
        ...(acteur2 ? [{ nom: acteur2, role: 'acteur2', assoc: assoc2 }] : []),
      ];
    }

    // event_type : nouveau champ OU ancien "event" (string plate)
    const eventTypeRaw =
      this.normalizeString((evt.event_type as string | undefined) ?? undefined) ??
      this.normalizeString((payload.event_type as string | undefined) ?? undefined) ??
      (typeof payload.event === 'string' ? this.normalizeString(payload.event) : undefined);

    // geo_point depuis latitude/longitude
    const lat = this.toNullableNumber(loc.latitude);
    const lon = this.toNullableNumber(loc.longitude);
    const geo = lat !== null && lon !== null ? { lat, lon } : null;

    const normalized: IntelIncidentDocument = {
      location: {
        province_region: this.normalizeString((loc.province_region as string | undefined) ?? undefined) ?? '',
        territoire_ville: this.normalizeString((loc.territoire_ville as string | undefined) ?? undefined) ?? '',
        secteur_chefferie_commune: this.normalizeString((loc.secteur_chefferie_commune as string | undefined) ?? undefined),
        groupement_quartier: this.normalizeString((loc.groupement_quartier as string | undefined) ?? undefined),
        localite_village_lieuprecis: this.normalizeString((loc.localite_village_lieuprecis as string | undefined) ?? undefined) ?? '',
        latitude: lat,
        longitude: lon,
        pays: this.normalizeString((loc.pays as string | undefined) ?? undefined) ?? 'République Démocratique du Congo',
        geo: geo ?? undefined,
        geoprecision: this.normalizeString((loc.geoprecision as string | undefined) ?? undefined),
      },
      event: {
        date_event: this.toIsoDate(evt.date_event ?? payload.date_event) ?? '',
        event_type: eventTypeRaw ?? '',
        categorie: this.normalizeString((evt.categorie as string | undefined) ?? (payload.categorie as string | undefined) ?? undefined),
        description: this.normalizeString((evt.description as string | undefined) ?? (payload.description as string | undefined) ?? undefined) ?? '',
      },
      actors: actors && actors.length > 0 ? actors : undefined,
      source: srcObj
        ? {
            source_type: this.normalizeString((srcObj.source_type as string | undefined) ?? undefined),
            source_name: this.normalizeString((srcObj.source_name as string | undefined) ?? undefined),
            source_ref: this.normalizeString((srcObj.source_ref as string | undefined) ?? undefined),
          }
        : (typeof payload.source === 'string' && payload.source
            ? { source_name: this.normalizeString(payload.source) }
            : undefined),
      degats_humains: {
        morts: this.toNonNegativeInteger(degatsHumains.morts),
        blesses: this.toNonNegativeInteger(degatsHumains.blesses),
        enleves_disparus: this.toNonNegativeInteger(degatsHumains.enleves_disparus),
        expulses: this.toNonNegativeInteger(degatsHumains.expulses),
      },
      degats_materiels: {
        degat_vehicules: this.toNonNegativeInteger(degatsMateriels.degat_vehicules),
        degat_batiments: this.toNonNegativeInteger(degatsMateriels.degat_batiments),
        degat_infrastructures: this.toNonNegativeInteger(degatsMateriels.degat_infrastructures),
        autres_degats: this.normalizeString((degatsMateriels.autres_degats as string | undefined) ?? undefined) ?? '',
      },
      classification: {
        level: this.normalizeString((classification.level as string | undefined) ?? undefined) ?? 'OUVERT',
        compartments: this.toStringArray(classification.compartments),
      },
      audit: {
        created_at: this.toIsoDate(audit.created_at) ?? undefined,
        updated_at: this.toIsoDate(audit.updated_at) ?? undefined,
        created_by: this.normalizeString((audit.created_by as string | undefined) ?? undefined),
        updated_by: this.normalizeString((audit.updated_by as string | undefined) ?? undefined),
      },
    };

    const missingFields = [
      { key: 'location.province_region', value: normalized.location.province_region },
      { key: 'location.territoire_ville', value: normalized.location.territoire_ville },
      { key: 'location.localite_village_lieuprecis', value: normalized.location.localite_village_lieuprecis },
      { key: 'event.date_event', value: normalized.event.date_event },
      { key: 'event.event_type', value: normalized.event.event_type },
      { key: 'event.description', value: normalized.event.description },
    ]
      .filter((field) => !field.value)
      .map((field) => field.key);

    if (missingFields.length > 0) {
      throw new HttpException(
        `Champs obligatoires manquants: ${missingFields.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return normalized;
  }

  private generateLinkId(): string {
    return `lnk_${Date.now()}_${randomBytes(5).toString('hex')}`;
  }

  private generateIntelId(): string {
    return `intel_${Date.now()}_${randomBytes(5).toString('hex')}`;
  }

  private generateObsId(): string {
    return `obs_${Date.now()}_${randomBytes(5).toString('hex')}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${randomBytes(5).toString('hex')}`;
  }

  private resolveSize(value: number | undefined, fallback: number, maxValue: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fallback;
    }

    const rounded = Math.trunc(value);
    if (rounded <= 0) {
      return fallback;
    }

    return Math.min(rounded, maxValue);
  }

  private mapUpstreamStatus(status: number): number {
    if (status >= 400 && status < 500) {
      return status;
    }

    return HttpStatus.BAD_GATEWAY;
  }

  private extractElasticsearchError(payload: unknown, fallback: string): string {
    if (isRecord(payload) && isRecord(payload.error)) {
      const reason = payload.error.reason;
      if (typeof reason === 'string' && reason.trim().length > 0) {
        return reason;
      }

      const rootCause = payload.error.root_cause;
      if (Array.isArray(rootCause) && rootCause.length > 0 && isRecord(rootCause[0])) {
        const firstReason = rootCause[0].reason;
        if (typeof firstReason === 'string' && firstReason.trim().length > 0) {
          return firstReason;
        }
      }
    }

    if (typeof fallback === 'string' && fallback.trim().length > 0) {
      return fallback;
    }

    return 'Erreur Elasticsearch';
  }

  private tryParseJson(body: string): unknown {
    if (!body) {
      return {};
    }

    try {
      return JSON.parse(body) as unknown;
    } catch {
      return { raw: body };
    }
  }

  private normalizeRequired(value: string, fieldName: string): string {
    const normalized = this.normalizeString(value);
    if (!normalized) {
      throw new HttpException(`Le paramètre ${fieldName} est obligatoire`, HttpStatus.BAD_REQUEST);
    }

    return normalized;
  }

  private normalizeString(value: string | undefined): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private toIsoDate(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  private toConfidence(value: unknown): number {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return 0;
    }

    const clamped = Math.max(0, Math.min(100, Math.round(numeric)));
    return clamped;
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }

    return [];
  }

  private buildEventPayload(payload: UnknownRecord): EventDocument {
    const time = isRecord(payload.time) ? payload.time : {} as UnknownRecord;
    const location = isRecord(payload.location) ? payload.location : {} as UnknownRecord;
    const geo = isRecord(location.geo) ? location.geo : {} as UnknownRecord;
    const impact = isRecord(payload.impact) ? payload.impact : {} as UnknownRecord;
    const classification = isRecord(payload.classification) ? payload.classification : {} as UnknownRecord;
    const audit = isRecord(payload.audit) ? payload.audit : {} as UnknownRecord;
    const source = isRecord(payload.source) ? payload.source : {} as UnknownRecord;
    const evaluation = isRecord(payload.evaluation) ? payload.evaluation : {} as UnknownRecord;

    const participants = Array.isArray(payload.participants)
      ? (payload.participants as UnknownRecord[]).filter(isRecord).map((p) => ({
          entity_id: this.normalizeString(p.entity_id as string | undefined) ?? '',
          role: this.normalizeString(p.role as string | undefined) ?? 'participant',
        }))
      : [];

    const normalized: EventDocument = {
      title: this.normalizeString((payload.title as string | undefined) ?? undefined) ?? '',
      description: this.normalizeString((payload.description as string | undefined) ?? undefined) ?? '',
      event_type: this.normalizeString((payload.event_type as string | undefined) ?? undefined) ?? '',
      time: {
        start: this.toIsoDate(time.start) ?? new Date().toISOString(),
        end: this.toIsoDate(time.end) ?? new Date().toISOString(),
      },
      location: {
        province: this.normalizeString((location.province as string | undefined) ?? undefined) ?? '',
        territoire: this.normalizeString((location.territoire as string | undefined) ?? undefined) ?? '',
        address: this.normalizeString((location.address as string | undefined) ?? undefined) ?? '',
        groupement: this.normalizeString((location.groupement as string | undefined) ?? undefined),
        secteur: this.normalizeString((location.secteur as string | undefined) ?? undefined),
        geo: {
          lat: Number(geo.lat) || 0,
          lon: Number(geo.lon) || 0,
        },
      },
      impact: {
        morts: this.toNonNegativeInteger(impact.morts),
        blesses: this.toNonNegativeInteger(impact.blesses),
        enleves_disparus: this.toNonNegativeInteger(impact.enleves_disparus),
        expulses: this.toNonNegativeInteger(impact.expulses),
        degat_vehicules: this.toNonNegativeInteger(impact.degat_vehicules),
        degat_batiments: this.toNonNegativeInteger(impact.degat_batiments),
        degat_infrastructures: this.toNonNegativeInteger(impact.degat_infrastructures),
        autres_degats: this.normalizeString((impact.autres_degats as string | undefined) ?? undefined) ?? '',
      },
      participants,
      source: {
        source_type: this.normalizeString((source.source_type as string | undefined) ?? undefined),
        source_name: this.normalizeString((source.source_name as string | undefined) ?? undefined),
        source_ref: this.normalizeString((source.source_ref as string | undefined) ?? undefined),
        collector: this.normalizeString((source.collector as string | undefined) ?? undefined),
        unit: this.normalizeString((source.unit as string | undefined) ?? undefined),
        collection_method: this.normalizeString((source.collection_method as string | undefined) ?? undefined),
      },
      evaluation: {
        source_reliability: this.normalizeString((evaluation.source_reliability as string | undefined) ?? undefined),
        info_credibility: this.normalizeString((evaluation.info_credibility as string | undefined) ?? undefined),
        confidence: evaluation.confidence !== undefined ? this.toConfidence(evaluation.confidence) : undefined,
      },
      tags: this.toStringArray(payload.tags),
      classification: {
        level: this.normalizeString((classification.level as string | undefined) ?? undefined) ?? 'OUVERT',
        compartments: this.toStringArray(classification.compartments),
      },
      audit: {
        created_at: this.toIsoDate(audit.created_at) ?? undefined,
        updated_at: this.toIsoDate(audit.updated_at) ?? undefined,
        created_by: this.normalizeString((audit.created_by as string | undefined) ?? undefined),
        updated_by: this.normalizeString((audit.updated_by as string | undefined) ?? undefined),
      },
    };

    if (!normalized.title || !normalized.event_type) {
      throw new HttpException(
        'Les champs title et event_type sont obligatoires',
        HttpStatus.BAD_REQUEST,
      );
    }

    return normalized;
  }

  private buildObservationPayload(payload: UnknownRecord): ObservationDocument {
    const time = isRecord(payload.time) ? payload.time : {};
    const location = isRecord(payload.location) ? payload.location : {};
    const geo = isRecord(location.geo) ? location.geo : null;
    const source = isRecord(payload.source) ? payload.source : {};
    const evaluation = isRecord(payload.evaluation) ? payload.evaluation : {};
    const audit = isRecord(payload.audit) ? payload.audit : {};
    const classification = isRecord(payload.classification) ? payload.classification : {};

    const entityRefs = Array.isArray(payload.entity_refs)
      ? (payload.entity_refs as UnknownRecord[]).filter(isRecord).map((ref) => ({
          entity_id: this.normalizeString(ref.entity_id as string | undefined) ?? '',
          role: this.normalizeString(ref.role as string | undefined) ?? 'subject',
        }))
      : [];

    const evidence = Array.isArray(payload.evidence)
      ? (payload.evidence as UnknownRecord[]).filter(isRecord).map((e) => ({
          doc_id: this.normalizeString(e.doc_id as string | undefined) ?? '',
          type: this.normalizeString(e.type as string | undefined),
          sha256: this.normalizeString(e.sha256 as string | undefined),
        }))
      : undefined;

    const normalized: ObservationDocument = {
      obs_type: this.normalizeString((payload.obs_type as string | undefined) ?? undefined) ?? '',
      summary: this.normalizeString((payload.summary as string | undefined) ?? undefined) ?? '',
      entity_refs: entityRefs,
      event_ref: this.normalizeString((payload.event_ref as string | undefined) ?? undefined),
      time: {
        observed_at: this.toIsoDate(time.observed_at) ?? new Date().toISOString(),
        reported_at: this.toIsoDate(time.reported_at) ?? new Date().toISOString(),
      },
      location: {
        address: this.normalizeString((location.address as string | undefined) ?? undefined) ?? '',
        province: this.normalizeString((location.province as string | undefined) ?? undefined) ?? '',
        territoire: this.normalizeString((location.territoire as string | undefined) ?? undefined) ?? '',
        groupement: this.normalizeString((location.groupement as string | undefined) ?? undefined),
        secteur: this.normalizeString((location.secteur as string | undefined) ?? undefined),
        geo: geo ? { lat: Number(geo.lat) || 0, lon: Number(geo.lon) || 0 } : undefined,
      },
      source: {
        source_type: this.normalizeString((source.source_type as string | undefined) ?? undefined) ?? '',
        source_name: this.normalizeString((source.source_name as string | undefined) ?? undefined) ?? '',
        source_ref: this.normalizeString((source.source_ref as string | undefined) ?? undefined) ?? '',
        collector: this.normalizeString((source.collector as string | undefined) ?? undefined) ?? '',
        unit: this.normalizeString((source.unit as string | undefined) ?? undefined) ?? '',
        collection_method: this.normalizeString((source.collection_method as string | undefined) ?? undefined) ?? '',
      },
      evaluation: {
        source_reliability: this.normalizeString((evaluation.source_reliability as string | undefined) ?? undefined) ?? '',
        info_credibility: this.normalizeString((evaluation.info_credibility as string | undefined) ?? undefined) ?? '',
        confidence: this.toConfidence(evaluation.confidence),
      },
      evidence,
      tags: this.toStringArray(payload.tags),
      classification: {
        level: this.normalizeString((classification.level as string | undefined) ?? undefined) ?? 'OUVERT',
        compartments: this.toStringArray(classification.compartments),
      },
      audit: {
        created_at: this.toIsoDate(audit.created_at) ?? undefined,
        created_by: this.normalizeString((audit.created_by as string | undefined) ?? undefined),
        updated_at: this.toIsoDate(audit.updated_at) ?? undefined,
        updated_by: this.normalizeString((audit.updated_by as string | undefined) ?? undefined),
      },
    };

    if (!normalized.obs_type || !normalized.summary) {
      throw new HttpException(
        'Les champs obs_type et summary sont obligatoires',
        HttpStatus.BAD_REQUEST,
      );
    }

    return normalized;
  }

  // ── Documents (documents_v1) ──────────────────────────────────────

  async searchDocuments(input: SearchDocumentsInput) {
    const search = this.normalizeString(input.search);
    const docType = this.normalizeString(input.doc_type);
    const size = this.resolveSize(input.size, 100, 1000);

    const must: UnknownRecord[] = [];
    const filters: UnknownRecord[] = [];

    if (search) {
      must.push({
        multi_match: {
          query: search,
          fields: ['title^3', 'extracted_text^2', 'origin.source_name', 'tags'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (docType) {
      filters.push({ term: { doc_type: docType } });
    }

    const dateRange: Record<string, string> = {};
    const dateFrom = this.toIsoDate(input.dateFrom);
    const dateTo = this.toIsoDate(input.dateTo);
    if (dateFrom) dateRange.gte = dateFrom;
    if (dateTo) dateRange.lte = dateTo;
    if (Object.keys(dateRange).length > 0) {
      filters.push({ range: { 'audit.created_at': dateRange } });
    }

    const hasConstraints = must.length > 0 || filters.length > 0;

    const body: UnknownRecord = {
      query: hasConstraints
        ? { bool: { ...(must.length > 0 ? { must } : {}), ...(filters.length > 0 ? { filter: filters } : {}) } }
        : { match_all: {} },
      sort: [{ 'audit.created_at': { order: 'desc' } }],
      size,
    };

    const response = await this.requestToElasticsearch<ElasticsearchSearchResponse<DocumentDocument>>(
      `/${this.documentsIndex}/_search`,
      'POST',
      body,
    );

    const hits = response.hits?.hits ?? [];
    return {
      count: response.hits?.total?.value ?? hits.length,
      items: hits.map((hit) => ({ ...(hit._source ?? {}), _id: hit._id })),
    };
  }

  async getDocumentById(id: string) {
    const docId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<DocumentDocument>>(
      `/${this.documentsIndex}/_doc/${encodeURIComponent(docId)}`,
      'GET',
    );

    if (response.found === false) {
      throw new HttpException('Document introuvable', HttpStatus.NOT_FOUND);
    }

    return { ...(response._source ?? {}), _id: response._id };
  }

  async saveDocument(payload: UnknownRecord, documentId?: string) {
    const normalizedPayload = this.buildDocumentPayload(payload);
    const explicitId = this.normalizeString(documentId);
    const payloadId = this.normalizeString((payload._id as string | undefined) ?? undefined);
    const docId = explicitId ?? payloadId ?? this.generateDocId();

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<DocumentDocument>>(
      `/${this.documentsIndex}/_doc/${encodeURIComponent(docId)}`,
      'POST',
      normalizedPayload,
    );

    return {
      _id: response._id ?? docId,
      id: response._id ?? docId,
      result: response.result ?? 'updated',
      item: { ...normalizedPayload, _id: response._id ?? docId },
    };
  }

  async deleteDocument(id: string) {
    const docId = this.normalizeRequired(id, 'id');

    const response = await this.requestToElasticsearch<ElasticsearchDocumentResponse<unknown>>(
      `/${this.documentsIndex}/_doc/${encodeURIComponent(docId)}`,
      'DELETE',
    );

    return { id: response._id ?? docId, result: response.result ?? 'deleted' };
  }

  private generateEntityId(): string {
    return `ent_${Date.now()}_${randomBytes(5).toString('hex')}`;
  }

  private generateDocId(): string {
    return `doc_${Date.now()}_${randomBytes(5).toString('hex')}`;
  }

  private buildEntityPayload(payload: UnknownRecord): EntityDocument {
    const attributes = isRecord(payload.attributes) ? payload.attributes : {};
    const person = isRecord(attributes.person) ? attributes.person : null;
    const organisation = isRecord(attributes.organisation) ? attributes.organisation : null;
    const lieu = isRecord(attributes.lieu) ? attributes.lieu : null;
    const geoLieu = lieu && isRecord(lieu.geo) ? lieu.geo : null;
    const risk = isRecord(payload.risk) ? payload.risk : null;
    const classification = isRecord(payload.classification) ? payload.classification : {};
    const audit = isRecord(payload.audit) ? payload.audit : {};

    const normalized: EntityDocument = {
      entity_type: this.normalizeString((payload.entity_type as string | undefined) ?? undefined) ?? '',
      name: this.normalizeString((payload.name as string | undefined) ?? undefined) ?? '',
      aliases: this.toStringArray(payload.aliases),
      status: this.normalizeString((payload.status as string | undefined) ?? undefined),
      labels: this.toStringArray(payload.labels),
      tags: this.toStringArray(payload.tags),
      classification: {
        level: this.normalizeString((classification.level as string | undefined) ?? undefined) ?? 'OUVERT',
        compartments: this.toStringArray(classification.compartments),
      },
      audit: {
        created_at: this.toIsoDate(audit.created_at) ?? undefined,
        updated_at: this.toIsoDate(audit.updated_at) ?? undefined,
        created_by: this.normalizeString((audit.created_by as string | undefined) ?? undefined),
        updated_by: this.normalizeString((audit.updated_by as string | undefined) ?? undefined),
      },
    };

    if (person || organisation || lieu) {
      normalized.attributes = {};
      if (person) {
        normalized.attributes.person = {
          sexe: this.normalizeString((person.sexe as string | undefined) ?? undefined),
          naissance: this.toIsoDate(person.naissance) ?? undefined,
          lieu_nais: this.normalizeString((person.lieu_nais as string | undefined) ?? undefined),
          etat_civil: this.normalizeString((person.etat_civil as string | undefined) ?? undefined),
          profession: this.normalizeString((person.profession as string | undefined) ?? undefined),
          nom_pere: this.normalizeString((person.nom_pere as string | undefined) ?? undefined),
          nom_mere: this.normalizeString((person.nom_mere as string | undefined) ?? undefined),
        };
      }
      if (organisation) {
        normalized.attributes.organisation = {
          type_org: this.normalizeString((organisation.type_org as string | undefined) ?? undefined),
          secteur_activite: this.normalizeString((organisation.secteur_activite as string | undefined) ?? undefined),
          pays_enregistrement: this.normalizeString((organisation.pays_enregistrement as string | undefined) ?? undefined),
          date_creation: this.toIsoDate(organisation.date_creation) ?? undefined,
          parent_entity_id: this.normalizeString((organisation.parent_entity_id as string | undefined) ?? undefined),
        };
      }
      if (lieu) {
        normalized.attributes.lieu = {
          type_lieu: this.normalizeString((lieu.type_lieu as string | undefined) ?? undefined),
          province: this.normalizeString((lieu.province as string | undefined) ?? undefined),
          territoire: this.normalizeString((lieu.territoire as string | undefined) ?? undefined),
          geo: geoLieu ? { lat: Number(geoLieu.lat) || 0, lon: Number(geoLieu.lon) || 0 } : null,
        };
      }
    }

    if (Array.isArray(payload.identifiers)) {
      normalized.identifiers = (payload.identifiers as UnknownRecord[]).filter(isRecord).map((item) => ({
        id_type: this.normalizeString((item.id_type as string | undefined) ?? undefined) ?? '',
        id_value: this.normalizeString((item.id_value as string | undefined) ?? undefined) ?? '',
        country: this.normalizeString((item.country as string | undefined) ?? undefined),
      }));
    }

    if (Array.isArray(payload.contacts)) {
      normalized.contacts = (payload.contacts as UnknownRecord[]).filter(isRecord).map((c) => ({
        type: this.normalizeString((c.type as string | undefined) ?? undefined) ?? '',
        value: this.normalizeString((c.value as string | undefined) ?? undefined) ?? '',
        valid_from: this.toIsoDate(c.valid_from) ?? undefined,
        valid_to: this.toIsoDate(c.valid_to) ?? undefined,
      }));
    }

    if (Array.isArray(payload.locations)) {
      normalized.locations = (payload.locations as UnknownRecord[]).filter(isRecord).map((loc) => {
        const geoLoc = isRecord(loc.geo) ? loc.geo : null;
        return {
          role: this.normalizeString((loc.role as string | undefined) ?? undefined),
          address: this.normalizeString((loc.address as string | undefined) ?? undefined),
          province: this.normalizeString((loc.province as string | undefined) ?? undefined),
          territoire: this.normalizeString((loc.territoire as string | undefined) ?? undefined),
          groupement: this.normalizeString((loc.groupement as string | undefined) ?? undefined),
          secteur: this.normalizeString((loc.secteur as string | undefined) ?? undefined),
          geo: geoLoc ? { lat: Number(geoLoc.lat) || 0, lon: Number(geoLoc.lon) || 0 } : undefined,
          valid_from: this.toIsoDate(loc.valid_from) ?? undefined,
          valid_to: this.toIsoDate(loc.valid_to) ?? undefined,
        };
      });
    }

    if (Array.isArray(payload.media_refs)) {
      normalized.media_refs = (payload.media_refs as UnknownRecord[]).filter(isRecord).map((m) => ({
        doc_id: this.normalizeString((m.doc_id as string | undefined) ?? undefined) ?? '',
        media_type: this.normalizeString((m.media_type as string | undefined) ?? undefined),
        role: this.normalizeString((m.role as string | undefined) ?? undefined),
      }));
    }

    if (risk) {
      normalized.risk = {
        risk_score: this.toNullableNumber(risk.risk_score),
        risk_level: this.normalizeString((risk.risk_level as string | undefined) ?? undefined),
        watchlist: typeof risk.watchlist === 'boolean' ? risk.watchlist : undefined,
      };
    }

    if (!normalized.name || !normalized.entity_type) {
      throw new HttpException('Les champs name et entity_type sont obligatoires', HttpStatus.BAD_REQUEST);
    }

    return normalized;
  }

  private buildDocumentPayload(payload: UnknownRecord): DocumentDocument {
    const origin = isRecord(payload.origin) ? payload.origin : {};
    const file = isRecord(payload.file) ? payload.file : {};
    const classification = isRecord(payload.classification) ? payload.classification : {};
    const audit = isRecord(payload.audit) ? payload.audit : {};

    return {
      title: this.normalizeString((payload.title as string | undefined) ?? undefined),
      doc_type: this.normalizeString((payload.doc_type as string | undefined) ?? undefined),
      origin: {
        source_type: this.normalizeString((origin.source_type as string | undefined) ?? undefined),
        source_name: this.normalizeString((origin.source_name as string | undefined) ?? undefined),
        source_ref: this.normalizeString((origin.source_ref as string | undefined) ?? undefined),
      },
      file: {
        sha256: this.normalizeString((file.sha256 as string | undefined) ?? undefined),
        mime: this.normalizeString((file.mime as string | undefined) ?? undefined),
        path: this.normalizeString((file.path as string | undefined) ?? undefined),
        url: this.normalizeString((file.url as string | undefined) ?? undefined),
      },
      extracted_text: this.normalizeString((payload.extracted_text as string | undefined) ?? undefined),
      tags: this.toStringArray(payload.tags),
      classification: {
        level: this.normalizeString((classification.level as string | undefined) ?? undefined) ?? 'OUVERT',
        compartments: this.toStringArray(classification.compartments),
      },
      audit: {
        created_at: this.toIsoDate(audit.created_at) ?? undefined,
        updated_at: this.toIsoDate(audit.updated_at) ?? undefined,
        created_by: this.normalizeString((audit.created_by as string | undefined) ?? undefined),
        updated_by: this.normalizeString((audit.updated_by as string | undefined) ?? undefined),
      },
    };
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string' && value.trim() === '') {
      return null;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return null;
    }

    return numeric;
  }

  private toNonNegativeInteger(value: unknown): number {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return 0;
    }

    return Math.max(0, Math.trunc(numeric));
  }
}