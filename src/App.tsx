import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BatteryCharging,
  CalendarRange,
  Camera,
  Download,
  ListChecks,
  Plus,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { ItemCard } from './components/ItemCard';
import { ItemDetailSheet } from './components/ItemDetailSheet';
import { ItemFormSheet } from './components/ItemFormSheet';
import { PWAInstallModal } from './components/PWAInstallModal';
import { ScheduleView } from './components/ScheduleView';
import { SettingsView } from './components/SettingsView';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWA';
import { AppSettings, BatteryItem, FilterScope } from './types/battery';
import { addInterval, diffDaysBetween, getTodayStr } from './utils/dateCycle';
import { formatBytesCompact } from './utils/imageUtils';
import {
  createDemoItems,
  DEFAULT_SETTINGS,
  deleteItemById,
  loadAllItems,
  loadSettings,
  optimizeAllStoredPhotos,
  replaceAllItems,
  saveItem,
  saveSettings,
} from './utils/storage';

type ActiveTab = 'inventory' | 'schedule' | 'settings';

export default function App() {
  const isOnline = useOnlineStatus();
  const { isInstalled, isInstallable, install } = usePWAInstall();
  const [items, setItems] = useState<BatteryItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState<FilterScope>('all');

  const [selectedItem, setSelectedItem] = useState<BatteryItem | null>(null);
  const [editingItem, setEditingItem] = useState<BatteryItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [dismissInstallBar, setDismissInstallBar] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Initial load from IndexedDB
  useEffect(() => {
    let active = true;
    (async () => {
      const [loadedItems, loadedSettings] = await Promise.all([
        loadAllItems(),
        loadSettings(),
      ]);
      if (!active) return;
      setItems(loadedItems);
      setSettings(loadedSettings);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Check periodic reminders once per day when enabled
  useEffect(() => {
    if (isLoading || !settings.remindersEnabled || items.length === 0) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const today = getTodayStr();
    if (settings.lastReminderDate === today) return;

    const dueSoon = items.filter((item) => {
      const diff = diffDaysBetween(today, item.nextChargeDate);
      return diff <= settings.reminderDaysBefore;
    });

    if (dueSoon.length > 0) {
      const firstNames = dueSoon
        .slice(0, 3)
        .map((i) => i.name)
        .join('、');
      const suffix = dueSoon.length > 3 ? ` 等 ${dueSoon.length} 件物件` : '';
      new Notification('CellKeep 蓄電保養提醒', {
        body: `${firstNames}${suffix}需要補充電量，開啟 App 查看放置位置。`,
        icon: './pwa-192x192.png',
      });
    }

    const updatedSettings: AppSettings = { ...settings, lastReminderDate: today };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
  }, [isLoading, items, settings]);

  const handleUpdateSettings = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const handleSaveItem = async (saved: BatteryItem) => {
    await saveItem(saved);
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...prev];
    });
    if (selectedItem?.id === saved.id) {
      setSelectedItem(saved);
    }
    setIsFormOpen(false);
    setEditingItem(null);
    showToast(`已儲存「${saved.name}」`);
  };

  const handleResetCycle = async (item: BatteryItem, resetDate = getTodayStr()) => {
    const nextDate = addInterval(resetDate, item.intervalValue, item.intervalUnit);
    const updated: BatteryItem = {
      ...item,
      startDate: resetDate,
      nextChargeDate: nextDate,
      resetCount: (item.resetCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    await saveItem(updated);
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    if (selectedItem?.id === updated.id) {
      setSelectedItem(updated);
    }
    showToast(`已重置「${item.name}」，下次充電日：${nextDate}`);
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItemById(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedItem(null);
    showToast('已刪除該物件記錄');
  };

  const handleImportItems = async (imported: BatteryItem[]) => {
    await replaceAllItems(imported);
    setItems(imported);
    showToast(`已匯入 ${imported.length} 件物件`);
  };

  const handleLoadDemoItems = async () => {
    const demos = await createDemoItems();
    for (const d of demos) {
      await saveItem(d);
    }
    setItems((prev) => [...demos, ...prev]);
    setActiveTab('inventory');
    showToast('已載入 3 筆範例電器，可點擊查看多張位置照片');
  };

  const handleOptimizePhotos = async (): Promise<string> => {
    const { updatedItems, beforeBytes, afterBytes } = await optimizeAllStoredPhotos(items);
    setItems(updatedItems);
    const saved = Math.max(0, beforeBytes - afterBytes);
    return saved > 1024
      ? `照片最佳化完成：從 ${formatBytesCompact(beforeBytes)} 縮減至 ${formatBytesCompact(afterBytes)}（節省 ${formatBytesCompact(saved)}）`
      : `已完成所有照片檢視與縮圖建立（目前總計 ${formatBytesCompact(afterBytes)}）。`;
  };

  const handleSendTestNotification = async (): Promise<string> => {
    if (typeof Notification === 'undefined') {
      return '此裝置瀏覽器不支援網頁系統通知，建議改用「匯出手機行事曆 (.ics)」。';
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    if (perm !== 'granted') {
      return '通知權限遭拒絕，請至瀏覽器或手機系統設定允許通知。';
    }
    new Notification('CellKeep 蓄電筆記 · 測試提醒', {
      body: '提醒功能運作正常！系統將於充電日到期前為您提示裝置位置。',
      icon: './pwa-192x192.png',
    });
    return '已發送測試通知，請檢查系統通知欄。';
  };

  // Urgency counts for filter tabs & KPI strip
  const counts = useMemo(() => {
    const today = getTodayStr();
    let overdue = 0;
    let dueWeek = 0;
    let dueMonth = 0;
    let healthy = 0;

    for (const item of items) {
      const diff = diffDaysBetween(today, item.nextChargeDate);
      if (diff < 0) overdue++;
      else if (diff <= 7) dueWeek++;
      else if (diff <= 30) dueMonth++;
      else healthy++;
    }

    return {
      all: items.length,
      overdue,
      due_week: dueWeek,
      due_month: dueWeek + dueMonth, // 近月內包含30天內應充
      due_month_only: dueMonth,
      healthy,
    };
  }, [items]);

  // Filtered & urgency-sorted list
  const filteredItems = useMemo(() => {
    const today = getTodayStr();
    const q = searchQuery.trim().toLowerCase();

    return items
      .filter((item) => {
        if (q) {
          const tagsText = (item.tags || []).join(' ');
          const haystack = `${item.name} ${item.location} ${item.category} ${tagsText} ${item.notes}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }

        const diff = diffDaysBetween(today, item.nextChargeDate);
        if (filterScope === 'overdue') return diff < 0;
        if (filterScope === 'due_week') return diff >= 0 && diff <= 7;
        if (filterScope === 'due_month') return diff >= 0 && diff <= 30;
        if (filterScope === 'healthy') return diff > 30;
        return true;
      })
      .sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate));
  }, [items, searchQuery, filterScope]);

  const tabTitles: Record<ActiveTab, string> = {
    inventory: '物件清單與搜尋',
    schedule: '日週月年充電排程',
    settings: '設定、提醒與更新',
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] dark:bg-[#0D1117] text-slate-900 dark:text-slate-100">
      {/* Top Bar: Calm informational header on mobile (NO corner buttons for iOS ergonomics), clean 3-zone bar on desktop */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-[#161B22]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 pt-safe-ios">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <span className="h-7 w-7 rounded-lg bg-teal-600 text-white flex items-center justify-center">
              <BatteryCharging className="h-4 w-4" />
            </span>
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              CellKeep 蓄電筆記
            </span>
          </div>

          {/* Mobile current view text only (zero corner click targets on iOS top edge) */}
          <span className="md:hidden text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            {tabTitles[activeTab]}
          </span>

          {/* Zone 2: Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
            {(
              [
                { id: 'inventory', label: '物件清單' },
                { id: 'schedule', label: '充電排程' },
                { id: 'settings', label: '設定與更新' },
              ] as const
            ).map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveTab(nav.id)}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === nav.id
                    ? 'border-teal-600 text-slate-900 dark:text-white font-semibold'
                    : 'border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Desktop Single Primary CTA */}
          <div className="hidden md:flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              新增物件
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-28 md:pb-12">
        {isLoading ? (
          <div className="py-20 text-center text-sm text-slate-500 dark:text-slate-400">
            正在讀取本機電池與位置記錄...
          </div>
        ) : activeTab === 'inventory' ? (
          <div className="space-y-5">
            {/* Summary Strip (Interactive quick-filter cards) */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setFilterScope('overdue')}
                className={`rounded-2xl border p-3.5 text-left transition-colors cursor-pointer ${
                  filterScope === 'overdue'
                    ? 'border-red-500 bg-red-50/70 dark:bg-red-950/35'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-medium text-red-600 dark:text-red-400">已逾期未充</div>
                <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {counts.overdue}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFilterScope('due_week')}
                className={`rounded-2xl border p-3.5 text-left transition-colors cursor-pointer ${
                  filterScope === 'due_week'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/35'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-medium text-amber-600 dark:text-amber-400">近週內 (7日)</div>
                <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {counts.due_week}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFilterScope('due_month')}
                className={`rounded-2xl border p-3.5 text-left transition-colors cursor-pointer ${
                  filterScope === 'due_month'
                    ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/35'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-medium text-teal-700 dark:text-teal-400">近月內 (30日)</div>
                <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {counts.due_month}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFilterScope('all')}
                className={`rounded-2xl border p-3.5 text-left transition-colors cursor-pointer ${
                  filterScope === 'all'
                    ? 'border-slate-900 dark:border-slate-300 bg-slate-100/70 dark:bg-slate-800/70'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">全部管理物件</div>
                <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {counts.all}
                </div>
              </button>
            </section>

            {/* Search Input & Filter Tabs (placed in comfortable middle reach zone) */}
            <section className="space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋物件名稱、標籤、放置位置（如：抽屜、書房）、分類..."
                  className="w-full min-h-[48px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] pl-10 pr-11 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="清除搜尋"
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {(
                  [
                    { id: 'all', label: `全部 (${counts.all})` },
                    { id: 'overdue', label: `已逾期 (${counts.overdue})` },
                    { id: 'due_week', label: `近週內 (${counts.due_week})` },
                    { id: 'due_month', label: `近月內 (${counts.due_month})` },
                    { id: 'healthy', label: `電量健康 (${counts.healthy})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterScope(tab.id)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                      filterScope === tab.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-white dark:bg-[#161B22] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Non-intrusive In-App Install Prompt Bar (hidden once installed in standalone mode) */}
            {!isInstalled && !dismissInstallBar && (
              <section className="rounded-2xl border border-teal-200/90 dark:border-teal-900/70 bg-teal-50/70 dark:bg-teal-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      安裝 CellKeep 到手機主畫面或電腦桌面
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      獨立全螢幕開啟、離線查看所有設備位置照片
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isInstallable ? (
                    <button
                      type="button"
                      onClick={install}
                      className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      立即安裝
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowInstallModal(true)}
                    className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 px-3.5 py-2 text-xs font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                  >
                    安裝畫面
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissInstallBar(true)}
                    aria-label="暫時隱藏安裝提示"
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </section>
            )}

            {/* Inventory Grid or Empty State */}
            {items.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161B22] px-6 py-12 text-center space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                  <Camera className="h-7 w-7" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    開始建立您的電池保養與收納圖鑑
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    為少用的行動電源、相機、玩具或備用電器拍張照，記下放置位置與充電週期，再也不怕放到沒電壞掉或找不到！
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setIsFormOpen(true);
                    }}
                    className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    新增第一個電器
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadDemoItems}
                    className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    載入 3 筆範例體驗看看
                  </button>
                </div>
              </section>
            ) : filteredItems.length === 0 ? (
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] py-12 text-center space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  找不到符合目前搜尋或篩選條件的物件
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterScope('all');
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  顯示全部物件
                </button>
              </section>
            ) : (
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onSelect={(it) => setSelectedItem(it)}
                    onQuickReset={(it) => handleResetCycle(it, getTodayStr())}
                  />
                ))}
              </section>
            )}
          </div>
        ) : activeTab === 'schedule' ? (
          <ScheduleView
            items={items}
            onSelectItem={(it) => setSelectedItem(it)}
            onQuickReset={(it) => handleResetCycle(it, getTodayStr())}
          />
        ) : (
          <SettingsView
            items={items}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onImportItems={handleImportItems}
            onLoadDemoItems={handleLoadDemoItems}
            onOptimizePhotos={handleOptimizePhotos}
            onSendTestNotification={handleSendTestNotification}
          />
        )}
      </main>

      {/* Non-intrusive offline status & feedback toast above bottom dock */}
      <div className="fixed bottom-24 md:bottom-6 inset-x-0 z-40 pointer-events-none flex flex-col items-center gap-2 px-4">
        {!isOnline && (
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
            <WifiOff className="h-3.5 w-3.5" />
            目前為離線狀態 · 本機資料與照片可正常使用
          </div>
        )}
        {toastMessage && (
          <div className="pointer-events-auto rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 text-sm font-medium shadow-lg">
            {toastMessage}
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Dock (Inset from edges & corners for iOS ergonomics) */}
      <nav
        aria-label="主導覽列"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-safe-ios pt-1 pointer-events-none"
      >
        <div className="pointer-events-auto mx-auto max-w-md rounded-2xl bg-white/92 dark:bg-[#161B22]/92 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-lg grid grid-cols-4 items-center gap-1 p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              activeTab === 'inventory'
                ? 'text-teal-700 dark:text-teal-400 bg-teal-50/80 dark:bg-teal-950/40'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <ListChecks className="h-5 w-5" />
            <span className="text-[11px] font-medium mt-0.5">清單</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              activeTab === 'schedule'
                ? 'text-teal-700 dark:text-teal-400 bg-teal-50/80 dark:bg-teal-950/40'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <CalendarRange className="h-5 w-5" />
            <span className="text-[11px] font-medium mt-0.5">排程</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsFormOpen(true);
            }}
            className="min-h-[48px] flex flex-col items-center justify-center rounded-xl bg-teal-600 text-white active:scale-[0.97] transition-transform cursor-pointer"
          >
            <Plus className="h-5 w-5" />
            <span className="text-[11px] font-semibold mt-0.5">新增</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'text-teal-700 dark:text-teal-400 bg-teal-50/80 dark:bg-teal-950/40'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[11px] font-medium mt-0.5">設定</span>
          </button>
        </div>
      </nav>

      {/* Item Detail Sheet */}
      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={(item) => {
            setSelectedItem(null);
            setEditingItem(item);
            setIsFormOpen(true);
          }}
          onResetCycle={handleResetCycle}
          onDelete={handleDeleteItem}
        />
      )}

      {/* Create / Edit Item Form Sheet */}
      {isFormOpen && (
        <ItemFormSheet
          initialItem={editingItem}
          onSave={handleSaveItem}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* PWA Install Guide / Native Install Screen */}
      {showInstallModal && (
        <PWAInstallModal onClose={() => setShowInstallModal(false)} />
      )}
    </div>
  );
}
