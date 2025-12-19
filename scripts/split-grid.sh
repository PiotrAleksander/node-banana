#!/bin/bash

# Split an image into a grid of tiles using ffmpeg
# Usage: ./split-grid.sh <input-image> <rows> <cols> [output-dir]
#
# Example: ./split-grid.sh contact-sheet.jpg 2 3 ./output

set -e

if [ $# -lt 3 ]; then
    echo "Usage: $0 <input-image> <rows> <cols> [output-dir]"
    echo ""
    echo "Arguments:"
    echo "  input-image  Path to the input image file"
    echo "  rows         Number of rows in the grid"
    echo "  cols         Number of columns in the grid"
    echo "  output-dir   Output directory (default: ./tiles)"
    echo ""
    echo "Example:"
    echo "  $0 contact-sheet.jpg 2 3 ./output"
    exit 1
fi

INPUT="$1"
ROWS="$2"
COLS="$3"
OUTPUT_DIR="${4:-./tiles}"

# Check if input file exists
if [ ! -f "$INPUT" ]; then
    echo "Error: Input file not found: $INPUT"
    exit 1
fi

# Check if ffmpeg is available
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get image dimensions using ffprobe
DIMENSIONS=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$INPUT")
WIDTH=$(echo "$DIMENSIONS" | cut -d',' -f1)
HEIGHT=$(echo "$DIMENSIONS" | cut -d',' -f2)

echo "Input image: ${WIDTH}x${HEIGHT}"
echo "Splitting into ${ROWS} rows x ${COLS} columns = $((ROWS * COLS)) tiles"

TILE_WIDTH=$((WIDTH / COLS))
TILE_HEIGHT=$((HEIGHT / ROWS))

echo "Tile size: ${TILE_WIDTH}x${TILE_HEIGHT}"

# Get base name and extension
BASENAME=$(basename "$INPUT")
NAME="${BASENAME%.*}"
EXT="${BASENAME##*.}"

TILE_NUM=1
for ((row=0; row<ROWS; row++)); do
    for ((col=0; col<COLS; col++)); do
        X=$((col * TILE_WIDTH))
        Y=$((row * TILE_HEIGHT))
        
        PADDED_NUM=$(printf "%02d" $TILE_NUM)
        OUTPUT_FILE="${OUTPUT_DIR}/${NAME}_${PADDED_NUM}.${EXT}"
        
        ffmpeg -y -v error -i "$INPUT" -vf "crop=${TILE_WIDTH}:${TILE_HEIGHT}:${X}:${Y}" "$OUTPUT_FILE"
        
        echo "  Created: $OUTPUT_FILE (row $((row + 1)), col $((col + 1)))"
        TILE_NUM=$((TILE_NUM + 1))
    done
done

echo ""
echo "Done! Created $((ROWS * COLS)) tiles in $OUTPUT_DIR"
