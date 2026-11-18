<p align="center"><img src="assets/logo.svg" alt="modesty-extensions" width="110" height="110"></p>

# modesty-extensions

> Browser extensions

**Part of the [Modesty toolkit](https://github.com/sniffis-commits/modesty-meta)** — see the
[big README](https://github.com/sniffis-commits/modesty-meta) for the full picture, the rating scale and all repositories.

## What this is

Browser extensions that scan page images and cover ones at or above your chosen rating. The offline/self-hosted mode is FOSS; the mode that requires a hosted API key is a paid product.

## How to


```bash
# load unpacked in Chrome/Edge:
#   chrome://extensions -> Developer mode -> Load unpacked -> browser-extension/
```
- Set your scan service URL in the popup (must be HTTPS and end in `/scan`).
- Point it at your own `modesty-webservice` deployment to stay fully self-hosted.
- Video scanning is experimental and off by default.
See `browser-extension/README.md` for details.


## Layout

| Path | Purpose |
|---|---|
| `browser-extension/` | source from the monorepo |
| `api-extension/` | source from the monorepo |

## More

- Full overview and other repos: [modesty-meta](https://github.com/sniffis-commits/modesty-meta)
- Website: [https://modesty.cia.org.il](https://modesty.cia.org.il)
- Model weights: [modesty-models](https://github.com/sniffis-commits/modesty-models)
- Licence: MIT (see `LICENSE`). Third-party data/model terms are on the
  [site's licence page](https://modesty.cia.org.il/?p=licenses).
