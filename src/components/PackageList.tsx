// src/components/PackageList.tsx
import React from 'react';
import type { Package } from '../types/Package';
import './PackageList.css';

interface PackageListProps {
  packages: Package[];
  onPackageEdited: (pkg: Package) => void;
  onPackageDeleted: (packageId: string) => void;
}

const PackageList: React.FC<PackageListProps> = ({ packages, onPackageEdited, onPackageDeleted }) => {
  if (packages.length === 0) {
    return (
      <div className="text-center py-6 text-gray-600">Henüz tanımlı paket bulunmamaktadır.</div>
    );
  }

  return (
    <div className="package-list space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">Tanımlı Paketler</h3>
      <ul className="space-y-2">
        {packages.map(pkg => (
          <li
            key={pkg.id}
            className={`rounded-md border p-3 flex items-start justify-between gap-3 ${
              pkg.isActive ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="package-info">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-medium text-gray-800">{pkg.name}</h4>
                <span className={`text-xs px-2 py-0.5 rounded-full ${pkg.isActive ? 'bg-emerald-200 text-emerald-900' : 'bg-gray-200 text-gray-800'}`}>
                  {pkg.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                <span><strong>Fiyat:</strong> {pkg.price} TL</span>
                {pkg.lessonCount != null && <span><strong>Ders:</strong> {pkg.lessonCount}</span>}
                {pkg.durationDays != null && <span><strong>Süre:</strong> {pkg.durationDays} Gün</span>}
              </div>
            </div>
            <div className="package-actions flex shrink-0 items-center gap-2">
              <button
                onClick={() => onPackageEdited(pkg)}
                className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs"
              >
                Düzenle
              </button>
              <button
                onClick={() => onPackageDeleted(pkg.id)}
                className="px-3 py-1 rounded-md bg-red-600 text-white text-xs"
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
