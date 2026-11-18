//! Modesty - nsfw protection API extension content script
//! Sends image bytes to the hosted Modesty scan service via fetch().

const DEFAULT_SETTINGS = { threshold: 6, scanVideo: false, apiKey: "", apiUrl: "https://api.modesty.nsfw/scan" };
const MAX_ACTIVE_IMAGE_SCANS = 2;
const BLOCKED_SVG_URL = chrome.runtime.getURL("blocked.svg");

let settings = { ...DEFAULT_SETTINGS };
let imageQueue = [];
let activeImageScans = 0;
const pendingImageScans = new Map();
const imageScanCache = new Map();
const images = new Set();
const imageRatings = new WeakMap();
const originalImageVisibility = new WeakMap();
const blockedImageOverlays = new WeakMap();
const backgroundStates = new WeakMap();
const originalBackgroundVisibility = new WeakMap();
const videoScans = new WeakMap();
const originalVideoVisibility = new WeakMap();
const videoOverlays = new WeakMap();
const videos = new Set();
const backgroundElements = new Set();
let blockedCount = 0;
let unassessedCount = 0;

function rememberVisibility(element, store) {
  if (!store.has(element)) {
    store.set(element, {
      value: element.style.getPropertyValue("visibility"),
      priority: element.style.getPropertyPriority("visibility"),
    });
  }
}

function restoreVisibility(element, store) {
  const original = store.get(element);
  if (!original) return;
  if (original.value) {
    element.style.setProperty("visibility", original.value, original.priority);
  } else {
    element.style.removeProperty("visibility");
  }
}

function createBlockedOverlay(parent) {
  const overlay = document.createElement("div");
  overlay.style.position = "relative";
  overlay.style.display = "inline-block";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.overflow = "hidden";
  const img = document.createElement("img");
  img.src = BLOCKED_SVG_URL;
  img.style.position = "absolute";
  img.style.top = "0";
  img.style.left = "0";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";
  img.style.objectPosition = "center";
  img.style.display = "block";
  img.alt = "Content blocked by Modesty";
  img.title = "Content blocked by Modesty — rated above your threshold";
  overlay.appendChild(img);
  parent.appendChild(overlay);
  return overlay;
}

function removeBlockedOverlay(element, overlayWeakMap) {
  const overlay = overlayWeakMap.get(element);
  if (overlay) {
    overlay.remove();
    overlayWeakMap.delete(element);
  }
}

function applyImageRating(image) {
  const result = imageRatings.get(image);
  if (!result) return;
  restoreVisibility(image, originalImageVisibility);
  removeBlockedOverlay(image, blockedImageOverlays);
  if (result.rating !== null && result.rating >= settings.threshold) {
    rememberVisibility(image, originalImageVisibility);
    image.style.setProperty("visibility", "hidden", "important");
    const wrap = document.createElement("div");
    wrap.style.display = "inline-block";
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    wrap.style.overflow = "hidden";
    image.parentNode.insertBefore(wrap, image);
    wrap.appendChild(image);
    const svg = document.createElement("img");
    svg.src = BLOCKED_SVG_URL;
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.objectFit = "contain";
    svg.style.objectPosition = "center";
    svg.style.display = "block";
    svg.alt = "Content blocked by Modesty";
    svg.title = "Content blocked by Modesty — rated above your threshold";
    image.parentElement.appendChild(svg);
    blockedImageOverlays.set(image, svg);
  }
}

function applyVideoRating(video) {
  const result = videoScans.get(video);
  if (!result) return;
  restoreVisibility(video, originalVideoVisibility);
  removeBlockedOverlay(video, videoOverlays);
  if (settings.scanVideo && result.rating !== null && result.rating >= settings.threshold) {
    rememberVisibility(video, originalVideoVisibility);
    video.pause();
    const container = document.createElement("div");
    container.style.display = "inline-block";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.overflow = "hidden";
    video.parentNode.insertBefore(container, video);
    container.appendChild(video);
    const svg = document.createElement("img");
    svg.src = BLOCKED_SVG_URL;
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.objectFit = "contain";
    svg.style.objectPosition = "center";
    svg.style.display = "block";
    svg.alt = "Content blocked by Modesty";
    svg.title = "Content blocked by Modesty — rated above your threshold";
    container.appendChild(svg);
    videoOverlays.set(video, svg);
    video.style.setProperty("visibility", "hidden", "important");
  }
}

