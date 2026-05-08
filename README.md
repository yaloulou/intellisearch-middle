<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## API Elasticsearch (REST)

Ce backend expose désormais des endpoints REST qui interrogent Elasticsearch côté serveur (au lieu de l'appeler directement depuis le front).

### Variables d'environnement

Définissez ces variables avant de lancer l'API :

- `ELASTICSEARCH_URL` (ex: `http://localhost:9200`)
- `ELASTICSEARCH_USERNAME` (optionnel si votre cluster est public)
- `ELASTICSEARCH_PASSWORD` (optionnel si votre cluster est public)
- `ELASTICSEARCH_INDEX_LINKS` (défaut: `links_v1`)
- `ELASTICSEARCH_INDEX_ENTITIES` (défaut: `entities_v1`)
- `ELASTICSEARCH_INDEX_INTEL` (défaut: `intel_v1`)
- `ELASTICSEARCH_INDEX_OBSERVATIONS` (défaut: `observations_v1`)
- `ELASTICSEARCH_INDEX_EVENTS` (défaut: `events_v1`)

### Endpoints disponibles

- `POST /api/entities/search`
  - Body: `{ "query": "nom", "size": 20 }` (ou `{ "q": "nom" }`)
  - Retourne les suggestions d'entités pour l'autocomplete (`text`, `value`, `entity_type`, etc.)

- `GET /api/entities/:id`
  - Retourne le détail d'une entité.

- `GET /api/links`
  - Query params supportés: `linkType`, `selectedLinkType`, `fromEntity`, `selectedFromEntity`, `toEntity`, `selectedToEntity`, `search`, `size`
  - Retourne la liste des liens avec filtres.

- `POST /api/links/search`
  - Même logique que `GET /api/links`, mais via body JSON.

- `GET /api/links/:id`
  - Retourne un lien par son identifiant de document.

- `POST /api/links`
  - Crée ou remplace un lien.
  - Champs obligatoires: `from_entity`, `to_entity`, `link_type`.

- `PUT /api/links/:id`
  - Met à jour (upsert) un lien en forçant l'identifiant du document.

- `DELETE /api/links/:id`
  - Supprime un lien.

- `GET /api/intel`
  - Query params supportés: `search`, `province_region`, `territoire_ville`, `event`, `dateFrom`, `dateTo`, `size`
  - Retourne la liste des incidents (index `intel_v1`) avec filtres.

- `POST /api/intel/search`
  - Même logique que `GET /api/intel`, mais via body JSON.

- `GET /api/intel/:id`
  - Retourne un incident par son identifiant de document.

- `POST /api/intel`
  - Crée un incident.
  - Champs obligatoires: `province_region`, `territoire_ville`, `localite_village_lieuprecis`, `date_event`, `event`, `description`, `acteur1`, `assoc_acteur1`, `assoc_acteur2`.

- `PUT /api/intel/:id`
  - Met à jour (upsert) un incident en forçant l'identifiant du document.

- `DELETE /api/intel/:id`
  - Supprime un incident.

- `GET /api/intel-dashboard/provinces`
  - Retourne la liste distincte des provinces (agrégation `terms` sur `province_region`).

- `GET /api/intel-dashboard/territoires?province=X`
  - Retourne la liste des territoires/villes pour une province donnée.

- `GET /api/intel-dashboard/data`
  - Query params: `province`, `territoire`, `dateFrom`, `dateTo`, `size` (défaut 10000)
  - Retourne les incidents filtrés avec uniquement les champs nécessaires au dashboard (`date_event`, `province_region`, `territoire_ville`, `event`, `description`, `degats_humains.morts`, `degats_humains.blesses`).

- `POST /api/intel-dashboard/data`
  - Même logique que `GET /api/intel-dashboard/data`, mais via body JSON.

- `GET /api/observations`
  - Query params: `search`, `obs_type`, `source_reliability`, `dateFrom`, `dateTo`, `size`
  - Retourne la liste des observations (index `observations_v1`) avec filtres.

- `POST /api/observations/search`
  - Même logique que `GET /api/observations`, mais via body JSON.

- `GET /api/observations/:id`
  - Retourne une observation par son identifiant.

- `POST /api/observations`
  - Crée une observation.
  - Champs obligatoires: `obs_type`, `summary`.
  - Champs supportés: `entity_refs[]`, `time`, `location`, `source`, `evaluation`, `audit`.

- `PUT /api/observations/:id`
  - Met à jour (upsert) une observation.

- `DELETE /api/observations/:id`
  - Supprime une observation.

- `GET /api/events`
  - Query params: `search`, `event_type`, `classification_level`, `dateFrom`, `dateTo`, `size`
  - Retourne la liste des événements (index `events_v1`) avec filtres.

- `POST /api/events/search`
  - Même logique que `GET /api/events`, mais via body JSON.

- `GET /api/events/:id`
  - Retourne un événement par son identifiant.

- `POST /api/events`
  - Crée un événement.
  - Champs obligatoires: `title`, `event_type`.
  - Champs supportés: `description`, `time { start, end }`, `location { province, territoire, address, geo { lat, lon } }`, `impact { morts, blesses, enleves_disparus, expulses, degat_vehicules, degat_batiments, degat_infrastructures, autres_degats }`, `participants[] { entity_id, role }`, `tags[]`, `classification { level, compartments[] }`, `audit { created_at, updated_at }`.

- `PUT /api/events/:id`
  - Met à jour (upsert) un événement.

- `DELETE /api/events/:id`
  - Supprime un événement.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
