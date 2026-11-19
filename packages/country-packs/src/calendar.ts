/** Working-day arithmetic driven by a country pack calendar (no hard-coded country logic). */
export interface PackCalendar {
  weekend: string[];
  holidays: { date: string }[];
}

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y as number, (m as number) - 1, d as number));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWorkingDay(iso: string, cal: PackCalendar): boolean {
  const day = DAY_CODES[parseIsoDate(iso).getUTCDay()] as string;
  if (cal.weekend.includes(day)) return false;
  return !cal.holidays.some((h) => h.date === iso);
}

/** Add n working days after `fromIso` (the start day itself is not counted). */
export function addWorkingDays(fromIso: string, n: number, cal: PackCalendar): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('n must be a non-negative integer');
  const d = parseIsoDate(fromIso);
  let counted = 0;
  while (counted < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkingDay(toIsoDate(d), cal)) counted++;
  }
  return toIsoDate(d);
}

/** Signed number of working days from a to b (positive if b is later). */
export function workingDaysBetween(aIso: string, bIso: string, cal: PackCalendar): number {
  if (aIso === bIso) return 0;
  const sign = aIso < bIso ? 1 : -1;
  const [start, end] = sign > 0 ? [aIso, bIso] : [bIso, aIso];
  const d = parseIsoDate(start);
  let n = 0;
  while (toIsoDate(d) < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkingDay(toIsoDate(d), cal)) n++;
  }
  return sign * n;
}