function applyBackgroundRating(element, state) {
  const blocked = [...state.results.values()].some(
    (result) => result.rating !== null && result.rating >= settings.threshold,
  );
  const isBlocked = element.dataset.modestyBackgroundBlocked === "true";
  if (blocked && !isBlocked) {
    rememberVisibility(element, originalBackgroundVisibility);
    removeBlockedOverlay(element, blockedImageOverlays);
    const container = document.createElement("div");
    container.style.position = "relative";
    container.style.display = "inline-block";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.overflow = "hidden";
    element.parentNode.insertBefore(container, element);
    container.appendChild(element);
    const svg = document.createElement("img");
    svg.src = BLOCKED_SVG_URL;
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.objectFit = "contain";
    svg.style.objectPosition = "center";
    svg.style.display = "block";
    svg.alt = "Content blocked by Modesty";
    svg.title = "Content blocked by Modesty — rated above your threshold";
    container.appendChild(svg);
    blockedImageOverlays.set(element, svg);
    element.style.setProperty("visibility", "hidden", "important");
    element.dataset.modestyBackgroundBlocked = "true";
  } else if (!blocked && isBlocked) {
    restoreVisibility(element, originalBackgroundVisibility);
    removeBlockedOverlay(element, blockedImageOverlays);
    delete element.dataset.modestyBackgroundBlocked;
  }
}

function updateCounts() {
  const blockedElements = new Set();
  const unassessedElements = new Set();
  for (const image of images) {
    const result = imageRatings.get(image);
    if (!result) continue;
    if (result.rating === null) {
      unassessedElements.add(image);
    } else if (result.rating >= settings.threshold) {
      blockedElements.add(image);
    }
  }
  for (const element of backgroundElements) {
    const state = backgroundStates.get(element);
    if (!state) continue;
    const results = [...state.results.values()];
    if (results.some((result) => result.pending || result.rating === null)) {
      unassessedElements.add(element);
    }
    if (results.some((result) => result.rating !== null && result.rating >= settings.threshold)) {
      blockedElements.add(element);
    }
  }
  for (const video of videos) {
    const result = videoScans.get(video);
    if (!result) continue;
    if (result.rating === null) {
      unassessedElements.add(video);
    } else if (settings.scanVideo && result.rating >= settings.threshold) {
      blockedElements.add(video);
    }
  }
  blockedCount = blockedElements.size;
  unassessedCount = unassessedElements.size;
}

function scanImage(image) {
  if (!(image instanceof HTMLImageElement)) return;
  images.add(image);
  if (!image.complete || image.naturalWidth === 0) return;
  const url = image.currentSrc || image.src;
  if (!url || image.dataset.modestyScannedUrl === url) return;
  image.dataset.modestyScannedUrl = url;
  const cached = imageScanCache.get(url);
  if (cached) {
    imageRatings.set(image, cached);
    applyImageRating(image);
    updateCounts();
    return;
  }
  imageRatings.delete(image);
  restoreVisibility(image, originalImageVisibility);
  imageRatings.set(image, { rating: null, pending: true });
  queueImageScan({ image, url });
  updateCounts();
}

function queueImageScan(task) {
  const pending = pendingImageScans.get(task.url);
  if (pending) {
    pending.push(task);
    return;
  }
  pendingImageScans.set(task.url, [task]);
  imageQueue.push({ url: task.url });
  processImageQueue();
}

function applyScanResult(task, result) {
  if (task.backgroundState) {
    if (task.backgroundState.results.get(task.url) === task.backgroundResult) {
      Object.assign(task.backgroundResult, result, { pending: false });
      applyBackgroundRating(task.image, task.backgroundState);
    }
  } else if (task.image.dataset.modestyScannedUrl === task.url) {
    imageRatings.set(task.image, result);
    applyImageRating(task.image);
  }
}

function processImageQueue() {
  while (activeImageScans < MAX_ACTIVE_IMAGE_SCANS && imageQueue.length > 0) {
    const task = imageQueue.shift();
    activeImageScans += 1;

    // API mode: send image bytes to hosted scan service via service worker
    chrome.runtime.sendMessage(
      { type: "scan-media", kind: "image", url: task.url },
      (result) => {
        activeImageScans -= 1;
        const scanResult = chrome.runtime.lastError || !result
          ? {
              rating: null,
              error: chrome.runtime.lastError?.message || "No scanner response.",
            }
          : result;
        if (scanResult.rating !== null) imageScanCache.set(task.url, scanResult);
        const tasks = pendingImageScans.get(task.url) || [];
        pendingImageScans.delete(task.url);
        tasks.forEach((pendingTask) => applyScanResult(pendingTask, scanResult));
        updateCounts();
        processImageQueue();
      }
    );
  }
}

