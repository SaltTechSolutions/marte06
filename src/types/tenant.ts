import { Timestamp } from 'firebase/firestore';

export interface TenantBranding {
  logoUrl?: string;
  primaryColor: string; // e.g., "#10B981"
  accentColor: string;  // e.g., "#06B6D4"
  appName: string;
  themeMode?: 'light' | 'dark' | 'system';
}

export interface Tenant {
  id: string;
  code: string; // e.g., "TARABYA-01", "OLYMPUS-84"
  name: string;
  branding: TenantBranding;
  ownerUid?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface TenantMembership {
  id: string;
  userId: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  status: 'pending' | 'active' | 'rejected' | 'suspended';
  role: 'member' | 'trainer' | 'admin';
  requestedAt: Timestamp | Date;
  approvedAt?: Timestamp | Date;
}
