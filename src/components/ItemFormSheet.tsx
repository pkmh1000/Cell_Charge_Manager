import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ImagePlus,
  MapPin,
  Plus,
  Redo2,
  Tag,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { BatteryItem, CycleUnit, DeviceCategory, PhotoEvidence } from '../types/battery';
import { addInterval, getTodayStr } from '../utils/dateCycle';
import {
  compressImageToPair,
  estimateDataUrlBytes,
  formatBytesCompact,
} from '../utils/imageUtils';

interface ItemFormSheetProps {
  initialItem?: BatteryItem | null;
  onSave: (item: BatteryItem) => void;
  onCancel: () => void;
}

interface FormSnapshot {
  name: string;
  location: string;
  category: DeviceCategory;
  tags: string[];
  startDate: string;
  intervalInput: string;
  intervalUnit: CycleUnit;
  nextChargeDate: string;
  customNextDate: boolean;
  photos: PhotoEvidence[];
  notes: string;
}

const CATEGORIES: DeviceCategory[] = [
  '3C 電子',
  '行動電源',
  '家電用品',
  '攝影器材',
  '玩具遙控',
  '照明工具',
  '其他',
];

const QUICK_TAGS = ['書房', '客廳', '抽屜', '防潮箱', 'Type-C', '備用電池', '停電照明'];

const CYCLE_PRESETS: Array<{ label: string; value: number; unit: CycleUnit }> = [
  { label: '7 天', value: 7, unit: 'day' },
  { label: '14 天', value: 14, unit: 'day' },
  { label: '1 個月', value: 1, unit: 'month' },
  { label: '3 個月', value: 3, unit: 'month' },
  { label: '1 年', value: 1, unit: 'year' },
];

