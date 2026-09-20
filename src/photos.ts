/**
 * Photos are stored inline as compressed JPEG data URLs rather than in Cloud
 * Storage, which is what keeps the app on Firebase's free Spark plan. That
 * only works if every photo comfortably fits a Firestore document, so this is
 * where the size budget is enforced — nothing else in the app checks it.
 */

/** Longest edge of the stored image. Plenty to show what a repair looked like. */
const MAX_EDGE = 1024;

/**
 * A Firestore document is capped at 1,048,576 bytes. A data URL is ASCII, so
 * its length is its byte count, and 700k leaves generous room for the rest of
 * the document. Base64 inflates by a third, so this is ~525KB of actual JPEG.
 */
const MAX_DATA_URL = 700_000;

/** Tried in order until one fits the budget. */
const QUALITIES = [0.72, 0.6, 0.48];

type Source = ImageBitmap | HTMLImageElement;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't an image this phone can read."));
    };
    img.src = url;
  });
}

async function decode(file: File): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      // A photo taken sideways carries its rotation in EXIF; without this the
      // stored copy comes out on its side.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older Safari rejects the options argument. The <img> path below
      // applies EXIF orientation by itself, so fall back to it.
    }
  }
  return loadImageElement(file);
}

/** Scale to fit within `edge` on the longest side, never scaling up. */
function fit(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Shrink a camera photo to a data URL that fits in a Firestore document.
 * Rejects with a message worth showing if the image can't be read or can't be
 * squeezed small enough.
 */
export async function compressPhoto(file: File): Promise<string> {
  const source = await decode(file);
  try {
    let edge = MAX_EDGE;
    // Each pass drops the resolution; within a pass, quality steps down first
    // because it costs less visible detail than shrinking does.
    for (let pass = 0; pass < 4; pass += 1) {
      const { width, height } = fit(source.width, source.height, edge);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("This phone's browser can't process images.");
      ctx.drawImage(source, 0, 0, width, height);
      for (const quality of QUALITIES) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= MAX_DATA_URL) return dataUrl;
      }
      edge = Math.round(edge * 0.75);
    }
    throw new Error('That photo is too detailed to store. Try taking it again.');
  } finally {
    if ('close' in source) source.close();
  }
}
