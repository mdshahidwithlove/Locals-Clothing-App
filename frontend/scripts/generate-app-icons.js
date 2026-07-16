/**
 * Generates app icons and syncs splash assets into the existing android/ folder.
 * Does NOT run expo prebuild.
 *
 * Run: node scripts/generate-app-icons.js
 */
const fs = require('fs');
const path = require('path');
const parsePng = require('parse-png');
const {
  generateImageAsync,
  generateImageBackgroundAsync,
  compositeImagesAsync,
} = require('@expo/image-utils');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets/images/locals-logo.png');
const OUT_DIR = path.join(ROOT, 'assets/images');
const ANDROID_RES = path.join(ROOT, 'android/app/src/main/res');
const CANVAS = 1024;
const LOGO_SCALE = 0.62;
/** Smaller than app icon — Android splash scales the drawable to ~240dp */
const SPLASH_LOGO_SCALE = 0.58;
const BG = '#FFD21F';

/** Must match the sizes already present under android/app/src/main/res */
const ANDROID_SPLASH_SIZES = {
  'drawable-mdpi': 288,
  'drawable-hdpi': 432,
  'drawable-xhdpi': 576,
  'drawable-xxhdpi': 864,
  'drawable-xxxhdpi': 1152,
};

async function getPngSize(buffer) {
  const { width, height } = await parsePng(buffer);
  return { width, height };
}

async function buildPaddedIcon(name, logoSize, backgroundColor = BG) {
  const logoPx = Math.round(CANVAS * logoSize);
  const fgName = `${path.basename(name, '.png')}-fg-${logoPx}.png`;

  const { source: logo } = await generateImageAsync(
    { projectRoot: ROOT, cacheType: 'none' },
    {
      src: SRC,
      width: logoPx,
      height: logoPx,
      resizeMode: 'contain',
      backgroundColor: 'transparent',
      name: fgName,
    },
  );

  const { width: fgWidth, height: fgHeight } = await getPngSize(logo);
  const x = Math.round((CANVAS - fgWidth) / 2);
  const y = Math.round((CANVAS - fgHeight) / 2);

  const background = await generateImageBackgroundAsync({
    width: CANVAS,
    height: CANVAS,
    backgroundColor,
  });

  const composed = await compositeImagesAsync({
    background,
    foreground: logo,
    x,
    y,
  });

  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, composed);
  console.log('Wrote', outPath, `(${fgWidth}x${fgHeight} centered at ${x},${y})`);
}

async function buildAdaptiveForeground() {
  const logoPx = Math.round(CANVAS * LOGO_SCALE);
  const fgName = `adaptive-icon-foreground-${logoPx}.png`;

  const { source: logo } = await generateImageAsync(
    { projectRoot: ROOT, cacheType: 'none' },
    {
      src: SRC,
      width: logoPx,
      height: logoPx,
      resizeMode: 'contain',
      backgroundColor: 'transparent',
      name: fgName,
    },
  );

  const { width: fgWidth, height: fgHeight } = await getPngSize(logo);
  const x = Math.round((CANVAS - fgWidth) / 2);
  const y = Math.round((CANVAS - fgHeight) / 2);

  const background = await generateImageBackgroundAsync({
    width: CANVAS,
    height: CANVAS,
    backgroundColor: 'transparent',
  });

  const composed = await compositeImagesAsync({
    background,
    foreground: logo,
    x,
    y,
  });

  const outPath = path.join(OUT_DIR, 'adaptive-icon-foreground.png');
  fs.writeFileSync(outPath, composed);
  console.log('Wrote', outPath, `(${fgWidth}x${fgHeight} centered at ${x},${y})`);
}

/** Splash: small centered logo on yellow canvas (avoids overflow on device). */
async function buildSplashIcon() {
  const logoPx = Math.round(CANVAS * SPLASH_LOGO_SCALE);
  const fgName = `splash-icon-fg-${logoPx}.png`;

  const { source: logo } = await generateImageAsync(
    { projectRoot: ROOT, cacheType: 'none' },
    {
      src: SRC,
      width: logoPx,
      height: logoPx,
      resizeMode: 'contain',
      backgroundColor: 'transparent',
      name: fgName,
    },
  );

  const { width: fgWidth, height: fgHeight } = await getPngSize(logo);
  const x = Math.round((CANVAS - fgWidth) / 2);
  const y = Math.round((CANVAS - fgHeight) / 2);

  const background = await generateImageBackgroundAsync({
    width: CANVAS,
    height: CANVAS,
    backgroundColor: BG,
  });

  const composed = await compositeImagesAsync({
    background,
    foreground: logo,
    x,
    y,
  });

  const outPath = path.join(OUT_DIR, 'splash-icon.png');
  fs.writeFileSync(outPath, composed);
  console.log('Wrote', outPath, `(${fgWidth}x${fgHeight} centered at ${x},${y})`);
  return outPath;
}

async function syncAndroidSplashDrawables(splashPath) {
  if (!fs.existsSync(ANDROID_RES)) {
    console.warn('Skipped android splash sync — android/app/src/main/res not found');
    return;
  }

  for (const [folder, size] of Object.entries(ANDROID_SPLASH_SIZES)) {
    const { source } = await generateImageAsync(
      { projectRoot: ROOT, cacheType: 'none' },
      {
        src: splashPath,
        width: size,
        height: size,
        resizeMode: 'contain',
        backgroundColor: BG,
        name: `android-splash-${size}.png`,
      },
    );

    const dir = path.join(ANDROID_RES, folder);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, 'splashscreen_logo.png');
    fs.writeFileSync(out, source);
    console.log('Synced', out);
  }
}

async function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Missing source logo: ${SRC}`);
  }

  await buildPaddedIcon('app-icon.png', LOGO_SCALE);
  await buildAdaptiveForeground();
  const splashPath = await buildSplashIcon();
  await syncAndroidSplashDrawables(splashPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