export const ItemFormSheet: React.FC<ItemFormSheetProps> = ({
  initialItem,
  onSave,
  onCancel,
}) => {
  const today = getTodayStr();

  const initialSnapshot: FormSnapshot = {
    name: initialItem?.name ?? '',
    location: initialItem?.location ?? '',
    category: initialItem?.category ?? '3C 電子',
    tags: initialItem?.tags ?? [],
    startDate: initialItem?.startDate ?? today,
    intervalInput: String(initialItem?.intervalValue ?? 1),
    intervalUnit: initialItem?.intervalUnit ?? 'month',
    nextChargeDate: initialItem?.nextChargeDate ?? addInterval(today, 1, 'month'),
    customNextDate: false,
    photos: initialItem?.photos ?? [],
    notes: initialItem?.notes ?? '',
  };

  const [form, setForm] = useState<FormSnapshot>(initialSnapshot);
  const [undoStack, setUndoStack] = useState<FormSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<FormSnapshot[]>([]);
  const lastTextCheckpointRef = useRef<{ field: string; time: number }>({
    field: '',
    time: 0,
  });

  const [tagDraft, setTagDraft] = useState('');
  const [zoomedPhotoId, setZoomedPhotoId] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [intervalError, setIntervalError] = useState<string | null>(null);

  // Press-and-hold drag-to-reorder state
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const draggingIdxRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number; photoId: string } | null>(null);
  const preDragSnapshotRef = useRef<FormSnapshot | null>(null);
  const formRef = useRef<FormSnapshot>(form);
  formRef.current = form;

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Discrete state update -> pushes previous snapshot onto undo stack immediately
  const applyDiscreteChange = (updater: (prev: FormSnapshot) => FormSnapshot) => {
    lastTextCheckpointRef.current = { field: '', time: 0 };
    setForm((prev) => {
      const next = updater(prev);
      setUndoStack((u) => [...u.slice(-39), prev]);
      setRedoStack([]);
      return next;
    });
  };

  // Continuous text typing update -> groups rapid keystrokes in the same field into one undo step
  const applyTextChange = (field: string, updater: (prev: FormSnapshot) => FormSnapshot) => {
    const now = Date.now();
    const shouldPush =
      lastTextCheckpointRef.current.field !== field ||
      now - lastTextCheckpointRef.current.time > 650;
    lastTextCheckpointRef.current = { field, time: now };

    setForm((prev) => {
      if (shouldPush) {
        setUndoStack((u) => [...u.slice(-39), prev]);
        setRedoStack([]);
      }
      return updater(prev);
    });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    lastTextCheckpointRef.current = { field: '', time: 0 };
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, form]);
    setForm(previous);
    setErrorMsg(null);
    setIntervalError(null);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    lastTextCheckpointRef.current = { field: '', time: 0 };
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, form]);
    setForm(next);
    setErrorMsg(null);
    setIntervalError(null);
  };

  useEffect(() => {
    const clearHoldTimer = () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };

    const handleWindowPointerMove = (e: PointerEvent) => {
      // Cancel pending hold if user is scrolling
      if (draggingIdxRef.current === null && pointerDownPosRef.current) {
        const dx = e.clientX - pointerDownPosRef.current.x;
        const dy = e.clientY - pointerDownPosRef.current.y;
        if (Math.hypot(dx, dy) > 10) {
          clearHoldTimer();
          pointerDownPosRef.current = null;
        }
        return;
      }

      const activeIdx = draggingIdxRef.current;
      if (activeIdx === null) return;

      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-photo-idx]');
      if (!el) return;
      const targetIdx = Number((el as HTMLElement).dataset.photoIdx);
      if (Number.isNaN(targetIdx) || targetIdx === activeIdx) return;

      draggingIdxRef.current = targetIdx;
      setDraggingIdx(targetIdx);
      setForm((prev) => {
        if (
          activeIdx < 0 ||
          activeIdx >= prev.photos.length ||
          targetIdx < 0 ||
          targetIdx >= prev.photos.length
        ) {
          return prev;
        }
        const reordered = [...prev.photos];
        const [moved] = reordered.splice(activeIdx, 1);
        reordered.splice(targetIdx, 0, moved);
        return { ...prev, photos: reordered };
      });
    };

    const handleWindowPointerEnd = () => {
      clearHoldTimer();
      const wasDragging = draggingIdxRef.current !== null;
      const tapMeta = pointerDownPosRef.current;
      pointerDownPosRef.current = null;

      if (wasDragging) {
        draggingIdxRef.current = null;
        setDraggingIdx(null);
        const beforeSnap = preDragSnapshotRef.current;
        preDragSnapshotRef.current = null;
        if (beforeSnap) {
          const beforeIds = beforeSnap.photos.map((p) => p.id).join(',');
          const afterIds = formRef.current.photos.map((p) => p.id).join(',');
          if (beforeIds !== afterIds) {
            setUndoStack((u) => [...u.slice(-39), beforeSnap]);
            setRedoStack([]);
          }
        }
      } else if (tapMeta) {
        // Quick tap without moving or entering drag -> open full-screen view
        setZoomedPhotoId(tapMeta.photoId);
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);
    return () => {
      clearHoldTimer();
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);
    };
  }, []);

  const handlePhotoPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    index: number,
    photoId: string
  ) => {
    // Ignore if tapping the tiny delete button
    if ((e.target as HTMLElement).closest('[data-delete-photo]')) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    pointerDownPosRef.current = { x: e.clientX, y: e.clientY, photoId };
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
    }

    const delay = e.pointerType === 'mouse' ? 140 : 220;
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      preDragSnapshotRef.current = formRef.current;
      draggingIdxRef.current = index;
      setDraggingIdx(index);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(15);
        } catch {
          // ignore
        }
      }
    }, delay);
  };

  const handleFilesSelected = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    setIsProcessingPhoto(true);
    setErrorMsg(null);
    try {
      const results = await Promise.allSettled(
        selectedFiles.map(async (file, idx) => {
          const pair = await compressImageToPair(file);
          return {
            id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
            dataUrl: pair.dataUrl,
            thumbDataUrl: pair.thumbDataUrl,
            createdAt: new Date().toISOString(),
          } satisfies PhotoEvidence;
        })
      );

      const added: PhotoEvidence[] = [];
      let failedCount = 0;
      for (const res of results) {
        if (res.status === 'fulfilled') added.push(res.value);
        else failedCount++;
      }

      if (added.length > 0) {
        applyDiscreteChange((prev) => ({
          ...prev,
          photos: [...prev.photos, ...added],
        }));
      }
      if (failedCount > 0) {
        setErrorMsg(`有 ${failedCount} 張照片格式無法讀取，其餘 ${added.length} 張已成功加入。`);
      }
    } catch {
      setErrorMsg('照片讀取失敗，請確認格式為 JPG / PNG / WebP。');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleRemovePhoto = (id: string) => {
    if (zoomedPhotoId === id) {
      setZoomedPhotoId(null);
    }
    applyDiscreteChange((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== id),
    }));
  };

  const handleAddTag = (rawTag: string) => {
    const clean = rawTag.replace(/^#/, '').trim();
    if (!clean) return;
    if (form.tags.includes(clean)) {
      setTagDraft('');
      return;
    }
    applyDiscreteChange((prev) => ({
      ...prev,
      tags: [...prev.tags, clean],
    }));
    setTagDraft('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    applyDiscreteChange((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleIntervalTextChange = (raw: string) => {
    // Allow clearing completely or entering digits freely on mobile keyboards
    const digitsOnly = raw.replace(/[^\d]/g, '');
    setIntervalError(null);
    applyTextChange('intervalInput', (prev) => {
      const parsed = parseInt(digitsOnly, 10);
      const nextDate =
        !prev.customNextDate && digitsOnly !== '' && parsed >= 1
          ? addInterval(prev.startDate, parsed, prev.intervalUnit)
          : prev.nextChargeDate;
      return {
        ...prev,
        intervalInput: digitsOnly,
        nextChargeDate: nextDate,
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIntervalError(null);

    const trimmedName = form.name.trim();
    const trimmedLocation = form.location.trim();
    const parsedInterval = parseInt(form.intervalInput, 10);

    if (!trimmedName) {
      setErrorMsg('請輸入物件名稱（例如：Switch 主機、露營頭燈）。');
      return;
    }
    if (!trimmedLocation) {
      setErrorMsg('請填寫放置位置，避免日後忘記收在哪裡。');
      return;
    }
    if (!form.intervalInput.trim() || Number.isNaN(parsedInterval) || parsedInterval < 1) {
      setIntervalError('請填寫大於 0 的充電週期數值，或點選快速週期按鈕');
      setErrorMsg('「多久需要充一次電」尚未填寫有效數字，請補充後再儲存。');
      return;
    }

    const nowIso = new Date().toISOString();
    const saved: BatteryItem = {
      id: initialItem?.id ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      location: trimmedLocation,
      category: form.category,
      tags: form.tags,
      startDate: form.startDate,
      intervalValue: parsedInterval,
      intervalUnit: form.intervalUnit,
      nextChargeDate: form.nextChargeDate,
      photos: form.photos,
      notes: form.notes.trim(),
      resetCount: initialItem?.resetCount ?? 0,
      createdAt: initialItem?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    onSave(saved);
  };

  const totalPhotoBytes = useMemo(
    () =>
      form.photos.reduce(
        (acc, p) => acc + estimateDataUrlBytes(p.dataUrl) + estimateDataUrlBytes(p.thumbDataUrl || ''),
        0
      ),
    [form.photos]
  );

  const zoomedPhoto = form.photos.find((p) => p.id === zoomedPhotoId) || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/55 backdrop-blur-xs"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full md:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-2 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Title + Inset Undo/Redo Toolbar (safe inside sheet, away from screen edges) */}
        <div className="px-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {initialItem ? '編輯物件資料' : '新增帶電池物件'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              支援多選照片與搜尋標籤，所有修改皆可復原重作
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="復原上一步"
              className="min-h-[42px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5" />
              復原
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="重作"
              className="min-h-[42px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            >
              <Redo2 className="h-3.5 w-3.5" />
              重作
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Multi-Photo Grid (No per-photo text notes, tap to view full image or delete) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                物件與放置位置照片（{form.photos.length} 張）
              </label>
              {form.photos.length > 0 && (
                <span className="text-xs text-slate-400 tabular-nums">
                  已最佳化 WebP · 約 {formatBytesCompact(totalPhotoBytes)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className="min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/30 px-3 py-2.5 text-sm font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-100/70 dark:hover:bg-teal-900/40 cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                拍照記錄
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className="min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ImagePlus className="h-4 w-4" />
                從相簿多選
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = '';
                handleFilesSelected(files);
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = '';
                handleFilesSelected(files);
              }}
            />

            {isProcessingPhoto && (
              <p className="text-xs text-teal-600 dark:text-teal-400">
                正在壓縮照片並產生低記憶體縮圖...
              </p>
            )}

            {form.photos.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  點選照片可放大全圖 · 按住照片拖曳可調整前後順序
                </p>
                <div
                  className={`grid grid-cols-3 sm:grid-cols-4 gap-2.5 ${
                    draggingIdx !== null ? 'touch-none select-none' : ''
                  }`}
                >
                  {form.photos.map((photo, index) => {
                    const isDragging = draggingIdx === index;
                    return (
                      <div
                        key={photo.id}
                        data-photo-idx={index}
                        onPointerDown={(e) => handlePhotoPointerDown(e, index, photo.id)}
                        style={{ WebkitTouchCallout: 'none' }}
                        className={`relative aspect-square rounded-xl overflow-hidden border bg-slate-100 dark:bg-slate-900 select-none transition-transform duration-150 cursor-pointer ${
                          isDragging
                            ? 'scale-105 border-teal-500 ring-2 ring-teal-500 shadow-lg z-10 opacity-95'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <img
                          src={photo.thumbDataUrl || photo.dataUrl}
                          alt={`照片 ${index + 1}`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          className="h-full w-full object-cover pointer-events-none select-none"
                        />

                        <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                          {index + 1}
                        </span>

                        <button
                          type="button"
                          data-delete-photo="true"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(photo.id);
                          }}
                          aria-label="刪除此照片"
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                物件名稱 *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  applyTextChange('name', (prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="例：小米行動電源 20000mAh、Switch、露營燈"
                className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                物件分類
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  applyDiscreteChange((prev) => ({
                    ...prev,
                    category: e.target.value as DeviceCategory,
                  }))
                }
                className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Storage Location */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              <MapPin className="h-4 w-4 text-teal-600" />
              放置位置描述 *
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) =>
                applyTextChange('location', (prev) => ({ ...prev, location: e.target.value }))
              }
              placeholder="例：客廳電視櫃左下方黑色收納籃內"
              className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
            />
          </div>

          {/* Searchable Item Tags */}
          <section className="space-y-2.5">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
              <Tag className="h-4 w-4 text-teal-600" />
              物件標籤（方便搜尋定位）
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(tagDraft);
                  }
                }}
                placeholder="輸入標籤（例：書房、Type-C、停電備用）"
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddTag(tagDraft)}
                className="min-h-[44px] inline-flex items-center gap-1 rounded-xl bg-slate-900 dark:bg-slate-100 px-4 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                加入標籤
              </button>
            </div>

            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {form.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 px-2.5 text-xs font-medium text-teal-800 dark:text-teal-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300 transition-colors cursor-pointer"
                  >
                    <span>#{tag}</span>
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">快速加入：</span>
              {QUICK_TAGS.filter((t) => !form.tags.includes(t)).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAddTag(preset)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:border-teal-500 cursor-pointer"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </section>

          {/* Battery Cycle Setup */}
          <section className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                充電循環設定（起始日 ↔ 下次充電日）
              </h3>
            </div>

            {/* Quick Cycle Presets */}
            <div className="flex flex-wrap gap-1.5">
              {CYCLE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setIntervalError(null);
                    applyDiscreteChange((prev) => ({
                      ...prev,
                      intervalInput: String(preset.value),
                      intervalUnit: preset.unit,
                      customNextDate: false,
                      nextChargeDate: addInterval(prev.startDate, preset.value, preset.unit),
                    }));
                  }}
                  className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-teal-500 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  充電起始日
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => {
                    const val = e.target.value || today;
                    const parsed = parseInt(form.intervalInput, 10);
                    applyDiscreteChange((prev) => ({
                      ...prev,
                      startDate: val,
                      nextChargeDate:
                        !prev.customNextDate && !Number.isNaN(parsed) && parsed >= 1
                          ? addInterval(val, parsed, prev.intervalUnit)
                          : prev.nextChargeDate,
                    }));
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  多久需要充一次電 *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.intervalInput}
                    placeholder="填數字"
                    onChange={(e) => handleIntervalTextChange(e.target.value)}
                    className={`w-24 min-h-[44px] rounded-xl border bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums text-center focus:outline-none ${
                      intervalError
                        ? 'border-red-500 ring-2 ring-red-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-teal-600'
                    }`}
                  />
                  <select
                    value={form.intervalUnit}
                    onChange={(e) => {
                      const unit = e.target.value as CycleUnit;
                      const parsed = parseInt(form.intervalInput, 10);
                      applyDiscreteChange((prev) => ({
                        ...prev,
                        intervalUnit: unit,
                        nextChargeDate:
                          !prev.customNextDate && !Number.isNaN(parsed) && parsed >= 1
                            ? addInterval(prev.startDate, parsed, unit)
                            : prev.nextChargeDate,
                      }));
                    }}
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="day">日（天）</option>
                    <option value="week">週</option>
                    <option value="month">月</option>
                    <option value="year">年</option>
                  </select>
                </div>
                {intervalError && (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {intervalError}
                  </p>
                )}
              </div>
            </div>

            {/* Direct Next Charge Date Picker (always unlocked for easy date selection) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  下次充電日（可直接選日期，或由上方週期自動推算）
                </label>
                {form.customNextDate && (
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = Math.max(1, parseInt(form.intervalInput || '1', 10));
                      applyDiscreteChange((prev) => ({
                        ...prev,
                        customNextDate: false,
                        nextChargeDate: addInterval(prev.startDate, parsed, prev.intervalUnit),
                      }));
                    }}
                    className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    改回自動推算
                  </button>
                )}
              </div>
              <input
                type="date"
                value={form.nextChargeDate}
                onChange={(e) => {
                  const picked = e.target.value;
                  if (!picked) return;
                  applyDiscreteChange((prev) => ({
                    ...prev,
                    customNextDate: true,
                    nextChargeDate: picked,
                  }));
                }}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:border-teal-600 focus:outline-none"
              />
            </div>
          </section>

          {/* Optional Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              電池保養備註（選填）
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) =>
                applyTextChange('notes', (prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="例：使用 5V/2A 慢充頭、收納電量保持 60%"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Sticky Bottom Action Bar (Thumb zone, away from iOS corners) */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] px-4 pt-3 pb-safe-ios flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-[2] min-h-[48px] rounded-xl bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 active:scale-[0.99] transition-all cursor-pointer"
          >
            {initialItem ? '儲存變更' : '儲存物件'}
          </button>
        </div>
      </form>

      {/* Fullscreen Photo Editor Viewer (View Full Image + Delete from editor) */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-black/95 p-4 pb-safe-ios"
          onClick={() => setZoomedPhotoId(null)}
        >
          <div className="h-4" />
          <img
            src={zoomedPhoto.dataUrl}
            alt="全圖檢視"
            referrerPolicy="no-referrer"
            className="max-h-[74vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div
            className="w-full max-w-sm flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleRemovePhoto(zoomedPhoto.id)}
              className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-2xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              刪除此照片
            </button>
            <button
              type="button"
              onClick={() => setZoomedPhotoId(null)}
              className="flex-[1.5] min-h-[48px] rounded-2xl bg-white/15 backdrop-blur-md text-white text-sm font-semibold border border-white/25 cursor-pointer"
            >
              關閉全圖
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
