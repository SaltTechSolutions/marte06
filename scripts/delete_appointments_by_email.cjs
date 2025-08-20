'use strict';

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

function assertEmail(arg) {
  if (!arg || typeof arg !== 'string' || !arg.includes('@')) {
    console.error('Kullanım: node scripts/delete_appointments_by_email.cjs <email> [--apply]');
    process.exit(1);
  }
}

async function main() {
  const email = process.argv[2];
  const apply = process.argv.includes('--apply');
  assertEmail(email);

  const sa = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();

  console.log(`Hedef e-posta: ${email}`);
  console.log(apply ? 'ÇALIŞTIRMA MODU: Uygulama (değişiklikler yapılacak)' : 'KURU ÇALIŞTIRMA: Değişiklik yapılmayacak');

  // 1) Email ile üye(ler)i bul
  const membersSnap = await db.collection('members').where('email', '==', email).get();
  if (membersSnap.empty) {
    console.log('Bu e-posta ile eşleşen üye bulunamadı.');
    return;
  }

  const members = membersSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
  console.log(`Bulunan üye sayısı: ${members.length}`);
  for (const m of members) {
    console.log(`- ${m.id} | ${m.name || ''} ${m.surname || ''}`);
  }

  let totalLessonsAffected = 0;
  let totalDocsDeleted = 0;
  let totalDocsUpdated = 0;

  for (const member of members) {
    const memberId = member.id;
    console.log(`\nÜye işleniyor: ${memberId} (${member.name || ''} ${member.surname || ''})`);

    // 2) Lessons içinde bu üye geçen tüm kayıtları bul (3 farklı alanda array-contains)
    const coll = db.collection('lessons');

    const byMemberIds = await coll.where('memberIds', 'array-contains', memberId).get();
    const byWalkIns = await coll.where('walkInMemberIds', 'array-contains', memberId).get();
    const byAttended = await coll.where('attendedMemberIds', 'array-contains', memberId).get();

    const idSet = new Set();
    for (const s of [byMemberIds, byWalkIns, byAttended]) {
      s.forEach(doc => idSet.add(doc.id));
    }

    console.log(`Bulunan ders kaydı sayısı: ${idSet.size}`);
    totalLessonsAffected += idSet.size;

    for (const id of idSet) {
      const ref = coll.doc(id);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const data = snap.data() || {};

      const oldMemberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
      const oldWalkIns = Array.isArray(data.walkInMemberIds) ? data.walkInMemberIds : [];
      const oldAttended = Array.isArray(data.attendedMemberIds) ? data.attendedMemberIds : [];

      const newMemberIds = oldMemberIds.filter(x => x !== memberId);
      const newWalkIns = oldWalkIns.filter(x => x !== memberId);
      const newAttended = oldAttended.filter(x => x !== memberId);

      const lessonDate = data.date && typeof data.date.toDate === 'function' ? data.date.toDate() : null;
      const dateStr = lessonDate ? lessonDate.toISOString() : 'Tarih yok';

      if (newMemberIds.length === 0 && newWalkIns.length === 0 && newAttended.length === 0) {
        // Tamamen boş kaldıysa dersi sil
        if (apply) {
          await ref.delete();
          console.log(`SİLİNDİ: lessonId=${id} (${dateStr})`);
          totalDocsDeleted += 1;
        } else {
          console.log(`Silinecek (dry-run): lessonId=${id} (${dateStr})`);
        }
      } else {
        if (apply) {
          await ref.update({
            memberIds: newMemberIds,
            walkInMemberIds: newWalkIns,
            attendedMemberIds: newAttended,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`GÜNCELLENDİ: lessonId=${id} (${dateStr})`);
          totalDocsUpdated += 1;
        } else {
          console.log(`Güncellenecek (dry-run): lessonId=${id} (${dateStr})`);
          console.log('  memberIds:', newMemberIds);
          console.log('  walkInMemberIds:', newWalkIns);
          console.log('  attendedMemberIds:', newAttended);
        }
      }
    }
  }

  console.log('\nÖzet:');
  console.log('Etkilenen toplam ders:', totalLessonsAffected);
  console.log('Güncellenen kayıt sayısı:', totalDocsUpdated);
  console.log('Silinen kayıt sayısı:', totalDocsDeleted);
}

main().catch(err => {
  console.error('Hata oluştu:', err);
  process.exit(1);
});
