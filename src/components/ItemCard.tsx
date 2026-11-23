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
  getUrgencyInfo,
} from '../utils/dateCycle';

interface ItemCardProps {
  item: BatteryItem;
  onSelect: (item: BatteryItem) => void;
  onQuickReset: (item: BatteryItem) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onSelect, onQuickReset }) => {
  const urgency = getUrgencyInfo(item.nextChargeDate);
  const coverPhoto = item.photos[0]?.thumbDataUrl || item.photos[0]?.dataUrl;

  const statusConfig = {
    overdue: {
      icon: AlertTriangle,
      textClass: 'text-red-700 dark:text-red-400',
      surfaceRing: 'bg-rose-50/85 dark:bg-red-950/25 border-red-200/90 dark:border-red-900/60',
    },
    due_week: {
      icon: Clock,
      textClass: 'text-amber-700 dark:text-amber-400',
      surfaceRing: 'bg-amber-50/85 dark:bg-amber-950/25 border-amber-200/90 dark:border-amber-900/50',
    },
    due_month: {
      icon: Calendar,
      textClass: 'text-teal-700 dark:text-teal-400',
      surfaceRing: 'bg-teal-50/70 dark:bg-teal-950/20 border-teal-200/80 dark:border-teal-900/50',
    },
    healthy: {
      icon: CheckCircle2,
      textClass: 'text-emerald-700 dark:text-emerald-400',
      surfaceRing: 'bg-slate-50/95 dark:bg-[#171E29] border-slate-200/95 dark:border-slate-700/80',
    },
  }[urgency.status];

  const StatusIcon = statusConfig.icon;

  return (
    <article
      className={`flex items-center gap-3 rounded-2xl border shadow-xs px-3 py-2.5 ${statusConfig.surfaceRing}`}
    >
      {/* Clickable Full-Thumbnail Preview (uncropped object-contain -> tap to open location & photos) */}
      <button
        type="button"
        onClick={() => onSelect(item)}
        aria-label={`查看 ${item.name} 位置與照片`}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300/60 dark:border-slate-700/70 flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600"
      >
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={item.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          <BatteryCharging className="h-6 w-6 text-slate-400 dark:text-slate-500" />
        )}
        {item.photos.length > 1 && (
          <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white tabular-nums leading-none">
            <Images className="h-2.5 w-2.5" />
            {item.photos.length}
          </span>
        )}
      </button>

      {/* Clickable Primary Info */}
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="min-w-0 flex-1 text-left py-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600 rounded-lg"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
            {item.name}
          </h3>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 tabular-nums ${statusConfig.textClass}`}
          >
            <StatusIcon className="h-3 w-3 shrink-0" />
            {urgency.shortLabel}
          </span>
        </div>

        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 truncate">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
          <span className="truncate">{item.location}</span>
        </p>

        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
          <span>下次 {item.nextChargeDate}</span>
          <span aria-hidden="true">·</span>
          <span>{formatCycleLabel(item.intervalValue, item.intervalUnit)}</span>
          {item.tags && item.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate text-teal-700 dark:text-teal-400">
                {item.tags.slice(0, 2).map((t) => `#${t}`).join(' ')}
              </span>
            </>
          )}
        </div>
      </button>

      {/* Compact Quick Reset Action */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onQuickReset(item);
        }}
        title="充飽重置週期"
        className="min-h-[42px] shrink-0 inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 active:scale-[0.97] transition-all whitespace-nowrap cursor-pointer"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        重置
      </button>
    </article>
  );
};
