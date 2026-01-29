const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = 1988;
const DETER_YEARS = new Set();
const TOTAL_AMAZON = 5500000;

let DEFORESTATION_DATA = {};
let DEFORESTATION_TOTALS = {};
let CUMULATIVE_LOSS = {};
let TOTAL_LOSS = 0;
let gladAlerts = [];
let dataSource = 'loading';
let prodesFromAPI = false;
let isLoadingData = true;

let STATE_BOUNDARIES = [];
let stateBoundariesLoaded = false;

const LOINAME_TO_STATE = {
  4576: 'AC', 4577: 'AM', 4578: 'AP', 4579: 'RO', 4580: 'PA',
  4581: 'MT', 4582: 'RR', 4583: 'TO', 4584: 'MA',
};

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 900;
const MARGIN = 50;

const AMAZON_BOUNDARY = [
  [-73.99, -7.52], [-73.76, -6.91], [-73.21, -6.35], [-72.89, -5.12],
  [-72.32, -4.44], [-71.87, -4.12], [-70.54, -4.29], [-70.06, -4.33],
  [-69.96, -4.24], [-69.41, -1.74], [-69.17, -0.46], [-69.85, 0.66],
  [-69.47, 0.73], [-68.13, 1.74], [-67.08, 1.18], [-66.87, 1.22],
  [-66.06, 0.79], [-65.10, 0.99], [-64.20, 1.53], [-64.00, 1.62],
  [-63.39, 2.15], [-63.39, 2.41], [-64.05, 2.47], [-64.03, 3.93],
  [-64.23, 4.14], [-63.93, 4.02], [-63.49, 3.84], [-62.97, 3.59],
  [-62.55, 3.85], [-62.12, 4.09], [-60.97, 4.52], [-60.73, 5.20],
  [-60.21, 5.24], [-59.98, 4.81], [-59.84, 4.48], [-59.55, 3.93],
  [-59.68, 3.40], [-59.56, 2.51], [-59.89, 1.71], [-59.75, 1.23],
  [-58.82, 1.20], [-57.32, 1.96], [-56.47, 1.94], [-55.90, 2.04],
  [-55.72, 2.40], [-54.62, 2.33], [-54.18, 2.15], [-53.77, 2.35],
  [-52.97, 2.19], [-52.56, 2.50], [-51.85, 4.15], [-51.65, 4.05],
  [-51.31, 4.20], [-51.07, 3.67], [-50.51, 2.13], [-50.06, 1.59],
  [-49.60, 1.12], [-49.09, 0.34], [-48.57, -0.05], [-48.38, -0.29],
  [-48.47, -1.04], [-48.38, -1.52], [-48.15, -1.78], [-47.58, -2.04],
  [-46.55, -2.41], [-45.47, -2.50], [-44.58, -2.93], [-44.39, -2.89],
  [-44.28, -3.26], [-44.05, -3.27], [-44.00, -3.04], [-43.34, -2.97],
  [-42.24, -2.75], [-41.52, -2.91], [-40.47, -2.79], [-39.99, -2.87],
  [-38.49, -3.70], [-37.84, -4.40], [-37.21, -4.87], [-36.95, -5.11],
  [-35.98, -5.05], [-35.55, -5.11], [-35.24, -5.47], [-34.85, -7.01],
  [-34.82, -7.94], [-34.93, -8.83], [-35.17, -9.06], [-35.50, -9.38],
  [-35.89, -9.75], [-36.39, -10.48], [-37.02, -11.04], [-37.38, -12.09],
  [-38.23, -13.01], [-39.07, -13.59], [-39.86, -14.25], [-40.77, -14.47],
  [-41.79, -14.47], [-42.94, -15.15], [-43.72, -15.77], [-44.53, -15.94],
  [-45.47, -15.73], [-46.48, -15.80], [-47.47, -15.76], [-48.47, -15.76],
  [-49.61, -15.92], [-50.57, -15.95], [-51.29, -15.72], [-52.10, -15.62],
  [-53.16, -15.83], [-54.26, -15.81], [-55.42, -15.85], [-56.05, -15.90],
  [-57.47, -15.85], [-58.16, -16.31], [-58.40, -16.31], [-58.47, -16.70],
  [-59.09, -16.27], [-60.02, -16.26], [-60.17, -16.49], [-60.59, -16.42],
  [-61.08, -16.06], [-61.51, -15.99], [-62.02, -15.79], [-62.76, -15.62],
  [-63.19, -15.43], [-63.59, -14.90], [-64.32, -14.55], [-64.72, -14.18],
  [-65.04, -13.88], [-65.32, -13.79], [-65.40, -13.44], [-65.33, -12.97],
  [-65.18, -12.59], [-65.18, -12.11], [-65.35, -11.85], [-65.39, -11.25],
  [-65.32, -10.89], [-65.44, -10.51], [-65.31, -10.25], [-65.40, -9.71],
  [-66.58, -9.90], [-67.11, -10.31], [-68.00, -10.10], [-68.27, -10.95],
  [-69.42, -10.95], [-69.57, -10.95], [-70.64, -11.01], [-70.64, -9.62],
  [-71.24, -10.00], [-72.14, -10.00], [-72.38, -9.51], [-73.21, -9.41],
  [-73.12, -8.40], [-73.76, -7.89], [-73.99, -7.52]
];

const AMAZON_BOUNDS = { minLon: -74, maxLon: -34, minLat: -17, maxLat: 6 };

