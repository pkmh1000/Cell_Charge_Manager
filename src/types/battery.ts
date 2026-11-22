export type CycleUnit = 'day' | 'week' | 'month' | 'year';

export type UrgencyStatus = 'overdue' | 'due_week' | 'due_month' | 'healthy';

export type FilterScope = 'all' | 'overdue' | 'due_week' | 'due_month' | 'healthy';

export type ScheduleGranularity = 'day' | 'week' | 'month' | 'year';

export type DeviceCategory =
  | '3C 電子'
  | '行動電源'
  | '家電用品'
  | '攝影器材'
  | '玩具遙控'
  | '照明工具'
  | '其他';

export interface PhotoEvidence {
  id: string;
  dataUrl: string;
  thumbDataUrl?: string; // Lightweight 280px thumbnail for fast low-memory grid/card rendering
  createdAt: string;
}

export interface BatteryItem {
  id: string;
  name: string;
  location: string;
  category: DeviceCategory;
  tags?: string[]; // Searchable item tags (e.g. 書房, Type-C, 停電備用)
  startDate: string; // YYYY-MM-DD (充電起始日)
  intervalValue: number;
  intervalUnit: CycleUnit;
  nextChargeDate: string; // YYYY-MM-DD (下次充電日)
  photos: PhotoEvidence[];
  notes: string;
  resetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  remindersEnabled: boolean;
  reminderDaysBefore: number;
  lastReminderDate: string | null;
}
