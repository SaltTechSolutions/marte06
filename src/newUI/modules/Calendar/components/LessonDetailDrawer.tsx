import { useState } from 'react';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
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
  onRefetch?: () => void;
};

const statusVariant: Record<CalendarLesson['status'], 'neutral' | 'success' | 'danger'> = {
  scheduled: 'neutral',
  completed: 'success',
  cancelled: 'danger',
};

export const LessonDetailDrawer = ({ lesson, onClose, onMarkAttendance, onRefetch }: LessonDetailDrawerProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [newHour, setNewHour] = useState('');
  const [newMinute, setNewMinute] = useState('');

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

  const handleDeleteLesson = async () => {
    if (!confirm('Bu dersi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'lessons', lesson.id));
      console.log('Lesson deleted:', lesson.id);

      if (onRefetch) {
        setTimeout(() => onRefetch(), 500);
      }

      onClose();
    } catch (error) {
      console.error('Delete lesson error:', error);
      alert('Ders silinirken hata oluştu: ' + (error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTimeChange = async () => {
    const hour = parseInt(newHour);
    const minute = parseInt(newMinute);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      alert('Geçerli bir saat ve dakika girin (Saat: 0-23, Dakika: 0-59)');
      return;
    }

    try {
      const newStart = new Date(start);
      newStart.setHours(hour, minute, 0, 0);

      const newEnd = new Date(newStart);
      newEnd.setHours(hour + 1, minute, 0, 0);

      await updateDoc(doc(db, 'lessons', lesson.id), {
        date: newStart,
        endDate: newEnd,
      });

      console.log('Lesson time updated:', lesson.id, newStart);

      if (onRefetch) {
        setTimeout(() => onRefetch(), 500);
      }

      setIsEditingTime(false);
      onClose();
    } catch (error) {
      console.error('Update lesson time error:', error);
      alert('Ders saati güncellenirken hata oluştu: ' + (error as Error).message);
    }
  };

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

        {isEditingTime ? (
          <div className="lesson-drawer__time-edit">
            <h4>Ders Saatini Değiştir</h4>
            <div className="lesson-drawer__time-inputs">
              <div>
                <label htmlFor="hour-input">Saat</label>
                <input
                  id="hour-input"
                  type="number"
                  min="0"
                  max="23"
                  placeholder={start.getHours().toString()}
                  value={newHour}
                  onChange={(e) => setNewHour(e.target.value)}
                  className="lesson-drawer__time-input"
                />
              </div>
              <div>
                <label htmlFor="minute-input">Dakika</label>
                <input
                  id="minute-input"
                  type="number"
                  min="0"
                  max="59"
                  placeholder={start.getMinutes().toString()}
                  value={newMinute}
                  onChange={(e) => setNewMinute(e.target.value)}
                  className="lesson-drawer__time-input"
                />
              </div>
            </div>
            <div className="lesson-drawer__time-actions">
              <Button variant="neutral" tone="ghost" onClick={() => setIsEditingTime(false)}>
                İptal
              </Button>
              <Button variant="primary" onClick={handleTimeChange}>
                Saati Güncelle
              </Button>
            </div>
          </div>
        ) : null}

        <div className="lesson-drawer__footer">
          <Button
            variant="danger"
            tone="ghost"
            onClick={handleDeleteLesson}
            disabled={isDeleting}
          >
            {isDeleting ? 'Siliniyor...' : 'Dersi Sil'}
          </Button>
          <Button
            variant="primary"
            tone="ghost"
            onClick={() => setIsEditingTime(true)}
          >
            Saati Değiştir
          </Button>
        </div>
      </div>
    </div>
  );
};
