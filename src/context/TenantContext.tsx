import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Tenant, TenantMembership } from '../types/tenant';

interface TenantContextType {
  activeTenant: Tenant | null;
  activeMembership: TenantMembership | null;
  userMemberships: TenantMembership[];
  loading: boolean;
  switchTenant: (tenantId: string) => void;
  refreshTenant: () => Promise<void>;
}

const DEFAULT_TARABYA_TENANT: Tenant = {
  id: 'tarabya-marte',
  code: 'TARABYA-01',
  name: 'Tarabya Marte',
  branding: {
    appName: 'Tarabya Marte',
    primaryColor: '#10B981',
    accentColor: '#06B6D4',
    themeMode: 'dark',
  },
  createdAt: new Date(),
};

const TenantContext = createContext<TenantContextType>({
  activeTenant: DEFAULT_TARABYA_TENANT,
  activeMembership: null,
  userMemberships: [],
  loading: false,
  switchTenant: () => {},
  refreshTenant: async () => {},
});

export const useTenant = () => useContext(TenantContext);

interface TenantProviderProps {
  children: React.ReactNode;
  userUid?: string | null;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children, userUid }) => {
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(DEFAULT_TARABYA_TENANT);
  const [activeMembership, setActiveMembership] = useState<TenantMembership | null>(null);
  const [userMemberships, setUserMemberships] = useState<TenantMembership[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load User Memberships from Firestore when userUid is available
  useEffect(() => {
    if (!userUid) {
      setUserMemberships([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'tenant_memberships'),
      where('userId', '==', userUid),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const memberships: TenantMembership[] = [];
        snapshot.forEach((docSnap) => {
          memberships.push({ id: docSnap.id, ...docSnap.data() } as TenantMembership);
        });

        setUserMemberships(memberships);

        // If user has memberships, set the first one or maintain selected
        if (memberships.length > 0) {
          const storedTenantId = localStorage.getItem('gymentra_active_tenant_id');
          const matched = memberships.find((m) => m.tenantId === storedTenantId) || memberships[0];
          setActiveMembership(matched);
          fetchTenantData(matched.tenantId);
        } else {
          // Default fallback to Tarabya Marte
          fetchTenantData('tarabya-marte');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching memberships:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userUid]);

  const fetchTenantData = async (tenantId: string) => {
    try {
      const docRef = doc(db, 'tenants', tenantId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const tenantData = { id: snap.id, ...snap.data() } as Tenant;
        setActiveTenant(tenantData);
        applyTenantBranding(tenantData);
      } else {
        setActiveTenant(DEFAULT_TARABYA_TENANT);
        applyTenantBranding(DEFAULT_TARABYA_TENANT);
      }
    } catch (err) {
      console.error('Failed to fetch tenant:', err);
      setActiveTenant(DEFAULT_TARABYA_TENANT);
      applyTenantBranding(DEFAULT_TARABYA_TENANT);
    }
  };

  const applyTenantBranding = (tenant: Tenant) => {
    if (!tenant.branding) return;

    const root = document.documentElement;
    if (tenant.branding.primaryColor) {
      root.style.setProperty('--color-primary', tenant.branding.primaryColor);
    }
    if (tenant.branding.accentColor) {
      root.style.setProperty('--color-accent', tenant.branding.accentColor);
    }
  };

  const switchTenant = (tenantId: string) => {
    localStorage.setItem('gymentra_active_tenant_id', tenantId);
    const membership = userMemberships.find((m) => m.tenantId === tenantId) || null;
    setActiveMembership(membership);
    fetchTenantData(tenantId);
  };

  const refreshTenant = async () => {
    if (activeTenant) {
      await fetchTenantData(activeTenant.id);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        activeTenant,
        activeMembership,
        userMemberships,
        loading,
        switchTenant,
        refreshTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};
