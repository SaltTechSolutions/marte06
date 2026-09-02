'use strict';

// Fills `classes.trainerId` from the free-text `trainerName` (PER-8).
//
// Classes predate the field, so every existing one is "ownerless": the rules
// leave those admin-only and no trainer sees them under Derslerim. Matching is
// EXACT and case-sensitive against the active trainer roster — a fuzzy match
// here would silently hand a class to the wrong coach, which is worse than
// leaving it admin-owned. Anything that does not match exactly is reported and
// skipped for a human to decide.
//
// Idempotent: a class that already has trainerId is left alone.
//
// Usage:
//   node scripts/backfill_class_trainer_id.cjs          (dry run)
//   node scripts/backfill_class_trainer_id.cjs --apply  (writes)

const fs = require('fs');
const path = require('path');
const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../secrets/serviceAccount.json');
const apply = process.argv.includes('--apply');

async function main() {
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))) });
  const db = getFirestore();

  const trainers = await db
    .collection('tenant_memberships')
    .where('status', '==', 'active')
    .where('roles', 'array-contains', 'trainer')
    .get();

  // Keyed by tenant: two gyms may each have a "Mert Kaya", and a name is only
  // meaningful inside its own gym.
  const byTenant = new Map();
  for (const d of trainers.docs) {
    const m = d.data();
    const name = (m.userDisplayName || '').trim();
    if (!name) continue;
    if (!byTenant.has(m.tenantId)) byTenant.set(m.tenantId, new Map());
    const names = byTenant.get(m.tenantId);
    // A duplicated display name inside one gym is unresolvable — mark it so
    // and skip, rather than picking whichever came back first.
    names.set(name, names.has(name) ? null : m.userId);
  }

  const classes = await db.collection('classes').get();
  let matched = 0;
  let already = 0;
  const skipped = [];

  const batchable = [];
  for (const d of classes.docs) {
    const c = d.data();
    if (c.trainerId) {
      already += 1;
      continue;
    }
    const uid = byTenant.get(c.tenantId)?.get((c.trainerName || '').trim());
    if (!uid) {
      skipped.push(`${d.id} · ${c.tenantId} · "${c.trainerName}"`);
      continue;
    }
    matched += 1;
    batchable.push({ ref: d.ref, uid });
  }

  console.log(`${classes.size} ders · ${already} zaten eşli · ${matched} eşleşti · ${skipped.length} atlandı`);
  if (skipped.length) {
    console.log('\natlananlar (eğitmen adı aktif bir antrenörle birebir eşleşmiyor):');
    for (const s of skipped) console.log('  -', s);
  }

  if (!apply) {
    console.log('\nKuru çalıştırma — yazmak için --apply.');
    return;
  }

  for (let i = 0; i < batchable.length; i += 400) {
    const batch = db.batch();
    for (const { ref, uid } of batchable.slice(i, i + 400)) batch.update(ref, { trainerId: uid });
    await batch.commit();
  }
  console.log(`\n${matched} ders güncellendi.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
