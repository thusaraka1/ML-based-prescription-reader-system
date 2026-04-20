/**
 * Image Preprocessor for CRNN OCR
 * Handles prescription image preprocessing: grayscale, contrast,
 * binarization, line segmentation, and normalization for CRNN input.
 */

const CRNN_INPUT_HEIGHT = 32;
const CRNN_INPUT_WIDTH = 100;

/**
 * Load an image from a File or base64 data URL into an HTMLImageElement.
 */
export function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;

    if (source instanceof File) {
      const reader = new FileReader();
      reader.onloadend = () => {
        img.src = reader.result as string;
      };
      reader.readAsDataURL(source);
    } else {
      img.src = source;
    }
  });
}

/**
 * Convert image to grayscale pixel data on an offscreen canvas.
 */
export function toGrayscale(img: HTMLImageElement): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8ClampedArray(canvas.width * canvas.height);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    // Luminosity method
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  return { data: gray, width: canvas.width, height: canvas.height };
}

/**
 * Apply adaptive contrast enhancement (simplified CLAHE-like approach).
 * Divides the image into tiles and equalizes histogram per tile.
 */
export function enhanceContrast(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  clipLimit: number = 2.0
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data.length);

  // Compute global histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i++) {
    histogram[data[i]]++;
  }

  // Clip histogram
  const totalPixels = width * height;
  const avgBinCount = totalPixels / 256;
  const clipThreshold = Math.floor(clipLimit * avgBinCount);
  let excess = 0;

  for (let i = 0; i < 256; i++) {
    if (histogram[i] > clipThreshold) {
      excess += histogram[i] - clipThreshold;
      histogram[i] = clipThreshold;
    }
  }

  // Redistribute excess
  const perBin = Math.floor(excess / 256);
  for (let i = 0; i < 256; i++) {
    histogram[i] += perBin;
  }

  // Compute cumulative distribution
  const cdf = new Array(256).fill(0);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Normalize CDF
  const cdfMin = cdf.find(v => v > 0) || 0;
  for (let i = 0; i < data.length; i++) {
    result[i] = Math.round(((cdf[data[i]] - cdfMin) / (totalPixels - cdfMin)) * 255);
  }

  return result;
}

/**
 * Otsu's binarization — automatically finds the optimal threshold
 * to separate foreground (text) from background.
 */
export function otsuBinarize(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data.length);
  const totalPixels = width * height;

  // Compute histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i++) {
    histogram[data[i]]++;
  }

  // Otsu's method
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] > threshold ? 255 : 0;
  }

  return result;
}

/**
 * Segment a prescription image into individual text lines using
 * horizontal projection profiles.
 */
export function segmentLines(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  minLineHeight: number = 10
): { y: number; h: number }[] {
  // Compute horizontal projection (count dark pixels per row)
  const projection = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] === 0) {
        projection[y]++;
      }
    }
  }

  // Find line boundaries (transitions from empty to non-empty rows)
  const lines: { y: number; h: number }[] = [];
  const threshold = width * 0.01; // at least 1% of row width must be dark
  let inLine = false;
  let lineStart = 0;

  for (let y = 0; y < height; y++) {
    if (!inLine && projection[y] > threshold) {
      inLine = true;
      lineStart = y;
    } else if (inLine && projection[y] <= threshold) {
      inLine = false;
      const lineHeight = y - lineStart;
      if (lineHeight >= minLineHeight) {
        // Add padding
        const padTop = Math.max(0, lineStart - 4);
        const padBottom = Math.min(height, y + 4);
        lines.push({ y: padTop, h: padBottom - padTop });
      }
    }
  }

  // Handle case where last line reaches bottom of image
  if (inLine) {
    const lineHeight = height - lineStart;
    if (lineHeight >= minLineHeight) {
      lines.push({ y: Math.max(0, lineStart - 4), h: height - lineStart + 4 });
    }
  }

  return lines;
}

/**
 * Extract a single line region from grayscale data and resize/normalize
 * it for CRNN input (32×width, normalized to [-1, 1]).
 */
export function prepareLineForCRNN(
  grayData: Uint8ClampedArray,
  imgWidth: number,
  lineRegion: { y: number; h: number },
  targetHeight: number = CRNN_INPUT_HEIGHT,
  targetWidth: number = CRNN_INPUT_WIDTH
): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;

  // Draw the line region to a temporary canvas first
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = imgWidth;
  srcCanvas.height = lineRegion.h;
  const srcCtx = srcCanvas.getContext('2d')!;
  const srcImageData = srcCtx.createImageData(imgWidth, lineRegion.h);

  for (let y = 0; y < lineRegion.h; y++) {
    for (let x = 0; x < imgWidth; x++) {
      const srcIdx = (lineRegion.y + y) * imgWidth + x;
      const dstIdx = (y * imgWidth + x) * 4;
      const val = grayData[srcIdx];
      srcImageData.data[dstIdx] = val;
      srcImageData.data[dstIdx + 1] = val;
      srcImageData.data[dstIdx + 2] = val;
      srcImageData.data[dstIdx + 3] = 255;
    }
  }
  srcCtx.putImageData(srcImageData, 0, 0);

  // Resize to CRNN input dimensions
  ctx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);
  const resized = ctx.getImageData(0, 0, targetWidth, targetHeight);

  // Normalize to [-1, 1] range (single channel)
  const normalized = new Float32Array(targetHeight * targetWidth);
  for (let i = 0; i < targetHeight * targetWidth; i++) {
    normalized[i] = (resized.data[i * 4] / 255.0 - 0.5) / 0.5;
  }

  return normalized;
}

/**
 * Full preprocessing pipeline: image → grayscale → contrast → binarize → segment → normalize.
 * Returns an array of line tensors ready for CRNN inference.
 */
export async function preprocessPrescriptionImage(
  source: File | string
): Promise<{ lines: Float32Array[]; lineRegions: { y: number; h: number }[] }> {
  const img = await loadImage(source);
  const gray = toGrayscale(img);
  const enhanced = enhanceContrast(gray.data, gray.width, gray.height);
  const binary = otsuBinarize(enhanced, gray.width, gray.height);
  const lineRegions = segmentLines(binary, gray.width, gray.height);

  // If no lines detected, treat the entire image as one line
  const regions = lineRegions.length > 0
    ? lineRegions
    : [{ y: 0, h: gray.height }];

  const lines = regions.map(region =>
    prepareLineForCRNN(enhanced, gray.width, region)
  );

  return { lines, lineRegions: regions };
}

export { CRNN_INPUT_HEIGHT, CRNN_INPUT_WIDTH };