const COLORS = {
  background: '#1A1A1A',
  forestDark: '#1B4D3E',
  forestMid: '#2D6A4F',
  forestLight: '#40916C',
  forestHighlight: '#52B788',
  scar: '#3D2817',
  accent: '#D4A373',
  alertRed: '#FF4444',
  text: '#F4F4F0',
  textDim: '#888888',
};

let forestCells = [];
let currentYear = START_YEAR;
let isPlaying = false;
let lastYearChange = 0;
let CACHED_COLORS = {};
let staticBuffer = null;
let staticBufferDirty = true;

// GIF Recording
let gifRecorder = null;
let isRecording = false;
let recordingYear = START_YEAR;
let recordingFrameCount = 0;
const FRAMES_PER_YEAR = 3; // Capture 3 frames per year for smoother animation

const NASA_FIRMS_MAP_KEY = ''; // Get your key at https://firms.modaps.eosdis.nasa.gov/api/area/

async function fetchStateBoundaries() {
  updateDataStatus('Fetching state boundaries...');

  const statesUrl = 'https://terrabrasilis.dpi.inpe.br/geoserver/prodes-legal-amz/ows?' +
    'service=WFS&version=1.0.0&request=GetFeature&' +
    'typeName=prodes-legal-amz:states_legal_amazon&' +
    'outputFormat=application/json';

  const fetchWithTimeout = (url, timeout = 8000) => {
    return Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
    ]);
  };

  const proxies = [
    `https://corsproxy.io/?${statesUrl}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(statesUrl)}`,
    statesUrl
  ];

  for (const url of proxies) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) continue;

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        STATE_BOUNDARIES = data.features.map(f => ({
          sigla: f.properties.sigla,
          nome: f.properties.nome,
          id: f.properties.id,
          geocodigo: f.properties.geocodigo,
          geometry: f.geometry
        }));

        calculateStateBoundingBoxes();
        stateBoundariesLoaded = true;
        return true;
      }
    } catch (error) {
      continue;
    }
  }

  console.error('[States] Could not fetch state boundaries');
  return false;
}

function calculateStateBoundingBoxes() {
  for (const state of STATE_BOUNDARIES) {
    if (!state.geometry) continue;

    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    const processCoords = (coords) => {
      if (typeof coords[0] === 'number') {
        minLon = Math.min(minLon, coords[0]);
        maxLon = Math.max(maxLon, coords[0]);
        minLat = Math.min(minLat, coords[1]);
        maxLat = Math.max(maxLat, coords[1]);
      } else {
        for (const item of coords) processCoords(item);
      }
    };

    processCoords(state.geometry.coordinates);

    state.bbox = { minLon, maxLon, minLat, maxLat };
  }
}

function pointInGeoJSONGeometry(lon, lat, geometry) {
  if (!geometry) return false;

  if (geometry.type === 'Polygon') {
    const exteriorRing = geometry.coordinates[0];
    if (!pointInPolygon(lon, lat, exteriorRing.map(c => [c[0], c[1]]))) return false;
    for (let i = 1; i < geometry.coordinates.length; i++) {
      if (pointInPolygon(lon, lat, geometry.coordinates[i].map(c => [c[0], c[1]]))) return false;
    }
    return true;
  }

  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      const exteriorRing = polygon[0];
      if (pointInPolygon(lon, lat, exteriorRing.map(c => [c[0], c[1]]))) {
        let inHole = false;
        for (let i = 1; i < polygon.length; i++) {
          if (pointInPolygon(lon, lat, polygon[i].map(c => [c[0], c[1]]))) { inHole = true; break; }
        }
        if (!inHole) return true;
      }
    }
    return false;
  }
  return false;
}

async function fetchLiveData() {
  updateDataStatus('Loading data...');

  try {
    await fetchStateBoundaries();
    await fetchPRODESData();
    const deterAlerts = await fetchDETERData();

    updateDataStatus('Fetching fire data...');
    const fireData = await fetchNASAFires();

    if (prodesFromAPI) dataSource = 'live';

    if (fireData && fireData.length > 0) {
      gladAlerts = fireData;
      const deterYearsStr = DETER_YEARS.size > 0 ? ` | DETER: ${Array.from(DETER_YEARS).join(', ')}` : '';
      updateDataStatus(`Live: ${fireData.length} fires | PRODES${deterYearsStr}`);
    } else if (deterAlerts && deterAlerts.length > 0) {
      gladAlerts = deterAlerts;
      updateDataStatus(`Live: ${deterAlerts.length} DETER alerts | PRODES`);
    } else if (prodesFromAPI) {
      updateDataStatus('Live: PRODES API data loaded');
    } else {
      updateDataStatus('Error: Could not fetch data');
    }

  } catch (error) {
    console.error('Failed to fetch live data:', error);
    updateDataStatus('Using offline data');
  }

  calculateCumulativeLoss();
  isLoadingData = false;
  generateForestCells();
  precomputeAlertPositions();
  staticBufferDirty = true;
  updateStatsDisplay(currentYear);
  hideLoadingOverlay();
}

