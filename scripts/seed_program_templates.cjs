'use strict';

// Seeds the shared GymEntra program template library (PER-18) from
// `program_templates.seed.json` into the `program_templates` collection.
//
// Templates are global (no `tenantId`) — every gym reads them, a trainer
// assigning one COPIES it into the member's `programs` doc and edits the
// copy. A gym's own saved templates live in the same collection with
// `tenantId` set; this script never touches those.
//
// Idempotent: doc id is the template's `id`, writes are `set` with merge off,
// so re-running overwrites the global set with whatever the JSON says and
// nothing else. `sourceVersion` records which JSON version a doc came from.
//
// Usage:
//   node scripts/seed_program_templates.cjs           (dry run — prints diff)
//   node scripts/seed_program_templates.cjs --apply    (writes)
//
// Requires service account at scripts/../secrets/serviceAccount.json.
// Requires the PER-17/18 model to exist first: `ProgramExercise.type`,
// `durationSeconds`, `restSeconds`, `cue`, `Program.days[]`, `Program.warmup`
// — see plan.md PER-18 and SCHEMA.md `program_templates`.

const fs = require('fs');
const path = require('path');
const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../secrets/serviceAccount.json');
const SEED_PATH = path.resolve(__dirname, 'program_templates.seed.json');
const COLLECTION = 'program_templates';
const apply = process.argv.includes('--apply');

async function main() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))) });
  const db = getFirestore();

  const existing = await db.collection(COLLECTION).where('tenantId', '==', null).get();
  const existingIds = new Set(existing.docs.map((d) => d.id));
  const seedIds = new Set(seed.templates.map((t) => t.id));

  const toWrite = seed.templates;
  const stale = [...existingIds].filter((id) => !seedIds.has(id));

  console.log(`${toWrite.length} şablon yazılacak (${[...seedIds].filter((id) => existingIds.has(id)).length} güncelleme, ${[...seedIds].filter((id) => !existingIds.has(id)).length} yeni)`);
  if (stale.length) console.log(`JSON'da olmayan ${stale.length} eski global şablon SİLİNMEYECEK, elle karar ver: ${stale.join(', ')}`);
  if (!apply) {
    console.log('Dry run — --apply ile yaz.');
    return;
  }

  const batch = db.batch();
  for (const t of toWrite) {
    batch.set(db.collection(COLLECTION).doc(t.id), {
      ...t,
      tenantId: null,
      isActive: true,
      sourceVersion: seed.version,
      disclaimer: seed.disclaimer,
      sourceCitations: Object.fromEntries(t.sources.map((k) => [k, seed.sources[k]])),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log('Yazıldı.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
