'use strict';

/**
 * Backfill script:
 * Assigns legacy data (members, packages, assigned_packages, lessons) to default tenant "Tarabya Marte" (tenantId: "tarabya-marte", code: "TARABYA-01").
 *
 * Usage:
 *   node scripts/backfill_tarabya_marte_tenant.cjs          (Dry run)
 *   node scripts/backfill_tarabya_marte_tenant.cjs --apply  (Execute updates)
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../secrets/serviceAccount.json');
const DEFAULT_TENANT_ID = 'tarabya-marte';
const DEFAULT_TENANT_CODE = 'TARABYA-01';

function loadServiceAccount() {
  try {
    const raw = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Service account file missing or invalid at:', SERVICE_ACCOUNT_PATH);
    console.error(e);
    process.exit(1);
  }
}

async function run() {
  const isApply = process.argv.includes('--apply');
  console.log(`[Backfill] Mode: ${isApply ? 'APPLY (Writing to Firestore)' : 'DRY RUN (Simulated)'}`);

  const sa = loadServiceAccount();
  if (!getApps().length) {
    initializeApp({
      credential: cert(sa)
    });
  }

  const db = getFirestore();

  // 1. Create or Update Default Tenant "Tarabya Marte"
  const tenantRef = db.collection('tenants').doc(DEFAULT_TENANT_ID);
  const tenantSnap = await tenantRef.get();

  const tenantData = {
    code: DEFAULT_TENANT_CODE,
    name: 'Tarabya Marte',
    branding: {
      appName: 'Tarabya Marte',
      primaryColor: '#10B981',
      accentColor: '#06B6D4',
      themeMode: 'dark'
    },
    updatedAt: FieldValue.serverTimestamp()
  };

  if (!tenantSnap.exists) {
    tenantData.createdAt = FieldValue.serverTimestamp();
    console.log(`[Tenant] Initializing default tenant '${DEFAULT_TENANT_ID}' (${DEFAULT_TENANT_CODE})...`);
    if (isApply) {
      await tenantRef.set(tenantData);
    }
  } else {
    console.log(`[Tenant] Tenant '${DEFAULT_TENANT_ID}' already exists.`);
  }

  const collectionsToBackfill = ['members', 'packages', 'assigned_packages', 'lessons'];

  for (const collName of collectionsToBackfill) {
    console.log(`\n--- Backfilling collection: ${collName} ---`);
    const snap = await db.collection(collName).get();
    let updatedCount = 0;
    let skippedCount = 0;

    const batchSize = 400;
    let currentBatch = db.batch();
    let pendingInBatch = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.tenantId) {
        updatedCount++;
        if (isApply) {
          currentBatch.update(doc.ref, {
            tenantId: DEFAULT_TENANT_ID,
            tenantCode: DEFAULT_TENANT_CODE
          });
          pendingInBatch++;

          if (pendingInBatch >= batchSize) {
            await currentBatch.commit();
            currentBatch = db.batch();
            pendingInBatch = 0;
          }
        }
      } else {
        skippedCount++;
      }
    }

    if (isApply && pendingInBatch > 0) {
      await currentBatch.commit();
    }

    console.log(`Collection '${collName}': ${updatedCount} would be updated, ${skippedCount} already have tenantId.`);
  }

  console.log(`\n[Backfill Completed] ${isApply ? 'Data successfully updated!' : 'Dry run complete. Run with --apply to write changes.'}`);
}

run().catch(err => {
  console.error('Fatal error during backfill:', err);
  process.exit(1);
});