async function fetchPRODESData() {
  updateDataStatus('Fetching PRODES data from INPE...');

  try {
    const prodesUrl = 'https://terrabrasilis.dpi.inpe.br/app/prodes/dashboard/deforestation/files/rates2025.json';
    const proxyUrl = 'https://corsproxy.io/?' + prodesUrl;
    const response = await fetch(proxyUrl);

    if (response.ok) {
      const text = await response.text();
      const data = JSON.parse(text);
      const periods = data?.periods || (Array.isArray(data) ? data : []);

      if (periods.length > 0) {
        const result = parsePRODESPeriods(periods);

        if (Object.keys(result.byState).length > 10) {
          Object.assign(DEFORESTATION_DATA, result.byState);
          Object.assign(DEFORESTATION_TOTALS, result.totals);
          prodesFromAPI = true;
          return true;
        }
      }
    }
  } catch (error) {}

  try {
    const directUrl = 'https://terrabrasilis.dpi.inpe.br/app/prodes/dashboard/deforestation/files/rates2025.json';
    const response = await fetch(directUrl);

    if (response.ok) {
      const data = await response.json();
      const periods = data?.periods || (Array.isArray(data) ? data : []);

      if (periods.length > 0) {
        const result = parsePRODESPeriods(periods);

        if (Object.keys(result.byState).length > 10) {
          Object.assign(DEFORESTATION_DATA, result.byState);
          Object.assign(DEFORESTATION_TOTALS, result.totals);
          prodesFromAPI = true;
          return true;
        }
      }
    }
  } catch (error) {}

  console.error('[PRODES] Failed to fetch data from API');
  dataSource = 'error';
  return false;
}

function parsePRODESPeriods(periods) {
  const byState = {};
  const totals = {};

  for (const period of periods) {
    const endYear = period.endDate?.year;
    if (!endYear || endYear < START_YEAR) continue;

    const features = period.features || period.lois || [];
    let yearTotal = 0;
    const yearByState = {};

    for (const feature of features) {
      const loiname = feature.loiname || feature.loi;
      const stateCode = LOINAME_TO_STATE[loiname];
      let featureArea = 0;
      if (Array.isArray(feature.areas)) {
        for (const areaObj of feature.areas) {
          featureArea += parseFloat(areaObj.area) || 0;
        }
      } else {
        featureArea = parseFloat(feature.area) || 0;
      }

      if (featureArea > 0) {
        yearTotal += featureArea;

        if (stateCode) {
          yearByState[stateCode] = (yearByState[stateCode] || 0) + featureArea;
        }
      }
    }

    if (yearTotal > 0) {
      totals[endYear] = Math.round(yearTotal);
      byState[endYear] = {};
      for (const [state, area] of Object.entries(yearByState)) {
        byState[endYear][state] = Math.round(area);
      }
    }
  }

  return { byState, totals };
}


async function fetchNASAFires() {
  if (!NASA_FIRMS_MAP_KEY) return [];
  try {
    const bbox = `${AMAZON_BOUNDS.minLon},${AMAZON_BOUNDS.minLat},${AMAZON_BOUNDS.maxLon},${AMAZON_BOUNDS.maxLat}`;
    const firmsUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/${bbox}/2`;
    const response = await fetch(firmsUrl);
    if (!response.ok) throw new Error(`NASA FIRMS API error: ${response.status}`);
    return parseFiresCSV(await response.text());
  } catch (error) {
    console.error('NASA FIRMS fetch failed:', error);
    return await fetchFIRMSGeoJSON();
  }
}

function parseFiresCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  const latIdx = headers.indexOf('latitude');
  const lonIdx = headers.indexOf('longitude');
  const dateIdx = headers.indexOf('acq_date');
  const confIdx = headers.indexOf('confidence');
  const frpIdx = headers.indexOf('frp');

  if (latIdx === -1 || lonIdx === -1) return [];

  const fires = [];
  for (let i = 1; i < lines.length && fires.length < 500; i++) {
    const cols = lines[i].split(',');
    const lat = parseFloat(cols[latIdx]);
    const lon = parseFloat(cols[lonIdx]);
    if (isNaN(lat) || isNaN(lon)) continue;

    if (lat >= AMAZON_BOUNDS.minLat && lat <= AMAZON_BOUNDS.maxLat &&
        lon >= AMAZON_BOUNDS.minLon && lon <= AMAZON_BOUNDS.maxLon &&
        pointInPolygon(lon, lat, AMAZON_BOUNDARY)) {
      fires.push({
        lat, lon,
        date: cols[dateIdx] || new Date().toISOString().split('T')[0],
        confidence: cols[confIdx] || 'nominal',
        frp: parseFloat(cols[frpIdx]) || 0,
        type: 'fire'
      });
    }
  }
  return fires;
}

async function fetchFIRMSGeoJSON() {
  if (!NASA_FIRMS_MAP_KEY) return [];
  try {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${NASA_FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/BRA/1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('GeoJSON endpoint failed');
    return parseFiresCSV(await response.text());
  } catch (error) {
    console.error('FIRMS GeoJSON fetch failed:', error);
    return [];
  }
}

async function fetchDETERData() {
  updateDataStatus('Fetching DETER deforestation alerts...');

  try {
    const startDate = '2025-01-01';
    const url = 'https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/ows?' +
      'service=WFS&version=1.0.0&request=GetFeature&' +
      'typeName=deter-amz:deter_amz&' +
      'outputFormat=application/json&' +
      `cql_filter=view_date>='${startDate}'&` +
      'maxFeatures=10000';
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`TerraBrasilis API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const yearlyTotals = {};

      for (const feature of data.features) {
        const props = feature.properties;
        const viewDate = props?.view_date || props?.VIEW_DATE;
        const areaHa = props?.areamunkm || props?.areameters / 10000 || props?.area_ha || 0;

        if (viewDate) {
          const year = new Date(viewDate).getFullYear();
          if (year >= 2025) {
            yearlyTotals[year] = (yearlyTotals[year] || 0) + areaHa;
          }
        }
      }

      for (const [year, total] of Object.entries(yearlyTotals)) {
        const yearNum = parseInt(year);
        DEFORESTATION_DATA[yearNum] = Math.round(total);
        DETER_YEARS.add(yearNum);
      }

      return data.features.map(f => {
        const coords = f.geometry?.coordinates;
        let lat, lon;

        if (f.geometry?.type === 'Point') {
          [lon, lat] = coords;
        } else if (f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon') {
          const flatCoords = flattenCoordinates(coords);
          if (flatCoords.length > 0) {
            lon = flatCoords.reduce((s, c) => s + c[0], 0) / flatCoords.length;
            lat = flatCoords.reduce((s, c) => s + c[1], 0) / flatCoords.length;
          }
        }

        if (lat === undefined || lon === undefined) return null;

        return {
          lat,
          lon,
          date: f.properties?.view_date || new Date().toISOString().split('T')[0],
          confidence: 'high',
          area: f.properties?.areamunkm || 0,
          type: 'deforestation'
        };
      }).filter(a => a !== null);
    }

    return [];

  } catch (error) {
    console.error('[DETER] Fetch failed:', error);
    return [];
  }
}

