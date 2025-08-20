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

function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

async function main() {
  const q = (process.argv[2] || '').trim();
  if (!q) {
    console.error('Kullanım: node scripts/list_members_filter.cjs <arama(isim/soyisim/email)>');
    process.exit(1);
  }
  const nq = normalize(q);

  const sa = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();

  const snap = await db.collection('members').get();
  const rows = [];
  snap.forEach(doc => {
    const d = doc.data() || {};
    const name = d.name || '';
    const surname = d.surname || '';
    const email = d.email || '';
    const match = [name, surname, email].some(v => normalize(v).includes(nq));
    if (match) {
      rows.push({ id: doc.id, name, surname, email });
    }
  });

  if (rows.length === 0) {
    console.log('Eşleşen üye bulunamadı.');
  } else {
    console.log(`Bulunan ${rows.length} üye:`);
    for (const r of rows) {
      console.log(`- id=${r.id} | ${r.name || ''} ${r.surname || ''} | ${r.email || ''}`);
    }
  }
}

main().catch(err => {
  console.error('Hata oluştu:', err);
  process.exit(1);
});
