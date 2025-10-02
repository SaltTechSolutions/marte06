import type { CalendarDay, CalendarLesson } from '../types';
import { dateKeyTZ, TZ } from '../../../../utils/dateHelpers';
import './calendar.css';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 - 21:00

export type CalendarWeekGridProps = {
  currentDate: Date;
  days: CalendarDay[];
  onOpenLesson?: (lessonId: string) => void;
  onEmptySlot?: (date: Date, hour: number) => void;
};

const getWeekDays = (currentDate: Date) => {
  const base = new Date(currentDate);
  const dow = base.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const start = new Date(base);
  start.setDate(base.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const formatDayHeader = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('tr-TR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: TZ,
  });
  return formatter.format(date);
};

const getLessonsForDay = (day: Date, lessonsMap: Map<string, CalendarLesson[]>) => {
  const key = dateKeyTZ(day);
  return lessonsMap.get(key) ?? [];
};

export const CalendarWeekGrid = ({ currentDate, days, onOpenLesson, onEmptySlot }: CalendarWeekGridProps) => {
  const weekDays = getWeekDays(currentDate);
  const lessonsMap = new Map<string, CalendarLesson[]>();

  days.forEach((day) => {
    lessonsMap.set(day.date, day.lessons);
  });

  return (
    <div className="calendar-week-grid" role="grid" aria-label="Haftalık takvim">
      <div className="calendar-week-grid__header" role="row">
        <div className="calendar-week-grid__time-col" aria-hidden>
          <span>Saat</span>
        </div>
        {weekDays.map((day) => {
          const isToday = dateKeyTZ(day) === dateKeyTZ(new Date());
          return (
            <div
              key={day.toISOString()}
              className="calendar-week-grid__day"
              role="columnheader"
              aria-label={formatDayHeader(day)}
              data-today={isToday}
            >
              <span>{formatDayHeader(day)}</span>
            </div>
          );
        })}
      </div>

      <div className="calendar-week-grid__body">
        {HOURS.map((hour) => (
          <div className="calendar-week-grid__row" key={hour} role="row">
            <div className="calendar-week-grid__time-col" role="gridcell" aria-label={`${hour}:00`}>
              <span>{hour.toString().padStart(2, '0')}:00</span>
            </div>
            {weekDays.map((day) => {
              const lessons = getLessonsForDay(day, lessonsMap).filter((lesson) => {
                const start = new Date(lesson.start);
                return start.getHours() === hour;
              });

              const slotDate = new Date(day);
              slotDate.setHours(hour, 0, 0, 0);

              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className="calendar-week-grid__cell"
                  role="gridcell"
                  onClick={() => {
                    if (lessons.length === 0) {
                      onEmptySlot?.(slotDate, hour);
                    }
                  }}
                >
                  {lessons.length === 0 ? (
                    <button
                      type="button"
                      className="calendar-week-grid__empty"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEmptySlot?.(slotDate, hour);
                      }}
                    >
                      + Ders ekle
                    </button>
                  ) : (
                    <div className="calendar-week-grid__lessons">
                      {lessons.map((lesson) => (
                        <button
                          key={lesson.id}
                          type="button"
                          className="calendar-week-grid__lesson"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenLesson?.(lesson.id);
                          }}
                        >
                          <span className="calendar-week-grid__lesson-title">{lesson.title}</span>
                          <span className="calendar-week-grid__lesson-meta">👥 {lesson.members}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarWeekGrid;
