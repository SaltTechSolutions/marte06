#!/usr/bin/env node
/**
 * Export all members from Firestore to CSV
 * Usage: node scripts/export-members.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createWriteStream } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
const serviceAccount = resolve(__dirname, '../secrets/serviceAccount.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Helper: Firestore Timestamp -> readable date string
function formatDate(val) {
    if (!val) return '';
    // Firestore Timestamp
    if (val._seconds !== undefined) {
        return new Date(val._seconds * 1000).toLocaleDateString('tr-TR');
    }
    // JS Date or string
    if (val instanceof Date) return val.toLocaleDateString('tr-TR');
    if (typeof val === 'string') return val;
    // Timestamp with toDate()
    if (typeof val.toDate === 'function') return val.toDate().toLocaleDateString('tr-TR');
    return String(val);
}

function formatDateTime(val) {
    if (!val) return '';
    if (val._seconds !== undefined) {
        return new Date(val._seconds * 1000).toLocaleString('tr-TR');
    }
    if (val instanceof Date) return val.toLocaleString('tr-TR');
    if (typeof val === 'string') return val;
    if (typeof val.toDate === 'function') return val.toDate().toLocaleString('tr-TR');
    return String(val);
}

// Escape CSV value
function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function main() {
    console.log('🔄 Firestore\'dan üyeler çekiliyor...');

    const snapshot = await db.collection('members').get();

    if (snapshot.empty) {
        console.log('⚠️  Kayıtlı üye bulunamadı.');
        process.exit(0);
    }

    console.log(`✅ ${snapshot.size} üye bulundu.`);

    // Collect all unique field names across all documents
    const allFields = new Set();
    const rows = [];

    snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        Object.keys(data).forEach((key) => allFields.add(key));
        rows.push(data);
    });

    // Define column order (important fields first, rest alphabetically)
    const priorityFields = [
        'id', 'name', 'surname', 'email', 'phone',
        'birthDate', 'parentName', 'parentPhone',
        'isActive', 'notes', 'memberUid', 'createdAt', 'updatedAt'
    ];

    const remainingFields = [...allFields]
        .filter((f) => !priorityFields.includes(f))
        .sort();

    const columns = [...priorityFields.filter((f) => allFields.has(f)), ...remainingFields];

    // Column header translations
    const headerMap = {
        id: 'ID',
        name: 'Ad',
        surname: 'Soyad',
        email: 'E-posta',
        phone: 'Telefon',
        birthDate: 'Doğum Tarihi',
        parentName: 'Veli Adı',
        parentPhone: 'Veli Telefon',
        isActive: 'Aktif',
        notes: 'Notlar',
        memberUid: 'Üye UID',
        createdAt: 'Kayıt Tarihi',
        updatedAt: 'Güncelleme Tarihi',
    };

    // Build CSV
    const timestamp = new Date().toISOString().slice(0, 10);
    const outputPath = resolve(__dirname, `../uyeler_export_${timestamp}.csv`);
    const stream = createWriteStream(outputPath, { encoding: 'utf-8' });

    // BOM for Excel UTF-8 compatibility
    stream.write('\uFEFF');

    // Header row
    const headerRow = columns.map((col) => csvEscape(headerMap[col] || col)).join(',');
    stream.write(headerRow + '\n');

    // Data rows
    for (const row of rows) {
        const csvRow = columns.map((col) => {
            let val = row[col];

            // Format specific field types
            if (col === 'birthDate') val = formatDate(val);
            else if (col === 'createdAt' || col === 'updatedAt') val = formatDateTime(val);
            else if (col === 'isActive') val = val !== false ? 'Evet' : 'Hayır';
            else if (typeof val === 'object' && val !== null) val = JSON.stringify(val);

            return csvEscape(val);
        }).join(',');

        stream.write(csvRow + '\n');
    }

    stream.end();

    console.log(`\n📁 CSV dosyası oluşturuldu: ${outputPath}`);
    console.log(`   Toplam: ${rows.length} üye, ${columns.length} sütun`);
}

main().catch((err) => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
