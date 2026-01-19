// src/newUI/modules/Calendar/components/LessonModal.tsx
import { useState, useEffect } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import type { CalendarLesson } from '../types';
import { Button } from '../../../primitives/Button';
import { Alert } from '../../../primitives/Alert';
import { useMembers } from '../../../../hooks/useMembers';
import './calendar.css';

export type LessonModalProps = {
  lesson: CalendarLesson | null;
  onClose: () => void;
  onSave?: (lesson: CalendarLesson) => void;
  onRefetch?: () => void;
  slotDate?: Date;
  slotHour?: number;
};

export const LessonModal = ({ lesson, onClose, onSave, onRefetch, slotDate, slotHour }: LessonModalProps) => {
  // Title removed from UI, defaulting to "Ders" or existing title
  const title = lesson?.title ?? 'Ders';
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // State for Date and Hour (initialized from props or defaults)
  const [selectedDate, setSelectedDate] = useState<string>(
    slotDate ? slotDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [selectedHour, setSelectedHour] = useState<number>(
    slotHour !== undefined ? slotHour : new Date().getHours() + 1
  );

  const { sortedMembers, members } = useMembers(false);

  const isNewLesson = !lesson;

  // Update state if props change (e.g. clicking a different slot while modal is open, though unlikely)
  useEffect(() => {
    if (slotDate) setSelectedDate(slotDate.toISOString().split('T')[0]);
    if (slotHour !== undefined) setSelectedHour(slotHour);
  }, [slotDate, slotHour]);

  const handleSave = async () => {
    if (isNewLesson) {
      setIsSaving(true);
      try {
        // Construct Lesson Date from selected state
        const lessonDate = new Date(selectedDate);
        lessonDate.setHours(selectedHour, 0, 0, 0);

        // End time (1 hour duration default)
        const lessonEndDate = new Date(lessonDate);
        lessonEndDate.setHours(selectedHour + 1, 0, 0, 0);

        const memberUids = selectedMemberIds
          .map((id) => {
            const member = members.find((m) => m.id === id) as any;
            return member?.memberUid;
          })
          .filter(Boolean);

        const docData = {
          title: 'Ders', // Fixed title for new lessons

          date: lessonDate,
          endDate: lessonEndDate,
          memberIds: selectedMemberIds,
          attendedMemberIds: selectedMemberIds,
          absentMemberIds: [],
          walkInMemberIds: selectedMemberIds,
          status: 'scheduled' as const,
          ...(memberUids.length > 0 ? {
            memberUids,
            attendedMemberUids: memberUids,
            walkInMemberUids: memberUids,
          } : {}),
        };

        await addDoc(collection(db, 'lessons'), docData);

        if (onRefetch) {
          setTimeout(() => onRefetch(), 500);
        }

        onClose();
      } catch (error) {
        console.error('Ders oluşturma hatası:', error);
        alert('Ders oluşturulurken hata oluştu: ' + (error as Error).message);
      } finally {
        setIsSaving(false);
      }
    } else if (onSave && lesson) {
      onSave({ ...lesson, title });
      onClose();
    }
  };

  return (
    <div className="lesson-modal__overlay" onClick={onClose}>
      <div className="lesson-modal" onClick={(e) => e.stopPropagation()}>
        <header className="lesson-modal__header">
          <h3>{isNewLesson ? 'Yeni Ders Ekle' : 'Ders Düzenle'}</h3>
          <Button variant="neutral" tone="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </header>

        <div className="lesson-modal__body">
          {isNewLesson && (
            <Alert
              variant="success"
              title="Randevusuz Kayıt"
              description="Aşağıdan üye seçerek randevusuz ders kaydı oluşturabilirsiniz."
            />
          )}

          {/* Title input removed as per user request. Defaulting to 'Ders'. */}


          {/* Date & Time Selection (Editable for new lessons) */}
          <div className="lesson-modal__field-group">
            <div className="lesson-modal__field">
              <label htmlFor="lesson-date">Tarih</label>
              {isNewLesson ? (
                <input
                  id="lesson-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="lesson-modal__input"
                />
              ) : (
                <div className="lesson-modal__readonly">
                  {new Date(lesson!.start).toLocaleDateString('tr-TR')}
                </div>
              )}
            </div>

            <div className="lesson-modal__field">
              <label htmlFor="lesson-hour">Saat</label>
              {isNewLesson ? (
                <select
                  id="lesson-hour"
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(Number(e.target.value))}
                  className="lesson-modal__input"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 8).map(h => (
                    <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                  ))}
                </select>
              ) : (
                <div className="lesson-modal__readonly">
                  {new Date(lesson!.start).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>

          {!isNewLesson && lesson && (
            <div className="lesson-modal__field">
              <label>Katılımcı Sayısı</label>
              <div className="lesson-modal__readonly">{lesson.members} kişi</div>
            </div>
          )}

          {isNewLesson && (
            <div className="lesson-modal__field">
              <label htmlFor="member-select">Üye Seç</label>
              <select
                id="member-select"
                className="lesson-modal__input"
                onChange={(e) => {
                  const memberId = e.target.value;
                  if (memberId && !selectedMemberIds.includes(memberId)) {
                    setSelectedMemberIds([...selectedMemberIds, memberId]);
                  }
                  e.target.value = '';
                }}
              >
                <option value="">Üye seçin...</option>
                {sortedMembers
                  .filter((m) => !selectedMemberIds.includes(m.id))
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} {member.surname}
                    </option>
                  ))}
              </select>
              {selectedMemberIds.length > 0 && (
                <div className="lesson-modal__selected-members">
                  {selectedMemberIds.map((id) => {
                    const member = sortedMembers.find((m) => m.id === id);
                    if (!member) return null;
                    return (
                      <div key={id} className="lesson-modal__member-chip">
                        <span>{member.name} {member.surname}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedMemberIds(selectedMemberIds.filter((mid) => mid !== id))}
                          className="lesson-modal__member-remove"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="lesson-modal__footer">
          <Button variant="neutral" tone="ghost" onClick={onClose} disabled={isSaving}>
            İptal
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={(isNewLesson && selectedMemberIds.length === 0) || isSaving}
          >
            {isSaving ? 'Kaydediliyor...' : (isNewLesson ? 'Ders Oluştur' : 'Kaydet')}
          </Button>
        </footer>
      </div>
    </div>
  );
};
