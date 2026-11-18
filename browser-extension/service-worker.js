const DEFAULT_SCANNER_URL = "https://api.modesty.nsfw/scan";
const DEFAULT_SETTINGS = { scannerUrl: DEFAULT_SCANNER_URL };
const IMAGE_LIMIT_BYTES = 25 * 1024 * 1024;
const VIDEO_LIMIT_BYTES = 64 * 1024 * 1024;
const VIDEO_MAX_DURATION_SECONDS = 600;
const VIDEO_MAX_FRAMES = 600;

function scannerEndpoint(value, kind) {
  let endpoint;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("Set a valid HTTPS scanner service URL in Modesty settings.");
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash ||       endpoint.search || endpoint.hash || !endpoint.pathname.endsWith("/scan")) {
    throw new Error("The scanner service URL must be an HTTPS URL ending in /scan.");
  }
  endpoint.searchParams.set("details", "0");
  if (kind === "video") {
    endpoint.searchParams.set("max_duration_sec", String(VIDEO_MAX_DURATION_SECONDS));
    endpoint.searchParams.set("max_frames", String(VIDEO_MAX_FRAMES));
    endpoint.searchParams.set("fps", "1");
  }
  return endpoint.href;
}

function filenameFromUrl(value, kind) {
  try {
    const url = new URL(value);
    const name = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (name && /\.[a-z0-9]{2,5}$/i.test(name)) {
      return name.slice(0, 180);
    }
  } catch {
    // Use a generic extension for URLs without a usable path.
  }
  return kind === "video" ? "page-video.mp4" : "page-image.jpg";
}

async function downloadMedia(url, kind) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("The media URL is invalid.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:" &&
      !(kind === "image" && parsed.protocol === "data:")) {
    throw new Error("Only HTTP(S) media and inline image URLs can be scanned.");
  }
  if (kind === "video" && /\.(m3u8|mpd)(?:$)/i.test(parsed.pathname)) {
    throw new Error("Streaming playlists are not supported yet; use a direct video file.");
  }

  const response = await fetch(parsed.href, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Could not read the media from this page (HTTP ${response.status}).`);
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (kind === "video" && contentType.includes("mpegurl")) {
    throw new Error("Streaming playlists are not supported yet; use a direct video file.");
  }

  const limit = kind === "video" ? VIDEO_LIMIT_BYTES : IMAGE_LIMIT_BYTES;
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > limit) {
    throw new Error(`This ${kind} exceeds the ${Math.round(limit / 1024 / 1024)} MB scan limit.`);
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("The browser could not read this media response.");
  }
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error(`This ${kind} exceeds the ${Math.round(limit / 1024 / 1024)} MB scan limit.`);
    }
    chunks.push(value);
  }
  if (size === 0) {
    throw new Error("The page returned an empty media file.");
  }
  return new Blob(chunks, { type: contentType || "application/octet-stream" });
}

async function scanMedia(url, kind) {
  const blob = await downloadMedia(url, kind);
  const form = new FormData();
  form.append("file", blob, filenameFromUrl(url, kind));

  const { scannerUrl = DEFAULT_SETTINGS.scannerUrl } =
    await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const endpoint = scannerEndpoint(scannerUrl, kind);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(kind === "video" ? 8 * 60 * 1000 : 2 * 60 * 1000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("The Modesty scan service timed out; try a smaller image or shorter video.");
    }
    throw new Error(`Could not reach the Modesty scan service at ${new URL(endpoint).origin}.`);
  }
  const result = await response.json();
  if (!result || typeof result !== "object") {
    throw new Error("The Modesty scan service returned an invalid response.");
  }
  if (!response.ok) {
    throw new Error(result.error || `The Modesty scan service returned HTTP ${response.status}.`);
  }
  return {
    rating: Number.isInteger(result.rating) ? result.rating : null,
    phrase: typeof result.phrase === "string" ? result.phrase : "",
    error: typeof result.error === "string" ? result.error : "",
    mediaType: typeof result.media_type === "string" ? result.media_type : kind,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "scan-media") {
    return false;
  }
  if (message.kind !== "image" && message.kind !== "video") {
    sendResponse({ error: "Unsupported media type." });
    return false;
  }
  scanMedia(message.url, message.kind)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        rating: null,
        error: error instanceof Error ? error.message : "The media could not be scanned.",
      });
    });
  return true;
});
