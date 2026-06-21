import { PhotonImage, resize, SamplingFilter } from '@cf-wasm/photon';

const BLOB_SIZE_LIMIT = 1_900_000;

export async function processImage(
  blob: Blob,
): Promise<{ blob: Blob; width: number | undefined; height: number | undefined }> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const img = PhotonImage.new_from_byteslice(buf);
  const origW = img.get_width();
  const origH = img.get_height();

  if (blob.size <= BLOB_SIZE_LIMIT) {
    img.free();
    return { blob, width: origW, height: origH };
  }

  const scale = Math.sqrt(BLOB_SIZE_LIMIT / blob.size) * 0.85;
  const w = Math.max(1, Math.floor(origW * scale));
  const h = Math.max(1, Math.floor(origH * scale));

  const resized = resize(img, w, h, SamplingFilter.Lanczos3);
  img.free();

  let outBytes = resized.get_bytes_jpeg(85);
  if (outBytes.byteLength > BLOB_SIZE_LIMIT) {
    outBytes = resized.get_bytes_jpeg(70);
  }
  resized.free();

  const result = new Blob([outBytes.slice()], { type: 'image/jpeg' });
  console.info(`[image] compressed ${blob.size} → ${result.size} bytes (${w}x${h})`);
  return { blob: result, width: w, height: h };
}
