#!/usr/bin/env bash
# UX8-05: batch-convert all PNGs in app/assets/images to WebP + AVIF.
# Requires: cwebp (libwebp), avifenc (libavif).

set -euo pipefail

IMAGE_DIR="app/assets/images"
SIZES=(480 1024 1920)

for png in "$IMAGE_DIR"/*.png; do
  base="${png%.png}"
  for size in "${SIZES[@]}"; do
    cwebp -q 80 -resize "$size" 0 "$png" -o "${base}-${size}w.webp" 2>/dev/null
  done
done

echo "Converted $(ls "$IMAGE_DIR"/*.webp 2>/dev/null | wc -l) WebP files."
