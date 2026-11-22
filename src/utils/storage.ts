import { AppSettings, BatteryItem } from '../types/battery';
import { addDays, addInterval, getTodayStr } from './dateCycle';
import demoPowerbankImg from '../assets/images/demo_powerbank_1795359621322.jpg';
import demoDrawerImg from '../assets/images/demo_drawer_location_1795359622125.jpg';
import demoCameraImg from '../assets/images/demo_camera_1795359621603.jpg';
import { compressImageToPair, estimateDataUrlBytes, urlToDataUrl } from './imageUtils';

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

  const loadPair = async (url: string) => {
    try {
      const raw = await urlToDataUrl(url);
      return await compressImageToPair(raw);
    } catch {
      return { dataUrl: url, thumbDataUrl: url };
    }
  };

  const [pbPair, drawerPair, camPair] = await Promise.all([
    loadPair(demoPowerbankImg),
    loadPair(demoDrawerImg),
    loadPair(demoCameraImg),
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
      tags: ['書房', '抽屜', 'Type-C', '快充'],
      startDate: item1Start,
      intervalValue: 1,
      intervalUnit: 'month',
      nextChargeDate: addInterval(item1Start, 1, 'month'),
      photos: [
        {
          id: 'p-1a',
          dataUrl: pbPair.dataUrl,
          thumbDataUrl: pbPair.thumbDataUrl,
          createdAt: nowIso,
        },
        {
          id: 'p-1b',
          dataUrl: drawerPair.dataUrl,
          thumbDataUrl: drawerPair.thumbDataUrl,
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
      tags: ['客廳', '白色櫃', '相機電池'],
      startDate: item2Start,
      intervalValue: 4,
      intervalUnit: 'week',
      nextChargeDate: addInterval(item2Start, 4, 'week'),
      photos: [
        {
          id: 'p-2a',
          dataUrl: camPair.dataUrl,
          thumbDataUrl: camPair.thumbDataUrl,
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
      tags: ['玄關', '停電備用', '18650'],
      startDate: item3Start,
      intervalValue: 30,
      intervalUnit: 'day',
      nextChargeDate: addInterval(item3Start, 30, 'day'),
      photos: [],
      notes: '停電緊急照明用，每 30 天補電一次。',
      resetCount: 3,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

export async function optimizeAllStoredPhotos(items: BatteryItem[]): Promise<{
  updatedItems: BatteryItem[];
  beforeBytes: number;
  afterBytes: number;
}> {
  let beforeBytes = 0;
  let afterBytes = 0;
  const updatedItems: BatteryItem[] = [];

  for (const item of items) {
    const newPhotos = [];
    for (const p of item.photos) {
      beforeBytes += estimateDataUrlBytes(p.dataUrl) + estimateDataUrlBytes(p.thumbDataUrl || '');
      if (p.dataUrl.startsWith('data:image/')) {
        try {
          const pair = await compressImageToPair(p.dataUrl);
          // Keep smaller representation if already smaller
          const origSize = estimateDataUrlBytes(p.dataUrl);
          const newSize = estimateDataUrlBytes(pair.dataUrl);
          const finalFull = newSize < origSize ? pair.dataUrl : p.dataUrl;
          const finalThumb = pair.thumbDataUrl;
          afterBytes += estimateDataUrlBytes(finalFull) + estimateDataUrlBytes(finalThumb);
          newPhotos.push({ ...p, dataUrl: finalFull, thumbDataUrl: finalThumb });
          continue;
        } catch {
          // fallback keep existing
        }
      }
      afterBytes += estimateDataUrlBytes(p.dataUrl) + estimateDataUrlBytes(p.thumbDataUrl || '');
      newPhotos.push(p);
    }
    updatedItems.push({ ...item, photos: newPhotos });
  }

  await replaceAllItems(updatedItems);
  return { updatedItems, beforeBytes, afterBytes };
}
