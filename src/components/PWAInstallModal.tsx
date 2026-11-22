import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Laptop,
  MoreVertical,
  Share,
  Smartphone,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWA';

interface PWAInstallModalProps {
  onClose: () => void;
}

type PlatformTab = 'ios' | 'android' | 'desktop';

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } = usePWAInstall();
  const [platformTab, setPlatformTab] = useState<PlatformTab>(
    isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
  );
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleNativeInstall = async () => {
    const ok = await install();
    if (ok) {
      setInstallSuccess(true);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/55 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-2 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
          {/* App Identity Showcase */}
          <div className="flex items-center gap-4 pt-1">
            <img
              src="./pwa-192x192.png"
              alt="CellKeep 蓄電筆記圖示"
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                安裝 CellKeep 蓄電筆記
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                安裝至手機主畫面或電腦桌面後，可全螢幕獨立開啟並離線查詢所有設備位置照片與充電週期。
              </p>
            </div>
          </div>

          {/* Native One-Tap Install Status */}
          {isInstalled || installSuccess ? (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">已完成安裝</p>
                <p className="text-xs opacity-90 mt-0.5">您現在可以從主畫面或應用程式選單獨立啟動。</p>
              </div>
            </div>
          ) : isInstallable ? (
            <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/35 p-4 space-y-3">
              <p className="text-sm font-medium text-teal-900 dark:text-teal-200">
                您的瀏覽器已就緒，可直接將此應用安裝至裝置：
              </p>
              <button
                type="button"
                onClick={handleNativeInstall}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 active:scale-[0.99] transition-all cursor-pointer"
              >
                <Download className="h-4 w-4" />
                立即安裝到主畫面 / 桌面
              </button>
            </div>
          ) : isInIframe ? (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/80 dark:bg-amber-950/30 p-4 space-y-3">
              <div className="text-sm text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-semibold">目前正於預覽框架中瀏覽</p>
                <p className="text-xs leading-relaxed opacity-90">
                  瀏覽器安全機制會在內嵌預覽框中隱藏自動安裝視窗。請點擊下方按鈕以「獨立新分頁」開啟，即可觸發瀏覽器一鍵安裝或加入主畫面。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90"
                >
                  <ExternalLink className="h-4 w-4" />
                  在新分頁開啟並安裝
                </a>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedUrl ? '已複製網址' : '複製網址'}
                </button>
              </div>
            </div>
          ) : null}

          {/* Step-by-step Platform Guide */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              各裝置手動安裝步驟
            </h3>

            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setPlatformTab('ios')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  platformTab === 'ios'
                    ? 'bg-white dark:bg-[#161B22] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                iPhone / iPad
              </button>
              <button
                type="button"
                onClick={() => setPlatformTab('android')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  platformTab === 'android'
                    ? 'bg-white dark:bg-[#161B22] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Android 手機
              </button>
              <button
                type="button"
                onClick={() => setPlatformTab('desktop')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  platformTab === 'desktop'
                    ? 'bg-white dark:bg-[#161B22] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                電腦桌面版
              </button>
            </div>

            {platformTab === 'ios' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <p>使用 <strong>Safari</strong> 瀏覽器開啟本網站（勿使用 LINE / FB 內建瀏覽器）。</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="flex items-center flex-wrap gap-1">
                    點擊底部工具列的 <Share className="h-4 w-4 text-teal-600 inline" /> <strong>分享</strong> 按鈕。
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <p>向下捲動並點擊 <strong>「加入主畫面」</strong>，再點右上角「新增」即可完成安裝。</p>
                </div>
              </div>
            )}

            {platformTab === 'android' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <p>使用 <strong>Chrome</strong> 或 Edge 瀏覽器開啟本頁面。</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="flex items-center flex-wrap gap-1">
                    點擊右上角 <MoreVertical className="h-4 w-4 inline" /> 選單，選擇 <strong>「安裝應用程式」</strong> 或 <strong>「加到主畫面」</strong>。
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <p>
                    <Smartphone className="h-4 w-4 inline mr-1 text-teal-600" />
                    確認後即會出現在桌面與應用程式抽屜中（未來亦支援打包為 APK）。
                  </p>
                </div>
              </div>
            )}

            {platformTab === 'desktop' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <p>使用 <strong>Chrome</strong> 或 <strong>Microsoft Edge</strong> 開啟獨立分頁。</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="flex items-center flex-wrap gap-1">
                    點擊網址列右側的 <Laptop className="h-4 w-4 inline text-teal-600" /> <strong>「安裝 CellKeep 蓄電筆記」</strong> 圖示。
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <p>安裝後將以獨立視窗開啟，並支援離線查看資料。</p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Bottom Thumb-Safe Action Bar */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] px-4 pt-3 pb-safe-ios flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-xl bg-slate-900 dark:bg-slate-100 text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90 cursor-pointer"
          >
            關閉安裝畫面
          </button>
        </div>
      </div>
    </div>
  );
};
