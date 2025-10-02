import { Button } from '../../../primitives/Button';
import './calendar.css';

export type CalendarEmptyStateProps = {
  onCreateLesson?: () => void;
};

export const CalendarEmptyState = ({ onCreateLesson }: CalendarEmptyStateProps) => {
  return (
    <div className="calendar-empty">
      <div className="calendar-empty__content">
        <span className="calendar-empty__icon" aria-hidden>
          📅
        </span>
        <h3>Henüz ders planlanmadı</h3>
        <p>
          Takvimde bu tarih aralığı için ders bulunmuyor. Hızlıca yeni bir ders oluşturarak üyeleri
          davet edin.
        </p>
        <Button variant="primary" onClick={onCreateLesson}>
          Ders Oluştur
        </Button>
      </div>
    </div>
  );
};
