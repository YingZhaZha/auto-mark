
import { WatermarkConfig } from '../types';

/**
 * Applies a high-visibility iOS-style red badge watermark to an image.
 */
export const applyWatermarkToImage = async (
  base64: string,
  text: string,
  config: WatermarkConfig
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Canvas context failed"));

        // Set dimensions
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Calculate dynamic sizes
        const fontSize = Math.floor(canvas.width * 0.05);
        const paddingH = fontSize * 0.8;
        const paddingV = fontSize * 0.4;
        const margin = fontSize * 0.8;
        const radius = fontSize * 0.4;

        ctx.font = `bold ${fontSize}px -apple-system, "SF Pro Text", sans-serif`;
        const textMetrics = ctx.measureText(text);
        
        const boxWidth = textMetrics.width + paddingH * 2;
        const boxHeight = fontSize + paddingV * 2;

        // Position: Bottom Left
        const x = margin;
        const y = canvas.height - boxHeight - margin;

        // Draw iOS Red Background
        ctx.fillStyle = '#FF3B30';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, boxWidth, boxHeight, radius);
        } else {
          // Fallback for older browsers
          ctx.rect(x, y, boxWidth, boxHeight);
        }
        ctx.fill();

        // Draw White Text
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, x + boxWidth / 2, y + boxHeight / 2 + (fontSize * 0.05));

        resolve(canvas.toDataURL('image/jpeg', 0.85)); // Slightly reduce quality of full image too to save export memory
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = base64;
  });
};

/**
 * Generates a VERY low-res thumbnail from a base64 image string.
 * Optimized for list performance.
 */
export const generateThumbnail = async (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // Aggressive downscaling for list performance
      // 250px is enough for a 3-column grid on mobile
      const MAX_SIZE = 250; 
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Heavily compress thumbnail (0.5 quality)
        resolve(canvas.toDataURL('image/jpeg', 0.5)); 
      } else {
        // Absolute fallback: return empty if canvas fails, NEVER return full base64
        resolve(""); 
      }
    };
    img.onerror = () => resolve(""); // Return empty on error to prevent crash
    img.src = base64;
  });
};
