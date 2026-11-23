import React from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  Calendar,
  CheckCircle2,
  Clock,
  Images,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import { BatteryItem } from '../types/battery';
import {
  formatCycleLabel,
  getCycleProgressPercent,
  getDateGranularityTags,
  getUrgencyInfo,
} from '../utils/dateCycle';

interface ItemCardProps {
  item: BatteryItem;
  onSelect: (item: BatteryItem) => void;
  onQuickReset: (item: BatteryItem) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onSelect, onQuickReset }) => {
  const urgency = getUrgencyInfo(item.nextChargeDate);
  const progress = getCycleProgressPercent(item.startDate, item.nextChargeDate);
  const tags = getDateGranularityTags(item.nextChargeDate);
  const coverPhoto = item.photos[0]?.thumbDataUrl || item.photos[0]?.dataUrl;

  const statusConfig = {
    overdue: {
      icon: AlertTriangle,
      textClass: 'text-red-700 dark:text-red-400',
      barClass: 'bg-red-500',
      surfaceRing: 'bg-rose-50/85 dark:bg-red-950/25 border-red-200/90 dark:border-red-900/60',
      footerBg: 'bg-rose-100/55 dark:bg-red-950/40 border-red-200/70 dark:border-red-900/50',
    },
    due_week: {
      icon: Clock,
      textClass: 'text-amber-700 dark:text-amber-400',
      barClass: 'bg-amber-500',
      surfaceRing: 'bg-amber-50/85 dark:bg-amber-950/25 border-amber-200/90 dark:border-amber-900/50',
      footerBg: 'bg-amber-100/50 dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-900/40',
    },
    due_month: {
      icon: Calendar,
      textClass: 'text-teal-700 dark:text-teal-400',
      barClass: 'bg-teal-600',
      surfaceRing: 'bg-teal-50/70 dark:bg-teal-950/20 border-teal-200/80 dark:border-teal-900/50',
      footerBg: 'bg-teal-100/45 dark:bg-teal-950/35 border-teal-200/60 dark:border-teal-900/40',
    },
    healthy: {
      icon: CheckCircle2,
      textClass: 'text-emerald-700 dark:text-emerald-400',
      barClass: 'bg-emerald-500',
      surfaceRing: 'bg-slate-50/95 dark:bg-[#171E29] border-slate-200/95 dark:border-slate-700/80',
      footerBg: 'bg-white/75 dark:bg-slate-900/55 border-slate-200/80 dark:border-slate-800',
    },
  }[urgency.status];

  const StatusIcon = statusConfig.icon;

  return (
    <article
      className={`group flex flex-col justify-between rounded-2xl border shadow-xs ${statusConfig.surfaceRing} overflow-hidden transition-transform duration-150`}
    >
      {/* Main clickable detail area */}
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="w-full text-left p-4 flex flex-col gap-3.5 focus-visible:outline-2 focus-visible:outline-teal-600 rounded-t-2xl cursor-pointer"
      >
        <div className="flex items-start gap-3.5">
          {/* Cover Thumbnail with fallback */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-center">
            {coverPhoto ? (
              <img
                src={coverPhoto}
                alt={item.name}
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <BatteryCharging className="h-7 w-7 text-slate-400 dark:text-slate-500" />
            )}
            {item.photos.length > 1 && (
              <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
                <Images className="h-3 w-3" />
                {item.photos.length}
              </span>
            )}
          </div>

          {/* Primary Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {item.category} · {formatCycleLabel(item.intervalValue, item.intervalUnit)}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 tabular-nums ${statusConfig.textClass}`}
              >
                <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                {urgency.shortLabel}
              </span>
            </div>

            <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {item.name}
            </h3>

            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
              <MapPin className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
              <span>{item.location}</span>
            </p>

            {item.tags && item.tags.length > 0 && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 truncate">
                {item.tags.map((t) => `#${t}`).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Cycle dates & progress */}
        <div className="space-y-2 pt-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${statusConfig.barClass}`}
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>起始 {item.startDate}</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              下次 {item.nextChargeDate} ({tags.week} · {tags.month})
            </span>
          </div>
        </div>
      </button>

      {/* Ergonomic Bottom Action Row (away from iOS corners) */}
      <div className={`flex items-center justify-between gap-2 border-t px-4 py-2.5 ${statusConfig.footerBg}`}>
        <button
          type="button"
          onClick={() => onSelect(item)}
          className="min-h-[44px] px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          查看位置照片
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickReset(item);
          }}
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          充飽重置
        </button>
      </div>
    </article>
  );
};
