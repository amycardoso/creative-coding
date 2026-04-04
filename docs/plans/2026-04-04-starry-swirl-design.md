# Starry Swirl — Design

A Van Gogh / James R. Eads–inspired swirling night sky, rendered as a GLSL shader. Luminous flowing currents across a deep dark canvas with twinkling stars and a glowing moon.

## Reference

Tumblr GIF by James R. Eads — deep blue/black swirling lines with luminous edges.

## Architecture

Same pattern as oil-marble, the-xx, eye-of-god:

- `sketches/starry-swirl/index.html` — HTML host page
- `sketches/starry-swirl/sketch.js` — p5.js WEBGL + inline vertex/fragment shaders
- Uniforms: `u_time` (millis/1000), `u_resolution` ([width, height])
- Canvas: 800x800, pixelDensity(2)

## GLSL Strategy

### Swirl field

Double domain-warped FBM. First warp pass creates large-scale currents, second pass adds turbulent sub-swirls. Warp vectors rotate with time for flowing animation.

### Luminous edges

Gradient magnitude via finite differences on warped noise. Gold/amber color with additive glow along edges — creates the "luminous tracer" effect where movement becomes visible as bright flowing lines.

### Color palette (5 colors)

1. Near-black deep navy — background voids
2. Dark indigo — swirl body
3. Medium blue — swirl mid-tones
4. Warm amber/gold — swirl edge highlights
5. Bright warm white — peak intensity

Mixed via smoothstep palette function driven by warped noise + edge intensity.

### Stars

Procedural hash-based starfield masked by swirl intensity (stars appear only in calmer, darker regions where fbm < threshold). Twinkle via sin(time * hash).

### Moon

Circular SDF with soft glow falloff. Off-center upper placement. Subtle crater texture from low-frequency noise. Swirls flow around it via warp field bias.

### Polish

Vignette + saturation boost + gamma correction (consistent with all existing shaders).

## Constraints

- No interactivity — pure animation
- No textures — fully procedural
- Single shader pass — no post-processing
