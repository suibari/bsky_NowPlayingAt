const BLOB_SIZE_LIMIT = 1_900_000;

export async function processImage(
  blob: Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const { width: origW, height: origH } = bitmap;

  if (blob.size <= BLOB_SIZE_LIMIT) {
    return { blob, width: origW, height: origH };
  }

  const scale = Math.sqrt(BLOB_SIZE_LIMIT / blob.size) * 0.85;
  const w = Math.max(1, Math.floor(origW * scale));
  const h = Math.max(1, Math.floor(origH * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  let result = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  if (result.size > BLOB_SIZE_LIMIT) {
    result = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
  }
  console.info(`[image] compressed ${blob.size} → ${result.size} bytes (${w}x${h})`);
  return { blob: result, width: w, height: h };
}
