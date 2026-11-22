import React, { useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Download,
  Moon,
  RefreshCw,
  Smartphone,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import { AppSettings, BatteryItem } from '../types/battery';
import { useBetaUpdater, usePWAInstall } from '../hooks/usePWA';
import { PWAInstallModal } from './PWAInstallModal';

interface SettingsViewProps {
  items: BatteryItem[];
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onImportItems: (imported: BatteryItem[]) => Promise<void>;
  onLoadDemoItems: () => Promise<void>;
  onSendTestNotification: () => Promise<string>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  items,
  settings,
  onUpdateSettings,
  onImportItems,
  onLoadDemoItems,
  onSendTestNotification,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const {
    currentVersion,
    channel,
    swWaiting,
    checkState,
    remoteVersion,
    lastCheckedAt,
    checkForUpdates,
    installUpdate,
  } = useBetaUpdater();

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [showDeployGuide, setShowDeployGuide] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleToggleNotifications = async () => {
    if (!settings.remindersEnabled) {
      if (typeof Notification === 'undefined') {
        setFeedbackMsg('此瀏覽器不支援網頁推播通知，可使用排程頁面的「匯出手機行事曆 (.ics)」來取得系統鬧鐘提醒。');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setFeedbackMsg('尚未取得通知權限，請於瀏覽器或手機系統設定中開啟通知權限。');
        return;
      }
      onUpdateSettings({ ...settings, remindersEnabled: true });
      setFeedbackMsg('已開啟定期充電提醒功能。');
    } else {
      onUpdateSettings({ ...settings, remindersEnabled: false });
      setFeedbackMsg('已關閉瀏覽器充電提醒。');
    }
  };

  const handleExportBackup = () => {
    const payload = {
      app: 'CellKeep',
      version: currentVersion,
      exportedAt: new Date().toISOString(),
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cellkeep-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedbackMsg(`已匯出 ${items.length} 筆物件資料與照片備份檔。`);
  };

  const handleImportFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed?.items;
      if (!Array.isArray(list)) {
        setFeedbackMsg('備份檔格式不正確，請選擇由 CellKeep 匯出的 JSON 檔。');
        return;
      }
      await onImportItems(list as BatteryItem[]);
      setFeedbackMsg(`成功還原 ${list.length} 筆物件記錄。`);
    } catch {
      setFeedbackMsg('無法解析 JSON 備份檔案。');
    }
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {feedbackMsg && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 px-4 py-3 text-sm text-teal-800 dark:text-teal-200">
          {feedbackMsg}
        </div>
      )}

      {/* 1. PWA Installation Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-teal-600" />
              安裝應用程式至桌面 / 手機
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              支援離線瀏覽照片與充電週期，可由網頁直接安裝，未來亦可打包為 Android APK
            </p>
          </div>
        </div>

        {isInstalled ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            目前已於獨立 App 模式（Standalone）中執行
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            {isInstallable && (
              <button
                type="button"
                onClick={install}
                className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                立即安裝 CellKeep App
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className={`min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold cursor-pointer ${
                isInstallable
                  ? 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              開啟安裝畫面與步驟引導
            </button>
          </div>
        )}
      </section>

      {/* 2. Beta Version & Manual User-Initiated Update Check */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              版本資訊與手動檢查更新
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              目前版本：v{currentVersion} ({channel})
              {lastCheckedAt ? ` · 上次檢查 ${lastCheckedAt}` : ''}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          開發測試期間不會強行推播或自動重整您的畫面；您可隨時手動檢查是否有新的 Beta 版本並自行決定是否安裝。
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={checkForUpdates}
            disabled={checkState === 'checking'}
            className="min-h-[46px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${checkState === 'checking' ? 'animate-spin' : ''}`} />
            {checkState === 'checking' ? '正在檢查版本...' : '檢查更新版本'}
          </button>

          {(checkState === 'update-available' || swWaiting) && (
            <button
              type="button"
              onClick={installUpdate}
              className="min-h-[46px] inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              立即安裝新版本{remoteVersion ? ` (${remoteVersion.version})` : ''}
            </button>
          )}
        </div>

        {checkState === 'up-to-date' && !swWaiting && (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            目前已是最新 Beta 版本（v{currentVersion}），無須更新。
          </p>
        )}
        {checkState === 'update-available' && remoteVersion && (
          <div className="rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 p-3 text-xs text-teal-800 dark:text-teal-200">
            <p className="font-semibold">發現新版本：v{remoteVersion.version}</p>
            <p className="mt-1">{remoteVersion.notes}</p>
          </div>
        )}
        {checkState === 'offline' && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            目前為離線狀態，請連線後再檢查版本更新。
          </p>
        )}
      </section>

      {/* 3. Periodic Reminders */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="h-4 w-4 text-teal-600" />
              定期充電提醒
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              開啟 App 時檢查即將到期與已逾期裝置並發送提醒通知
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleNotifications}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              settings.remindersEnabled
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {settings.remindersEnabled ? '已開啟' : '開啟提醒'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <span>提前提醒天數：</span>
            <select
              value={settings.reminderDaysBefore}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  reminderDaysBefore: Number(e.target.value),
                })
              }
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm"
            >
              <option value={0}>充電日當天</option>
              <option value={1}>提前 1 天</option>
              <option value={3}>提前 3 天</option>
              <option value={7}>提前 7 天</option>
            </select>
          </div>

          <button
            type="button"
            onClick={async () => {
              const res = await onSendTestNotification();
              setFeedbackMsg(res);
            }}
            className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            發送測試通知
          </button>
        </div>
      </section>

      {/* 4. Data Backup, Demo Loader & Theme */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">外觀與資料備份</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              所有資料與多張照片皆安全儲存於本機離線資料庫（目前共 {items.length} 件物件）
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                ...settings,
                theme: settings.theme === 'dark' ? 'light' : 'dark',
              })
            }
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            {settings.theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            {settings.theme === 'dark' ? '淺色模式' : '深色模式'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={items.length === 0}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            匯出完整備份 (.json)
          </button>

          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            匯入還原備份
          </button>

          <button
            type="button"
            onClick={async () => {
              await onLoadDemoItems();
              setFeedbackMsg('已載入 3 筆範例電器與位置循跡照片，可立即體驗搜尋與重置流程。');
            }}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/30 px-4 py-2 text-sm font-medium text-teal-800 dark:text-teal-300 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            加入示範物件
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              handleImportFile(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      {/* 5. GitHub Pages & Android APK Packaging Guide */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] p-5">
        <button
          type="button"
          onClick={() => setShowDeployGuide((v) => !v)}
          className="w-full min-h-[44px] flex items-center justify-between text-left text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
        >
          <span>GitHub Pages 部署與 Android APK 打包架構說明</span>
          <span className="text-xs text-teal-700 dark:text-teal-400">
            {showDeployGuide ? '收合' : '展開查看'}
          </span>
        </button>

        {showDeployGuide && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>
              <strong>1. GitHub Pages 靜態部署：</strong>已內建相對路徑設定（<code className="font-mono-num">base: &apos;./&apos;</code>）與 <code className="font-mono-num">.github/workflows/deploy.yml</code>，推送至 <code className="font-mono-num">main</code> 分支並開啟 Repository 的 Pages（GitHub Actions）即可自動上線。
            </p>
            <p>
              <strong>2. 轉為 Android App (APK)：</strong>專案根目錄已備妥 <code className="font-mono-num">capacitor.config.json</code>（App ID：<code className="font-mono-num">com.cellkeep.app</code>）。未來只需執行 <code className="font-mono-num">npm run build</code> 後透過 Capacitor <code className="font-mono-num">npx cap add android && npx cap sync</code> 即可於 Android Studio 編譯 APK，或直接以 PWA TWA (Bubblewrap) 打包上架。
            </p>
          </div>
        )}
      </section>

      {showInstallModal && <PWAInstallModal onClose={() => setShowInstallModal(false)} />}
    </div>
  );
};
