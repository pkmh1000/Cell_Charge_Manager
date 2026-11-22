import { BatteryItem, CycleUnit, UrgencyStatus } from '../types/battery';

const WEEKDAYS_TC = ['日', '一', '二', '三', '四', '五', '六'];

export function getTodayStr(): string {
  const now = new Date();
  return formatLocalDate(now);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDays(dateStr: string, days: number): string {
  const dt = parseLocalDate(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatLocalDate(dt);
}

export function addInterval(startDate: string, value: number, unit: CycleUnit): string {
  const safeVal = Math.max(1, Math.floor(value || 1));
  const dt = parseLocalDate(startDate);
  const origDay = dt.getDate();

  if (unit === 'day') {
    dt.setDate(dt.getDate() + safeVal);
  } else if (unit === 'week') {
    dt.setDate(dt.getDate() + safeVal * 7);
  } else if (unit === 'month') {
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + safeVal);
    const maxDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(origDay, maxDay));
  } else if (unit === 'year') {
    dt.setDate(1);
    dt.setFullYear(dt.getFullYear() + safeVal);
    const maxDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(origDay, maxDay));
  }

  return formatLocalDate(dt);
}

export function diffDaysBetween(fromDateStr: string, toDateStr: string): number {
  const from = parseLocalDate(fromDateStr);
  const to = parseLocalDate(toDateStr);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

export function getUrgencyInfo(nextChargeDate: string, todayStr = getTodayStr()): {
  status: UrgencyStatus;
  diffDays: number;
  shortLabel: string;
  detailLabel: string;
} {
  const diffDays = diffDaysBetween(todayStr, nextChargeDate);

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      status: 'overdue',
      diffDays,
      shortLabel: `逾期 ${overdueDays} 天`,
      detailLabel: `已逾期 ${overdueDays} 天，建議立即充電`,
    };
  }
  if (diffDays === 0) {
    return {
      status: 'due_week',
      diffDays,
      shortLabel: '今日應充',
      detailLabel: '排定於今日充電',
    };
  }
  if (diffDays <= 7) {
    return {
      status: 'due_week',
      diffDays,
      shortLabel: `${diffDays} 天內`,
      detailLabel: `${diffDays} 天後需充電（近週內）`,
    };
  }
  if (diffDays <= 30) {
    return {
      status: 'due_month',
      diffDays,
      shortLabel: `${diffDays} 天後`,
      detailLabel: `${diffDays} 天後需充電（近月內）`,
    };
  }
  return {
    status: 'healthy',
    diffDays,
    shortLabel: `${diffDays} 天後`,
    detailLabel: `距離下次充電還有 ${diffDays} 天`,
  };
}

export function formatCycleUnit(unit: CycleUnit): string {
  switch (unit) {
    case 'day':
      return '日';
    case 'week':
      return '週';
    case 'month':
      return '個月';
    case 'year':
      return '年';
  }
}

export function formatCycleLabel(value: number, unit: CycleUnit): string {
  return `每 ${value} ${formatCycleUnit(unit)}`;
}

export function getISOWeekInfo(dateStr: string): { year: number; week: number; startOfWeek: string; endOfWeek: string } {
  const dt = parseLocalDate(dateStr);
  const day = dt.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // ISO week number
  const target = new Date(dt.valueOf());
  const dayNr = (dt.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

  return {
    year: target.getFullYear(),
    week,
    startOfWeek: formatLocalDate(monday),
    endOfWeek: formatLocalDate(sunday),
  };
}

export function formatDateWithWeekday(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  const w = WEEKDAYS_TC[dt.getDay()];
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  return `${dt.getFullYear()}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')} (週${w})`;
}

export function getDateGranularityTags(dateStr: string): {
  day: string;
  week: string;
  month: string;
  year: string;
} {
  const dt = parseLocalDate(dateStr);
  const weekInfo = getISOWeekInfo(dateStr);
  return {
    day: `${dt.getMonth() + 1}月${dt.getDate()}日`,
    week: `第 ${weekInfo.week} 週`,
    month: `${dt.getMonth() + 1}月`,
    year: `${dt.getFullYear()}年`,
  };
}

export function getMonthMatrix(year: number, monthIndexZeroBased: number): Array<{ dateStr: string; inCurrentMonth: boolean; dayNum: number }> {
  const firstDay = new Date(year, monthIndexZeroBased, 1, 12, 0, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(year, monthIndexZeroBased, 1 - startWeekday, 12, 0, 0);

  const cells: Array<{ dateStr: string; inCurrentMonth: boolean; dayNum: number }> = [];
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + i);
    cells.push({
      dateStr: formatLocalDate(cellDate),
      inCurrentMonth: cellDate.getMonth() === monthIndexZeroBased,
      dayNum: cellDate.getDate(),
    });
  }
  return cells;
}

export function getCycleProgressPercent(startDate: string, nextChargeDate: string, todayStr = getTodayStr()): number {
  const total = Math.max(1, diffDaysBetween(startDate, nextChargeDate));
  const elapsed = diffDaysBetween(startDate, todayStr);
  if (elapsed <= 0) return 0;
  if (elapsed >= total) return 100;
  return Math.round((elapsed / total) * 100);
}

export function generateICS(items: BatteryItem[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CellKeep//Battery Cycle Reminder//ZH-HANT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  for (const item of items) {
    const ymd = item.nextChargeDate.replace(/-/g, '');
    const nextDay = addDays(item.nextChargeDate, 1).replace(/-/g, '');
    const cleanSummary = `[蓄電提醒] ${item.name}`.replace(/[\r\n,;]/g, ' ');
    const cleanDesc = `放置位置：${item.location} | 週期：${formatCycleLabel(item.intervalValue, item.intervalUnit)}${item.notes ? ' | 備註：' + item.notes : ''}`.replace(/[\r\n,;]/g, ' ');

    lines.push(
      'BEGIN:VEVENT',
      `UID:cellkeep-${item.id}-${ymd}@cellkeep.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd}`,
      `DTEND;VALUE=DATE:${nextDay}`,
      `SUMMARY:${cleanSummary}`,
      `DESCRIPTION:${cleanDesc}`,
      `LOCATION:${item.location.replace(/[\r\n,;]/g, ' ')}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${cleanSummary}`,
      'TRIGGER:-PT0M',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
