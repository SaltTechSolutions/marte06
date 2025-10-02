import type { CalendarDay } from '../types';
import { LessonCard } from './LessonCard';
import './calendar.css';

export type LessonListProps = {
  days: CalendarDay[];
  onOpenLesson?: (day: CalendarDay, lessonId: string) => void;
};

export const LessonList = ({ days, onOpenLesson }: LessonListProps) => {
  return (
    <div className="calendar-lessons">
      {days.map((day) => (
        <section key={day.date} className="calendar-lessons__section">
          <header className="calendar-lessons__header">
            <h3>{new Date(day.date).toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' })}</h3>
          </header>
          <div className="calendar-lessons__grid">
            {day.lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                onOpen={() => onOpenLesson?.(day, lesson.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
