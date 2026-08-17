const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

export const appConfig = {
  port: Number(process.env.PORT ?? 3000),
  elasticsearch: {
    url: trimTrailingSlashes(process.env.ELASTICSEARCH_URL ?? ''),
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    indexes: {
      links: process.env.ELASTICSEARCH_INDEX_LINKS ?? 'links_v1',
      entities: process.env.ELASTICSEARCH_INDEX_ENTITIES ?? 'entities_v1',
      intel: process.env.ELASTICSEARCH_INDEX_INTEL ?? 'intel_v1',
      observations: process.env.ELASTICSEARCH_INDEX_OBSERVATIONS ?? 'observations_v1',
      events: process.env.ELASTICSEARCH_INDEX_EVENTS ?? 'events_v1',
      documents: process.env.ELASTICSEARCH_INDEX_DOCUMENTS ?? 'documents_v1',
      users: process.env.ELASTICSEARCH_INDEX_USERS ?? 'users_v1',
    },
  },
  uploads: {
    dir: process.env.UPLOADS_DIR ?? 'uploads',
    publicPath: process.env.UPLOADS_PUBLIC_PATH ?? '/uploads',
  },
} as const;
