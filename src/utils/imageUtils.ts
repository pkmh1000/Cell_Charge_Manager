export interface CompressedPhotoPair {
  dataUrl: string;
  thumbDataUrl: string;
}

let cachedWebpSupport: boolean | null = null;

function supportsWebPEncode(): boolean {
  if (cachedWebpSupport !== null) return cachedWebpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 2;
    cachedWebpSupport = c.toDataURL('image/webp', 0.8).startsWith('data:image/webp');
  } catch {
    cachedWebpSupport = false;
  }
  return cachedWebpSupport;
}

function renderScaledDataUrl(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number
): string {
  const { width, height } = img;
  let targetW = width;
  let targetH = height;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      targetW = maxDimension;
      targetH = Math.round((height * maxDimension) / width);
    } else {
      targetH = maxDimension;
      targetW = Math.round((width * maxDimension) / height);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, targetW);
  canvas.height = Math.max(1, targetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const mime = supportsWebPEncode() ? 'image/webp' : 'image/jpeg';
  return canvas.toDataURL(mime, quality);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('無法讀取圖片檔案'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export async function compressImageToPair(
  source: File | string,
  fullMaxDim = 1080,
  fullQuality = 0.76,
  thumbMaxDim = 280,
  thumbQuality = 0.68
): Promise<CompressedPhotoPair> {
  const isFile = typeof source !== 'string';
  const objectUrl = isFile ? URL.createObjectURL(source) : null;
  const imgSrc = objectUrl || (source as string);

  try {
    return await new Promise<CompressedPhotoPair>((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const full =
            renderScaledDataUrl(img, fullMaxDim, fullQuality) ||
            (isFile ? await readFileAsDataUrl(source as File) : (source as string));
          const thumb = renderScaledDataUrl(img, thumbMaxDim, thumbQuality) || full;
          resolve({ dataUrl: full, thumbDataUrl: thumb });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = async () => {
        // Fallback to FileReader if objectURL failed to decode
        if (isFile) {
          try {
            const fallbackDataUrl = await readFileAsDataUrl(source as File);
            const fallbackImg = new Image();
            fallbackImg.onload = () => {
              const full = renderScaledDataUrl(fallbackImg, fullMaxDim, fullQuality) || fallbackDataUrl;
              const thumb = renderScaledDataUrl(fallbackImg, thumbMaxDim, thumbQuality) || full;
              resolve({ dataUrl: full, thumbDataUrl: thumb });
            };
            fallbackImg.onerror = () => reject(new Error('圖片格式無法解析'));
            fallbackImg.src = fallbackDataUrl;
          } catch {
            reject(new Error('圖片格式無法解析'));
          }
        } else {
          reject(new Error('圖片格式無法解析'));
        }
      };
      img.src = imgSrc;
    });
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const base64Len = dataUrl.length - commaIdx - 1;
  return Math.round((base64Len * 3) / 4);
}

export function formatBytesCompact(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
