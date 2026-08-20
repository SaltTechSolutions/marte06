import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { sendPushToUser } from './push';

/**
 * GymEntra: promotes the first person on a class waitlist when a spot frees up.
 *
 * Security rules deliberately cannot do this. Booking is modelled as a
 * single-uid self-toggle — a member may only add or remove their OWN uid, in
 * exactly one array, per write. Promotion moves a *different* user's uid
 * between two arrays in one write, which that model cannot express safely, so
 * until now an admin had to notice a cancellation and promote by hand.
 *
 * Runs with the Admin SDK, so it is the one place that write is safe.
 */
export const promoteFromClassWaitlist = onDocumentUpdated(
  { document: 'classes/{classId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const capacity = after.capacity as number | undefined;
    const booked: string[] = after.bookedUserIds ?? [];
    const waitlist: string[] = after.waitlistUserIds ?? [];
    if (typeof capacity !== 'number' || waitlist.length === 0) return;

    // Only react to a spot actually opening; ignore our own promotion write
    // and any unrelated edit, otherwise this retriggers itself.
    const beforeBooked: string[] = before.bookedUserIds ?? [];
    const freedUp = booked.length < beforeBooked.length;
    if (!freedUp || booked.length >= capacity) return;

    const promoted = waitlist[0];
    // A stale waitlist entry for someone already booked would otherwise
    // duplicate them.
    const nextBooked = booked.includes(promoted) ? booked : [...booked, promoted];

    await event.data!.after.ref.update({
      bookedUserIds: nextBooked,
      waitlistUserIds: waitlist.slice(1),
    });

    await sendPushToUser(
      promoted,
      'Yerin açıldı 🎉',
      `"${after.name}" dersinde bekleme listesinden çıktın, yerin hazır.`,
      { screen: 'member/classes' },
    );

    console.log(`Promoted ${promoted} from waitlist of class ${event.params.classId}`);
  },
);