function videoUrl(video) {
  return video.currentSrc || video.src ||
    video.querySelector("source[src]")?.src || "";
}

function scanVideo(video) {
  if (!settings.scanVideo || !(video instanceof HTMLVideoElement)) return;
  videos.add(video);
  const url = videoUrl(video);
  if (!url || videoScans.get(video)?.url === url) return;
  videoScans.set(video, { url, rating: null, pending: true });
  updateCounts();

  chrome.runtime.sendMessage(
    { type: "scan-media", kind: "video", url },
    (result) => {
      if (chrome.runtime.lastError || !result) {
        videoScans.set(video, {
          url,
          rating: null,
          error: chrome.runtime.lastError?.message || "No scanner response.",
        });
      } else {
        videoScans.set(video, { ...result, url });
      }
      applyVideoRating(video);
      updateCounts();
    },
  );
}

function inspectNode(node) {
  if (!(node instanceof Element)) return;
  if (node.matches("img")) scanImage(node);
  if (node.matches("video")) scanVideo(node);
  scanBackgrounds(node);
  node.querySelectorAll("img").forEach(scanImage);
  node.querySelectorAll("video").forEach(scanVideo);
  node.querySelectorAll("*").forEach(scanBackgrounds);
}

function forgetNode(node) {
  if (!(node instanceof Element)) return;
  if (node instanceof HTMLImageElement) images.delete(node);
  if (node instanceof HTMLVideoElement) videos.delete(node);
  backgroundElements.delete(node);
  node.querySelectorAll("img").forEach((image) => images.delete(image));
  node.querySelectorAll("video").forEach((video) => videos.delete(video));
  node.querySelectorAll("*").forEach((element) => backgroundElements.delete(element));
  updateCounts();
}

function refreshSettings() {
  for (const image of images) applyImageRating(image);
  for (const element of backgroundElements) {
    const state = backgroundStates.get(element);
    if (state) applyBackgroundRating(element, state);
  }
  for (const video of videos) applyVideoRating(video);
  updateCounts();
}

function retryUnassessed() {
  for (const image of images) {
    const result = imageRatings.get(image);
    if (result?.rating !== null || result?.pending) continue;
    imageRatings.delete(image);
    delete image.dataset.modestyScannedUrl;
    scanImage(image);
  }
  for (const element of backgroundElements) {
    const state = backgroundStates.get(element);
    if (!state || ![...state.results.values()].some(
      (result) => result.rating === null && !result.pending,
    )) continue;
    state.urls = [];
    state.results.clear();
    scanBackgrounds(element);
  }
  if (settings.scanVideo) {
    for (const video of videos) {
      const result = videoScans.get(video);
      if (result?.rating === null && !result.pending) {
        videoScans.delete(video);
        scanVideo(video);
      }
    }
  }
  updateCounts();
}

async function initialize() {
  settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settings.threshold = Number.isInteger(settings.threshold) &&
    settings.threshold >= 1 && settings.threshold <= 10
    ? settings.threshold
    : DEFAULT_SETTINGS.threshold;
  settings.scanVideo = settings.scanVideo === true;

  document.querySelectorAll("img").forEach(scanImage);
  document.querySelectorAll("video").forEach(scanVideo);
  document.querySelectorAll("*").forEach(scanBackgrounds);
  document.addEventListener("load", (event) => {
    if (event.target instanceof HTMLImageElement) scanImage(event.target);
  }, true);
  document.addEventListener("play", (event) => {
    if (event.target instanceof HTMLVideoElement) scanVideo(event.target);
  }, true);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        inspectNode(record.target);
      }
      record.addedNodes.forEach(inspectNode);
      record.removedNodes.forEach(forgetNode);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "data-src", "style", "class"],
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.threshold) settings.threshold = changes.threshold.newValue;
  if (changes.scanVideo) settings.scanVideo = changes.scanVideo.newValue === true;
  if (changes.apiKey) settings.apiKey = changes.apiKey.newValue || "";
  if (changes.apiUrl) settings.apiUrl = changes.apiUrl.newValue || settings.apiUrl;
  refreshSettings();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "get-scan-status") {
    sendResponse({ blockedCount, unassessedCount });
    return false;
  }
  if (message?.type === "retry-unassessed") {
    retryUnassessed();
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

initialize().catch((error) => {
  console.error("Modesty could not load its settings.", error);
});
