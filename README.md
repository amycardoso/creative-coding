# Creative Coding

A collection of generative art and data visualizations built with p5.js and WebGL shaders.

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
    ├── handmaids-tale/   # Fluxo, Contida, Nomes, Maioria
    ├── interstellar/     # Time Dilation, Endurance, Gargantua
    └── reflexoes/        # Pilha de Areia, Mitose, Cópia da Cópia, Queimada, Bolhas, Feira
```

Each sketch folder is `sketches/<category>/<slug>/` (or `sketches/series/<series>/<slug>/`) and holds `index.html`, `sketch.js` and its preview media named `<slug>.gif` or `<slug>.png`. `manifest.json` lists every sketch with its `media` path; sketches in a series also carry a `series` field.

## Running Locally

Each project is self-contained. Open any `index.html` directly in a browser — no build tools required.

## Tech Stack

- [p5.js](https://p5js.org) for graphics and interaction
- GLSL shaders for procedural rendering

## License

MIT
