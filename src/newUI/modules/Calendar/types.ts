export type CalendarParticipantStatus = 'scheduled' | 'attended' | 'absent';

export type CalendarParticipant = {
  id: string;
  name: string;
  status: CalendarParticipantStatus;
  isWalkIn?: boolean;
};

export type CalendarLesson = {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  members: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  participants: CalendarParticipant[];
  notes?: string;
};

export type CalendarDay = {
  date: string; // YYYY-MM-DD
  lessons: CalendarLesson[];
};

export type CalendarOverview = {
  rangeLabel: string;
  totalLessons: number;
  attendanceRate: number;
  expiringPackages: number;
};
