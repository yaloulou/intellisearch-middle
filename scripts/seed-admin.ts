/**
 * Script de création du premier utilisateur ADMIN.
 *
 * Usage :
 *   npx ts-node -r tsconfig-paths/register scripts/seed-admin.ts
 *
 * Surcharge possible via variables d'environnement :
 *   ADMIN_EMAIL=mon@email.com ADMIN_PASSWORD=MonMotDePasse npx ts-node ...
 */

import 'dotenv/config';
import * as bcrypt from 'bcrypt';

const ES_URL = (process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200').replace(/\/+$/, '');
const ES_USER = process.env.ELASTICSEARCH_USERNAME;
const ES_PASS = process.env.ELASTICSEARCH_PASSWORD;
const INDEX = process.env.ELASTICSEARCH_INDEX_USERS ?? 'users_v1';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@intellisearch.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@1234!';
const ADMIN_NOM = process.env.ADMIN_NOM ?? 'Admin';
const ADMIN_PRENOM = process.env.ADMIN_PRENOM ?? 'Super';

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader(): Record<string, string> {
  if (ES_USER && ES_PASS) {
    return {
      Authorization: `Basic ${Buffer.from(`${ES_USER}:${ES_PASS}`).toString('base64')}`,
    };
  }
  return {};
}

async function esRequest(path: string, method: string, body?: unknown) {
  const res = await fetch(`${ES_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeader(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n▶  IntelSearch — Seed Admin');
  console.log(`   Elasticsearch : ${ES_URL}`);
  console.log(`   Index         : ${INDEX}`);
  console.log(`   Email admin   : ${ADMIN_EMAIL}\n`);

  // 1. Créer l'index si inexistant (l'erreur 400 "already exists" est ignorée)
  const createIndex = await esRequest(`/${INDEX}`, 'PUT', {
    mappings: {
      properties: {
        email:         { type: 'keyword' },
        password_hash: { type: 'keyword', index: false },
        nom:           { type: 'text' },
        prenom:        { type: 'text' },
        role:          { type: 'keyword' },
        desk:          { type: 'keyword' },
        actif:         { type: 'boolean' },
        created_at:    { type: 'date' },
        updated_at:    { type: 'date' },
      },
    },
  });

  if (createIndex.ok) {
    console.log(`✅  Index "${INDEX}" créé.`);
  } else {
    const err = createIndex.data as Record<string, Record<string, string>>;
    if (err?.error?.type === 'resource_already_exists_exception') {
      console.log(`ℹ️   Index "${INDEX}" existe déjà.`);
    } else {
      console.error('❌  Impossible de créer l\'index :', createIndex.data);
      process.exit(1);
    }
  }

  // 2. Vérifier si un utilisateur avec cet email existe déjà
  const check = await esRequest(`/${INDEX}/_search`, 'POST', {
    query: { term: { email: ADMIN_EMAIL.toLowerCase().trim() } },
    size: 1,
  });

  const total = (check.data as { hits?: { total?: { value?: number } } })?.hits?.total?.value ?? 0;
  if (total > 0) {
    console.log(`⚠️   Un compte avec l'email "${ADMIN_EMAIL}" existe déjà. Rien n'a été créé.`);
    process.exit(0);
  }

  // 3. Hacher le mot de passe
  console.log('⏳  Hachage du mot de passe...');
  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const now = new Date().toISOString();

  // 4. Créer le document admin
  const result = await esRequest(`/${INDEX}/_doc`, 'POST', {
    email:         ADMIN_EMAIL.toLowerCase().trim(),
    password_hash,
    nom:           ADMIN_NOM,
    prenom:        ADMIN_PRENOM,
    role:          'admin',
    desk:          '',
    actif:         true,
    created_at:    now,
    updated_at:    now,
  });

  if (!result.ok) {
    console.error('❌  Échec de la création du compte admin :', result.data);
    process.exit(1);
  }

  const id = (result.data as { _id?: string })._id;

  console.log('\n🎉  Administrateur créé avec succès !');
  console.log('─'.repeat(45));
  console.log(`   ID       : ${id}`);
  console.log(`   Email    : ${ADMIN_EMAIL}`);
  console.log(`   Password : ${ADMIN_PASSWORD}`);
  console.log(`   Rôle     : admin`);
  console.log('─'.repeat(45));
  console.log('\n⚠️   Changez le mot de passe dès la première connexion via PUT /users/:id/password\n');
}

main().catch((err: unknown) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
