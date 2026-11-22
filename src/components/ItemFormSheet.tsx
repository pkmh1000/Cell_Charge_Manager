import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, MapPin, Trash2 } from 'lucide-react';
import { BatteryItem, CycleUnit, DeviceCategory, PhotoEvidence } from '../types/battery';
import { addInterval, getTodayStr } from '../utils/dateCycle';
import { compressImageFile } from '../utils/imageUtils';

interface ItemFormSheetProps {
  initialItem?: BatteryItem | null;
  onSave: (item: BatteryItem) => void;
  onCancel: () => void;
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

const CAPTION_PRESETS = ['物件外觀', '近處擺放位置', '房間/櫃位遠景'];

export const ItemFormSheet: React.FC<ItemFormSheetProps> = ({
  initialItem,
  onSave,
  onCancel,
}) => {
  const today = getTodayStr();
  const [name, setName] = useState(initialItem?.name ?? '');
  const [location, setLocation] = useState(initialItem?.location ?? '');
  const [category, setCategory] = useState<DeviceCategory>(initialItem?.category ?? '3C 電子');
  const [startDate, setStartDate] = useState(initialItem?.startDate ?? today);
  const [intervalValue, setIntervalValue] = useState(initialItem?.intervalValue ?? 1);
  const [intervalUnit, setIntervalUnit] = useState<CycleUnit>(initialItem?.intervalUnit ?? 'month');
  const [nextChargeDate, setNextChargeDate] = useState(
    initialItem?.nextChargeDate ?? addInterval(today, 1, 'month')
  );
  const [customNextDate, setCustomNextDate] = useState(false);
  const [photos, setPhotos] = useState<PhotoEvidence[]>(initialItem?.photos ?? []);
  const [notes, setNotes] = useState(initialItem?.notes ?? '');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const updateCyclePreview = (newStart: string, newVal: number, newUnit: CycleUnit) => {
    if (!customNextDate) {
      setNextChargeDate(addInterval(newStart, newVal, newUnit));
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessingPhoto(true);
    setErrorMsg(null);
    try {
      const added: PhotoEvidence[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImageFile(file);
        const defaultCaption =
          photos.length + added.length === 0
            ? '物件外觀'
            : `存放位置循跡 #${photos.length + added.length + 1}`;
        added.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dataUrl: compressed,
          caption: defaultCaption,
          createdAt: new Date().toISOString(),
        });
      }
      setPhotos((prev) => [...prev, ...added]);
    } catch {
      setErrorMsg('部分照片讀取失敗，請確認格式為 JPG/PNG/WebP。');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handlePhotoCaptionChange = (id: string, caption: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedLocation = location.trim();

    if (!trimmedName) {
      setErrorMsg('請輸入物件名稱（例如：Switch 主機、露營頭燈）。');
      return;
    }
    if (!trimmedLocation) {
      setErrorMsg('請填寫放置位置，避免日後忘記收在哪裡。');
      return;
    }

    const nowIso = new Date().toISOString();
    const safeVal = Math.max(1, Math.floor(intervalValue || 1));

    const saved: BatteryItem = {
      id: initialItem?.id ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      location: trimmedLocation,
      category,
      startDate,
      intervalValue: safeVal,
      intervalUnit,
      nextChargeDate,
      photos,
      notes: notes.trim(),
      resetCount: initialItem?.resetCount ?? 0,
      createdAt: initialItem?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };

    onSave(saved);
  };

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

        <div className="px-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {initialItem ? '編輯電器與位置記錄' : '新增帶電池物件'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            可拍攝物件本體與周邊環境多張照片，日後一鍵循跡找回
          </p>
        </div>

        {/* Scrollable Form Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Photo Capture & Album Section */}
          <section className="space-y-3">
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
              物件與放置位置照片（支援多張循跡）
            </label>

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
                從相簿選取
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />

            {isProcessingPhoto && (
              <p className="text-xs text-teal-600 dark:text-teal-400">正在最佳化壓縮照片中...</p>
            )}

            {photos.length > 0 && (
              <div className="space-y-2.5">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-2.5"
                  >
                    <img
                      src={photo.dataUrl}
                      alt={photo.caption || `照片 ${index + 1}`}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={(e) => handlePhotoCaptionChange(photo.id, e.target.value)}
                        placeholder="輸入照片說明（例如：書房左側抽屜）"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {CAPTION_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handlePhotoCaptionChange(photo.id, preset)}
                            className="text-[11px] px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-500 cursor-pointer"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      aria-label="移除照片"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：小米行動電源 20000mAh、Switch、露營燈"
                className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                物件分類
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DeviceCategory)}
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
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例：客廳電視櫃左下方黑色收納籃內"
              className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
            />
          </div>

          {/* Battery Cycle Setup: Start Date + Interval (Day/Week/Month/Year) -> Next Charge Date */}
          <section className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              充電循環設定（起始日 ↔ 下次充電日）
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  充電起始日
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const val = e.target.value || today;
                    setStartDate(val);
                    updateCyclePreview(val, intervalValue, intervalUnit);
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  多久需要充一次電
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={intervalValue}
                    onChange={(e) => {
                      const num = Math.max(1, parseInt(e.target.value || '1', 10));
                      setIntervalValue(num);
                      updateCyclePreview(startDate, num, intervalUnit);
                    }}
                    className="w-20 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums text-center"
                  />
                  <select
                    value={intervalUnit}
                    onChange={(e) => {
                      const unit = e.target.value as CycleUnit;
                      setIntervalUnit(unit);
                      updateCyclePreview(startDate, intervalValue, unit);
                    }}
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="day">日（天）</option>
                    <option value="week">週</option>
                    <option value="month">月</option>
                    <option value="year">年</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  下次充電日
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const nextCustom = !customNextDate;
                    setCustomNextDate(nextCustom);
                    if (!nextCustom) {
                      setNextChargeDate(addInterval(startDate, intervalValue, intervalUnit));
                    }
                  }}
                  className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  {customNextDate ? '恢復依週期自動計算' : '手動微調下次充電日'}
                </button>
              </div>
              <input
                type="date"
                value={nextChargeDate}
                disabled={!customNextDate}
                onChange={(e) => {
                  if (e.target.value) setNextChargeDate(e.target.value);
                }}
                className={`w-full min-h-[44px] rounded-xl border px-3 text-sm tabular-nums ${
                  customNextDate
                    ? 'border-teal-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                }`}
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
    </div>
  );
};
