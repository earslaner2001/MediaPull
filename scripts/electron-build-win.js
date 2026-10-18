const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const buildOutputConfig = path.join(root, '.build-output-path.json');

let outputDir = 'dist';
let cfg = null;

if (fs.existsSync(buildOutputConfig)) {
  try {
    cfg = JSON.parse(fs.readFileSync(buildOutputConfig, 'utf8'));
    if (cfg && typeof cfg.output === 'string' && cfg.output.trim()) {
      outputDir = cfg.output.trim();
    }
  } catch (err) {
    console.warn('Build output config okunamadi:', err.message);
  }
}

const args = ['electron-builder', '--win', `--config.directories.output=${outputDir}`];

try {
  execSync(`npx ${args.map((a) => `"${a}"`).join(' ')}`, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    windowsHide: true
  });
} finally {
  if (fs.existsSync(buildOutputConfig)) {
    try { fs.unlinkSync(buildOutputConfig); } catch { /* ignore */ }
  }
}

if (cfg?.reason === 'locked-dist') {
  console.log('');
  console.log(`Kurulum dosyasi: ${path.join(root, outputDir)}`);
  console.log('Eski kilitli dist\\ klasorunu daha sonra silebilirsiniz.');
}
