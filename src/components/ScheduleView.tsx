import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import { BatteryItem, ScheduleGranularity } from '../types/battery';
import {
  addDays,
  formatCycleLabel,
  formatDateWithWeekday,
  formatLocalDate,
  generateICS,
  getISOWeekInfo,
  getMonthMatrix,
  getTodayStr,
  getUrgencyInfo,
  parseLocalDate,
} from '../utils/dateCycle';

interface ScheduleViewProps {
  items: BatteryItem[];
  onSelectItem: (item: BatteryItem) => void;
  onQuickReset: (item: BatteryItem) => void;
}

const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  items,
  onSelectItem,
  onQuickReset,
}) => {
  const today = getTodayStr();
  const [granularity, setGranularity] = useState<ScheduleGranularity>('month');
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [viewDate, setViewDate] = useState<Date>(() => parseLocalDate(today));

  // Group items by nextChargeDate (YYYY-MM-DD)
  const itemsByDate = useMemo(() => {
    const map = new Map<string, BatteryItem[]>();
    for (const item of items) {
      const list = map.get(item.nextChargeDate) || [];
      list.push(item);
      map.set(item.nextChargeDate, list);
    }
    return map;
  }, [items]);

  const overdueItems = useMemo(
    () =>
      items
        .filter((i) => i.nextChargeDate < today)
        .sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate)),
    [items, today]
  );

  // Selected day items
  const selectedDayItems = useMemo(
    () => itemsByDate.get(selectedDate) || [],
    [itemsByDate, selectedDate]
  );

  // Week range items
  const weekInfo = useMemo(() => getISOWeekInfo(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekInfo.startOfWeek, i));
  }, [weekInfo.startOfWeek]);

  // Month matrix
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const monthCells = useMemo(() => getMonthMatrix(viewYear, viewMonth), [viewYear, viewMonth]);

  // Year monthly counts
  const yearMonthBuckets = useMemo(() => {
    return MONTH_NAMES.map((label, monthIdx) => {
      const prefix = `${viewYear}-${String(monthIdx + 1).padStart(2, '0')}`;
      const matched = items
        .filter((i) => i.nextChargeDate.startsWith(prefix))
        .sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate));
      return {
        monthIdx,
        label,
        prefix,
        items: matched,
      };
    });
  }, [items, viewYear]);

  const handleExportICS = () => {
    if (items.length === 0) return;
    const ics = generateICS(items);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cellkeep-schedule-${today}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shiftPeriod = (delta: number) => {
    if (granularity === 'day') {
      const next = addDays(selectedDate, delta);
      setSelectedDate(next);
      setViewDate(parseLocalDate(next));
    } else if (granularity === 'week') {
      const next = addDays(selectedDate, delta * 7);
      setSelectedDate(next);
      setViewDate(parseLocalDate(next));
    } else if (granularity === 'month') {
      const next = new Date(viewYear, viewMonth + delta, 1, 12, 0, 0);
      setViewDate(next);
    } else {
      const next = new Date(viewYear + delta, viewMonth, 1, 12, 0, 0);
      setViewDate(next);
    }
  };

  const renderCompactItemRow = (item: BatteryItem) => {
    const urgency = getUrgencyInfo(item.nextChargeDate, today);
    const cover = item.photos[0]?.thumbDataUrl || item.photos[0]?.dataUrl;

    return (
      <div
        key={item.id}
        className="flex items-center justify-between gap-3 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 p-3"
      >
        <button
          type="button"
          onClick={() => onSelectItem(item)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
        >
          <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200/70 dark:border-slate-700/60">
            {cover ? (
              <img
                src={cover}
                alt={item.name}
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <BatteryCharging className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {item.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0 text-teal-600" />
              <span className="truncate">{item.location}</span>
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">
              {formatCycleLabel(item.intervalValue, item.intervalUnit)} · {urgency.shortLabel}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onQuickReset(item)}
          className="min-h-[42px] inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 shrink-0 whitespace-nowrap cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重置
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Granularity Switcher + Calendar Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-200/75 dark:bg-slate-800/80 p-1">
          {(
            [
              { id: 'day', label: '日視圖' },
              { id: 'week', label: '週視圖' },
              { id: 'month', label: '月視圖' },
              { id: 'year', label: '年視圖' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setGranularity(tab.id)}
              className={`min-h-[42px] flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                granularity === tab.id
                  ? 'bg-white dark:bg-[#161B22] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportICS}
          disabled={items.length === 0}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          <Download className="h-4 w-4 text-teal-600" />
          匯出手機行事曆 (.ics)
        </button>
      </div>

      {/* Period Navigation Bar */}
      <div className="flex items-center justify-between rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 px-3 py-2">
        <button
          type="button"
          onClick={() => shiftPeriod(-1)}
          aria-label="上一個區間"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tabular-nums">
            {granularity === 'day' && formatDateWithWeekday(selectedDate)}
            {granularity === 'week' && `${weekInfo.year}年 第 ${weekInfo.week} 週 (${weekInfo.startOfWeek.slice(5)} ~ ${weekInfo.endOfWeek.slice(5)})`}
            {granularity === 'month' && `${viewYear}年 ${viewMonth + 1}月`}
            {granularity === 'year' && `${viewYear}年 全年充電排程`}
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedDate(today);
              setViewDate(parseLocalDate(today));
            }}
            className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline mt-0.5 cursor-pointer"
          >
            回到今日 ({today})
          </button>
        </div>

        <button
          type="button"
          onClick={() => shiftPeriod(1)}
          aria-label="下一個區間"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Overdue Alert Strip if any overdue items exist */}
      {overdueItems.length > 0 && (
        <section className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/25 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>已逾期未充電物件（{overdueItems.length} 件）</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {overdueItems.map((item) => renderCompactItemRow(item))}
          </div>
        </section>
      )}

      {/* DAY VIEW */}
      {granularity === 'day' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
              {selectedDate} 排定充電物件（{selectedDayItems.length} 件）
            </h3>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setViewDate(parseLocalDate(e.target.value));
                }
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] px-3 text-xs text-slate-800 dark:text-slate-200 tabular-nums"
            />
          </div>

          {selectedDayItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedDayItems.map((item) => renderCompactItemRow(item))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] py-10 text-center">
              <CalendarDays className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                這一天目前沒有排定需要充電的物件
              </p>
            </div>
          )}
        </section>
      )}

      {/* WEEK VIEW */}
      {granularity === 'week' && (
        <section className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {weekDays.map((dayStr) => {
              const dayItems = itemsByDate.get(dayStr) || [];
              const isToday = dayStr === today;
              return (
                <div
                  key={dayStr}
                  className={`rounded-2xl border p-3.5 space-y-2.5 ${
                    isToday
                      ? 'border-teal-400 dark:border-teal-700 bg-teal-50/40 dark:bg-teal-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatDateWithWeekday(dayStr)}
                      {isToday && ' · 今天'}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                      {dayItems.length > 0 ? `${dayItems.length} 件同日充` : '無排程'}
                    </span>
                  </div>
                  {dayItems.length > 0 && (
                    <div className="space-y-2">{dayItems.map((item) => renderCompactItemRow(item))}</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* MONTH VIEW */}
      {granularity === 'month' && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 mb-2 text-center">
              {WEEKDAY_HEADERS.map((w) => (
                <div key={w} className="text-xs font-medium text-slate-400 py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {monthCells.map((cell) => {
                const count = (itemsByDate.get(cell.dateStr) || []).length;
                const isSelected = cell.dateStr === selectedDate;
                const isTodayCell = cell.dateStr === today;
                const isPastDue = cell.dateStr < today && count > 0;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`min-h-[52px] sm:min-h-[60px] flex flex-col items-center justify-between rounded-xl p-1.5 transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200'
                        : isTodayCell
                          ? 'border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/70'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    } ${!cell.inCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <span className="text-xs font-semibold tabular-nums">{cell.dayNum}</span>
                    {count > 0 ? (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums ${
                          isPastDue
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300'
                            : 'bg-teal-600 text-white'
                        }`}
                      >
                        {count}件
                      </span>
                    ) : (
                      <span className="h-4" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Detail List beneath Month Grid */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
              {formatDateWithWeekday(selectedDate)} · 當天充電清單（{selectedDayItems.length} 件）
            </h3>
            {selectedDayItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {selectedDayItems.map((item) => renderCompactItemRow(item))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800">
                點選上方有標記件數的日期，即可查看可同日一起充電的物件
              </p>
            )}
          </div>
        </section>
      )}

      {/* YEAR VIEW */}
      {granularity === 'year' && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {yearMonthBuckets.map((bucket) => {
            const sameDayClusters = new Set(bucket.items.map((i) => i.nextChargeDate)).size;
            return (
              <button
                key={bucket.prefix}
                type="button"
                onClick={() => {
                  setViewDate(new Date(viewYear, bucket.monthIdx, 1, 12, 0, 0));
                  setGranularity('month');
                }}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] p-4 text-left hover:border-teal-500 transition-colors cursor-pointer min-h-[112px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {bucket.label}
                  </span>
                  <span className="text-sm font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
                    {bucket.items.length} 件
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  {bucket.items.slice(0, 2).map((item) => (
                    <p key={item.id} className="text-xs text-slate-600 dark:text-slate-400 truncate tabular-nums">
                      {item.nextChargeDate.slice(5)} · {item.name}
                    </p>
                  ))}
                  {bucket.items.length > 2 && (
                    <p className="text-[11px] text-slate-400">
                      另有 {bucket.items.length - 2} 件（共 {sameDayClusters} 個充電日）
                    </p>
                  )}
                  {bucket.items.length === 0 && (
                    <p className="text-xs text-slate-400">尚無排定充電</p>
                  )}
                </div>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
};
