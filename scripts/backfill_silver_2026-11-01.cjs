'use strict';

/**
 * plan-eng-review Faz 4.2 — one-time backfill for the pilot gym's cutover.
 * PKG-1→8 shipped without ever migrating the 51 pre-existing members onto
 * the new `member_packages`/`member_credits` model — without this, the
 * moment the new rules/functions deploy, every one of them checks in and
 * hears "paketin yok."
 *
 * Assigns tenant `tarabya-marte`'s "Silver" catalog package to every
 * active member (role `member`, `tenant_memberships.status === 'active'`)
 * who does not already hold an active membership-kind `member_packages`
 * assignment. Mints the matching `member_credits` rows the same way
 * `gymentra-mobile/src/data/firebase/memberPackageRepo.ts`'s
 * `assignPackageToMember` does for a normal assignment, so a backfilled
 * member is indistinguishable from one assigned through the app.
 *
 * Idempotent: a member who already has an active membership-kind package
 * (from a prior run of this script, or a real assignment made through the
 * app before this ran) is skipped, not duplicated. Re-running is safe.
 *
 * Every doc this script creates carries `backfillBatch` so the batch can
 * be found and reverted in bulk if something's wrong — see the `--revert`
 * flag below.
 *
 * Dry-run by default. `--apply` performs the writes. `--revert` deletes
 * everything tagged with this batch's `BACKFILL_BATCH` id (also dry-run
 * unless paired with `--apply`).
 */

// The sibling scripts in this directory use firebase-admin's old namespaced
// API (`admin.apps`, `admin.credential.cert`, `admin.firestore()`) — that
// surface no longer exists in the installed firebase-admin@14 (it's
// flat/modular now: `firebase-admin/app`, `firebase-admin/firestore`).
// Every one of those scripts is currently broken; flagged separately
// (out of scope here). This script uses the API that actually works.
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../secrets/serviceAccount.json');
const TENANT_ID = 'tarabya-marte';
const PACKAGE_NAME = 'Silver';
const ENDS_AT = new Date('2026-11-01T00:00:00+03:00'); // Europe/Istanbul
const BACKFILL_BATCH = 'faz4-cutover-2026-11-01';

