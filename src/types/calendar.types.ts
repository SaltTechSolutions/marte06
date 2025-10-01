// Calendar types
export type Lesson = {
  id: string;
  date: Date;
  memberIds: string[];
  attendedMemberIds: string[];
  absentMemberIds: string[];
  walkInMemberIds: string[];
};

export type ExpiringEntry = {
  assignedPackageId: string;
  memberId: string;
  endDate: Date;
};

export type ViewMode = 'month' | 'week' | 'day';
