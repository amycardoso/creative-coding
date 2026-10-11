# Amazônia Legal

Generative data visualization of Brazilian Amazon deforestation from 1988 to present. Uses real-time data from INPE (Brazil's National Institute for Space Research) to show 38 years of forest loss.

## Features

- **Accurate boundaries**: State polygons from TerraBrasilis/INPE GeoServer
- **Real deforestation data**: PRODES annual rates per state (1988-2024)
- **Live fire hotspots**: NASA FIRMS VIIRS satellite data (requires API key)
- **DETER alerts**: Near real-time deforestation detection for 2025+
- **Interactive timeline**: Scrub through years to see forest loss progression

## Data Sources

- **State Boundaries**: [TerraBrasilis GeoServer](https://terrabrasilis.dpi.inpe.br) - INPE
- **Deforestation Rates**: [PRODES](http://www.obt.inpe.br/OBT/assuntos/programas/amazonia/prodes) - INPE
- **Deforestation Alerts**: [DETER](http://www.obt.inpe.br/OBT/assuntos/programas/amazonia/deter) - INPE
- **Fire Hotspots**: [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov)

## Quick Start

1. Clone or download this repository
2. Open `index.html` in a web browser
3. Use the slider to explore deforestation from 1988 to present
4. Click "Play" to animate through the years

No build tools required - runs directly in the browser.

## NASA FIRMS API Key (Optional)

To display live fire hotspots:

1. Get a free API key at https://firms.modaps.eosdis.nasa.gov/api/area/
2. Open `sketch.js`
3. Add your key on line 95:

```javascript
const NASA_FIRMS_MAP_KEY = 'your-api-key-here';
```

Without a key, the visualization still works using PRODES/DETER data.

## Technical Details

- Built with [p5.js](https://p5js.org)
- Canvas: 800x900px
- Forest cells generated from state boundary geometries
- Deforestation assigned per-state based on PRODES annual data
- CORS proxies used for cross-origin API requests

## Stats Displayed

- Annual deforestation (km²)
- Cumulative loss since 1988
- Percentage of Legal Amazon lost
- Live fire/alert counts (current year)

## License

MIT
