// Maré — one lunar month of real tide at Porto de Itaqui, São Luís (MA),
// drawn as a spiral: one turn = one lunar day (24 h 50 min), ~29.5 turns.
//
// Tidal harmonic constituents (amplitude in meters, angular speed in deg/hour,
// phase lag in degrees) after the FEMAR / Marinha do Brasil tide-station
// catalog values for the Itaqui station. h(t) = Σ Aᵢ·cos(ωᵢ·t − φᵢ).
const CONSTITUENTS = [
  { name: "M2", amp: 2.05, speed: 28.9841042, phase: 300 },
  { name: "S2", amp: 0.65, speed: 30.0000000, phase: 335 },
  { name: "N2", amp: 0.40, speed: 28.4397295, phase: 285 },
  { name: "K1", amp: 0.11, speed: 15.0410686, phase: 190 },
  { name: "O1", amp: 0.08, speed: 13.9430356, phase: 170 },
  { name: "M4", amp: 0.06, speed: 57.9682084, phase:  30 },
];

const LUNAR_DAY_H = 24.8412;          // one spiral turn, hours
const DAYS = 29.5;                    // one synodic month of turns
const TOTAL_H = DAYS * LUNAR_DAY_H;   // ~732.8 simulated hours
const MAX_AMP = CONSTITUENTS.reduce((s, c) => s + c.amp, 0); // theoretical max |h|

function tideHeight(hours) {
  let h = 0;
  for (const c of CONSTITUENTS) {
    h += c.amp * Math.cos(((c.speed * hours - c.phase) * Math.PI) / 180);
  }
  return h;
}
