# Modesty - nsfw protection browser extension

This first extension version scans page `<img>` pictures (including
responsive `<picture>` images), inline images, and CSS background images
using the Modesty scan service. Images rated **6 or higher** are replaced
with a "Modesty protects you — content blocked" overlay by default.
Change the blocking limit from the extension popup (valid range:
1–10).

Video scanning is optional and **off by default**. It is experimental and
remains parked while hosted image scanning is completed. When enabled in
this development build, direct video files up to 64 MB and 10 minutes are
sampled at one frame per second. HLS/streaming playlists and protected media
are not supported.

## What runs where

The extension reads each page image and sends its bytes to the HTTPS
endpoint shown in the popup. The default is
`https://api.modesty.nsfw/scan`; change it if your deployment uses a
different HTTPS address ending in `/scan`. The extension does not include
model weights or require users to install Python or run a local server. The
documented default hostname did not resolve during implementation, so a
reachable production deployment is still required before users can scan.

**Privacy:** image bytes are uploaded to the configured scan service for
analysis. The current service implementation deletes its temporary upload
after scanning, but retains the file's SHA-256 hash, rating, and scan
metadata in its database. The service operator's logs and retention policy
also apply. Do not use the hosted scanner for private images unless you
accept those terms.

The extension needs access to websites so it can fetch their images, and
the browser will show that broad permission when installing it. A blocked
image may be visible briefly before its scan finishes.

## Blocked image overlay

When an image is rated at or above your chosen threshold, it is replaced
with a scalable SVG that reads **"Modesty protects you — content blocked"**.
The SVG preserves aspect ratio (`object-fit: contain`) so it looks correct
regardless of the original image dimensions. Blocked images keep their
original space in the page layout rather than collapsing.

## Load in Chrome or Edge for development

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this `packages\nsfw-browser-extension`
   folder.
4. Open a regular website. The extension starts checking images as they load.
5. Use the Modesty toolbar button to change the rating limit or scanner
   service URL. Video scanning remains off by default.

This is an unpacked development extension, not a signed store release.
