// Additive, repeatable mapping update. Existing observations are left unchanged;
// records without workflow are treated as pending by the application.
require('dotenv').config({ quiet: true });

async function main() {
  const base = (process.env.ELASTICSEARCH_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('ELASTICSEARCH_URL est obligatoire');
  const index = process.env.ELASTICSEARCH_INDEX_OBSERVATIONS || 'observations_v1';
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.ELASTICSEARCH_USERNAME) headers.Authorization = 'Basic ' + Buffer.from(
    process.env.ELASTICSEARCH_USERNAME + ':' + (process.env.ELASTICSEARCH_PASSWORD || '')).toString('base64');
  const properties = {
    status: { type: 'keyword' }, target_desks: { type: 'keyword' },
    submitted_at: { type: 'date' }, validated_at: { type: 'date' }, validated_by: { type: 'keyword' },
  };
  const response = await fetch(`${base}/${encodeURIComponent(index)}/_mapping`, {
    method: 'PUT', headers, body: JSON.stringify({ properties: { workflow: { type: 'object', dynamic: 'strict', properties } } }),
  });
  if (!response.ok) throw new Error(`Mise à jour du mapping refusée (HTTP ${response.status})`);
  const result = await response.json();
  if (!result.acknowledged) throw new Error('Mise à jour du mapping non confirmée');
  const check = await fetch(`${base}/${encodeURIComponent(index)}/_mapping`, { headers });
  if (!check.ok) throw new Error(`Vérification du mapping refusée (HTTP ${check.status})`);
  const mapping = (await check.json())[index].mappings.properties.workflow;
  for (const [field, definition] of Object.entries(properties)) {
    if (mapping.properties?.[field]?.type !== definition.type) throw new Error(`Mapping incorrect : workflow.${field}`);
  }
  console.log(`Mapping workflow ajouté et vérifié sur ${index}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
