const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const buildOutputConfig = path.join(root, '.build-output-path.json');

function sleepMs(ms) {
  try {
    execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, {
      stdio: 'ignore',
      windowsHide: true
    });
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) { /* noop */ }
  }
}

function tryRemoveDist() {
  if (!fs.existsSync(dist)) return true;

  for (let i = 0; i < 8; i++) {
    try {
      fs.rmSync(dist, {
        recursive: true,
        force: true,
        maxRetries: 6,
        retryDelay: 500
      });
      return true;
    } catch (err) {
      const locked = err && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'ENOTEMPTY');
      if (!locked) throw err;
      sleepMs(900);
    }
  }
  return false;
}

function useAlternateOutputDir() {
  const altName = `dist-build-${Date.now()}`;
  fs.writeFileSync(buildOutputConfig, JSON.stringify({
    output: altName,
    reason: 'locked-dist',
    lockedPath: dist
  }, null, 2), 'utf8');
  console.warn('');
  console.warn('dist klasoru kilitli (app.asar kullaniliyor).');
  console.warn(`Build yeni klasore yazilacak: ${altName}\\`);
  console.warn('Eski dist\\ klasorunu kapattiktan sonra elle silebilirsiniz.');
  console.warn('(MediaPull, Explorer, antivirus taramasi kilitleyebilir.)');
  console.warn('');
}

if (fs.existsSync(buildOutputConfig)) {
  try { fs.unlinkSync(buildOutputConfig); } catch { /* ignore */ }
}

if (tryRemoveDist()) {
  console.log('dist temizlendi.');
  process.exit(0);
}

useAlternateOutputDir();
process.exit(0);
