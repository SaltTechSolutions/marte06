// src/newUI/modules/Calendar/components/CalendarDayTimeline.tsx
import React from 'react';
import type { CalendarDay, CalendarLesson } from '../types';
import { dateKeyTZ, hourTZ } from '../../../../utils/dateHelpers';
import { FiPlus, FiClock, FiUsers, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import './calendar.css';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 - 23:00

export type CalendarDayTimelineProps = {
  currentDate: Date;
  days: CalendarDay[];
  onOpenLesson?: (lessonId: string) => void;
  onEmptySlot?: (date: Date, hour: number) => void;
};

const CalendarDayTimeline = ({ currentDate, days, onOpenLesson, onEmptySlot }: CalendarDayTimelineProps) => {
  // Find the day data for the current date
  const currentDayKey = dateKeyTZ(currentDate);
  const dayData = days.find(d => d.date === currentDayKey);
  const lessons = dayData ? dayData.lessons : [];

  const getLessonsForHour = (hour: number) => {
    return lessons.filter((lesson) => {
      const start = new Date(lesson.start);
      // Use hourTZ to get the hour in the correct timezone (Europe/Istanbul)
      return hourTZ(start) === hour;
    });
  };

  const isToday = dateKeyTZ(new Date()) === currentDayKey;
  const currentHour = hourTZ(new Date());

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h3 className="text-lg font-bold text-gray-900 capitalize">
            {new Intl.DateTimeFormat('tr-TR', { weekday: 'long' }).format(currentDate)}
          </h3>
          <p className="text-sm text-gray-500">
            {new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(currentDate)}
          </p>
        </div>
        {isToday && (
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
            Bugün
          </span>
        )}
      </div>

      {/* Timeline Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {HOURS.map((hour) => {
          const hourLessons = getLessonsForHour(hour);
          const slotDate = new Date(currentDate);
          slotDate.setHours(hour, 0, 0, 0);
          const isPast = isToday && hour < currentHour;

          return (
            <div key={hour} className="flex group min-h-[80px]">
              {/* Time Column */}
              <div className="w-16 flex-shrink-0 flex flex-col items-center pt-2">
                <span className="text-sm font-bold text-gray-700">{hour.toString().padStart(2, '0')}:00</span>
                {isPast && <div className="h-full w-0.5 bg-gray-100 mt-1" />}
              </div>

              {/* Content Column */}
              <div
                className={`flex-1 rounded-2xl border-2 border-transparent transition-all relative ${hourLessons.length === 0
                    ? 'hover:border-indigo-100 hover:bg-indigo-50/30 cursor-pointer'
                    : ''
                  }`}
                onClick={() => {
                  if (hourLessons.length === 0) onEmptySlot?.(slotDate, hour);
                }}
              >
                {hourLessons.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="flex items-center gap-1 text-indigo-600 font-medium text-sm bg-white px-3 py-1 rounded-full shadow-sm">
                      <FiPlus /> Ders Ekle
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 w-full">
                    {hourLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLesson?.(lesson.id);
                        }}
                        className={`
                          p-3 rounded-xl border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all
                          ${lesson.status === 'cancelled' ? 'bg-red-50 border-red-400' :
                            lesson.status === 'completed' ? 'bg-green-50 border-green-500' :
                              'bg-indigo-50 border-indigo-500'}
                        `}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`font-bold text-sm ${lesson.status === 'cancelled' ? 'text-red-900 line-through' : 'text-gray-900'}`}>
                            {lesson.title}
                          </h4>
                          {lesson.status === 'completed' && <FiCheckCircle className="text-green-600" />}
                          {lesson.status === 'cancelled' && <FiXCircle className="text-red-600" />}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <FiClock size={12} />
                            <span>
                              {new Date(lesson.start).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} -
                              {new Date(lesson.end).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FiUsers size={12} />
                            <span>{lesson.members} Üye</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarDayTimeline;
