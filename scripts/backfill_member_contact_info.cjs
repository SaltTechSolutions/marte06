'use strict';

// Carries phone and birthDate from the legacy `members` collection onto the
// matching `tenant_memberships` document for tarabya-marte.
//
// WEB-2 (19 Ağustos 2026) only copied name/email/role when it migrated 50
// legacy members — lessons, packages and contact details were deliberately
// left behind. The gym owner asked (20 Ağustos 2026) to carry over phone and
// birthDate specifically, while leaving legacy package/lesson data alone —
// that's being superseded by the new PKG catalog, not migrated.
//
// Matched via `members.memberUid` -> `tenant_memberships/{TENANT}_{uid}`,
// the same join WEB-2 used. Idempotent: skips a membership that already has
// both fields, so re-running after a partial failure only fills the gaps.
//
// Usage:
//   node scripts/backfill_member_contact_info.cjs           (dry run)
//   node scripts/backfill_member_contact_info.cjs --apply    (writes)
//
// Requires service account at scripts/../secrets/serviceAccount.json.

const fs = require('fs');
const path = require('path');
const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const TENANT = 'tarabya-marte';
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../secrets/serviceAccount.json');
const apply = process.argv.includes('--apply');

function loadServiceAccount() {
  try {
    return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  } catch (e) {
    console.error('Service account yüklenemedi:', SERVICE_ACCOUNT_PATH);
    console.error(e);
    process.exit(1);
  }
}

/** `members.birthDate` has shown up as a Timestamp, a JS Date, or (rarely) a
 *  plain string in legacy data — normalize all three to a Firestore Timestamp. */
function toTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return Timestamp.fromDate(value.toDate());
  if (value instanceof Date) return Timestamp.fromDate(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
}

async function main() {
  initializeApp({ credential: cert(loadServiceAccount()) });
  const db = getFirestore();

  console.log(apply ? 'ÇALIŞTIRMA MODU: Uygulama (değişiklikler yapılacak)' : 'KURU ÇALIŞTIRMA: Değişiklik yapılmayacak');

  const membersSnap = await db.collection('members').where('memberUid', '!=', null).get();
  console.log(`members: ${membersSnap.size} kayıt (memberUid'li)`);

  let matched = 0;
  let alreadyComplete = 0;
  let missingMembership = 0;
  let updated = 0;
  const writes = [];

  for (const doc of membersSnap.docs) {
    const m = doc.data();
    if (!m.memberUid || (!m.phone && !m.birthDate)) continue;

    const membershipRef = db.doc(`tenant_memberships/${TENANT}_${m.memberUid}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
      missingMembership += 1;
      continue;
    }
    matched += 1;

    const existing = membershipSnap.data();
    const patch = {};
    if (m.phone && !existing.phone) patch.phone = m.phone;
    const birthTs = toTimestamp(m.birthDate);
    if (birthTs && !existing.birthDate) patch.birthDate = birthTs;

    if (Object.keys(patch).length === 0) {
      alreadyComplete += 1;
      continue;
    }

    updated += 1;
    console.log(`  ${existing.userDisplayName || existing.userEmail || m.memberUid} → ${Object.keys(patch).join(', ')}`);
    if (apply) writes.push(membershipRef.set(patch, { merge: true }));
  }

  if (apply) await Promise.all(writes);

  console.log('');
  console.log(`Eşleşen üyelik: ${matched}`);
  console.log(`Zaten tamamdı: ${alreadyComplete}`);
  console.log(`Üyelik dokümanı bulunamadı (henüz taşınmamış/onaylanmamış): ${missingMembership}`);
  console.log(`${apply ? 'Güncellendi' : 'Güncellenecekti'}: ${updated}`);
}

main().catch((e) => {
  console.error('Hata oluştu:', e);
  process.exit(1);
});
