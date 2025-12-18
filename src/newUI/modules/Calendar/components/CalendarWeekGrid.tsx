// src/newUI/modules/Calendar/components/CalendarWeekGrid.tsx
import { useMemo } from 'react';
import type { CalendarDay, CalendarLesson } from '../types';
import { dateKeyTZ, hourTZ } from '../../../../utils/dateHelpers';
import './calendar.css';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 - 22:00

export type CalendarWeekGridProps = {
  currentDate: Date;
  days: CalendarDay[];
  onOpenLesson?: (lessonId: string) => void;
  onEmptySlot?: (date: Date, hour: number) => void;
};

const getWeekDays = (currentDate: Date) => {
  const base = new Date(currentDate);
  const dow = base.getDay();
  const diff = dow === 0 ? -6 : 1 - dow; // Start from Monday
  const start = new Date(base);
  start.setDate(base.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};



const getLessonsForDay = (day: Date, lessonsMap: Map<string, CalendarLesson[]>) => {
  const key = dateKeyTZ(day);
  return lessonsMap.get(key) ?? [];
};

const CalendarWeekGrid = ({ currentDate, days, onOpenLesson, onEmptySlot }: CalendarWeekGridProps) => {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const lessonsMap = new Map<string, CalendarLesson[]>();
  days.forEach((day) => {
    lessonsMap.set(day.date, day.lessons);
  });

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
      {/* Header Row (Sticky) */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {/* Time Column Header */}
        <div className="w-16 flex-shrink-0 border-r border-gray-100 p-2 flex items-center justify-center bg-gray-50 z-20 sticky left-0">
          <span className="text-xs font-bold text-gray-400">Saat</span>
        </div>

        {/* Days Header (Scrollable) */}
        <div className="flex-1 overflow-hidden"> {/* Wrapper to hide scrollbar if needed, but main scroll is on body */}
          <div className="flex w-full"> {/* This matches the body width */}
            {weekDays.map((day) => {
              const isToday = dateKeyTZ(day) === dateKeyTZ(new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={`flex-1 min-w-[100px] p-2 text-center border-r border-gray-100 last:border-0 ${isToday ? 'bg-indigo-50' : ''}`}
                >
                  <div className={`text-xs uppercase font-bold mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(day)}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid Body (Scrollable) */}
      <div className="flex-1 overflow-y-auto overflow-x-auto relative">
        <div className="min-w-[700px]"> {/* Force min width for 7 days on mobile */}
          {HOURS.map((hour) => (
            <div key={hour} className="flex border-b border-gray-50 min-h-[80px]">
              {/* Time Column (Sticky Left) */}
              <div className="w-16 flex-shrink-0 border-r border-gray-100 bg-white sticky left-0 z-10 flex items-start justify-center pt-2">
                <span className="text-xs font-medium text-gray-500">{hour.toString().padStart(2, '0')}:00</span>
              </div>

              {/* Days Columns */}
              {weekDays.map((day) => {
                const lessons = getLessonsForDay(day, lessonsMap).filter((lesson) => {
                  const start = new Date(lesson.start);
                  // Use hourTZ for consistent timezone comparison
                  return hourTZ(start) === hour;
                });

                const slotDate = new Date(day);
                slotDate.setHours(hour, 0, 0, 0);
                const isToday = dateKeyTZ(day) === dateKeyTZ(new Date());

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={`flex-1 min-w-[100px] border-r border-gray-50 last:border-0 p-1 relative group ${isToday ? 'bg-indigo-50/10' : ''}`}
                    onClick={() => {
                      if (lessons.length === 0) onEmptySlot?.(slotDate, hour);
                    }}
                  >
                    {lessons.length === 0 ? (
                      <div className="absolute inset-0 hover:bg-indigo-50/50 transition-colors cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="text-indigo-400 text-xl font-light">+</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {lessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            className={`
                               w-full text-left p-1.5 rounded-lg text-xs font-medium border-l-2 shadow-sm transition-all hover:scale-[1.02]
                               ${lesson.status === 'cancelled' ? 'bg-red-50 border-red-400 text-red-800' :
                                lesson.status === 'completed' ? 'bg-green-50 border-green-500 text-green-800' :
                                  'bg-indigo-100 border-indigo-500 text-indigo-900'}
                             `}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLesson?.(lesson.id);
                            }}
                          >
                            <div className="truncate font-bold">{lesson.title}</div>
                            <div className="truncate opacity-75">{lesson.members} Üye</div>
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
    </div>
  );
};

export default CalendarWeekGrid;
