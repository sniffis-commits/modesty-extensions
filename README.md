<p align="center">
  <img src="assets/logo.svg" alt="Modesty" width="110" height="110">
</p>

<p align="center">
  <img src="assets/modesty-brand.svg" alt="Modesty — NSFW protection" width="260">
</p>

# modesty-extensions

> Browser extensions

Page-image scanning extensions. Offline/self-hosted mode is FOSS; the mode requiring our hosted API is a paid product.

## Layout

| Path | What |
|---|---|
| `browser-extension/` | source from the monorepo |
| `api-extension/` | source from the monorepo |

## Details

| | |
|---|---|
| Language | JavaScript |
| License | MIT (FOSS mode) · hosted mode commercial |
| Website | [https://modesty.cia.org.il](https://modesty.cia.org.il) |
| Repository map | [REPO_MAP.md](https://github.com/sniffis-commits/nfsw_scanner/blob/main/docs/REPO_MAP.md) |
| Split from | private monorepo `sniffis-commits/nfsw_scanner` |

## Quick start

```sh
Load unpacked; point at your own HTTPS scanner.
```

## About Modesty

Privacy-first NSFW scanner. Local scanning by default; uploads are opt-in.
These public repos are split from a private monorepo — see the
[repository map](https://github.com/sniffis-commits/nfsw_scanner/blob/main/docs/REPO_MAP.md) for the full local-to-GitHub naming. Model weights are
in `modesty-models`; the free domain DB release is in `modesty-db`.

Third-party data/model terms are on the [site's license page](https://modesty.cia.org.il/?p=licenses).
