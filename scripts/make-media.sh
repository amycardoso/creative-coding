#!/bin/bash
# Record a seamlessly looping MP4 of a sketch, with its default seed.
#
# Pipeline: serve repo -> capture frames over CDP (one Chrome session) with
# the sketch's `seed` from manifest.json -> ffmpeg H.264 (CRF 20, yuv420p,
# faststart). An MP4 is about 6x smaller than the same loop as a GIF, and the
# gallery shows it as a muted looping video.
#
# Requires: the sketch must expose window.__captureFrame(i, N) (see README),
# plus node, ffmpeg and Google Chrome installed.
#
# Usage:
#   scripts/make-media.sh <slug> [frames] [fps] [size]
# Example:
#   scripts/make-media.sh calcadao 180 18 800
set -euo pipefail

SLUG="${1:?usage: make-media.sh <slug> [frames] [fps] [size]}"
FRAMES="${2:-180}"
FPS="${3:-18}"
SIZE="${4:-800}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Sketches live under sketches/<category>/<slug> or sketches/series/<series>/<slug>.
SKETCH_DIR="$(find "$ROOT/sketches" -mindepth 2 -maxdepth 3 -type d -name "$SLUG" | head -n 1)"
[ -n "$SKETCH_DIR" ] || { echo "no such sketch: $SLUG"; exit 1; }
SKETCH_PATH="${SKETCH_DIR#$ROOT/}"

PORT=8732
FRAMES_DIR="/tmp/${SLUG}_frames"
OUT="$SKETCH_DIR/$SLUG.mp4"
# Default seed from manifest.json (empty if the sketch has none).
SEED="$(node -e 'const m = require(process.argv[1]); const s = m.sketches.find((x) => x.slug === process.argv[2]); process.stdout.write(s && s.seed !== undefined ? String(s.seed) : "")' "$ROOT/manifest.json" "$SLUG")"

cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

echo "[1/3] serving repo on :$PORT"
( cd "$ROOT" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &
SERVER_PID=$!
sleep 1

echo "[2/3] capturing $FRAMES frames${SEED:+ (seed $SEED)}"
rm -rf "$FRAMES_DIR"; mkdir -p "$FRAMES_DIR"
node "$ROOT/scripts/capture-frames.mjs" \
  "http://localhost:$PORT/$SKETCH_PATH/index.html" \
  "$FRAMES_DIR" "$FRAMES" "$SIZE" "$SIZE" "$SEED"

echo "[3/3] encoding MP4 -> $OUT"
ffmpeg -y -v error -framerate "$FPS" -i "$FRAMES_DIR/f%04d.png" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" "$OUT"

SIZE_MB=$(du -m "$OUT" | cut -f1)
echo "done: $OUT (${SIZE_MB}MB, ${FRAMES}f @ ${FPS}fps)"
