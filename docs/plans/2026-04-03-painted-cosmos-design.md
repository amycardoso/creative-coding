# Painted Cosmos — Design

A gently animated generative cosmic scene with a hand-painted gouache aesthetic. Each reload produces a unique composition of spiral galaxies, colorful planets, twinkling stars, and a drifting comet on a deep navy background.

## Reference

Tumblr illustration with thick brush strokes, bold colors, imperfect shapes — screen-print/gouache quality, not photorealistic.

## Approach

**p5.js with offscreen brush texture buffers (createGraphics)**

Pre-render reusable brush stamps with rough, textured edges. Stamp them along paths to simulate thick paint strokes. This achieves the bold, physical paint quality of the reference.

### Brush Stamp System

- Create 3-4 brush stamps at init: small (`~20px`), medium (`~40px`), large (`~60px`)
- Each stamp is a `createGraphics` buffer with a soft, irregular blob shape built from overlapping semi-transparent circles with random offsets
- Stamps are tinted per-use to match the current color
- Drawing a "stroke" = stamping the brush along a path at intervals, with slight random rotation and scale jitter

## Composition

| Element | Count | Size Range | Animation |
|---------|-------|------------|-----------|
| Spiral galaxies | 2-4 | 150-350px radius | Slow rotation ~0.001 rad/frame |
| Solid planets | 6-10 | 15-80px | Very slow drift |
| Ringed planets | 1-3 | 30-60px | Slow drift |
| Comet | 1 | trail ~100-200px | Crosses canvas ~20s, loops |
| Stars (dots) | 200-400 | 1-3px | Twinkle (alpha oscillation) |
| Star sparkles (cross) | 10-20 | 5-15px | Gentle pulse |
| Cosmic dust | 100-200 | 1-2px | Static pink/purple |

### Galaxies

- Core: bright concentrated cluster of overlapping brush stamps
- Arms: 2-3 spiral arms traced with parametric spiral equation, brush stamps along the path
- Each arm uses 2-3 colors (pink/magenta core, yellow/gold outer rings)
- Tilted at random 3D perspective via ellipse scaling
- Whole galaxy rotates slowly

### Planets

- Base: filled circle with brush-stamp texture overlay for surface detail
- Shading: darker crescent on one side via offset semi-transparent dark circle
- Highlight: small bright spot
- Ringed planets: ellipse ring drawn with brush stamps, tilted

### Stars & Cosmic Dust

- Small stars: white dots with alpha oscillation for twinkle
- Sparkle stars: 4-line cross pattern, gentle size pulse
- Cosmic dust: small pink/purple dots, static positions

### Comet

- Glowing head: bright stamp with pink/red tint
- Trail: series of stamps decreasing in size and alpha behind the head
- Moves across canvas on a slight curve, wraps around

## Color Palette

| Role | Colors |
|------|--------|
| Background | `#0a0a1a` (deep navy) |
| Galaxy spirals | `#e84393` `#fd79a8` (pink/magenta), `#fdcb6e` `#f9ca24` (yellow/gold) |
| Planets | `#e84393` (hot pink), `#e17055` (coral), `#00cec9` (teal), `#0984e3` (blue), `#6ab04c` (olive), `#a29bfe` (lavender), `#dfe6e9` (silver) |
| Stars | `#ffffff` with slight blue tint |
| Cosmic dust | `#fd79a8` (pink), `#a29bfe` (soft purple) |
| Comet | `#d63031` (red head), `#e84393` (pink trail) |

## Canvas

- 928x928px
- Background redrawn each frame at full opacity (no trailing) — animation is via element movement, not afterimages

## Tech

- p5.js (CDN)
- No additional dependencies

## File Structure

```
sketches/painted-cosmos/
  index.html
  sketch.js
```
