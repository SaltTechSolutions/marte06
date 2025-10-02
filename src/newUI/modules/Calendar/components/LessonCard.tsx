import type { CalendarLesson } from '../types';
import { Badge } from '../../../primitives/Badge';
import { Button } from '../../../primitives/Button';
import { IconButton } from '../../../primitives/IconButton';
import { Alert } from '../../../primitives/Alert';
import './calendar.css';

export type LessonCardProps = {
  lesson: CalendarLesson;
  onOpen?: (lesson: CalendarLesson) => void;
};

const statusVariantMap: Record<CalendarLesson['status'], 'neutral' | 'success' | 'danger'> = {
  scheduled: 'neutral',
  completed: 'success',
  cancelled: 'danger',
};

export const LessonCard = ({ lesson, onOpen }: LessonCardProps) => {
  const start = new Date(lesson.start);
  const end = new Date(lesson.end);
  const timeRange = `${start.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${end.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const isCancelled = lesson.status === 'cancelled';

  return (
    <article className="calendar-lesson-card" data-status={lesson.status}>
      <div className="calendar-lesson-card__title">
        <h3>{lesson.title}</h3>
        <Badge variant={statusVariantMap[lesson.status]}>
          {lesson.status === 'scheduled' && 'Planlandı'}
          {lesson.status === 'completed' && 'Tamamlandı'}
          {lesson.status === 'cancelled' && 'İptal'}
        </Badge>
      </div>

      <div className="calendar-lesson-card__meta">
        <span>{timeRange}</span>
        <span>👥 {lesson.members}</span>
      </div>

      {isCancelled && (
        <Alert
          variant="danger"
          title="Ders iptal edildi"
          description="Üyeleri bilgilendirdiğinizden emin olun."
        />
      )}

      <div className="calendar-lesson-card__actions">
        <Button variant="primary" size="sm" onClick={() => onOpen?.(lesson)}>
          Detaylar
        </Button>
        <IconButton
          variant="neutral"
          tone="ghost"
          size="sm"
          aria-label="Ders seçenekleri"
          onClick={() => onOpen?.(lesson)}
          icon={<span>⋮</span>}
        />
      </div>
    </article>
  );
};