function flattenCoordinates(coords) {
  const result = [];
  function flatten(arr) {
    if (Array.isArray(arr[0]) && Array.isArray(arr[0][0])) {
      for (const item of arr) flatten(item);
    } else if (Array.isArray(arr[0]) && typeof arr[0][0] === 'number') {
      result.push(...arr);
    } else if (typeof arr[0] === 'number') {
      result.push(arr);
    }
  }
  flatten(coords);
  return result;
}

function calculateCumulativeLoss() {
  CUMULATIVE_LOSS = {};
  let runningTotal = 0;

  for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
    const yearLoss = getYearlyTotal(year);
    if (yearLoss > 0) {
      runningTotal += yearLoss;
    }
    CUMULATIVE_LOSS[year] = runningTotal;
  }

  TOTAL_LOSS = runningTotal;
}

function getYearlyTotal(year) {
  if (DEFORESTATION_TOTALS[year]) return DEFORESTATION_TOTALS[year];
  if (DEFORESTATION_DATA[year] && typeof DEFORESTATION_DATA[year] === 'object') {
    return Object.values(DEFORESTATION_DATA[year]).reduce((a, b) => a + b, 0);
  }
  if (typeof DEFORESTATION_DATA[year] === 'number') return DEFORESTATION_DATA[year];
  return 0;
}

function getStateDeforestation(year, stateCode) {
  if (DEFORESTATION_DATA[year] && typeof DEFORESTATION_DATA[year] === 'object') {
    return DEFORESTATION_DATA[year][stateCode] || 0;
  }
  return 0;
}

