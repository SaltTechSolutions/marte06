// src/pages/PackageManagement.tsx
import React, { useState, useEffect, useMemo } from 'react';
import AddPackageForm from '../components/AddPackageForm';
import Modal from '../components/Modal';
import { useToast } from '../components/ToastContext';
import PackageList from '../components/PackageList';
import type { Package } from '../types/Package';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import ConfirmModal from '../components/ConfirmModal';
import PageTransition from '../components/PageTransition';
import { Button } from '../newUI/primitives';
import { FiPlus, FiPackage } from 'react-icons/fi';

const PackageManagement: React.FC = () => {
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<string | null>(null);

  const collator = useMemo(() => new Intl.Collator('tr-TR', { sensitivity: 'base' }), []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'packages'));
      const packagesData = querySnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id })) as Package[];
      setPackages(packagesData.sort((a, b) => collator.compare(a.name || '', b.name || '')));
    } catch (error) {
      console.error("Error fetching packages: ", error);
      showToast('Paketler yüklenirken bir hata oluştu.', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleFormSuccess = () => {
    fetchPackages();
    setIsModalOpen(false);
    setEditingPackage(null);
  };

  const handleAddNewPackage = () => {
    setEditingPackage(null);
    setIsModalOpen(true);
  };

  const handleEditPackage = (pkg: Package) => {
    setEditingPackage(pkg);
    setIsModalOpen(true);
  };

  const handleDeleteRequest = (packageId: string) => {
    setPackageToDelete(packageId);
    setIsConfirmModalVisible(true);
  };

  const confirmDeletion = async () => {
    if (packageToDelete) {
      try {
        await deleteDoc(doc(db, 'packages', packageToDelete));
        showToast('Paket başarıyla silindi.', 'success');
        fetchPackages();
      } catch (error) {
        console.error("Error deleting package: ", error);
        showToast('Paket silinirken bir hata oluştu.', 'error');
      }
      setPackageToDelete(null);
      setIsConfirmModalVisible(false);
    }
  };

  return (
    <PageTransition className="p-4 md:p-6 max-w-4xl mx-auto pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiPackage className="text-indigo-600" /> Paket Yönetimi
          </h1>
          <p className="text-gray-500 text-sm">Sistemdeki paketleri düzenleyin.</p>
        </div>
        <Button onClick={handleAddNewPackage} variant="primary" tone="solid" icon={<FiPlus />}>
          Yeni Paket
        </Button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPackage(null);
        }}
        title={editingPackage ? 'Paketi Düzenle' : 'Yeni Paket Ekle'}
      >
        <AddPackageForm onSuccess={handleFormSuccess} existingPackage={editingPackage} />
      </Modal>

      {loading ? (
        <div className="flex justify-center p-8"><div className="spinner"></div></div>
      ) : (
        <PackageList
          packages={packages}
          onPackageEdited={handleEditPackage}
          onPackageDeleted={handleDeleteRequest}
        />
      )}

      <ConfirmModal
        isVisible={isConfirmModalVisible}
        message="Bu paketi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        onConfirm={confirmDeletion}
        onCancel={() => {
          setIsConfirmModalVisible(false);
          setPackageToDelete(null);
        }}
      />
    </PageTransition>
  );
}

export default PackageManagement;
