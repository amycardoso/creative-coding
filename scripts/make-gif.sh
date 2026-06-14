#!/bin/bash
# Generate a high-quality, seamlessly looping GIF for a sketch.
#
# Pipeline: serve repo -> capture frames over CDP (one Chrome session) ->
# ffmpeg two-pass palette with bayer dithering (best quality/size tradeoff).
#
# Requires: the sketch must expose window.__captureFrame(i, N) (see README),
# plus ffmpeg and Google Chrome installed.
#
# Usage:
#   scripts/make-gif.sh <slug> [frames] [fps] [size]
# Example:
#   scripts/make-gif.sh calcadao 180 18 800
set -euo pipefail

SLUG="${1:?usage: make-gif.sh <slug> [frames] [fps] [size]}"
FRAMES="${2:-180}"
FPS="${3:-18}"
SIZE="${4:-800}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKETCH_DIR="$ROOT/sketches/$SLUG"
[ -d "$SKETCH_DIR" ] || { echo "no such sketch: $SKETCH_DIR"; exit 1; }

PORT=8732
FRAMES_DIR="/tmp/${SLUG}_frames"
OUT="$SKETCH_DIR/$SLUG.gif"
PALETTE="/tmp/${SLUG}_palette.png"

cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

echo "[1/3] serving repo on :$PORT"
( cd "$ROOT" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &
SERVER_PID=$!
sleep 1

echo "[2/3] capturing $FRAMES frames"
rm -rf "$FRAMES_DIR"; mkdir -p "$FRAMES_DIR"
node "$ROOT/scripts/capture-frames.mjs" \
  "http://localhost:$PORT/sketches/$SLUG/index.html" \
  "$FRAMES_DIR" "$FRAMES" "$SIZE" "$SIZE"

echo "[3/3] encoding GIF (bayer dither) -> $OUT"
# Pass 1: build an optimal 256-colour palette from the whole sequence.
ffmpeg -y -framerate "$FPS" -i "$FRAMES_DIR/f%04d.png" \
  -vf "palettegen=stats_mode=full" "$PALETTE" >/dev/null 2>&1
# Pass 2: apply it with ordered (bayer) dithering — clean gradients, small file.
ffmpeg -y -framerate "$FPS" -i "$FRAMES_DIR/f%04d.png" -i "$PALETTE" \
  -lavfi "paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  -loop 0 "$OUT" >/dev/null 2>&1

SIZE_MB=$(du -m "$OUT" | cut -f1)
echo "done: $OUT (${SIZE_MB}MB, ${FRAMES}f @ ${FPS}fps)"
