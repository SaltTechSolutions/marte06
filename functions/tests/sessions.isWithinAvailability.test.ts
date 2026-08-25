import { describe, expect, it } from 'vitest';

import { isWithinAvailability } from '../src/sessions';

/**
 * plan-eng-review Faz 3.2. Same literal case table as
 * `gymentra-mobile/src/data/firebase/availabilityContract.test.ts` — see
 * that file's own comment for why it's duplicated by hand rather than
 * shared via a package. Anchor date matches: Wednesday 2026-08-19.
 */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 7, 19, hour, minute);
}

interface Case {
  name: string;
  weekly: Record<string, { start: string; end: string }[]>;
  exceptions: { date: string; closed?: boolean; windows?: { start: string; end: string }[] }[];
  slotMinutes: number;
  slot: Date;
  expected: boolean;
}

const CASES: Case[] = [
  {
    name: 'exactly at window start is valid',
    weekly: { wed: [{ start: '09:00', end: '12:00' }] },
    exceptions: [],
    slotMinutes: 60,
    slot: at(9),
    expected: true,
  },
  {
    name: 'grid-misaligned slot is rejected',
    weekly: { wed: [{ start: '09:00', end: '12:00' }] },
    exceptions: [],
    slotMinutes: 60,
    slot: at(9, 30),
    expected: false,
  },
  {
    name: 'a slot that fits exactly before window end is valid',
    weekly: { wed: [{ start: '09:00', end: '10:30' }] },
    exceptions: [],
    slotMinutes: 60,
    slot: at(9),
    expected: true,
  },
  {
    name: 'a grid-aligned slot that would run past window end is rejected',
    weekly: { wed: [{ start: '09:00', end: '10:30' }] },
    exceptions: [],
    slotMinutes: 60,
    slot: at(10),
    expected: false,
  },
  {
    name: 'a slot before window start is rejected',
    weekly: { wed: [{ start: '09:00', end: '12:00' }] },
    exceptions: [],
    slotMinutes: 60,
    slot: at(8),
    expected: false,
  },
  {
    name: 'a non-60-minute grid is respected',
    weekly: { wed: [{ start: '09:00', end: '12:00' }] },
    exceptions: [],
    slotMinutes: 30,
    slot: at(9, 30),
    expected: true,
  },
  {
    name: "a day exception's window overrides the weekly pattern entirely",
    weekly: { wed: [{ start: '09:00', end: '12:00' }] },
    exceptions: [{ date: '2026-08-19', windows: [{ start: '14:00', end: '15:00' }] }],
    slotMinutes: 60,
    slot: at(14),
    expected: true,
  },
  {
    name: 'the weekly-pattern slot is rejected once a day exception overrides it',
    weekly: { wed: [{ start: '09:00', end: '12:00' }] },
    exceptions: [{ date: '2026-08-19', windows: [{ start: '14:00', end: '15:00' }] }],
    slotMinutes: 60,
    slot: at(9),
    expected: false,
  },
  {
    name: 'a day exception marked closed rejects every slot that day',
    weekly: { wed: [{ start: '09:00', end: '12:00' }] },
    exceptions: [{ date: '2026-08-19', closed: true }],
    slotMinutes: 60,
    slot: at(9),
    expected: false,
  },
  {
    name: 'a weekday with no configured window at all is rejected',
    weekly: {},
    exceptions: [],
    slotMinutes: 60,
    slot: at(9),
    expected: false,
  },
];

describe('isWithinAvailability — contract with client computeFreeSlots', () => {
  it.each(CASES)('$name', ({ weekly, exceptions, slotMinutes, slot, expected }) => {
    expect(isWithinAvailability({ weekly, exceptions, slotMinutes }, slot)).toBe(expected);
  });
});
