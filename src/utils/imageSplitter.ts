/**
 * Split an image into a grid of tiles using Canvas API
 * Returns tiles in row-major order (left to right, top to bottom)
 */

export interface TileMetadata {
  row: number;
  col: number;
  index: number;
  crop: { x: number; y: number; width: number; height: number };
  sourceWidth: number;
  sourceHeight: number;
}

export interface TileOutput {
  handleId: string;
  imageBase64: string;
  metadata: TileMetadata;
}

export async function splitImageIntoTiles(
  imageBase64: string,
  rows: number,
  columns: number
): Promise<TileOutput[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const { width: W, height: H } = img;

        // Calculate base tile dimensions
        const tw = Math.floor(W / columns);
        const th = Math.floor(H / rows);

        // Calculate remainders
        const rw = W - tw * columns;
        const rh = H - th * rows;

        const tiles: TileOutput[] = [];

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < columns; col++) {
            const index = row * columns + col;

            // Calculate tile position and dimensions
            const x = col * tw;
            const y = row * th;

            // Last column/row gets extra pixels from remainder
            const tileWidth = col === columns - 1 ? tw + rw : tw;
            const tileHeight = row === rows - 1 ? th + rh : th;

            // Create canvas for this tile
            const canvas = document.createElement("canvas");
            canvas.width = tileWidth;
            canvas.height = tileHeight;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              throw new Error("Failed to get 2D context");
            }

            // Draw the tile portion of the source image
            ctx.drawImage(
              img,
              x,
              y,
              tileWidth,
              tileHeight, // source rect
              0,
              0,
              tileWidth,
              tileHeight // dest rect
            );

            // Convert to base64 PNG
            const tileBase64 = canvas.toDataURL("image/png");

            tiles.push({
              handleId: `tile-${index}`,
              imageBase64: tileBase64,
              metadata: {
                row,
                col,
                index,
                crop: { x, y, width: tileWidth, height: tileHeight },
                sourceWidth: W,
                sourceHeight: H,
              },
            });
          }
        }

        resolve(tiles);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = imageBase64;
  });
}
