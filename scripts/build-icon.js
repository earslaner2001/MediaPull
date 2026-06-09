const path = require('path');
const fs = require('fs');
const { PNG } = require('pngjs');

const root = path.join(__dirname, '..');
const assetSrc = path.join(
  process.env.USERPROFILE || '',
  '.cursor', 'projects', 'c-Users-user-Documents-GitHub-Arslaner-Download-Express', 'assets', 'icon.png'
);
const outPng = path.join(root, 'icon.png');
const outIco = path.join(root, 'icon.ico');

function readPng(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(new PNG())
      .on('parsed', function () { resolve(this); })
      .on('error', reject);
  });
}

function writePng(png, filePath) {
  return new Promise((resolve, reject) => {
    png.pack()
      .pipe(fs.createWriteStream(filePath))
      .on('finish', resolve)
      .on('error', reject);
  });
}

function cropSquareAndResize(src, size) {
  const side = Math.min(src.width, src.height);
  const sx = Math.floor((src.width - side) / 2);
  const sy = Math.floor((src.height - side) / 2);
  const out = new PNG({ width: size, height: size });

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const srcX = sx + Math.floor((x / size) * side);
      const srcY = sy + Math.floor((y / size) * side);
      const srcIdx = (src.width * srcY + srcX) << 2;
      const dstIdx = (size * y + x) << 2;
      out.data[dstIdx] = src.data[srcIdx];
      out.data[dstIdx + 1] = src.data[srcIdx + 1];
      out.data[dstIdx + 2] = src.data[srcIdx + 2];
      out.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }

  return out;
}

function verifyIco(filePath) {
  const buf = fs.readFileSync(filePath);
  const count = buf.readUInt16LE(4);
  let max = 0;
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16;
    const w = buf[o] === 0 ? 256 : buf[o];
    const h = buf[o + 1] === 0 ? 256 : buf[o + 1];
    max = Math.max(max, w, h);
  }
  return { count, max };
}

async function main() {
  const srcPath = [assetSrc, outPng].find((p) => fs.existsSync(p));
  if (!srcPath) {
    console.error('Kaynak icon bulunamadi.');
    process.exit(1);
  }

  const src = await readPng(srcPath);
  const png256 = cropSquareAndResize(src, 256);
  await writePng(png256, outPng);

  const { default: pngToIco } = await import('png-to-ico');
  const ico = await pngToIco(outPng);
  fs.writeFileSync(outIco, ico);

  const info = verifyIco(outIco);
  if (info.max < 256) {
    console.error(`icon.ico gecersiz: max boyut ${info.max}px (en az 256 gerekli)`);
    process.exit(1);
  }

  console.log(`icon.png (256x256) ve icon.ico (${info.count} katman, max ${info.max}px) hazir.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
