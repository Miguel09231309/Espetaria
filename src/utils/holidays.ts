import { CustomHoliday, DayType } from '../types';

export interface OperatingDayInfo {
  isOperating: boolean;
  dayType: DayType | null;
  label: string;
  holidayName: string;
  dateStr: string;
}

/**
 * Formats a Date object as YYYY-MM-DD in local time.
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

/**
 * Computes Easter Sunday for a given year (Anonymous Gregorian algorithm).
 */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Returns Brazilian national holidays for a given year.
 */
export function getBrazilianNationalHolidays(year: number): Record<string, string> {
  const easter = getEasterDate(year);
  const carnavalSeg = addDays(easter, -48);
  const carnavalTer = addDays(easter, -47);
  const sextaSanta = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  return {
    [`${year}-01-01`]: 'Confraternização Universal',
    [toLocalDateString(carnavalSeg)]: 'Segunda de Carnaval',
    [toLocalDateString(carnavalTer)]: 'Carnaval',
    [toLocalDateString(sextaSanta)]: 'Sexta-Feira Santa',
    [`${year}-04-21`]: 'Tiradentes',
    [`${year}-05-01`]: 'Dia do Trabalho',
    [toLocalDateString(corpusChristi)]: 'Corpus Christi',
    [`${year}-09-07`]: 'Independência do Brasil',
    [`${year}-10-12`]: 'Nossa Senhora Aparecida',
    [`${year}-11-02`]: 'Finados',
    [`${year}-11-15`]: 'Proclamação da República',
    [`${year}-11-20`]: 'Dia da Consciência Negra',
    [`${year}-12-25`]: 'Natal',
  };
}

/**
 * Checks whether a YYYY-MM-DD date is a Sunday or a registered Holiday.
 * Only Sundays and Holidays are valid sales days.
 */
export function checkOperatingDay(
  dateStr: string,
  customHolidays: CustomHoliday[] = []
): OperatingDayInfo {
  const date = parseLocalDate(dateStr);
  const year = date.getFullYear();
  const nationals = getBrazilianNationalHolidays(year);
  const customMatch = customHolidays.find((h) => h.date === dateStr);
  const nationalMatch = nationals[dateStr];
  const isSunday = date.getDay() === 0;

  if (customMatch) {
    return {
      isOperating: true,
      dayType: 'feriado',
      holidayName: customMatch.name,
      label: isSunday ? `Domingo · ${customMatch.name}` : `Feriado · ${customMatch.name}`,
      dateStr,
    };
  }

  if (nationalMatch) {
    return {
      isOperating: true,
      dayType: 'feriado',
      holidayName: nationalMatch,
      label: isSunday ? `Domingo · ${nationalMatch}` : `Feriado · ${nationalMatch}`,
      dateStr,
    };
  }

  if (isSunday) {
    return {
      isOperating: true,
      dayType: 'domingo',
      holidayName: '',
      label: 'Domingo de Brasa',
      dateStr,
    };
  }

  const weekdayNames = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];

  return {
    isOperating: false,
    dayType: null,
    holidayName: '',
    label: `${weekdayNames[date.getDay()]} (Dia útil — fechado)`,
    dateStr,
  };
}

/**
 * Returns today's date string if it's an operating day, otherwise the next Sunday or Holiday.
 */
export function getDefaultOperatingDate(
  customHolidays: CustomHoliday[] = [],
  fromDate = new Date()
): OperatingDayInfo {
  for (let offset = 0; offset <= 45; offset++) {
    const candidate = addDays(fromDate, offset);
    const candidateStr = toLocalDateString(candidate);
    const info = checkOperatingDay(candidateStr, customHolidays);
    if (info.isOperating) {
      return info;
    }
  }
  return checkOperatingDay(toLocalDateString(fromDate), customHolidays);
}

/**
 * Lists upcoming and recent Sundays/Holidays for quick selection in PDV and Daily Panel.
 */
export function getOperatingDateOptions(
  customHolidays: CustomHoliday[] = [],
  pastDays = 28,
  futureDays = 35
): OperatingDayInfo[] {
  const today = new Date();
  const options: OperatingDayInfo[] = [];

  for (let offset = -pastDays; offset <= futureDays; offset++) {
    const d = addDays(today, offset);
    const dateStr = toLocalDateString(d);
    const info = checkOperatingDay(dateStr, customHolidays);
    if (info.isOperating) {
      options.push(info);
    }
  }
  return options.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatShortDateBR(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

/**
 * Returns the Sunday (week start) for any YYYY-MM-DD date string.
 * Since operations happen primarily on Sundays and weekly holidays,
 * grouping weeks from Sunday to Saturday aligns weekly profit reports cleanly.
 */
export function getWeekStartSunday(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const diff = d.getDay(); // 0 = Sunday
  const sunday = addDays(d, -diff);
  return toLocalDateString(sunday);
}

export function getWeekEndSaturday(weekStartStr: string): string {
  const sunday = parseLocalDate(weekStartStr);
  return toLocalDateString(addDays(sunday, 6));
}
