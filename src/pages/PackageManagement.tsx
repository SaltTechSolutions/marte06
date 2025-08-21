// src/pages/PackageManagement.tsx
import React, { useState, useEffect } from 'react';
import AddPackageForm from '../components/AddPackageForm';
import Modal from '../components/Modal';
import { useToast } from '../components/ToastContext';
import PackageList from '../components/PackageList';
import type { Package } from '../types/Package';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import ConfirmModal from '../components/ConfirmModal';

const PackageManagement: React.FC = () => {
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<string | null>(null);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'packages'));
      const packagesData = querySnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id })) as Package[];
      setPackages(packagesData.sort((a, b) => a.name.localeCompare(b.name)));
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
    fetchPackages(); // Refresh the list
    setIsModalOpen(false); // Close modal
    setEditingPackage(null); // Reset editing state
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
        fetchPackages(); // Refresh the list
      } catch (error) {
        console.error("Error deleting package: ", error);
        showToast('Paket silinirken bir hata oluştu.', 'error');
      }
      setPackageToDelete(null);
      setIsConfirmModalVisible(false);
    }
  };

  return (
    <div className="section">
      <div className="section" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleAddNewPackage} className="btn btn-primary">
          Yeni Paket Ekle
        </button>
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

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--muted-color)', textAlign: 'center' }}>Paketler yükleniyor...</p>
        ) : (
          <PackageList
            packages={packages}
            onPackageEdited={handleEditPackage}
            onPackageDeleted={handleDeleteRequest}
          />
        )}
      </div>

      <ConfirmModal
        isVisible={isConfirmModalVisible}
        message="Bu paketi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        onConfirm={confirmDeletion}
        onCancel={() => {
          setIsConfirmModalVisible(false);
          setPackageToDelete(null);
        }}
      />
    </div>
  );
}

export default PackageManagement;
