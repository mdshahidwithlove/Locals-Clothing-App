const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

const dir = 'c:/X-DATA/Chirag Sekhar/zomato-clothing/frontend/assets/images/';

// Function to draw crisp, ultra-bold, modern "Locals" typography
function createLocalsLogo(width, height, isSolidYellowBg) {
  const png = new PNG({ width, height });
  
  // Fill background
  const bgR = 255, bgG = 210, bgB = 31, bgA = isSolidYellowBg ? 255 : 0;
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = bgR;
    png.data[i + 1] = bgG;
    png.data[i + 2] = bgB;
    png.data[i + 3] = bgA;
  }

  // Draw pixel helper (with anti-aliasing)
  function setPixel(x, y, colorR, colorG, colorB, alpha = 255) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= width || iy < 0 || iy >= height) return;
    const idx = (iy * width + ix) * 4;
    
    if (alpha === 255) {
      png.data[idx] = colorR;
      png.data[idx + 1] = colorG;
      png.data[idx + 2] = colorB;
      png.data[idx + 3] = 255;
    } else {
      const srcA = alpha / 255;
      const dstA = png.data[idx + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        png.data[idx] = Math.round((colorR * srcA + png.data[idx] * dstA * (1 - srcA)) / outA);
        png.data[idx + 1] = Math.round((colorG * srcA + png.data[idx + 1] * dstA * (1 - srcA)) / outA);
        png.data[idx + 2] = Math.round((colorB * srcA + png.data[idx + 2] * dstA * (1 - srcA)) / outA);
        png.data[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  function drawRect(x, y, w, h) {
    for (let r = Math.floor(y); r < Math.floor(y + h); r++) {
      for (let c = Math.floor(x); c < Math.floor(x + w); c++) {
        setPixel(c, r, 0, 0, 0, 255);
      }
    }
  }

  function drawCircleRing(cx, cy, rOuter, thickness) {
    const rInner = rOuter - thickness;
    for (let r = Math.floor(cy - rOuter - 2); r <= Math.floor(cy + rOuter + 2); r++) {
      for (let c = Math.floor(cx - rOuter - 2); c <= Math.floor(cx + rOuter + 2); c++) {
        const dx = c - cx;
        const dy = r - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= rOuter && dist >= rInner) {
          // Antialiasing edge
          let alpha = 255;
          if (rOuter - dist < 1) alpha = Math.floor(255 * (rOuter - dist));
          else if (dist - rInner < 1) alpha = Math.floor(255 * (dist - rInner));
          setPixel(c, r, 0, 0, 0, Math.max(0, Math.min(255, alpha)));
        }
      }
    }
  }

  // Define letter geometry centered in the canvas
  // Overall text width ~600px, height ~160px
  const startX = (width - 580) / 2;
  const startY = (height - 150) / 2;
  const stroke = 32;

  // L
  drawRect(startX, startY, stroke, 150);
  drawRect(startX, startY + 150 - stroke, 75, stroke);

  // o
  drawCircleRing(startX + 135, startY + 80, 55, stroke);

  // c
  const cx = startX + 250, cy = startY + 80;
  drawCircleRing(cx, cy, 55, stroke);
  // Cut out right side of 'c'
  for (let r = Math.floor(cy - 30); r <= Math.floor(cy + 30); r++) {
    for (let c = Math.floor(cx + 15); c <= Math.floor(cx + 65); c++) {
      setPixel(c, r, bgR, bgG, bgB, bgA);
    }
  }

  // a
  const ax = startX + 355;
  drawCircleRing(ax, startY + 95, 40, stroke);
  drawRect(ax + 20, startY + 30, stroke, 110);

  // l
  const lx = startX + 440;
  drawRect(lx, startY, stroke, 150);

  // s
  const sx = startX + 505;
  drawRect(sx, startY + 30, 65, stroke); // Top bar
  drawRect(sx, startY + 30, stroke, 50); // Top left
  drawRect(sx, startY + 70, 65, stroke); // Mid bar
  drawRect(sx + 65 - stroke, startY + 70, stroke, 50); // Bot right
  drawRect(sx, startY + 110, 65, stroke); // Bot bar

  return PNG.sync.write(png);
}

// Generate files
fs.writeFileSync(path.join(dir, 'app-icon.png'), createLocalsLogo(1024, 1024, true));
fs.writeFileSync(path.join(dir, 'adaptive-icon-foreground.png'), createLocalsLogo(1024, 1024, false));
fs.writeFileSync(path.join(dir, 'splash-icon.png'), createLocalsLogo(1024, 1024, false));

console.log('Successfully generated app-icon.png, adaptive-icon-foreground.png, and splash-icon.png');
