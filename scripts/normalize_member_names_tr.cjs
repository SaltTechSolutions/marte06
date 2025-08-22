"use strict";

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Service account JSON path (same convention as other scripts)
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "../secrets/serviceAccount.json");

function loadServiceAccount() {
  try {
    const raw = fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Service account yüklenemedi:", SERVICE_ACCOUNT_PATH);
    console.error(e);
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { apply: false, memberId: "" };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--apply") { opts.apply = true; continue; }
    if ((a === "--member" || a === "-m") && i + 1 < args.length) { opts.memberId = String(args[++i]); continue; }
    const mEq = a.match(/^--member=(.+)$/);
    if (mEq) { opts.memberId = String(mEq[1]); continue; }
  }
  return opts;
}

// Turkish-aware Title Case (dotted/dotless i)
function toTurkishTitleCase(input) {
  if (!input) return "";
  const cap = (part) => {
    if (!part) return "";
    const lower = String(part).toLocaleLowerCase("tr-TR");
    const first = lower.charAt(0).toLocaleUpperCase("tr-TR");
    return first + lower.slice(1);
  };
  return String(input)
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split(/([\-’'])/u) // keep separators
        .map((seg) => (/^[\-’']$/.test(seg) ? seg : cap(seg)))
        .join("")
    )
    .join(" ");
}

async function main() {
  const opts = parseArgs();
  const sa = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();

  console.log(opts.apply ? "ÇALIŞTIRMA MODU: Uygulama (değişiklikler yapılacak)" : "KURU ÇALIŞTIRMA: Değişiklik yapılmayacak");
  if (opts.memberId) console.log("Sadece üye için çalıştırılıyor:", opts.memberId);

  let total = 0;
  let candidates = 0;
  let updated = 0;

  if (opts.memberId) {
    const ref = db.collection("members").doc(opts.memberId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log("Üye bulunamadı:", opts.memberId);
      return;
    }
    total = 1;
    const data = snap.data() || {};
    await processMemberDoc(ref, data, opts, ({ changed, desc }) => {
      if (changed) {
        candidates += 1;
        if (opts.apply) updated += 1;
        console.log(desc);
      }
    });
  } else {
    console.log("Üyeler yükleniyor...");
    const qSnap = await db.collection("members").get();
    if (qSnap.empty) {
      console.log("Üye bulunamadı.");
      return;
    }
    total = qSnap.size;
    for (const doc of qSnap.docs) {
      const data = doc.data() || {};
      await processMemberDoc(doc.ref, data, opts, ({ changed, desc }) => {
        if (changed) {
          candidates += 1;
          if (opts.apply) updated += 1;
          console.log(desc);
        }
      });
    }
  }

  console.log("\nÖzet:");
  console.log("Toplam üyeler:", total);
  console.log("Aday (normalize edilecek):", candidates);
  console.log("Güncellenen kayıt sayısı:", updated);
}

async function processMemberDoc(ref, data, opts, onResult) {
  const origName = data.name ?? "";
  const origSurname = data.surname ?? "";
  const origParentName = (data.parentName === undefined ? undefined : (data.parentName ?? null));

  const newName = toTurkishTitleCase(String(origName));
  const newSurname = toTurkishTitleCase(String(origSurname));
  const newParentName = origParentName === undefined ? undefined : (origParentName === null ? null : toTurkishTitleCase(String(origParentName)));

  const changes = [];
  if (newName !== origName) changes.push(`name: '${origName}' -> '${newName}'`);
  if (newSurname !== origSurname) changes.push(`surname: '${origSurname}' -> '${newSurname}'`);
  if (newParentName !== undefined && newParentName !== origParentName) changes.push(`parentName: '${origParentName}' -> '${newParentName}'`);

  if (changes.length === 0) {
    onResult({ changed: false, desc: `Atlanıyor members/${ref.id} (değişiklik yok).` });
    return;
  }

  const update = { name: newName, surname: newSurname, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (newParentName !== undefined) update.parentName = newParentName;

  if (opts.apply) {
    await ref.update(update);
    onResult({ changed: true, desc: `GÜNCELLENDİ: members/${ref.id} -> ${changes.join(", ")}` });
  } else {
    onResult({ changed: true, desc: `Güncellenecek (dry-run): members/${ref.id} -> ${changes.join(", ")}` });
  }
}

main().catch((e) => {
  console.error("Hata oluştu:", e);
  process.exit(1);
});
