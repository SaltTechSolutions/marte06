import { useState, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { type Lesson } from '../types/calendar.types';
import { type Member } from './useMembers';

export const useLessonOperations = (
  members: Member[],
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
) => {
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);

  // Toggle absence
  const toggleAbsence = useCallback(async (lessonId: string, memberId: string, isAbsent: boolean) => {
    try {
      const ref = doc(db, 'lessons', lessonId);
      const mm = members.find((m) => m.id === memberId) as (Member & { memberUid?: string }) | undefined;
      const uid = mm?.memberUid;
      await updateDoc(ref, {
        absentMemberIds: isAbsent ? arrayRemove(memberId) : arrayUnion(memberId),
        ...(uid ? { absentMemberUids: isAbsent ? arrayRemove(uid) : arrayUnion(uid) } : {}),
      });
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonId
            ? {
                ...l,
                absentMemberIds: isAbsent
                  ? l.absentMemberIds.filter((x) => x !== memberId)
                  : [...l.absentMemberIds, memberId],
              }
            : l,
        ),
      );
    } catch (e) {
      console.error(e);
      setError('Devamsızlık güncellenirken hata oluştu');
    }
  }, [members, setLessons, setError]);

  // Add walk-in
  const addWalkIn = useCallback(async (
    lessonId: string,
    memberId: string,
    selectedLesson: Lesson | null,
    setSelectedLesson: React.Dispatch<React.SetStateAction<Lesson | null>>,
    setNewWalkInId: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!memberId) return;
    try {
      const mm = members.find((m) => m.id === memberId) as (Member & { memberUid?: string }) | undefined;
      const uid = mm?.memberUid;
      
      // If this is a placeholder, create the lesson first
      if (lessonId.startsWith('tmp-')) {
        if (!selectedLesson) return;
        setIsCreatingLesson(true);
        const docData = {
          date: selectedLesson.date,
          memberIds: [memberId],
          attendedMemberIds: [memberId],
          absentMemberIds: [],
          walkInMemberIds: [memberId],
          ...(uid ? {
            memberUids: [uid],
            attendedMemberUids: [uid],
            walkInMemberUids: [uid],
          } : {}),
        };
        const createdRef = await addDoc(collection(db, 'lessons'), docData);

        const newLesson: Lesson = {
          id: createdRef.id,
          ...docData,
        };

        setLessons((prev) => {
          const next = [...prev, newLesson];
          next.sort((a, b) => a.date.getTime() - b.date.getTime());
          return next;
        });

        setSelectedLesson(null);
        setTimeout(() => {
          setSelectedLesson(newLesson);
          setNewWalkInId('');
          setIsCreatingLesson(false);
        }, 0);
        return;
      }

      const ref = doc(db, 'lessons', lessonId);
      await updateDoc(ref, {
        walkInMemberIds: arrayUnion(memberId),
        ...(uid ? { walkInMemberUids: arrayUnion(uid) } : {}),
      });
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonId
            ? {
                ...l,
                walkInMemberIds: l.walkInMemberIds.includes(memberId)
                  ? l.walkInMemberIds
                  : [...l.walkInMemberIds, memberId],
              }
            : l,
        ),
      );
      setNewWalkInId('');
    } catch (e) {
      console.error(e);
      setError('Randevusuz üye eklenirken hata oluştu');
    }
  }, [members, setLessons, setError]);

  // Remove walk-in
  const removeWalkIn = useCallback(async (
    lessonId: string,
    memberId: string,
    setSelectedLesson: React.Dispatch<React.SetStateAction<Lesson | null>>
  ) => {
    try {
      // Placeholder lesson
      if (lessonId.startsWith('tmp-')) {
        setSelectedLesson((prev) => {
          if (!prev || prev.id !== lessonId) return prev;
          const updated = {
            ...prev,
            walkInMemberIds: prev.walkInMemberIds.filter((x) => x !== memberId),
          } as Lesson;
        
          if (((updated.memberIds?.length || 0) + (updated.walkInMemberIds?.length || 0)) === 0) {
            return null;
          }
          return updated;
        });
        return;
      }

      const ref = doc(db, 'lessons', lessonId);
      const mm = members.find((m) => m.id === memberId) as (Member & { memberUid?: string }) | undefined;
      const uid = mm?.memberUid;
      await updateDoc(ref, {
        walkInMemberIds: arrayRemove(memberId),
        ...(uid ? { walkInMemberUids: arrayRemove(uid) } : {}),
      });

      let shouldDelete = false;
      setLessons((prev) => {
        const next = prev
          .map((l) => {
            if (l.id !== lessonId) return l;
            const updated = { ...l, walkInMemberIds: l.walkInMemberIds.filter((x) => x !== memberId) } as Lesson;
            if (((updated.memberIds?.length || 0) + (updated.walkInMemberIds?.length || 0)) === 0) {
              shouldDelete = true;
            }
            return updated;
          })
          .filter((l) => ((l.memberIds?.length || 0) + (l.walkInMemberIds?.length || 0)) > 0);
        return next;
      });

      setSelectedLesson((prev) => {
        if (!prev || prev.id !== lessonId) return prev;
        const updated = { ...prev, walkInMemberIds: prev.walkInMemberIds.filter((x) => x !== memberId) } as Lesson;
        if (((updated.memberIds?.length || 0) + (updated.walkInMemberIds?.length || 0)) === 0) {
          return null;
        }
        return updated;
      });

      if (shouldDelete) {
        try { await deleteDoc(ref); } catch {}
      }
    } catch (e) {
      console.error(e);
      setError('Randevusuz üye silinirken hata oluştu');
    }
  }, [members, setLessons, setError]);

  return {
    toggleAbsence,
    addWalkIn,
    removeWalkIn,
    isCreatingLesson,
  };
};
