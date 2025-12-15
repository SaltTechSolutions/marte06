// src/components/PackageList.tsx
import React from 'react';
import type { Package } from '../types/Package';
import { formatPrice } from '../utils/formatters';
import { FiEdit2, FiTrash2, FiPackage, FiCheck, FiX, FiClock, FiBook } from 'react-icons/fi';
import { Button } from '../newUI/primitives';

interface PackageListProps {
  packages: Package[];
  onPackageEdited: (pkg: Package) => void;
  onPackageDeleted: (packageId: string) => void;
}

const PackageList: React.FC<PackageListProps> = ({ packages, onPackageEdited, onPackageDeleted }) => {
  if (packages.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <p className="text-gray-500">Henüz tanımlı paket bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {packages.map((pkg) => (
        <div key={pkg.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative overflow-hidden">
          {/* Status Badge */}
          <div className={`absolute top-4 right-4 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${pkg.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {pkg.isActive ? <FiCheck size={10} /> : <FiX size={10} />}
            {pkg.isActive ? 'Aktif' : 'Pasif'}
          </div>

          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 text-xl shrink-0">
              <FiPackage />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg leading-tight">{pkg.name}</h3>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{formatPrice(pkg.price)} <span className="text-sm font-normal text-gray-500">TL</span></p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 text-sm text-gray-600">
            <div className="bg-gray-50 p-2 rounded-lg flex items-center gap-2">
              <FiBook className="text-gray-400" />
              <span>{pkg.lessonCount != null ? `${pkg.lessonCount} Ders` : 'Sınırsız'}</span>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg flex items-center gap-2">
              <FiClock className="text-gray-400" />
              <span>{pkg.durationDays != null ? `${pkg.durationDays} Gün` : 'Süresiz'}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-50">
            <Button
              onClick={() => onPackageEdited(pkg)}
              variant="neutral"
              tone="ghost"
              size="sm"
              className="flex-1 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50"
              icon={<FiEdit2 />}
            >
              Düzenle
            </Button>
            <Button
              onClick={() => onPackageDeleted(pkg.id)}
              variant="danger"
              tone="ghost"
              size="sm"
              className="w-10 px-0 flex items-center justify-center"
              icon={<FiTrash2 />}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default PackageList;