function loadServiceAccount() {
  try {
    return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  } catch (e) {
    console.error('Service account yüklenemedi:', SERVICE_ACCOUNT_PATH);
    console.error(e);
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  return { apply: args.includes('--apply'), revert: args.includes('--revert') };
}

async function revert(db, apply) {
  console.log(apply ? 'GERİ ALMA — UYGULAMA MODU' : 'GERİ ALMA — KURU ÇALIŞTIRMA');
  const [packagesSnap, creditsSnap] = await Promise.all([
    db.collection('member_packages').where('backfillBatch', '==', BACKFILL_BATCH).get(),
    db.collection('member_credits').where('backfillBatch', '==', BACKFILL_BATCH).get(),
  ]);
  console.log(`Bulundu: ${packagesSnap.size} member_packages, ${creditsSnap.size} member_credits.`);
  for (const doc of [...packagesSnap.docs, ...creditsSnap.docs]) {
    if (apply) await doc.ref.delete();
    console.log(`${apply ? 'SİLİNDİ' : 'Silinecek (dry-run)'}: ${doc.ref.path}`);
  }
}

async function main() {
  const { apply, revert: doRevert } = parseArgs();
  const sa = loadServiceAccount();
  if (!getApps().length) initializeApp({ credential: cert(sa) });
  const db = getFirestore();

  if (doRevert) return revert(db, apply);

  const now = Timestamp.now();
  const endsAtTs = Timestamp.fromDate(ENDS_AT);

  console.log(apply ? 'UYGULAMA MODU — yazımlar yapılacak' : 'KURU ÇALIŞTIRMA — hiçbir şey yazılmayacak');
  console.log(`Tenant: ${TENANT_ID} | Paket: ${PACKAGE_NAME} | Bitiş: ${ENDS_AT.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}`);

  const pkgSnap = await db.collection('gym_packages').where('tenantId', '==', TENANT_ID).where('name', '==', PACKAGE_NAME).get();
  if (pkgSnap.size > 1) {
    console.error(`"${PACKAGE_NAME}" adında birden fazla paket var — hangisi kastedildiği belirsiz. Elle çöz.`);
    process.exit(1);
  }

  let pkgDoc = pkgSnap.docs[0];
  let pkg = pkgDoc && pkgDoc.data();
  if (!pkgDoc) {
    // gym_packages was found completely empty for this tenant at the time
    // this script was first run (`tarabya-marte` predates PKG-1 and never
    // went through `seedDefaultPackages`) — same template content that
    // function writes for a brand-new tenant, matching what the user
    // confirmed: price 0 (placeholder, admin fills in later from Salon
    // Ayarları) and gymAccess-only entitlements.
    const newPkgData = {
      tenantId: TENANT_ID,
      name: PACKAGE_NAME,
      kind: 'membership',
      price: 0,
      durationDays: 30,
      entitlements: { gymAccess: true },
      sortOrder: 0,
      activeAssignmentCount: 0,
      isActive: true,
      createdAt: now,
      backfillBatch: BACKFILL_BATCH,
    };
    if (apply) {
      const ref = await db.collection('gym_packages').add(newPkgData);
      pkgDoc = { id: ref.id, data: () => newPkgData };
      console.log(`OLUŞTURULDU: gym_packages/${ref.id} (${PACKAGE_NAME})`);
    } else {
      console.log(`Oluşturulacak (dry-run): gym_packages/<yeni> (${PACKAGE_NAME})`);
      pkgDoc = { id: '<dry-run>', data: () => newPkgData };
    }
    pkg = newPkgData;
  } else {
    console.log(`Paket bulundu: ${pkgDoc.id} (${pkg.kind}, ${pkg.price}₺)`);
  }

  const membersSnap = await db
    .collection('tenant_memberships')
    .where('tenantId', '==', TENANT_ID)
    .where('status', '==', 'active')
    .where('roles', 'array-contains', 'member')
    .get();
  console.log(`Aktif üye sayısı: ${membersSnap.size}`);

  let skipped = 0;
  let assigned = 0;
  for (const membershipDoc of membersSnap.docs) {
    const uid = membershipDoc.data().userId;
    const existingSnap = await db
      .collection('member_packages')
      .where('tenantId', '==', TENANT_ID)
      .where('memberId', '==', uid)
      .where('kind', '==', 'membership')
      .where('status', '==', 'active')
      .get();
    if (!existingSnap.empty) {
      skipped += 1;
      console.log(`Atlandı (zaten aktif paketi var): ${uid}`);
      continue;
    }

    const memberName = membershipDoc.data().userDisplayName || membershipDoc.data().userEmail || 'Üye';
    const packageRef = db.collection('member_packages').doc();
    const packageData = {
      tenantId: TENANT_ID,
      memberId: uid,
      memberName,
      packageId: pkgDoc.id,
      packageName: pkg.name,
      kind: pkg.kind,
      entitlements: pkg.entitlements,
      ...(pkg.freezePolicy ? { freezePolicy: pkg.freezePolicy } : {}),
      listPrice: pkg.price,
      finalPrice: pkg.price,
      startsAt: now,
      endsAt: endsAtTs,
      frozenDays: 0,
      freezes: [],
      status: 'active',
      assignedAt: now,
      assignedBy: 'backfill-script',
      backfillBatch: BACKFILL_BATCH,
    };

    const creditWrites = [];
    const gc = pkg.entitlements && pkg.entitlements.groupClasses;
    if (gc && !gc.unlimited && gc.count && gc.periodDays) {
      creditWrites.push({
        ref: db.collection('member_credits').doc(),
        data: {
          tenantId: TENANT_ID,
          memberId: uid,
          kind: 'groupClass',
          source: 'entitlement',
          sourcePackageId: packageRef.id,
          total: gc.count,
          used: 0,
          startsAt: now,
          expiresAt: endsAtTs,
          status: 'active',
          backfillBatch: BACKFILL_BATCH,
        },
      });
    }
    const pt = pkg.entitlements && pkg.entitlements.ptLessons;
    if (pt && pt.count && pt.periodDays) {
      creditWrites.push({
        ref: db.collection('member_credits').doc(),
        data: {
          tenantId: TENANT_ID,
          memberId: uid,
          kind: 'ptLesson',
          source: 'entitlement',
          sourcePackageId: packageRef.id,
          total: pt.count,
          used: 0,
          startsAt: now,
          expiresAt: endsAtTs,
          status: 'active',
          backfillBatch: BACKFILL_BATCH,
        },
      });
    }

    if (apply) {
      const batch = db.batch();
      batch.set(packageRef, packageData);
      for (const c of creditWrites) batch.set(c.ref, c.data);
      await batch.commit();
    }
    console.log(
      `${apply ? 'ATANDI' : 'Atanacak (dry-run)'}: ${uid} (${memberName}) → ${packageRef.id}` +
        (creditWrites.length ? ` + ${creditWrites.length} kredi` : ''),
    );
    assigned += 1;
  }

  console.log('\nÖzet:');
  console.log('Toplam aktif üye:', membersSnap.size);
  console.log('Atlanan (zaten paketi var):', skipped);
  console.log(`${apply ? 'Atanan' : 'Atanacak'}:`, assigned);
}

main().catch((e) => {
  console.error('Hata oluştu:', e);
  process.exit(1);
});
