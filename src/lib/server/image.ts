import { PhotonImage, resize, crop, SamplingFilter } from '@cf-wasm/photon';

const BLOB_SIZE_LIMIT = 1_900_000;

export async function processImage(
  blob: Blob,
  cropSquare: boolean = false
): Promise<{ blob: Blob; width: number | undefined; height: number | undefined }> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let img = PhotonImage.new_from_byteslice(buf);
  let origW = img.get_width();
  let origH = img.get_height();

  let modified = false;

  if (cropSquare && origW !== origH) {
    const size = Math.min(origW, origH);
    const x1 = Math.floor((origW - size) / 2);
    const y1 = Math.floor((origH - size) / 2);
    const x2 = x1 + size;
    const y2 = y1 + size;
    
    const cropped = crop(img, x1, y1, x2, y2);
    img.free();
    img = cropped;
    origW = size;
    origH = size;
    modified = true;
  }

  if (!modified && blob.size <= BLOB_SIZE_LIMIT) {
    img.free();
    return { blob, width: origW, height: origH };
  }

  let targetImg = img;
  let w = origW;
  let h = origH;

  if (blob.size > BLOB_SIZE_LIMIT) {
    const scale = Math.sqrt(BLOB_SIZE_LIMIT / blob.size) * 0.85;
    w = Math.max(1, Math.floor(origW * scale));
    h = Math.max(1, Math.floor(origH * scale));

    const resized = resize(img, w, h, SamplingFilter.Lanczos3);
    img.free();
    targetImg = resized;
  }

  let outBytes = targetImg.get_bytes_jpeg(85);
  if (outBytes.byteLength > BLOB_SIZE_LIMIT) {
    outBytes = targetImg.get_bytes_jpeg(70);
  }
  targetImg.free();

  const result = new Blob([outBytes.slice()], { type: 'image/jpeg' });
  console.info(`[image] processed image to ${result.size} bytes (${w}x${h})`);
  return { blob: result, width: w, height: h };
}
