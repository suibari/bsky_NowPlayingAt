<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { ImagePlus, Loader2, User, X } from "lucide-svelte";
  import { t } from "$lib/i18n";
  import { ProfileUpdateError, updateNowplayingAvatar } from "$lib/profile";
  import type { ProfileRecord } from "$lib/schema";

  // Avatar currently shown on the profile (NowPlayingAt's own, or the Bluesky
  // fallback) — displayed until the user picks a new image.
  export let currentAvatarUrl: string | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    saved: { record: ProfileRecord; previewUrl: string };
  }>();

  // Crop viewport in CSS px. The canvas is a WYSIWYG preview of the square that
  // gets uploaded, so the same transform is replayed at output resolution.
  const VIEW = 288;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  const MIN_OUTPUT = 200;
  const MAX_OUTPUT = 1000;
  const MAX_FILE_SIZE = 20_000_000;

  let canvas: HTMLCanvasElement | null = null;
  let img: HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  // Transform: the image is drawn centered, scaled by baseScale (cover) * zoom,
  // then shifted by offsetX/offsetY (viewport px).
  let baseScale = 1;
  let zoom = MIN_ZOOM;
  let offsetX = 0;
  let offsetY = 0;

  let saving = false;
  let errorKey = "";

  const pointers = new Map<number, { x: number; y: number }>();
  let dragStart: { x: number; y: number; offsetX: number; offsetY: number } | null = null;
  let pinchStart: { dist: number; zoom: number } | null = null;

  function clampZoom(value: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  }

  // Keep the image covering the whole viewport so the crop never shows gaps.
  function clampOffsets() {
    if (!img) return;
    const maxX = Math.max(0, (img.naturalWidth * baseScale * zoom - VIEW) / 2);
    const maxY = Math.max(0, (img.naturalHeight * baseScale * zoom - VIEW) / 2);
    offsetX = Math.min(maxX, Math.max(-maxX, offsetX));
    offsetY = Math.min(maxY, Math.max(-maxY, offsetY));
  }

  function draw() {
    if (!canvas || !img) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(VIEW * dpr)) {
      canvas.width = Math.round(VIEW * dpr);
      canvas.height = Math.round(VIEW * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, VIEW, VIEW);
    const w = img.naturalWidth * baseScale * zoom;
    const h = img.naturalHeight * baseScale * zoom;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, VIEW / 2 + offsetX - w / 2, VIEW / 2 + offsetY - h / 2, w, h);
  }

  // Redraw whenever the canvas, image or transform changes.
  function redraw(..._deps: unknown[]) {
    draw();
  }
  $: redraw(canvas, img, zoom, offsetX, offsetY);

  async function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // allow picking the same file again after a cancel
    if (!file) return;

    errorKey = "";
    if (file.size > MAX_FILE_SIZE) {
      errorKey = "profile.edit.error.toolarge";
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("decode failed"));
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("empty image");
    } catch {
      URL.revokeObjectURL(url);
      errorKey = "profile.edit.error.decode";
      return;
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = url;
    img = image;
    baseScale = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
    zoom = MIN_ZOOM;
    offsetX = 0;
    offsetY = 0;
  }

  // The canvas is CSS-scaled on narrow screens, so screen px must be converted
  // to the VIEW coordinate space the transform is expressed in.
  function viewRatio() {
    const shown = canvas?.clientWidth;
    return shown ? VIEW / shown : 1;
  }

  function pointerDistance() {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e: PointerEvent) {
    if (!img) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragStart = { x: e.clientX, y: e.clientY, offsetX, offsetY };
      pinchStart = null;
    } else if (pointers.size === 2) {
      dragStart = null;
      pinchStart = { dist: pointerDistance(), zoom };
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!img || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchStart && pointers.size >= 2) {
      const dist = pointerDistance();
      if (pinchStart.dist > 0) zoom = clampZoom(pinchStart.zoom * (dist / pinchStart.dist));
      clampOffsets();
    } else if (dragStart) {
      const ratio = viewRatio();
      offsetX = dragStart.offsetX + (e.clientX - dragStart.x) * ratio;
      offsetY = dragStart.offsetY + (e.clientY - dragStart.y) * ratio;
      clampOffsets();
    }
  }

  function onPointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) {
      dragStart = null;
    } else {
      // Carry on panning with whichever pointer is still down.
      const [p] = pointers.values();
      dragStart = { x: p.x, y: p.y, offsetX, offsetY };
    }
  }

  function onWheel(e: WheelEvent) {
    if (!img) return;
    e.preventDefault();
    zoom = clampZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    clampOffsets();
  }

  // Render the cropped square at its natural resolution (capped, never upscaled).
  function renderOutput(source: HTMLImageElement): Promise<Blob | null> {
    const cropSideInSource = Math.min(source.naturalWidth, source.naturalHeight) / zoom;
    const out = Math.max(MIN_OUTPUT, Math.min(MAX_OUTPUT, Math.round(cropSideInSource)));
    const target = document.createElement("canvas");
    target.width = out;
    target.height = out;
    const ctx = target.getContext("2d");
    if (!ctx) return Promise.resolve(null);

    const k = out / VIEW;
    const w = source.naturalWidth * baseScale * zoom * k;
    const h = source.naturalHeight * baseScale * zoom * k;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, out, out);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, out / 2 + offsetX * k - w / 2, out / 2 + offsetY * k - h / 2, w, h);
    return new Promise((resolve) => target.toBlob((b) => resolve(b), "image/jpeg", 0.9));
  }

  async function handleSave() {
    if (!img || saving) return;
    saving = true;
    errorKey = "";
    try {
      const blob = await renderOutput(img);
      if (!blob) throw new Error("render failed");
      const record = await updateNowplayingAvatar(blob);
      dispatch("saved", { record, previewUrl: URL.createObjectURL(blob) });
    } catch (e) {
      console.error("Failed to update profile", e);
      errorKey =
        e instanceof ProfileUpdateError && e.code === "SCOPE_REQUIRED"
          ? "profile.edit.error.reauth"
          : "profile.edit.error.save";
    } finally {
      saving = false;
    }
  }

  function requestClose() {
    if (saving) return;
    dispatch("close");
  }

  onDestroy(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
</script>

<div
  class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  on:click|self={requestClose}
  role="button"
  tabindex="0"
  on:keydown={(e) => e.key === "Escape" && requestClose()}
>
  <div
    class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
  >
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-white">{$t("profile.edit.title")}</h2>
      <button
        on:click={requestClose}
        disabled={saving}
        class="text-gray-400 hover:text-white disabled:opacity-50"
        aria-label={$t("profile.edit.cancel")}
      >
        <X size={24} />
      </button>
    </div>

    <p class="text-xs text-gray-500 mb-4">{$t("profile.edit.note")}</p>

    <p class="text-sm font-bold text-gray-300 mb-2">{$t("profile.edit.avatar")}</p>

    {#if img}
      <div class="flex flex-col items-center">
        <div
          class="relative w-full aspect-square overflow-hidden rounded-lg bg-black touch-none select-none cursor-grab active:cursor-grabbing"
          style:max-width={`${VIEW}px`}
          on:pointerdown={onPointerDown}
          on:pointermove={onPointerMove}
          on:pointerup={onPointerUp}
          on:pointercancel={onPointerUp}
          on:wheel={onWheel}
          role="presentation"
        >
          <canvas bind:this={canvas} class="block w-full h-full"></canvas>
          <!-- Circle guide: darkens everything outside the avatar shape. -->
          <div
            class="pointer-events-none absolute inset-0 rounded-full border-2 border-white/70"
            style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);"
          ></div>
        </div>

        <p class="text-[11px] text-gray-500 mt-2 text-center">{$t("profile.edit.hint")}</p>

        <label class="w-full mt-3 flex items-center gap-3">
          <span class="text-xs text-gray-400 shrink-0">{$t("profile.edit.zoom")}</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step="0.01"
            bind:value={zoom}
            on:input={clampOffsets}
            class="flex-1 accent-green-500"
          />
        </label>
      </div>
    {:else}
      <div class="flex items-center gap-4">
        {#if currentAvatarUrl}
          <img
            src={currentAvatarUrl}
            alt=""
            class="w-20 h-20 rounded-full border-2 border-gray-700 object-cover"
          />
        {:else}
          <div
            class="w-20 h-20 rounded-full border-2 border-gray-700 bg-gray-800 flex items-center justify-center text-gray-500"
          >
            <User size={28} />
          </div>
        {/if}
        <p class="text-sm text-gray-400">{$t("profile.edit.pick.hint")}</p>
      </div>
    {/if}

    <label
      class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 text-gray-200 text-sm font-bold hover:bg-gray-700 transition-colors cursor-pointer"
    >
      <ImagePlus size={16} />
      {img ? $t("profile.edit.change") : $t("profile.edit.pick")}
      <input type="file" accept="image/*" class="hidden" on:change={onFileChange} />
    </label>

    {#if errorKey}
      <p class="text-sm text-red-400 mt-3">{$t(errorKey)}</p>
    {/if}

    <div class="flex justify-end gap-3 mt-6">
      <button
        on:click={requestClose}
        disabled={saving}
        class="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {$t("profile.edit.cancel")}
      </button>
      <button
        on:click={handleSave}
        disabled={!img || saving}
        class="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
      >
        {#if saving}
          <Loader2 class="w-4 h-4 animate-spin" />
          {$t("profile.edit.saving")}
        {:else}
          {$t("profile.edit.save")}
        {/if}
      </button>
    </div>
  </div>
</div>
