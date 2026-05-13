const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets');
const STORE = path.join(__dirname, '..', 'store-assets');
const SOURCE = path.join(ASSETS, 'vertical.png'); // full brand: bean + COPA CAFÉ

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const COPA_GREEN = { r: 0, g: 133, b: 66, alpha: 1 };

if (!fs.existsSync(STORE)) fs.mkdirSync(STORE);

// The vertical.png is 580×628 with the bean on top (~45%) and "COPA CAFÉ" text below.
// For the icon we want JUST the bean — crop the top portion.
async function beanOnly() {
  // Crop top 280px (bean area); horizontally tight around bean (centered around x=110, width=360)
  return await sharp(SOURCE)
    .extract({ left: 110, top: 0, width: 360, height: 285 })
    .trim({ threshold: 10 })
    .toBuffer();
}

async function fullBrand() {
  return await sharp(SOURCE).trim({ threshold: 10 }).toBuffer();
}

// Bean + "COPA" only (no "CAFÉ" subtitle)
async function brandCopa() {
  return await sharp(SOURCE)
    .extract({ left: 0, top: 0, width: 580, height: 510 })
    .trim({ threshold: 10 })
    .toBuffer();
}

async function composeIcon({ size, bg, source, leafScale, output }) {
  const buf = await source();
  const meta = await sharp(buf).metadata();
  const targetSize = Math.round(size * leafScale);
  const scale = targetSize / Math.max(meta.width, meta.height);
  const resized = await sharp(buf)
    .resize({
      width: Math.round(meta.width * scale),
      height: Math.round(meta.height * scale),
      fit: 'inside',
    })
    .toBuffer();
  const rMeta = await sharp(resized).metadata();
  const left = Math.round((size - rMeta.width) / 2);
  const top = Math.round((size - rMeta.height) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(output);

  console.log(`✓ ${path.basename(output)} (${size}×${size})`);
}

async function composeFeatureGraphic() {
  const width = 1024;
  const height = 500;

  // COPA logo (bean + "COPA") in ORIGINAL colors for the left side
  const copaLogo = await brandCopa();
  const copaMeta = await sharp(copaLogo).metadata();
  const copaTargetH = 290;
  const copaScale = copaTargetH / copaMeta.height;
  const copaResized = await sharp(copaLogo)
    .resize({
      width: Math.round(copaMeta.width * copaScale),
      height: Math.round(copaMeta.height * copaScale),
      fit: 'inside',
    })
    .toBuffer();
  const copaFinal = await sharp(copaResized).metadata();

  // Sunrise gradient: warm cream at top → mint green at bottom + decorative beans + text
  const svgScene = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sunrise" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFF4C4"/>
          <stop offset="55%" stop-color="#FFFCEB"/>
          <stop offset="100%" stop-color="#E8F5E9"/>
        </linearGradient>
        <radialGradient id="sun" cx="92%" cy="18%" r="32%">
          <stop offset="0%" stop-color="#FFD54F" stop-opacity="0.85"/>
          <stop offset="60%" stop-color="#FFD54F" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#FFD54F" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#sunrise)"/>
      <rect width="${width}" height="${height}" fill="url(#sun)"/>

      <!-- Bright yellow accent dot near headline -->
      <circle cx="570" cy="155" r="10" fill="#FFB300"/>

      <!-- Headline + sub -->
      <text x="600" y="170" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800" fill="#003D1F" letter-spacing="-1.5">Sua fazenda</text>
      <text x="600" y="235" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800" fill="#003D1F" letter-spacing="-1.5">rendendo <tspan fill="#008542">mais</tspan>.</text>
      <text x="600" y="295" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="#2E5C3E">Cotações em tempo real, lotes,</text>
      <text x="600" y="325" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="#2E5C3E">custos e muito mais — no seu bolso.</text>

      <!-- Pill-shaped CTA-style badge -->
      <rect x="600" y="370" width="240" height="52" rx="26" fill="#008542"/>
      <text x="720" y="404" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="white" text-anchor="middle">Disponível agora</text>
    </svg>
  `;

  await sharp(Buffer.from(svgScene))
    .composite([
      {
        input: copaResized,
        left: 110,
        top: Math.round((height - copaFinal.height) / 2),
      },
    ])
    .png()
    .toFile(path.join(STORE, 'feature-graphic.png'));

  console.log(`✓ feature-graphic.png (${width}×${height})`);
}

(async () => {
  // App icon (rounded square on Android home screen)
  await composeIcon({
    size: 1024,
    bg: WHITE,
    source: beanOnly,
    leafScale: 0.65,
    output: path.join(ASSETS, 'icon.png'),
  });

  // Adaptive icon: transparent bg, smaller leaf (Android crops 66% center to circle)
  await composeIcon({
    size: 1024,
    bg: { r: 255, g: 255, b: 255, alpha: 0 },
    source: beanOnly,
    leafScale: 0.5,
    output: path.join(ASSETS, 'adaptive-icon.png'),
  });

  // Splash: lots of padding (splash bg #F7FAF5 from app.json)
  await composeIcon({
    size: 1242,
    bg: { r: 255, g: 255, b: 255, alpha: 0 },
    source: beanOnly,
    leafScale: 0.4,
    output: path.join(ASSETS, 'splash-icon.png'),
  });

  // Play Store icon (bean + COPA, sem "CAFÉ")
  await composeIcon({
    size: 512,
    bg: WHITE,
    source: brandCopa,
    leafScale: 0.7,
    output: path.join(STORE, 'play-store-icon.png'),
  });

  await composeFeatureGraphic();

  console.log('\nDone. Store assets in: store-assets/');
})();
