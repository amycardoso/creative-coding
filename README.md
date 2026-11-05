# Creative Coding

A collection of generative art and data visualizations built with p5.js and WebGL shaders: small systems that draw something different every time they run.

**Gallery:** [amycardoso.github.io/creative-coding-gallery](https://amycardoso.github.io/creative-coding-gallery/) (built from this repo's `manifest.json` by [creative-coding-gallery](https://github.com/amycardoso/creative-coding-gallery)).

## Structure

Sketches are grouped by the `category` in `manifest.json`; series get their own folder.

```
sketches/
├── abstract/        # agents, shaders, typography, geometry
├── brasilidade/     # Brazilian culture, places and craft
├── landscape/       # skies, seas and terrain
├── space/           # cosmos and physics
├── data-viz/        # real-data visualizations
└── series/
    ├── arrival/          # Logograma, Paralaxe Temporal
    ├── dead-channel/     # Routing, Pixel Sort, Neon Signs, ICE, Chiba Sky
    ├── grande-sertao/    # Veredas, Travessia, Redemoinho
    ├── handmaids-tale/   # Fluxo, Contida, Nomes, Maioria
    ├── hunger-games/     # Reaping, Arena, Spark, Tribute, Four Notes
    ├── interstellar/     # Time Dilation, Endurance, Gargantua
    ├── nebulae/          # Eye of God, Pillars, Filaments, Shells
    └── reflexoes/        # Pilha de Areia, Mitose, Cópia da Cópia, Queimada, Bolhas, Feira
```

Each sketch folder is `sketches/<category>/<slug>/` (or `sketches/series/<series>/<slug>/`) and holds `index.html`, `sketch.js` and its recording named `<slug>.mp4` (or `<slug>.png` for a still). A few older pieces keep a `<slug>.gif` because their noise does not compress as video. The gallery makes thumbnails from the recording on deploy and runs the sketch itself on its page. `manifest.json` lists every sketch with its `media` path and its default `seed`; sketches in a series also carry a `series` field.

### Seeds

Every sketch opens on its default `seed` from `manifest.json`, and `?seed=N` gives another variation. [`scripts/seed.js`](scripts/seed.js) makes that work for any sketch without touching its code: it turns `Math.random` (and with it p5's unseeded `random()` and `noise()`) into a seeded generator, and for sketches that hard-code their seeds it mixes the new seed into `randomSeed()`/`noiseSeed()`. With the default seed a sketch behaves exactly as it does on its own. The gallery injects it into each live sketch; the recording script injects it too, so a recording shows exactly what the gallery opens on.

### Recording

`scripts/make-media.sh <slug> [frames] [fps] [size]` records a seamless loop as `<slug>.mp4` with the sketch's default seed. The sketch has to expose `window.__captureFrame(i, N)` (render loop phase `i` of `N`, see `sketches/brasilidade/calcadao/sketch.js`).

## Running Locally

Each project is self-contained. Open any `index.html` directly in a browser — no build tools required.

## Tech Stack

- [p5.js](https://p5js.org) for graphics and interaction
- GLSL shaders for procedural rendering

## License

MIT
