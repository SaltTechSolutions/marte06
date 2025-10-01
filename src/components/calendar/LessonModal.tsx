import React from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { type Lesson } from '../../types/calendar.types';
import { type Member } from '../../hooks/useMembers';
import { formatDate, formatTime, formatDayName } from '../../utils/dateHelpers';
import { memberGradient } from '../../utils/colorHelpers';
import { CALENDAR_STYLES } from '../../constants/calendarTheme';

interface LessonModalProps {
  selectedLesson: Lesson | null;
  members: Member[];
  sortedMembers: Member[];
  newWalkInId: string;
  setNewWalkInId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedLesson: React.Dispatch<React.SetStateAction<Lesson | null>>;
  toggleAbsence: (lessonId: string, memberId: string, isAbsent: boolean) => void;
  addWalkIn: (
    lessonId: string,
    memberId: string,
    selectedLesson: Lesson | null,
    setSelectedLesson: React.Dispatch<React.SetStateAction<Lesson | null>>,
    setNewWalkInId: React.Dispatch<React.SetStateAction<string>>
  ) => void;
  removeWalkIn: (
    lessonId: string,
    memberId: string,
    setSelectedLesson: React.Dispatch<React.SetStateAction<Lesson | null>>
  ) => void;
}

export const LessonModal: React.FC<LessonModalProps> = ({
  selectedLesson,
  members,
  sortedMembers,
  newWalkInId,
  setNewWalkInId,
  setSelectedLesson,
  toggleAbsence,
  addWalkIn,
  removeWalkIn,
}) => {
  if (!selectedLesson) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={CALENDAR_STYLES.modal.backdrop}
      onClick={() => setSelectedLesson(null)}
    >
      <div 
        className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
        style={CALENDAR_STYLES.modal.container}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div 
          className="p-6 text-white relative"
          style={CALENDAR_STYLES.modal.header}
        >
          <button
            onClick={() => setSelectedLesson(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={CALENDAR_STYLES.modal.closeButton}
          >
            <span className="text-white text-xl">✕</span>
          </button>
          <h3 className="text-2xl font-bold mb-2">Ders Detayı</h3>
          <p className="text-white/90">
            {formatDayName(new Date(selectedLesson.date))}, {formatDate(new Date(selectedLesson.date))} - {formatTime(new Date(selectedLesson.date))}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Participants Section */}
          <div>
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#667eea' }}>
              <span>👥</span>
              <span>Katılımcılar</span>
            </h4>
            <div className="space-y-2">
              {Array.from(new Set([...selectedLesson.memberIds, ...selectedLesson.walkInMemberIds])).map((id) => {
                const m = members.find((mm) => mm.id === id) ?? ({ id, name: 'Üye' } as Member);
                const isAbsent = selectedLesson.absentMemberIds.includes(id);
                const isWalkIn = selectedLesson.walkInMemberIds.includes(id);
                return (
                  <div 
                    key={id} 
                    className="flex items-center justify-between p-4 rounded-2xl transition-all duration-200 hover:shadow-md"
                    style={{ 
                      background: isAbsent ? 'rgba(239, 68, 68, 0.05)' : 'rgba(102, 126, 234, 0.05)',
                      border: `2px solid ${isAbsent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(102, 126, 234, 0.2)'}`
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg"
                        style={memberGradient(id)}
                      >
                        {(m.name || 'Ü')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">
                          {(m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '')}
                        </div>
                        {isWalkIn && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>
                            Randevusuz
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!isAbsent}
                          onChange={() => toggleAbsence(selectedLesson.id, id, isAbsent)}
                          className="w-6 h-6 rounded-lg cursor-pointer"
                          style={{ accentColor: '#667eea' }}
                        />
                        <span className="text-sm font-medium text-gray-600">
                          {isAbsent ? 'Devamsız' : 'Katıldı'}
                        </span>
                      </label>
                      {isWalkIn && (
                        <button
                          onClick={() => {
                            if (!confirm('Randevusuz eklenen üyeyi silmek istediğinize emin misiniz?')) return;
                            removeWalkIn(selectedLesson.id, id, setSelectedLesson);
                          }}
                          className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                          style={{ background: '#fee2e2', color: '#991b1b' }}
                          title="Randevusuz eklenen üyeyi sil"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Walk-in Section */}
          <div 
            className="p-6 rounded-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)' }}
          >
            <h4 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: '#667eea' }}>
              <span>➕</span>
              <span>Randevusuz Üye Ekle</span>
            </h4>
            <div className="flex gap-3">
              {selectedLesson.id.startsWith('tmp-') && (
                <div className="flex-shrink-0">
                  <label htmlFor="walkin-time" className="block text-sm font-medium text-gray-700 mb-2">Saat</label>
                  <input
                    id="walkin-time"
                    type="time"
                    className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                    value={(() => {
                      const d = new Date(selectedLesson.date);
                      const hh = String(d.getHours()).padStart(2, '0');
                      const mm = String(d.getMinutes()).padStart(2, '0');
                      return `${hh}:${mm}`;
                    })()}
                    onChange={(e) => {
                      const v = e.target.value || '00:00';
                      const [hh, mm] = v.split(':').map((x) => parseInt(x || '0', 10));
                      setSelectedLesson((prev) => {
                        if (!prev) return prev;
                        const nd = new Date(prev.date);
                        nd.setHours(isNaN(hh) ? 0 : hh, isNaN(mm) ? 0 : mm, 0, 0);
                        return { ...(prev as Lesson), date: nd } as Lesson;
                      });
                    }}
                  />
                </div>
              )}
              <div className="flex-1">
                <label htmlFor="walkin-select" className="block text-sm font-medium text-gray-700 mb-2">Üye Seçin</label>
                <select
                  id="walkin-select"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                  value={newWalkInId}
                  onChange={(e) => setNewWalkInId(e.target.value)}
                >
                  <option value="">Üye seçin...</option>
                  {sortedMembers
                    .filter((m) => ![...selectedLesson.memberIds, ...selectedLesson.walkInMemberIds].includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {(m.name || 'Üye') + (m.surname ? ` ${m.surname}` : '')}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => addWalkIn(selectedLesson.id, newWalkInId, selectedLesson, setSelectedLesson, setNewWalkInId)}
                  disabled={!newWalkInId}
                  className="px-6 py-3 rounded-xl font-bold text-white transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{ 
                    background: newWalkInId ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#d1d5db',
                    boxShadow: newWalkInId ? '0 4px 12px rgba(102, 126, 234, 0.4)' : 'none'
                  }}
                >
                  + Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