function updateDataStatus(message) {
  const statusEl = document.getElementById('data-status');
  if (statusEl) statusEl.textContent = message;
  const loadingText = document.getElementById('loading-text');
  if (loadingText) {
    loadingText.textContent = message;
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

function showLoadingOverlay(message) {
  const overlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  if (overlay) overlay.classList.remove('hidden');
  if (loadingText && message) loadingText.textContent = message;
}

function setup() {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  canvas.parent('canvas-container');
  textFont('Inter, sans-serif');
  noiseSeed(42);
  frameRate(30);

  CACHED_COLORS = {
    forestDark: color(COLORS.forestDark),
    forestMid: color(COLORS.forestMid),
    forestLight: color(COLORS.forestLight),
    forestHighlight: color(COLORS.forestHighlight),
    scarR: red(color(COLORS.scar)),
    scarG: green(color(COLORS.scar)),
    scarB: blue(color(COLORS.scar)),
  };

  staticBuffer = createGraphics(CANVAS_WIDTH, CANVAS_HEIGHT);
  drawStaticBuffer();

  calculateCumulativeLoss();
  generateForestCells();
  setupSliderListener();
  updateStatsDisplay(currentYear);
  fetchLiveData();
}

function drawStaticBuffer() {
  staticBuffer.background(COLORS.background);
  staticBuffer.noStroke();
  for (let i = 0; i < 500; i++) {
    const x = random(CANVAS_WIDTH);
    const y = random(CANVAS_HEIGHT);
    staticBuffer.fill(255, random(2, 5));
    staticBuffer.ellipse(x, y, random(1, 2));
  }

  if (stateBoundariesLoaded && STATE_BOUNDARIES.length > 0) {
    for (const state of STATE_BOUNDARIES) {
      if (!state.geometry) continue;
      drawGeoJSONToBuffer(staticBuffer, state.geometry, COLORS.forestDark);
    }
  }

  const bounds = getMapBounds();
  const km500InDegrees = 500 / 111;
  const startPos = geoToCanvas(-70, -15);
  const endPos = geoToCanvas(-70 + km500InDegrees, -15);
  const scaleWidth = endPos.x - startPos.x;
  const scaleX = bounds.right - 80;
  const scaleY = bounds.bottom - 20;

  staticBuffer.stroke(COLORS.textDim);
  staticBuffer.strokeWeight(2);
  staticBuffer.line(scaleX - scaleWidth, scaleY, scaleX, scaleY);
  staticBuffer.strokeWeight(1);
  staticBuffer.line(scaleX - scaleWidth, scaleY - 4, scaleX - scaleWidth, scaleY + 4);
  staticBuffer.line(scaleX, scaleY - 4, scaleX, scaleY + 4);
  staticBuffer.noStroke();
  staticBuffer.fill(COLORS.textDim);
  staticBuffer.textAlign(CENTER, BOTTOM);
  staticBuffer.textSize(8);
  staticBuffer.textStyle(NORMAL);
  staticBuffer.text('500 km', scaleX - scaleWidth / 2, scaleY - 6);

  const cx = bounds.left + 30;
  const cy = bounds.top + 30;
  const compassSize = 12;
  staticBuffer.stroke(COLORS.textDim);
  staticBuffer.strokeWeight(1);
  staticBuffer.fill(COLORS.textDim);
  staticBuffer.line(cx, cy + compassSize, cx, cy - compassSize);
  staticBuffer.triangle(cx, cy - compassSize - 4, cx - 4, cy - compassSize + 2, cx + 4, cy - compassSize + 2);
  staticBuffer.noStroke();
  staticBuffer.textAlign(CENTER, BOTTOM);
  staticBuffer.textSize(9);
  staticBuffer.textStyle(BOLD);
  staticBuffer.text('N', cx, cy - compassSize - 6);

  staticBufferDirty = false;
}

function drawGeoJSONToBuffer(buf, geometry, strokeColor) {
  const drawPoly = (coords) => {
    buf.stroke(strokeColor);
    buf.strokeWeight(1);
    buf.noFill();
    buf.beginShape();
    for (const point of coords) {
      const pos = geoToCanvas(point[0], point[1]);
      buf.vertex(pos.x, pos.y);
    }
    buf.endShape(CLOSE);
  };

  if (geometry.type === 'Polygon') {
    drawPoly(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      drawPoly(polygon[0]);
    }
  }
}

function draw() {
  if (isPlaying && millis() - lastYearChange > 800) {
    currentYear++;
    if (currentYear > CURRENT_YEAR) {
      currentYear = START_YEAR;
    }
    updateSlider(currentYear);
    lastYearChange = millis();
  }

  if (staticBufferDirty) drawStaticBuffer();
  image(staticBuffer, 0, 0);

  drawForest(currentYear);
  drawGLADAlerts();
  drawAshParticles(currentYear);
  drawTypography(currentYear);
  drawDataSourceBadge();

  // Capture frame if recording
  if (isRecording) {
    captureGifFrame();
  }
}

function getMapBounds() {
  return {
    left: MARGIN + 10,
    right: CANVAS_WIDTH - MARGIN - 10,
    top: MARGIN + 90,
    bottom: CANVAS_HEIGHT - MARGIN - 100
  };
}

function geoToCanvas(lon, lat) {
  const bounds = getMapBounds();
  const mapWidth = bounds.right - bounds.left;
  const mapHeight = bounds.bottom - bounds.top;
  const geoWidth = AMAZON_BOUNDS.maxLon - AMAZON_BOUNDS.minLon;
  const geoHeight = AMAZON_BOUNDS.maxLat - AMAZON_BOUNDS.minLat;
  const geoAspect = geoWidth / geoHeight;
  const canvasAspect = mapWidth / mapHeight;

  let scale, offsetX, offsetY;
  if (geoAspect > canvasAspect) {
    scale = mapWidth / geoWidth;
    offsetX = bounds.left;
    offsetY = bounds.top + (mapHeight - geoHeight * scale) / 2;
  } else {
    scale = mapHeight / geoHeight;
    offsetX = bounds.left + (mapWidth - geoWidth * scale) / 2;
    offsetY = bounds.top;
  }

  return {
    x: offsetX + (lon - AMAZON_BOUNDS.minLon) * scale,
    y: offsetY + (AMAZON_BOUNDS.maxLat - lat) * scale
  };
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function generateForestCells() {
  forestCells = [];
  const gridSpacing = 0.18;
  const jitter = 0.07;

  if (stateBoundariesLoaded && STATE_BOUNDARIES.length > 0) {
    for (const state of STATE_BOUNDARIES) {
      if (!state.bbox || !state.geometry) continue;
      const { minLon, maxLon, minLat, maxLat } = state.bbox;

      for (let lon = minLon; lon <= maxLon; lon += gridSpacing) {
        for (let lat = minLat; lat <= maxLat; lat += gridSpacing) {
          const jitteredLon = lon + random(-jitter, jitter);
          const jitteredLat = lat + random(-jitter, jitter);
          if (!pointInGeoJSONGeometry(jitteredLon, jitteredLat, state.geometry)) continue;

          const pos = geoToCanvas(jitteredLon, jitteredLat);
          const noiseVal = noise(jitteredLon * 0.5, jitteredLat * 0.5);
          const radius = random(1.5, 4) * (0.7 + noiseVal * 0.4);

          forestCells.push({
            x: pos.x, y: pos.y,
            lon: jitteredLon, lat: jitteredLat,
            radius,
            stateCode: state.sigla,
            deathYear: null,
            noiseOffset: random(1000),
            greenVariant: random(1),
            pulseOffset: random(TWO_PI),
          });
        }
      }
    }
  }
  assignDeathYears();
}

function assignDeathYears() {
  for (const cell of forestCells) cell.deathYear = null;

  const hasPerStateData = stateBoundariesLoaded &&
    Object.keys(DEFORESTATION_DATA).length > 0 &&
    typeof DEFORESTATION_DATA[Object.keys(DEFORESTATION_DATA)[0]] === 'object';

  if (hasPerStateData) assignDeathYearsByState();
  else assignDeathYearsGlobal();
}

function assignDeathYearsByState() {
  const cellsByState = {};
  const cellsWithoutState = [];

  for (let i = 0; i < forestCells.length; i++) {
    const cell = forestCells[i];
    if (cell.stateCode) {
      if (!cellsByState[cell.stateCode]) cellsByState[cell.stateCode] = [];
      cellsByState[cell.stateCode].push(i);
    } else {
      cellsWithoutState.push(i);
    }
  }

  const stateTotalLoss = {};
  for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
    if (DEFORESTATION_DATA[year] && typeof DEFORESTATION_DATA[year] === 'object') {
      for (const [state, loss] of Object.entries(DEFORESTATION_DATA[year])) {
        stateTotalLoss[state] = (stateTotalLoss[state] || 0) + loss;
      }
    }
  }

  const globalLossRatio = TOTAL_LOSS / TOTAL_AMAZON;
  const totalCellsToDie = Math.round(forestCells.length * globalLossRatio * 8);

  for (const [stateCode, cellIndices] of Object.entries(cellsByState)) {
    const shuffled = [...cellIndices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = floor(random(i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const stateLoss = stateTotalLoss[stateCode] || 0;
    if (stateLoss === 0) continue;

    const stateRatio = stateLoss / TOTAL_LOSS;
    const cellsToDie = Math.min(Math.round(totalCellsToDie * stateRatio), shuffled.length);

    let cellIndex = 0;
    for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
      const yearLoss = getStateDeforestation(year, stateCode);
      if (yearLoss === 0) continue;

      const cellsThisYear = Math.max(1, Math.round(cellsToDie * (yearLoss / stateLoss)));
      for (let i = 0; i < cellsThisYear && cellIndex < cellsToDie; i++) {
        forestCells[shuffled[cellIndex]].deathYear = year;
        cellIndex++;
      }
    }
  }

  if (cellsWithoutState.length > 0) assignDeathYearsForCells(cellsWithoutState);
}

function assignDeathYearsGlobal() {
  assignDeathYearsForCells(forestCells.map((_, i) => i));
}

function assignDeathYearsForCells(cellIndices) {
  const shuffled = [...cellIndices];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const cellsToDie = floor(shuffled.length * (TOTAL_LOSS / TOTAL_AMAZON) * 8);
  let cellIndex = 0;

  for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
    const yearLoss = getYearlyTotal(year);
    if (yearLoss === 0) continue;

    const cellsThisYear = floor(cellsToDie * (TOTAL_LOSS > 0 ? yearLoss / TOTAL_LOSS : 0));
    for (let i = 0; i < cellsThisYear && cellIndex < shuffled.length; i++) {
      forestCells[shuffled[cellIndex]].deathYear = year;
      cellIndex++;
    }
  }
}

function drawForest(year) {
  const time = frameCount * 0.02;

  for (const cell of forestCells) {
    const isAlive = cell.deathYear === null || cell.deathYear > year;
    const isDead = cell.deathYear !== null && cell.deathYear <= year;

    if (isAlive) {
      const pulse = sin(time + cell.pulseOffset) * 0.05 + 1;
      const displayRadius = cell.radius * pulse;

      const greenColor = getForestGreen(cell);

      noStroke();
      fill(greenColor);
      ellipse(cell.x, cell.y, displayRadius * 2);

      fill(255, 15);
      ellipse(cell.x - cell.radius * 0.2, cell.y - cell.radius * 0.2, displayRadius * 0.5);

    } else if (isDead) {
      const yearsDeadRatio = (year - cell.deathYear) / 23;
      const scarAlpha = map(yearsDeadRatio, 0, 1, 60, 20);

      noStroke();
      fill(CACHED_COLORS.scarR, CACHED_COLORS.scarG, CACHED_COLORS.scarB, scarAlpha);
      ellipse(cell.x, cell.y, cell.radius * 1.2);
    }
  }
}

function precomputeAlertPositions() {
  const bounds = getMapBounds();
  for (const alert of gladAlerts) {
    const pos = geoToCanvas(alert.lon, alert.lat);
    alert.cx = pos.x;
    alert.cy = pos.y;
    alert.visible = pos.x >= bounds.left && pos.x <= bounds.right &&
                    pos.y >= bounds.top && pos.y <= bounds.bottom;
  }
}

function drawGLADAlerts() {
  if (currentYear !== CURRENT_YEAR || gladAlerts.length === 0) return;

  const time = frameCount * 0.05;
  const isFire = gladAlerts[0]?.type === 'fire';

  noStroke();
  for (let i = 0; i < Math.min(gladAlerts.length, 500); i++) {
    const alert = gladAlerts[i];
    if (!alert.visible) continue;

    const pulse = sin(time + i * 0.5) * 0.3 + 1;

    if (isFire) {
      const intensity = alert.frp ? map(alert.frp, 0, 100, 0.5, 1.5) : 1;
      const size = 3 * pulse * intensity;
      fill(255, 100, 0, 60);
      ellipse(alert.cx, alert.cy, size + 8);
      fill(255, 150, 0, 120);
      ellipse(alert.cx, alert.cy, size + 3);
      fill(255, 220, 100, 255);
      ellipse(alert.cx, alert.cy, size);
    } else {
      const size = 4 * pulse;
      fill(255, 68, 68, 150);
      ellipse(alert.cx, alert.cy, size + 4);
      fill(255, 100, 100, 255);
      ellipse(alert.cx, alert.cy, size);
    }
  }
}

function getForestGreen(cell) {
  const variant = cell.greenVariant;
  if (variant < 0.3) return CACHED_COLORS.forestDark;
  if (variant < 0.6) return CACHED_COLORS.forestMid;
  if (variant < 0.85) return CACHED_COLORS.forestLight;
  return CACHED_COLORS.forestHighlight;
}

function drawAshParticles(year) {
  const loss = year >= 2001 ? (CUMULATIVE_LOSS[year] || 0) : 0;
  const lossRatio = TOTAL_LOSS > 0 ? loss / TOTAL_LOSS : 0;

  const particleCount = floor(lossRatio * 150);
  const time = frameCount * 0.01;
  const bounds = getMapBounds();

  noStroke();
  for (let i = 0; i < particleCount; i++) {
    const baseX = noise(i * 0.1 + time * 0.3) * (bounds.right - bounds.left) + bounds.left;
    const baseY = noise(i * 0.1 + 500) * (bounds.bottom - bounds.top) * 0.8 + bounds.top;
    const floatY = baseY - (time * 15 + i * 8) % (bounds.bottom - bounds.top);

    const size = noise(i * 0.3) * 3 + 1;
    const alpha = map(floatY, bounds.top, bounds.bottom, 0, 35);

    if (alpha > 0 && floatY > bounds.top && floatY < bounds.bottom) {
      fill(180, 160, 140, alpha);
      ellipse(baseX, floatY, size);
    }
  }
}

function drawTypography(year) {
  const yearLoss = getYearlyTotal(year);
  const cumulative = CUMULATIVE_LOSS[year] || 0;
  const percentage = (cumulative / TOTAL_AMAZON * 100).toFixed(2);
  const isDeterYear = DETER_YEARS.has(year);
  const hasData = yearLoss > 0;
  const isPendingYear = year === CURRENT_YEAR && !hasData && !isDeterYear;

  fill(COLORS.text);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(36);
  textStyle(BOLD);
  text('AMAZÔNIA LEGAL', MARGIN, MARGIN);

  textSize(11);
  textStyle(NORMAL);
  fill(COLORS.textDim);
  text(`BRAZILIAN AMAZON DEFORESTATION ${START_YEAR}-${CURRENT_YEAR}`, MARGIN, MARGIN + 44);

  textAlign(RIGHT, TOP);
  fill(COLORS.accent);
  textSize(56);
  textStyle(BOLD);
  text(year, CANVAS_WIDTH - MARGIN, MARGIN);

  const footerY = CANVAS_HEIGHT - MARGIN - 75;

  textAlign(LEFT, TOP);
  fill(COLORS.accent);
  textSize(32);
  textStyle(BOLD);
  text(hasData ? numberWithCommas(yearLoss) : '—', MARGIN, footerY);

  textSize(11);
  textStyle(NORMAL);
  fill(COLORS.textDim);
  let lossLabel = 'KM² LOST THIS YEAR';
  if (isDeterYear) {
    lossLabel = 'KM² (DETER ALERTS)';
  } else if (isPendingYear) {
    lossLabel = 'KM² (PRODES DATA PENDING)';
  }
  text(lossLabel, MARGIN, footerY + 38);

  textAlign(CENTER, TOP);
  fill(COLORS.text);
  textSize(32);
  textStyle(BOLD);
  text(numberWithCommas(cumulative), CANVAS_WIDTH / 2, footerY);

  textSize(11);
  textStyle(NORMAL);
  fill(COLORS.textDim);
  text(`KM² TOTAL LOSS SINCE ${START_YEAR}`, CANVAS_WIDTH / 2, footerY + 38);

  textAlign(RIGHT, TOP);
  fill(COLORS.alertRed);
  textSize(32);
  textStyle(BOLD);
  text(`${percentage}%`, CANVAS_WIDTH - MARGIN, footerY);

  textSize(11);
  textStyle(NORMAL);
  fill(COLORS.textDim);
  text('OF AMAZON LOST', CANVAS_WIDTH - MARGIN, footerY + 38);

  textAlign(RIGHT, BOTTOM);
  textSize(8);
  fill(100);
  let sourceText = 'LOADING...';
  if (dataSource === 'error') {
    sourceText = 'ERROR: Could not fetch data';
  } else if (dataSource === 'live') {
    const sources = [];
    if (gladAlerts.length > 0) sources.push('NASA FIRMS');
    if (DETER_YEARS.size > 0) sources.push('INPE DETER');
    sources.push('INPE PRODES');
    sourceText = 'LIVE: ' + sources.join(' + ');
  }
  text(sourceText, CANVAS_WIDTH - MARGIN, CANVAS_HEIGHT - MARGIN + 15);

  textAlign(LEFT, BOTTOM);
  textSize(8);
  fill(80);
  text('Legal Amazon boundary from IBGE/INPE', MARGIN, CANVAS_HEIGHT - MARGIN + 15);
}

function drawDataSourceBadge() {
  if (dataSource === 'live' && !isLoadingData) {
    const badgeX = MARGIN;
    const badgeY = MARGIN + 65;
    const pulse = sin(frameCount * 0.1) * 0.3 + 0.7;

    noStroke();
    fill(68, 255, 68, 200 * pulse);
    ellipse(badgeX + 5, badgeY + 5, 8);

    fill(COLORS.textDim);
    textAlign(LEFT, TOP);
    textSize(9);
    textStyle(NORMAL);
    text('LIVE', badgeX + 14, badgeY);

    if (currentYear === CURRENT_YEAR && gladAlerts.length > 0) {
      fill(COLORS.alertRed);
      const alertType = gladAlerts[0]?.type === 'fire' ? 'fires' : 'alerts';
      text(`${gladAlerts.length} ${alertType}`, MARGIN + 50, badgeY);
    }
  }

  if (isLoadingData) {
    fill(COLORS.accent);
    textAlign(LEFT, TOP);
    textSize(9);
    textStyle(NORMAL);
    text('Loading NASA FIRMS data...', MARGIN, MARGIN + 65);
  }
}

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function updateSlider(year) {
  const slider = document.getElementById('year-slider');
  const label = document.getElementById('year-label');

  if (slider) slider.value = year;
  if (label) label.textContent = year;

  updateStatsDisplay(year);
}

function setupSliderListener() {
  const slider = document.getElementById('year-slider');
  const label = document.getElementById('year-label');

  if (slider) {
    slider.min = START_YEAR;
    slider.max = CURRENT_YEAR;
    slider.value = START_YEAR;

    slider.addEventListener('input', function() {
      currentYear = parseInt(this.value);
      if (label) label.textContent = currentYear;
      updateStatsDisplay(currentYear);
    });
  }

  if (label) label.textContent = START_YEAR;

  const subtitle = document.getElementById('header-subtitle');
  if (subtitle) {
    const yearCount = CURRENT_YEAR - START_YEAR;
    subtitle.textContent = `${yearCount} years of Amazon rainforest loss`;
  }
}

function updateStatsDisplay(year) {
  const statsEl = document.getElementById('stats-display');
  if (!statsEl) return;

  const yearLoss = getYearlyTotal(year);
  const cumulative = CUMULATIVE_LOSS[year] || 0;
  const isDeterYear = DETER_YEARS.has(year);
  const isPendingYear = year === CURRENT_YEAR && yearLoss === 0 && !isDeterYear;

  let context = '';
  if (year === 1995) context = ' (all-time peak)';
  else if (year === 2004) context = ' (second highest)';
  else if (year === 2012) context = ' (historic low)';
  else if (year === 2019) context = ' (sharp increase)';
  else if (year === CURRENT_YEAR) {
    if (gladAlerts.length > 0) {
      const alertType = gladAlerts[0]?.type === 'fire' ? 'active fires' : 'alerts';
      context = ` (${gladAlerts.length} ${alertType} detected)`;
    } else if (isPendingYear) {
      context = ' (PRODES data pending)';
    } else {
      context = ' (current year)';
    }
  }

  let sourceNote = '';
  if (isDeterYear) {
    sourceNote = ' • DETER alerts';
  } else if (prodesFromAPI && yearLoss > 0) {
    sourceNote = ' • PRODES';
  } else if (isPendingYear) {
    sourceNote = ' • data pending';
  }

  const lossDisplay = yearLoss > 0 ? numberWithCommas(yearLoss) : '—';

  statsEl.innerHTML = `
    <span class="highlight">${lossDisplay} km²</span> deforested in ${year}${context}<br>
    Total loss since ${START_YEAR}: <span class="highlight">${numberWithCommas(cumulative)} km²</span>${sourceNote}
  `;
}

function togglePlay() {
  isPlaying = !isPlaying;

  const playBtn = document.getElementById('play-btn');

  if (playBtn) {
    if (isPlaying) {
      playBtn.innerHTML = '<span id="play-icon">⏸</span> Pause';
    } else {
      playBtn.innerHTML = '<span id="play-icon">▶</span> Play';
    }
  }

  lastYearChange = millis();
}

function refreshData() {
  showLoadingOverlay('Refreshing data...');
  isLoadingData = true;
  dataSource = 'loading';
  prodesFromAPI = false;
  gladAlerts = [];
  DETER_YEARS.clear();
  DEFORESTATION_DATA = {};
  DEFORESTATION_TOTALS = {};
  STATE_BOUNDARIES = [];
  stateBoundariesLoaded = false;
  staticBufferDirty = true;
  fetchLiveData();
}

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  if (isLoadingData) {
    alert('Please wait for data to finish loading before recording.');
    return;
  }

  // Stop any playing animation
  if (isPlaying) {
    togglePlay();
  }

  // Initialize GIF encoder
  gifRecorder = new GIF({
    workers: 2,
    quality: 10,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js'
  });

  gifRecorder.on('finished', function(blob) {
    // Download the GIF
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazon-deforestation-${START_YEAR}-${CURRENT_YEAR}.gif`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Reset state
    isRecording = false;
    updateRecordButton(false);
    hideLoadingOverlay();
  });

  gifRecorder.on('progress', function(p) {
    updateDataStatus(`Rendering GIF: ${Math.round(p * 100)}%`);
  });

  // Start recording
  isRecording = true;
  recordingYear = START_YEAR;
  recordingFrameCount = 0;
  currentYear = START_YEAR;
  updateSlider(currentYear);
  updateRecordButton(true);
  showLoadingOverlay('Recording GIF...');
}

function stopRecording() {
  if (!gifRecorder) return;

  updateDataStatus('Rendering GIF...');
  gifRecorder.render();
}

function updateRecordButton(recording) {
  const btn = document.getElementById('record-btn');
  if (!btn) return;

  if (recording) {
    btn.classList.add('recording');
    btn.innerHTML = '<span id="record-icon">⬤</span> Stop';
  } else {
    btn.classList.remove('recording');
    btn.innerHTML = '<span id="record-icon">⬤</span> Record GIF';
  }
}

function captureGifFrame() {
  if (!isRecording || !gifRecorder) return;

  // Add current frame to GIF
  const canvas = document.querySelector('#canvas-container canvas');
  if (canvas) {
    gifRecorder.addFrame(canvas, { delay: 200, copy: true });
  }

  recordingFrameCount++;

  // After capturing FRAMES_PER_YEAR frames, advance to next year
  if (recordingFrameCount >= FRAMES_PER_YEAR) {
    recordingFrameCount = 0;
    recordingYear++;

    if (recordingYear > CURRENT_YEAR) {
      // Done recording all years
      stopRecording();
    } else {
      currentYear = recordingYear;
      updateSlider(currentYear);
      const progress = ((recordingYear - START_YEAR) / (CURRENT_YEAR - START_YEAR) * 100).toFixed(0);
      updateDataStatus(`Recording: ${recordingYear} (${progress}%)`);
    }
  }
}
