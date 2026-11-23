import React, { useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  MapPin,
  RotateCcw,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import { BatteryItem } from '../types/battery';
import {
  addInterval,
  formatCycleLabel,
  formatDateWithWeekday,
  getCycleProgressPercent,
  getDateGranularityTags,
  getTodayStr,
  getUrgencyInfo,
} from '../utils/dateCycle';

interface ItemDetailSheetProps {
  item: BatteryItem;
  onClose: () => void;
  onEdit: (item: BatteryItem) => void;
  onResetCycle: (item: BatteryItem, resetDate: string) => void;
  onMoveToTrash: (id: string) => void;
}

export const ItemDetailSheet: React.FC<ItemDetailSheetProps> = ({
  item,
  onClose,
  onEdit,
  onResetCycle,
  onMoveToTrash,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);
  const [resetDate, setResetDate] = useState(getTodayStr());

  const urgency = getUrgencyInfo(item.nextChargeDate);
  const progress = getCycleProgressPercent(item.startDate, item.nextChargeDate);
  const nextTags = getDateGranularityTags(item.nextChargeDate);
  const previewNextIfReset = addInterval(resetDate, item.intervalValue, item.intervalUnit);

  const activePhoto = item.photos[activePhotoIndex] || item.photos[0];

  const statusMeta = {
    overdue: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' },
    due_week: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
    due_month: { icon: Calendar, color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/40' },
    healthy: { icon: CheckCircle2, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  }[urgency.status];
  const StatusIcon = statusMeta.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/55 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (non-corner visual anchor) */}
        <div className="pt-3 pb-2 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
          {/* Header summary */}
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{item.category} · {formatCycleLabel(item.intervalValue, item.intervalUnit)}</span>
              <span className="tabular-nums">已循環 {item.resetCount} 次</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {item.name}
            </h2>
            <div className={`mt-2.5 inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium ${statusMeta.bg} ${statusMeta.color}`}>
              <StatusIcon className="h-4 w-4 shrink-0" />
              <span>{urgency.detailLabel}</span>
            </div>
          </div>

          {/* Multi-photo location trace gallery */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                放置位置與外觀照片循跡 ({item.photos.length} 張)
              </h3>
              {activePhoto && (
                <button
                  type="button"
                  onClick={() => setZoomedPhotoUrl(activePhoto.dataUrl)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 py-1.5 px-2.5 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 cursor-pointer"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                  放大檢視
                </button>
              )}
            </div>

            {item.photos.length > 0 && activePhoto ? (
              <div className="space-y-2.5">
                <div
                  className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-900/5 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer flex items-center justify-center"
                  onClick={() => setZoomedPhotoUrl(activePhoto.dataUrl)}
                >
                  <img
                    src={activePhoto.dataUrl}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    className="h-full w-full object-contain"
                  />
                  <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/65 px-2.5 py-1 text-xs font-medium text-white tabular-nums">
                    {activePhotoIndex + 1} / {item.photos.length}
                  </span>
                </div>

                {item.photos.length > 1 && (
                  <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                    {item.photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setActivePhotoIndex(index)}
                        className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-slate-100 dark:bg-slate-900 transition-all cursor-pointer ${
                          index === activePhotoIndex
                            ? 'border-teal-600 ring-2 ring-teal-500/30'
                            : 'border-slate-200 dark:border-slate-700 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={photo.thumbDataUrl || photo.dataUrl}
                          alt={`照片 ${index + 1}`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain"
                        />
                        <span className="absolute top-1 left-1 rounded bg-black/65 px-1.5 text-[10px] font-medium text-white tabular-nums">
                          {index + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 py-8 text-center">
                <BatteryCharging className="h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  尚未上傳外觀或位置照片，可點擊下方「編輯」補拍存放環境
                </p>
              </div>
            )}
          </section>

          {/* Storage Location Box */}
          <section className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              放置位置記錄
            </div>
            <p className="text-base font-medium text-slate-900 dark:text-slate-100">
              {item.location}
            </p>
            {item.tags && item.tags.length > 0 && (
              <p className="text-xs text-teal-700 dark:text-teal-400 pt-1">
                標籤：{item.tags.map((t) => `#${t}`).join(' · ')}
              </p>
            )}
            {item.notes && (
              <p className="text-sm text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800 mt-2">
                {item.notes}
              </p>
            )}
          </section>

          {/* Cycle Details (Start Date <-> Next Charge Date + Day/Week/Month/Year tags) */}
          <section className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>循環進度（起始日 → 下次充電日）</span>
              <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">{progress}%</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-teal-600 transition-all duration-300"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">充電起始日</span>
                <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatDateWithWeekday(item.startDate)}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">下次充電日</span>
                <p className="mt-0.5 font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
                  {formatDateWithWeekday(item.nextChargeDate)}
                </p>
              </div>
            </div>

            {/* Day / Week / Month / Year alignment summary */}
            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                充電日曆標記（便於對照同一天 / 同週 / 同月充電）：
              </p>
              <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                <div className="rounded-xl bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-slate-800 py-2 px-1">
                  <div className="text-[11px] text-slate-400">年</div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{nextTags.year}</div>
                </div>
                <div className="rounded-xl bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-slate-800 py-2 px-1">
                  <div className="text-[11px] text-slate-400">月</div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{nextTags.month}</div>
                </div>
                <div className="rounded-xl bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-slate-800 py-2 px-1">
                  <div className="text-[11px] text-slate-400">週</div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{nextTags.week}</div>
                </div>
                <div className="rounded-xl bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-slate-800 py-2 px-1">
                  <div className="text-[11px] text-slate-400">日</div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{nextTags.day}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Reset Cycle Box */}
          <section className="rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/60 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-teal-900 dark:text-teal-200">
                  已完成這次充電？重置新循環
                </h4>
                <p className="text-xs text-teal-700 dark:text-teal-400 mt-0.5">
                  重置後將以指定日期作為新起始日，下次充電日為 <span className="font-semibold tabular-nums">{previewNextIfReset}</span>
                </p>
              </div>
              <input
                type="date"
                value={resetDate}
                onChange={(e) => setResetDate(e.target.value || getTodayStr())}
                aria-label="重置起始日"
                className="min-h-[42px] rounded-xl border border-teal-300 dark:border-teal-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
              />
            </div>

            <button
              type="button"
              onClick={() => onResetCycle(item, resetDate)}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 active:scale-[0.99] transition-all cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              Reset 重置週期（設 {resetDate} 為起始日）
            </button>
          </section>

        </div>

        {/* Sticky Bottom Action Bar (iOS Thumb-Reach Zone - no corner close buttons) */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] px-4 pt-3 pb-safe-ios flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => onMoveToTrash(item.id)}
            className="min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>移至回收桶</span>
          </button>

          <div className="flex items-center gap-2.5 flex-1 justify-end">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Edit3 className="h-4 w-4" />
              編輯資料
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[46px] inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 px-5 text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90 cursor-pointer"
            >
              關閉
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Photo Lightbox */}
      {zoomedPhotoUrl && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-black/95 p-4 pb-safe-ios"
          onClick={() => setZoomedPhotoUrl(null)}
        >
          <div className="h-4" />
          <img
            src={zoomedPhotoUrl}
            alt={item.name}
            referrerPolicy="no-referrer"
            className="max-h-[75vh] max-w-full rounded-xl object-contain"
          />
          <button
            type="button"
            onClick={() => setZoomedPhotoUrl(null)}
            className="min-h-[48px] w-full max-w-xs rounded-2xl bg-white/15 backdrop-blur-md text-white text-sm font-semibold border border-white/25 cursor-pointer"
          >
            關閉放大檢視
          </button>
        </div>
      )}
    </div>
  );
};
