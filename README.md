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

### Accès CCOC

Les menus Enregistrer CCOC et Rechercher CCOC, les pages CCOC et les routes
`/api/intel` et `/api/intel-dashboard` sont réservés aux administrateurs et aux
analystes dont le desk est `CCOC`. Le nom du desk est comparé sans tenir compte
de la casse ni des espaces en début ou fin. Les autres rôles sont exclus, même
avec ce desk. La suppression d'un CCOC reste réservée aux administrateurs.
Après connexion, les autres comptes arrivent sur Informations.

Validation : `node node_modules/jest/bin/jest.js src/auth/ccoc-access.spec.ts --runInBand`
dans le backend et `node --test scripts/test-ccoc-access.cjs` dans le frontend.

### Pièces jointes des informations et renseignements

Les formulaires Informations (`observations_v1`) et Renseignements (`events_v1`)
acceptent plusieurs images, vidéos, audios et documents : 20 fichiers par fiche,
100 Mo par fichier. Le champ `evidence` des deux index doit être déclaré comme
`nested`, avec `doc_id`, `type` et `sha256` de type `keyword`.

- `POST /api/uploads/evidence` : multipart avec `file`, `context` (`observations`
  ou `events`) et `classification` (JSON). Retourne `evidence` et `document`.
- `GET /api/evidence/:id` : métadonnées de la pièce jointe.
- `GET /api/evidence/:id/file` : téléchargement authentifié, avec prise en charge
  des plages d'octets. Les deux routes GET acceptent `context` et `recordId` pour
  vérifier l'accès à la fiche qui référence le fichier.
- Les créations et modifications de fiches acceptent `evidence: [{ doc_id,
  type, sha256 }]`. Une modification omettant `evidence` conserve les références
  existantes ; un tableau vide retire toutes les références.

Un document par fichier est enregistré dans `documents_v1`. Les fichiers sont
stockés hors du dossier public `uploads`, dans `evidence-uploads` par défaut.
La variable `EVIDENCE_UPLOADS_DIR` permet de choisir un dossier privé et persistant
sur le serveur. Le compte exécutant le backend doit pouvoir écrire dans ce dossier.
Le stockage des fichiers et l'index `documents_v1` doivent être sauvegardés ensemble.

Les fichiers sont envoyés lors de l'enregistrement de la fiche. Après une erreur,
les envois réussis restent dans le brouillon et seuls les fichiers restants sont
renvoyés lors de la prochaine tentative. Retirer une pièce jointe supprime son lien
avec la fiche, sans supprimer le document ni le fichier. Un brouillon abandonné
après un envoi réussi peut laisser un fichier non rattaché.

Formats acceptés : JPG, JPEG, PNG, GIF, WEBP, BMP ; MP4, WEBM, MOV, AVI, MKV, M4V ;
MP3, WAV, OGG, OGA, M4A, AAC, FLAC ; PDF, TXT, CSV, RTF, DOC/DOCX, XLS/XLSX,
PPT/PPTX, ODT/ODS/ODP. La lecture audio et vidéo dépend des formats pris en charge
par le navigateur ; le téléchargement reste disponible.

Validation : `node node_modules/jest/bin/jest.js src/elasticsearch/evidence.spec.ts --runInBand`
dans le backend et `node --test scripts/test-evidence.cjs` dans le frontend.

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

## Validation et distribution des informations

Le desk `cord_intel` contrôle les observations. Il se sélectionne dans la gestion
des comptes ; les comptes existants ne sont pas réaffectés automatiquement.

- Une nouvelle observation reçoit `workflow.status: pending` et aucun desk destinataire.
  Seuls les membres de `cord_intel` peuvent la consulter, la modifier ou la supprimer.
- Le bouton **Valider et distribuer** permet de sélectionner plusieurs desks.
  Le catalogue contient les desks ayant au moins un analyste ou conseiller actif.
- Après validation, les analystes et conseillers des desks sélectionnés peuvent lire
  l'observation et ses pièces jointes. `cord_intel` conserve l'accès pour le suivi.
  Le rôle administrateur ne donne pas d'exception : il faut aussi appartenir à `cord_intel`.
- Une modification du contenu annule la distribution et remet l'information en attente.
  Une nouvelle validation est nécessaire. La redistribution remplace les anciens destinataires.
- Les observations anciennes sans champ `workflow` restent en attente, sans migration de contenu.
  Les droits utilisent le profil actuel du compte à chaque requête ; une désactivation ou
  un changement de desk s'applique sans attendre l'expiration du jeton.

Appliquer le mapping additif avant de démarrer la nouvelle version du backend :

```bash
node scripts/observation-workflow-mapping.cjs
```

Le script utilise le `.env` local, vérifie le mapping et peut être relancé. Il ne modifie
aucun document existant. Le champ `workflow` contient `status`, `target_desks`,
`submitted_at`, `validated_at` et `validated_by`.

API authentifiée : `GET /api/observations/desks`, `POST /api/observations/search`
(filtre facultatif `status: pending|validated`) et
`PUT /api/observations/:id/validation`. Pour valider via Postman, lire d'abord
`GET /api/observations/:id`, puis envoyer les versions retournées :

```json
{
  "target_desks": ["desk_est", "desk_ouest"],
  "_seq_no": 4,
  "_primary_term": 1
}
```

Le serveur refuse une validation d'une version périmée avec HTTP 409.
Les champs de workflow envoyés à la création ou à la modification ne permettent
pas de contourner la validation. Les identifiants envoyés lors de la création sont ignorés.
Les fichiers d'évidence se consultent par `/api/evidence/:id` et `/file` avec
`context=observations&recordId=...`, selon les mêmes droits que l'information.
Les endpoints génériques de documents n'exposent pas ces évidences.

Vérifications ciblées :

```bash
node node_modules/jest/bin/jest.js src/elasticsearch/observation-workflow.spec.ts src/elasticsearch/observation-workflow-http.spec.ts src/elasticsearch/evidence.spec.ts src/auth/ccoc-access.spec.ts --runInBand
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
