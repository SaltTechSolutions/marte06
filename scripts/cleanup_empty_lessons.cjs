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

function parseArgs() {
  const parseHourInput = (val) => {
    const s = String(val || '');
    const m = s.match(/(\d{1,2})/); // 8, 08, 08:00, 8:30 -> 8 or 08
    if (!m) return NaN;
    return Number(m[1]);
  };

  const args = process.argv.slice(2);
  const opts = { apply: false, hour: 17, all: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--apply') { opts.apply = true; continue; }
    if (a === '--all') { opts.all = true; continue; }

    // --hour=17 or --hour 17
    if (a === '--hour' && i + 1 < args.length) { opts.hour = parseHourInput(args[++i]); continue; }
    const mEq = a.match(/^--hour=(.+)$/);
    if (mEq) { opts.hour = parseHourInput(mEq[1]); continue; }

    // -h 17
    if (a === '-h' && i + 1 < args.length) { opts.hour = parseHourInput(args[++i]); continue; }

    // -hour:17 or -hour:08:00
    const mColon = a.match(/^-+hour:(.+)$/);
    if (mColon) { opts.hour = parseHourInput(mColon[1]); continue; }
  }
  if (Number.isNaN(opts.hour)) {
    console.error('Saat değeri geçersiz. Örnekler: --hour=17, --hour 17, -hour:08:00');
    process.exit(1);
  }
  return opts;
}

function istanbulHour(date) {
  // Europe/Istanbul sabit UTC+3 (yaz/kış saati yok). Güvenli ve hızlı hesap.
  const IST_OFFSET_MIN = 180;
  const localMs = date.getTime() + IST_OFFSET_MIN * 60 * 1000;
  const h = new Date(localMs).getUTCHours();
  return h; // 0-23
}

async function main() {
  const opts = parseArgs();
  const sa = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();

  console.log(opts.apply ? 'ÇALIŞTIRMA MODU: Uygulama (değişiklikler yapılacak)' : 'KURU ÇALIŞTIRMA: Değişiklik yapılmayacak');
  console.log(
    opts.all
      ? 'Filtre: memberIds/attendedMemberIds/walkInMemberIds alanlarından EN AZ BİRİ boş olan dersler'
      : `Filtre: ${String(opts.hour).padStart(2, '0')}:00 (Europe/Istanbul), alanlardan EN AZ BİRİ boş`
  );

  const coll = db.collection('lessons');
  const snap = await coll.get();
  if (snap.empty) {
    console.log('Ders koleksiyonu boş.');
    return;
  }

  let total = 0;
  let candidates = 0;
  let deleted = 0;

  for (const doc of snap.docs) {
    total += 1;
    const data = doc.data() || {};
    const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
    const walkIns = Array.isArray(data.walkInMemberIds) ? data.walkInMemberIds : [];
    const attended = Array.isArray(data.attendedMemberIds) ? data.attendedMemberIds : [];
    // EN AZ BİRİ boş ise aday
    const isAnyEmpty = memberIds.length === 0 || walkIns.length === 0 || attended.length === 0;

    if (!isAnyEmpty) continue;

    const ts = data.date && typeof data.date.toDate === 'function' ? data.date.toDate() : data.date ? new Date(data.date) : null;
    if (!ts || isNaN(ts.getTime())) continue;

    const hr = istanbulHour(ts);
    const match = opts.all || hr === opts.hour;
    if (!match) continue;

    candidates += 1;
    const iso = ts.toISOString();

    if (opts.apply) {
      await coll.doc(doc.id).delete();
      console.log(`SİLİNDİ: lessonId=${doc.id} (${iso})`);
      deleted += 1;
    } else {
      console.log(`Silinecek (dry-run): lessonId=${doc.id} (${iso})`);
    }
  }

  console.log('\nÖzet:');
  console.log('Toplam ders sayısı:', total);
  console.log('Aday (boş ve filtreye uyan) ders sayısı:', candidates);
  console.log('Silinen kayıt sayısı:', deleted);
}

main().catch((e) => {
  console.error('Hata oluştu:', e);
  process.exit(1);
});
