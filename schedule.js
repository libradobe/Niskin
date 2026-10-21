// ============================================================================
// HORARIO LABORAL, DISPONIBILIDAD, MONEDA Y DEPÓSITO
// Lógica compartida por las rutas del servidor.
// ============================================================================

const DEFAULT_WEEKLY_SCHEDULE = [
  { day: 0, open: false, start: '09:00', end: '13:00' },
  { day: 1, open: true, start: '09:00', end: '18:00' },
  { day: 2, open: true, start: '09:00', end: '18:00' },
  { day: 3, open: true, start: '09:00', end: '18:00' },
  { day: 4, open: true, start: '09:00', end: '18:00' },
  { day: 5, open: true, start: '09:00', end: '18:00' },
  { day: 6, open: true, start: '09:00', end: '14:00' }
];

const CURRENCIES = {
  DOP: { symbol: 'RD$', decimals: 0 },
  USD: { symbol: 'US$', decimals: 2 },
  EUR: { symbol: '€', decimals: 2 },
  MXN: { symbol: 'MX$', decimals: 2 },
  COP: { symbol: 'COL$', decimals: 0 },
  PEN: { symbol: 'S/', decimals: 2 },
  CLP: { symbol: 'CLP$', decimals: 0 },
  ARS: { symbol: 'AR$', decimals: 0 },
  GTQ: { symbol: 'Q', decimals: 2 },
  CRC: { symbol: '₡', decimals: 0 }
};

const LANGUAGES = ['es', 'en'];

function hhmmToMinutes(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function minutesToHHMM(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// "09:30 AM" <-> minutos desde medianoche
function slotToMinutes(slot) {
  const m = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(slot || '');
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3] === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

function minutesToSlot(total) {
  const h = Math.floor(total / 60);
  const min = total % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${suffix}`;
}

// Convierte la configuración antigua (lista de horas + días cerrados) al horario semanal
function legacyToWeekly(settings) {
  const closed = Array.isArray(settings.closedWeekdays) ? settings.closedWeekdays : [0];
  const minutes = (settings.slots || []).map(slotToMinutes).filter(v => v !== null).sort((a, b) => a - b);
  const start = minutes.length ? minutesToHHMM(minutes[0]) : '09:00';
  const end = minutes.length ? minutesToHHMM(Math.min(23 * 60 + 59, minutes[minutes.length - 1] + 60)) : '18:00';
  return [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, open: !closed.includes(day), start, end }));
}

function normalizeWeekly(input) {
  if (!Array.isArray(input)) return null;
  const byDay = new Map(input.map(d => [Number(d.day), d]));
  const result = [];
  for (let day = 0; day <= 6; day++) {
    const d = byDay.get(day) || {};
    const start = hhmmToMinutes(d.start);
    const end = hhmmToMinutes(d.end);
    const valid = start !== null && end !== null && end > start;
    result.push({
      day,
      open: Boolean(d.open) && valid,
      start: valid ? minutesToHHMM(start) : '09:00',
      end: valid ? minutesToHHMM(end) : '18:00'
    });
  }
  return result;
}

function weekdayOf(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

function dayScheduleFor(settings, dateStr) {
  const weekly = settings.weeklySchedule && settings.weeklySchedule.length === 7
    ? settings.weeklySchedule
    : legacyToWeekly(settings);
  return weekly.find(d => d.day === weekdayOf(dateStr)) || null;
}

// Horas de inicio posibles para una fecha según el horario y el intervalo
function slotsForDate(settings, dateStr, durationMin = 0) {
  const day = dayScheduleFor(settings, dateStr);
  if (!day || !day.open) return [];
  const start = hhmmToMinutes(day.start);
  const end = hhmmToMinutes(day.end);
  const step = Math.max(10, Number(settings.slotInterval) || 30);
  // La cita debe terminar antes del cierre (sin duración conocida, basta con empezar antes)
  const minLength = durationMin > 0 ? durationMin : 1;
  const result = [];
  for (let t = start; t + minLength <= end; t += step) result.push(minutesToSlot(t));
  return result;
}

function overlaps(startA, durA, startB, durB) {
  return startA < startB + durB && startB < startA + durA;
}

// Estado de cada horario: 'available' | 'taken' (ya hay una cita que se cruza)
function slotStatuses({ settings, dateStr, durationMin, existing }) {
  const busy = existing.map(a => ({ start: slotToMinutes(a.time), dur: a.durationMin || 60 }))
    .filter(b => b.start !== null);
  return slotsForDate(settings, dateStr, durationMin).map(time => {
    const start = slotToMinutes(time);
    const taken = busy.some(b => overlaps(start, durationMin || 60, b.start, b.dur));
    return { time, status: taken ? 'taken' : 'available' };
  });
}

function depositFor(treatment, settings) {
  if (!treatment || settings.requireDeposit === false) return 0;
  const type = settings.depositType || 'treatment';
  if (type === 'fixed') return Math.max(0, Math.round(Number(settings.depositValue) || 0));
  if (type === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(settings.depositValue) || 0));
    return Math.round((Number(treatment.price) || 0) * pct / 100);
  }
  return Math.max(0, Number(treatment.depositRequired) || 0);
}

module.exports = {
  DEFAULT_WEEKLY_SCHEDULE,
  CURRENCIES,
  LANGUAGES,
  hhmmToMinutes,
  slotToMinutes,
  minutesToSlot,
  legacyToWeekly,
  normalizeWeekly,
  weekdayOf,
  dayScheduleFor,
  slotsForDate,
  slotStatuses,
  depositFor
};
