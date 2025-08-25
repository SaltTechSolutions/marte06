'use strict';

// Backfill script to populate:
// 1) members.memberUid from Firebase Auth by email
// 2) lessons: memberUids, attendedMemberUids, absentMemberUids, walkInMemberUids (parallel to existing ID arrays)
// 3) assigned_packages.memberUid from members
//
// Usage:
//   node scripts/backfill_uids.cjs [--apply] [--members-only|--lessons-only|--packages-only]
//
// Notes:
// - Default is dry-run (no writes). Use --apply to perform updates.
// - Requires service account at scripts/secrets/serviceAccount.json

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../secrets/serviceAccount.json');

function loadServiceAccount() {
  try {
    const raw = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Service account yüklenemedi:', SERVICE_ACCOUNT_PATH);
    console.error(e);
    process.exit(1);
  }
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

async function getUidByEmail(auth, email) {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch (e) {
    if (e && e.code === 'auth/user-not-found') return null;
    throw e;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const membersOnly = process.argv.includes('--members-only');
  const lessonsOnly = process.argv.includes('--lessons-only');
  const packagesOnly = process.argv.includes('--packages-only');

  // Optional targeted mode flags
  function parseArgVal(name) {
    const i = process.argv.findIndex((a) => a === name || a.startsWith(name + '='));
    if (i === -1) return null;
    const a = process.argv[i];
    if (a.includes('=')) return a.split('=').slice(1).join('=').trim();
    const next = process.argv[i + 1];
    return next && !next.startsWith('--') ? next : null;
  }
  const targetMemberId = parseArgVal('--target-member-id');
  const targetUid = parseArgVal('--target-uid');

  if ([membersOnly, lessonsOnly, packagesOnly].filter(Boolean).length > 1) {
    console.error('Sadece bir kapsam seçebilirsiniz: --members-only | --lessons-only | --packages-only');
    process.exit(1);
  }

  const sa = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();
  const auth = admin.auth();

  console.log(apply ? 'ÇALIŞTIRMA MODU: Uygulama (değişiklikler yapılacak)' : 'KURU ÇALIŞTIRMA: Değişiklik yapılmayacak');
  if (targetMemberId) {
    console.log(`[HEDEF MODU] Sadece şu üye için çalışılacak: memberId=${targetMemberId}${targetUid ? `, uid=${targetUid}` : ''}`);
  }

  const memberIdToUid = new Map();

  // Step 1: Backfill and correct member.memberUid
  if (!lessonsOnly && !packagesOnly) {
    console.log('\n[1/3] Members koleksiyonunda memberUid dolduruluyor...');
    const membersSnap = await db.collection('members').get();
    let updated = 0, scanned = 0, missingAuth = 0, corrected = 0;
    for (const docSnap of membersSnap.docs) {
      scanned += 1;
      const data = docSnap.data() || {};
      const email = data.email || null;
      const currentUid = data.memberUid || null;
      if (email) {
        const authUid = await getUidByEmail(auth, String(email).trim().toLowerCase());
        const desiredUid = currentUid || authUid;
        if (desiredUid) {
          memberIdToUid.set(docSnap.id, desiredUid);
          if (!currentUid) {
            if (apply) {
              await docSnap.ref.update({ memberUid: desiredUid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
            updated += 1;
            console.log(`${apply ? 'GÜNCELLENDİ' : 'Güncellenecek (dry-run)'}: members/${docSnap.id} -> memberUid=${desiredUid}`);
          } else if (authUid && currentUid !== authUid) {
            if (apply) {
              await docSnap.ref.update({ memberUid: authUid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
            corrected += 1;
            memberIdToUid.set(docSnap.id, authUid);
            console.log(`${apply ? 'DÜZELTİLDİ' : 'Düzeltilecek (dry-run)'}: members/${docSnap.id} -> memberUid ${currentUid} => ${authUid}`);
          }
        } else {
          missingAuth += 1;
          console.warn(`Uyarı: Auth kullanıcısı bulunamadı, e-posta=${email}, memberId=${docSnap.id}`);
        }
      } else {
        console.warn(`Uyarı: Üye e-postası yok, memberId=${docSnap.id}`);
      }
    }
    console.log(`Members tarandı: ${scanned}, güncellenen: ${updated}, düzeltülen: ${corrected}, Auth bulunamayan: ${missingAuth}`);
  }

  // If membersOnly, we still need the map; fill from DB if empty
  if (memberIdToUid.size === 0) {
    const membersSnap = await db.collection('members').get();
    for (const docSnap of membersSnap.docs) {
      const data = docSnap.data() || {};
      if (data.memberUid) memberIdToUid.set(docSnap.id, data.memberUid);
    }
  }

  // Augment mapping using assigned_packages where memberUid exists (helps when members lack email/memberUid)
  try {
    const apSnapForMap = await db.collection('assigned_packages').get();
    let added = 0, conflicts = 0;
    for (const docSnap of apSnapForMap.docs) {
      const d = docSnap.data() || {};
      const mid = d.memberId;
      const muid = d.memberUid;
      if (mid && muid) {
        if (!memberIdToUid.has(mid)) {
          memberIdToUid.set(mid, muid);
          added += 1;
        } else if (memberIdToUid.get(mid) !== muid) {
          conflicts += 1;
          // Prefer value from members collection; just log the conflict
          console.warn(`Uyarı: memberId->uid eşleşmesinde çakışma: memberId=${mid}, membersMap=${memberIdToUid.get(mid)}, assigned_packages=${muid}`);
        }
      }
    }
    if (added || conflicts) {
      console.log(`Mapping güçlendirildi: assigned_packages kaynaklı eklenen=${added}, çakışma=${conflicts}`);
    }
  } catch (e) {
    console.warn('Mapping assigned_packages ile güçlendirilemedi:', e);
  }

  // Target override mapping if provided
  if (targetMemberId && targetUid) {
    memberIdToUid.set(targetMemberId, targetUid);
    console.log(`[HARİTA] Zorla eşleme: memberId=${targetMemberId} -> uid=${targetUid}`);
  }

  // Helper to map arrays of memberIds to uids
  const idsToUids = (ids) => uniq((Array.isArray(ids) ? ids : []).map((id) => memberIdToUid.get(id)).filter(Boolean));

  // Step 2: Backfill lessons UID arrays
  if (!membersOnly && !packagesOnly) {
    console.log('\n[2/3] Lessons koleksiyonunda UID dizileri dolduruluyor...');
    let lessonDocs = [];
    if (targetMemberId) {
      console.log(`[Hedef] Üye ile ilişkili dersler çekiliyor: ${targetMemberId}`);
      const [byMember, byAtt, byAbs, byWalk] = await Promise.all([
        db.collection('lessons').where('memberIds', 'array-contains', targetMemberId).get(),
        db.collection('lessons').where('attendedMemberIds', 'array-contains', targetMemberId).get(),
        db.collection('lessons').where('absentMemberIds', 'array-contains', targetMemberId).get(),
        db.collection('lessons').where('walkInMemberIds', 'array-contains', targetMemberId).get(),
      ]);
      const map = new Map();
      for (const snap of [byMember, byAtt, byAbs, byWalk]) {
        snap.docs.forEach((d) => map.set(d.id, d));
      }
      lessonDocs = Array.from(map.values());
      console.log(`[Hedef] Bulunan ders sayısı: ${lessonDocs.length}`);
    } else {
      const lessonsSnap = await db.collection('lessons').get();
      lessonDocs = lessonsSnap.docs;
    }

    let updated = 0, scanned = 0;
    for (const docSnap of lessonDocs) {
      scanned += 1;
      const d = docSnap.data() || {};
      const memberIds = Array.isArray(d.memberIds) ? d.memberIds : [];
      const attendedMemberIds = Array.isArray(d.attendedMemberIds) ? d.attendedMemberIds : [];
      const absentMemberIds = Array.isArray(d.absentMemberIds) ? d.absentMemberIds : [];
      const walkInMemberIds = Array.isArray(d.walkInMemberIds) ? d.walkInMemberIds : [];

      const memberUids = idsToUids(memberIds);
      const attendedMemberUids = idsToUids(attendedMemberIds);
      const absentMemberUids = idsToUids(absentMemberIds);
      const walkInMemberUids = idsToUids(walkInMemberIds);

      const currentMemberUids = Array.isArray(d.memberUids) ? d.memberUids : [];
      const currentAttendedMemberUids = Array.isArray(d.attendedMemberUids) ? d.attendedMemberUids : [];
      const currentAbsentMemberUids = Array.isArray(d.absentMemberUids) ? d.absentMemberUids : [];
      const currentWalkInMemberUids = Array.isArray(d.walkInMemberUids) ? d.walkInMemberUids : [];

      const needsUpdate = (
        memberUids.join(',') !== uniq(currentMemberUids).join(',') ||
        attendedMemberUids.join(',') !== uniq(currentAttendedMemberUids).join(',') ||
        absentMemberUids.join(',') !== uniq(currentAbsentMemberUids).join(',') ||
        walkInMemberUids.join(',') !== uniq(currentWalkInMemberUids).join(',')
      );

      if (needsUpdate) {
        if (apply) {
          await docSnap.ref.update({
            memberUids,
            attendedMemberUids,
            absentMemberUids,
            walkInMemberUids,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        updated += 1;
        console.log(`${apply ? 'GÜNCELLENDİ' : 'Güncellenecek (dry-run)'}: lessons/${docSnap.id}`);
      }
    }
    console.log(`Lessons tarandı: ${scanned}, güncellenen: ${updated}`);
  }

  // Step 3: Backfill assigned_packages.memberUid
  if (!membersOnly && !lessonsOnly) {
    console.log('\n[3/3] assigned_packages koleksiyonunda memberUid dolduruluyor...');
    let apDocs = [];
    if (targetMemberId) {
      const apSnapTarget = await db.collection('assigned_packages').where('memberId', '==', targetMemberId).get();
      apDocs = apSnapTarget.docs;
      console.log(`[Hedef] assigned_packages hedefli: ${apDocs.length} adet`);
    } else {
      const apSnap = await db.collection('assigned_packages').get();
      apDocs = apSnap.docs;
    }
    let updated = 0, scanned = 0, missing = 0;
    for (const docSnap of apDocs) {
      scanned += 1;
      const d = docSnap.data() || {};
      const memberId = d.memberId;
      const currentUid = d.memberUid || null;
      const uid = memberId ? (memberIdToUid.get(memberId) || null) : null;
      if (!uid) {
        missing += 1;
        console.warn(`Uyarı: memberUid bulunamadı -> assigned_packages/${docSnap.id} (memberId=${memberId})`);
        continue;
      }
      if (uid !== currentUid) {
        if (apply) {
          await docSnap.ref.update({ memberUid: uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        updated += 1;
        console.log(`${apply ? 'GÜNCELLENDİ' : 'Güncellenecek (dry-run)'}: assigned_packages/${docSnap.id} -> memberUid=${uid}`);
      }
    }
    console.log(`assigned_packages tarandı: ${scanned}, güncellenen: ${updated}, bulunamayan: ${missing}`);
  }

  console.log('\nTamamlandı.');
}

main().catch((err) => {
  console.error('Hata oluştu:', err);
  process.exit(1);
});
