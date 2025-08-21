// src/components/PackageList.tsx
import React from 'react';
import type { Package } from '../types/Package';
import { formatPrice } from '../utils/formatters';

interface PackageListProps {
  packages: Package[];
  onPackageEdited: (pkg: Package) => void;
  onPackageDeleted: (packageId: string) => void;
}

const PackageList: React.FC<PackageListProps> = ({ packages, onPackageEdited, onPackageDeleted }) => {
  if (packages.length === 0) {
    return (
      <div className="section">
        <p style={{ color: 'var(--muted-color)' }}>Henüz tanımlı paket bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h3 className="modal-title">Tanımlı Paketler</h3>
      <ul className="list">
        {packages.map((pkg) => (
          <li key={pkg.id} className="list-item">
            <div className="item-info" style={{ flex: 1, marginRight: 12 }}>
              <div><strong>{pkg.name}</strong></div>
              <div style={{ color: 'var(--muted-color)', fontSize: '0.95rem' }}>
                <strong>Fiyat:</strong> {formatPrice(pkg.price)} TL
                {pkg.lessonCount != null && <> • <strong>Ders:</strong> {pkg.lessonCount}</>}
                {pkg.durationDays != null && <> • <strong>Süre:</strong> {pkg.durationDays} Gün</>}
                <> • <strong>Durum:</strong> {pkg.isActive ? 'Aktif' : 'Pasif'}</>
              </div>
            </div>
            <div className="item-actions">
              <button
                onClick={() => onPackageEdited(pkg)}
                className="btn btn-secondary"
              >
                Düzenle
              </button>
              <button
                onClick={() => onPackageDeleted(pkg.id)}
                className="btn btn-danger"
              >
                Sil
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PackageList;
