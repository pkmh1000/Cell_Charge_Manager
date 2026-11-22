import { AppSettings, BatteryItem } from '../types/battery';
import { addDays, addInterval, getTodayStr } from './dateCycle';
import demoPowerbankImg from '../assets/images/demo_powerbank_1795359621322.jpg';
import demoDrawerImg from '../assets/images/demo_drawer_location_1795359622125.jpg';
import demoCameraImg from '../assets/images/demo_camera_1795359621603.jpg';
import { urlToDataUrl } from './imageUtils';

const DB_NAME = 'cellkeep-db';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';
const STORE_SETTINGS = 'settings';
const SETTINGS_KEY = 'app-settings';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  remindersEnabled: false,
  reminderDaysBefore: 3,
  lastReminderDate: null,
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllItems(): Promise<BatteryItem[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      const store = tx.objectStore(STORE_ITEMS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as BatteryItem[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    const raw = localStorage.getItem('cellkeep_items_fallback');
    return raw ? (JSON.parse(raw) as BatteryItem[]) : [];
  }
}

export async function saveItem(item: BatteryItem): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      tx.objectStore(STORE_ITEMS).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const current = await loadAllItems();
    const idx = current.findIndex((i) => i.id === item.id);
    if (idx >= 0) current[idx] = item;
    else current.push(item);
    localStorage.setItem('cellkeep_items_fallback', JSON.stringify(current));
  }
}

export async function deleteItemById(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      tx.objectStore(STORE_ITEMS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const current = await loadAllItems();
    localStorage.setItem('cellkeep_items_fallback', JSON.stringify(current.filter((i) => i.id !== id)));
  }
}

export async function replaceAllItems(items: BatteryItem[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_ITEMS);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem('cellkeep_items_fallback', JSON.stringify(items));
  }
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const req = tx.objectStore(STORE_SETTINGS).get(SETTINGS_KEY);
      req.onsuccess = () => resolve({ ...DEFAULT_SETTINGS, ...(req.result || {}) });
      req.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      tx.objectStore(STORE_SETTINGS).put(settings, SETTINGS_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem('cellkeep_settings_fallback', JSON.stringify(settings));
  }
}

export async function createDemoItems(): Promise<BatteryItem[]> {
  const today = getTodayStr();
  const nowIso = new Date().toISOString();

  const [pbImg, drawerImg, camImg] = await Promise.all([
    urlToDataUrl(demoPowerbankImg).catch(() => demoPowerbankImg),
    urlToDataUrl(demoDrawerImg).catch(() => demoDrawerImg),
    urlToDataUrl(demoCameraImg).catch(() => demoCameraImg),
  ]);

  const item1Start = addDays(today, -35);
  const item2Start = addDays(today, -25);
  const item3Start = addDays(today, -12);

  return [
    {
      id: `demo-pb-${Date.now()}`,
      name: 'Anker 20000mAh 行動電源',
      location: '書房木桌右側第一層收納抽屜（USB-C 線旁）',
      category: '行動電源',
      startDate: item1Start,
      intervalValue: 1,
      intervalUnit: 'month',
      nextChargeDate: addInterval(item1Start, 1, 'month'), // Overdue by ~5 days
      photos: [
        {
          id: 'p-1a',
          dataUrl: pbImg,
          caption: '物件外觀：深灰霧面行動電源',
          createdAt: nowIso,
        },
        {
          id: 'p-1b',
          dataUrl: drawerImg,
          caption: '放置位置循跡：書桌右側木頭抽屜中格',
          createdAt: nowIso,
        },
      ],
      notes: '建議維持在 50%–80% 電量存放，避免深度放電損壞電芯。',
      resetCount: 2,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `demo-cam-${Date.now() + 1}`,
      name: 'Fujifilm X-T4 數位相機電池',
      location: '客廳白色收納櫃中層（鏡頭袋左側）',
      category: '攝影器材',
      startDate: item2Start,
      intervalValue: 4,
      intervalUnit: 'week',
      nextChargeDate: addInterval(item2Start, 4, 'week'), // Due within 3 days
      photos: [
        {
          id: 'p-2a',
          dataUrl: camImg,
          caption: '存放位置：白色層架中層左側',
          createdAt: nowIso,
        },
      ],
      notes: '共 2 顆原廠電池，需輪流檢查並補電。',
      resetCount: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `demo-light-${Date.now() + 2}`,
      name: '防災手電筒（備用鋰電）',
      location: '玄關鞋櫃上層白色收納盒內',
      category: '照明工具',
      startDate: item3Start,
      intervalValue: 30,
      intervalUnit: 'day',
      nextChargeDate: addInterval(item3Start, 30, 'day'), // Due within 18 days (month)
      photos: [],
      notes: '停電緊急照明用，每 30 天補電一次。',
      resetCount: 3,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}
