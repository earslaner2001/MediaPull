const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const iconIco = path.join(root, 'icon.ico');

async function main() {
  if (!fs.existsSync(iconIco)) {
    console.warn('icon.ico bulunamadi, ikon yamasi atlandi.');
    return;
  }

  if (!fs.existsSync(electronExe)) {
    console.warn('electron.exe bulunamadi, ikon yamasi atlandi.');
    return;
  }

  try {
    const { rcedit } = await import('rcedit');
    await rcedit(electronExe, { icon: iconIco });
    console.log('Electron ikonu guncellendi.');
  } catch (err) {
    console.warn('Ikon yamasi basarisiz:', err.message);
  }
}

main();
