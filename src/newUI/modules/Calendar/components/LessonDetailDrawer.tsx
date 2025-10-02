import type { CalendarLesson, CalendarParticipantStatus } from '../types';
import { ParticipantList } from './ParticipantList';
import { Badge } from '../../../primitives/Badge';
import { Button } from '../../../primitives/Button';
import { Alert } from '../../../primitives/Alert';
import './calendar.css';

export type LessonDetailDrawerProps = {
  lesson: CalendarLesson | null;
  onClose: () => void;
  onMarkAttendance?: (
    lessonId: string,
    participantId: string,
    status: CalendarParticipantStatus,
  ) => void;
};

const statusVariant: Record<CalendarLesson['status'], 'neutral' | 'success' | 'danger'> = {
  scheduled: 'neutral',
  completed: 'success',
  cancelled: 'danger',
};

export const LessonDetailDrawer = ({ lesson, onClose, onMarkAttendance }: LessonDetailDrawerProps) => {
  if (!lesson) {
    return null;
  }

  const start = new Date(lesson.start);
  const end = new Date(lesson.end);
  const dateLabel = start.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const timeRange = `${start.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${end.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  return (
    <div className="lesson-drawer__overlay" role="dialog" aria-modal="true" aria-labelledby="lesson-drawer-title">
      <div className="lesson-drawer">
        <header className="lesson-drawer__header">
          <div className="lesson-drawer__titles">
            <h3 id="lesson-drawer-title">{lesson.title}</h3>
            <p>
              {dateLabel} • {timeRange}
            </p>
          </div>
          <Button variant="neutral" tone="ghost" onClick={onClose} aria-label="Dersi kapat">
            Kapat
          </Button>
        </header>

        <div className="lesson-drawer__meta">
          <Badge variant={statusVariant[lesson.status]}>{lesson.status}</Badge>
          <Badge variant="primary">👥 {lesson.members}</Badge>
        </div>

        {lesson.status === 'cancelled' && (
          <Alert
            variant="danger"
            title="Ders iptal edildi"
            description="Üyeleri bilgilendirip alternatif dersler sunmayı unutmayın."
          />
        )}

        {lesson.notes && lesson.status !== 'cancelled' && (
          <Alert variant="warning" title="Not" description={lesson.notes} />
        )}

        <div className="lesson-drawer__body">
          <ParticipantList
            participants={lesson.participants}
            onMarkAttendance={onMarkAttendance ? (participantId, status) => onMarkAttendance(lesson.id, participantId, status) : undefined}
          />
        </div>
      </div>
    </div>
  );
};
