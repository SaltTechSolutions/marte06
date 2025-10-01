// src/types/index.ts - Merkezi Type Definitions
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// MEMBER TYPES
// ============================================================================

export interface Member {
  id: string;
  name: string;
  surname: string;
  email?: string;
  phone?: string;
  birthDate?: Timestamp | Date | string | null;
  memberUid?: string; // Firebase Auth UID
  parentName?: string; // 18 yaş altı için
  parentPhone?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// PACKAGE TYPES
// ============================================================================

export interface Package {
  id: string;
  name: string;
  description?: string;
  price: number;
  lessonCount?: number | null; // Ders sayısı bazlı paketler için
  durationDays?: number | null; // Süre bazlı paketler için
  isActive: boolean;
  createdAt: Timestamp;
}

export interface AssignedPackage {
  id: string;
  memberId: string;
  memberUid?: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  totalLessonCount?: number | null;
  startDate: Timestamp;
  endDate?: Timestamp | null;
  assignedAt: Timestamp;
  autoPaymentId?: string;
}

// ============================================================================
// LESSON TYPES (Refactored for consistency)
// ============================================================================

export interface LessonAttendance {
  present: string[]; // Member IDs who attended
  absent: string[]; // Member IDs who were absent
  walkIn: string[]; // Walk-in member IDs
}

export interface LessonAttendanceUids {
  present: string[]; // Member UIDs who attended
  absent: string[]; // Member UIDs who were absent
  walkIn: string[]; // Walk-in member UIDs
}

export interface Lesson {
  id: string;
  date: Timestamp | Date;
  
  // Scheduled members
  scheduledMemberIds: string[]; // Renamed from memberIds for clarity
  scheduledMemberUids: string[]; // Renamed from memberUids for clarity
  
  // Attendance tracking (new structure)
  attendance: LessonAttendance;
  attendanceUids: LessonAttendanceUids;
  
  // Legacy fields (deprecated, kept for backward compatibility)
  /** @deprecated Use attendance.present instead */
  attendedMemberIds?: string[];
  /** @deprecated Use attendanceUids.present instead */
  attendedMemberUids?: string[];
  /** @deprecated Use attendance.absent instead */
  absentMemberIds?: string[];
  /** @deprecated Use attendanceUids.absent instead */
  absentMemberUids?: string[];
  /** @deprecated Use attendance.walkIn instead */
  walkInMemberIds?: string[];
  /** @deprecated Use attendanceUids.walkIn instead */
  walkInMemberUids?: string[];
  
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Helper type for creating new lessons
export interface CreateLessonInput {
  date: Date;
  scheduledMemberIds: string[];
  scheduledMemberUids: string[];
}

// ============================================================================
// BRANCH TYPES
// ============================================================================

export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// PAYMENT TYPES
// ============================================================================

export interface Payment {
  id: string;
  memberId: string;
  assignedPackageId?: string;
  amount: number;
  date: Timestamp;
  notes?: string;
  recordedAt: Timestamp;
  recordedBy?: string; // Admin user ID
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export interface AttendanceRecord {
  date: Date;
  timeSlot?: string;
  lessonId: string;
}

export interface MemberAttendanceReport {
  memberId: string;
  memberName: string;
  totalLessons: number;
  attendedLessons: number;
  absentLessons: number;
  attendanceRate: number; // percentage
  records: AttendanceRecord[];
}

export interface MonthlyAttendanceData {
  label: string; // Month name
  value: number; // Total attendance count
}

// ============================================================================
// UI HELPER TYPES
// ============================================================================

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export interface ConfirmModalProps {
  isVisible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

// ============================================================================
// AUTH TYPES
// ============================================================================

export type UserRole = 'admin' | 'member' | null;

export interface AuthContextType {
  currentUser: any | null; // Firebase User type
  userRole: UserRole;
  loading: boolean;
  memberId: string | null;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface MemberFormData {
  name: string;
  surname: string;
  email?: string;
  phone?: string;
  birthDay?: string;
  birthMonth?: string;
  birthYear?: string;
  parentName?: string;
  parentPhone?: string;
  notes?: string;
}

export interface PackageFormData {
  name: string;
  description?: string;
  price: number;
  lessonCount?: number | null;
  durationDays?: number | null;
  isActive: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

export type ViewMode = 'day' | 'week' | 'month';

export interface ExpiringPackage {
  assignedPackageId: string;
  memberId: string;
  memberName: string;
  packageName: string;
  endDate: Date;
  daysRemaining: number;
}
