import type { Track } from "./music";

export async function generatePlaylistThumbnail(tracks: Track[]): Promise<Blob | null> {
  if (tracks.length === 0) return null;

  const WIDTH = 1200;
  const HEIGHT = 630;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Fill background with dark color
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Helper: Draw image covering a rectangle (maintaining aspect ratio)
  const drawImageCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const sWidth = img.width;
    const sHeight = img.height;

    const targetAspect = w / h;
    const sourceAspect = sWidth / sHeight;

    let sx, sy, sw, sh;

    if (sourceAspect > targetAspect) {
      // Source is wider: Crop width center
      sh = sHeight;
      sw = sHeight * targetAspect;
      sy = 0;
      sx = (sWidth - sw) / 2;
    } else {
      // Source is taller: Crop height center
      sw = sWidth;
      sh = sWidth / targetAspect;
      sx = 0;
      sy = (sHeight - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  };

  // Determine layout and images to load
  let imagesToLoadCount = 0;
  if (tracks.length === 1) imagesToLoadCount = 1;
  else if (tracks.length === 2) imagesToLoadCount = 2;
  else imagesToLoadCount = Math.min(tracks.length, 8); // Max 8 for 4x2 grid

  // Load images
  const coverTracks = tracks.slice(0, imagesToLoadCount);
  const loadImage = (url: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }

      const load = (src: string, isRetry = false) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
          if (!isRetry) {
            // Retry with proxy
            load(`/api/proxy-image?url=${encodeURIComponent(url)}`, true);
          } else {
            resolve(null);
          }
        };
        img.src = src;
      };

      // Request higher resolution for initial attempt
      const finalUrl = url.replace("100x100bb", "600x600bb");
      load(finalUrl);
    });
  };

  const loadedImages = await Promise.all(coverTracks.map(t => loadImage(t.artworkUrl)));
  const validImages = loadedImages.filter((img): img is HTMLImageElement => !!img);

  if (validImages.length === 0) return null;

  // Layout Logic
  if (tracks.length === 1) {
    // 1 Image: 1200x630 Full Cover (Center Crop)
    drawImageCover(validImages[0], 0, 0, WIDTH, HEIGHT);
  } else if (tracks.length === 2) {
    // 2 Images: Split Left/Right (600x630 each)
    const w = WIDTH / 2;
    drawImageCover(validImages[0], 0, 0, w, HEIGHT);

    // If second is missing, repeat first
    const img2 = validImages[1] || validImages[0];
    drawImageCover(img2, w, 0, w, HEIGHT);
  } else {
    // 3+ Images: 4x2 Grid (8 slots, 300x315 each)
    const rows = 2;
    const cols = 4;
    const cellW = WIDTH / cols; // 300
    const cellH = HEIGHT / rows; // 315

    for (let i = 0; i < 8; i++) {
      const img = validImages[i % validImages.length]; // Cycle through available
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW;
      const y = row * cellH;
      drawImageCover(img, x, y, cellW, cellH);
    }
  }

  // Convert to Blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/jpeg", 0.9);
  });
}
