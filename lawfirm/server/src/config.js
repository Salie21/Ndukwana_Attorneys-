// Firm-wide settings. Edit here (or move to Firestore later) – nothing secret lives in this file.
export const CASE_TYPES = [
  { id: 'estate', label: 'Estate planning & administration' },
  { id: 'corporate', label: 'Corporate & commercial law' },
  { id: 'conveyancing', label: 'Conveyancing & property transfers' },
  { id: 'labour', label: 'Labour & employment disputes' },
  { id: 'litigation', label: 'Litigation & disputes' },
  { id: 'drafting', label: 'Agreements, legal opinions & FICA' },
  { id: 'other', label: 'Other / not sure yet' },
];
export const CASE_TYPE_IDS = CASE_TYPES.map((c) => c.id);
export const caseLabel = (id) => CASE_TYPES.find((c) => c.id === id)?.label ?? id;

// Bookable consultation start hours (South African time, Mon–Fri). One hour each.
export const SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
export const TZ_OFFSET = '+02:00'; // Africa/Johannesburg has no daylight saving
export const MAX_ACTIVE_BOOKINGS_PER_CLIENT = 5;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
