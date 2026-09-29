// CFIT scoring only has norms for ages 13+, and this program is for adults
// heading to work in Japan, so anything outside this range is almost always
// a typo (e.g. "2023" instead of "1993") rather than a real participant.
export const MIN_PARTICIPANT_AGE = 17;
export const MAX_PARTICIPANT_AGE = 60;

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** HTML date-input bounds: oldest allowed birth date first, most recent second. */
export function getBirthDateInputBounds(at: Date = new Date()) {
  const min = new Date(at);
  min.setFullYear(min.getFullYear() - MAX_PARTICIPANT_AGE);
  const max = new Date(at);
  max.setFullYear(max.getFullYear() - MIN_PARTICIPANT_AGE);
  return { min: toIsoDate(min), max: toIsoDate(max) };
}

export function isBirthDateInRange(birthDate: string, at: Date = new Date()) {
  const { min, max } = getBirthDateInputBounds(at);
  return birthDate >= min && birthDate <= max;
}

export function birthDateRangeMessage() {
  return `Tanggal lahir harus menunjukkan usia ${MIN_PARTICIPANT_AGE}–${MAX_PARTICIPANT_AGE} tahun. Cek kembali tahun lahirnya.`;
}
