export type CycleUnit = 'day' | 'week' | 'month' | 'year';

export type UrgencyStatus = 'overdue' | 'due_week' | 'due_month' | 'healthy';

export type FilterScope = 'all' | 'overdue' | 'due_week' | 'due_month' | 'healthy' | 'trash';

export type SortMode = 'updated_desc' | 'due_asc' | 'name_asc';

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
  thumbDataUrl?: string;
  createdAt: string;
}

export interface BatteryItem {
  id: string;
  name: string;
  location: string;
  category: DeviceCategory;
  tags?: string[];
  startDate: string; // YYYY-MM-DD
  intervalValue: number;
  intervalUnit: CycleUnit;
  nextChargeDate: string; // YYYY-MM-DD
  photos: PhotoEvidence[];
  notes: string;
  resetCount: number;
  deletedAt?: string | null; // Non-null when placed in Recycle Bin
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  remindersEnabled: boolean;
  reminderDaysBefore: number;
  lastReminderDate: string | null;
  sortBy: SortMode;
  savedTags: string[];
}
