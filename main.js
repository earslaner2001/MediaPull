const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const BinariesManager = require('./binaries-manager');

if (process.env.MEDIAPULL_DEV === '1') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    awaitWriteFinish: true,
    ignored: /node_modules|dist|binaries|\.git/
  });
}

let mainWindow;
let activeDownload = null;
const binariesManager = new BinariesManager();

function resolveAppIcon() {
  const candidates = process.platform === 'win32'
    ? ['icon.ico', 'icon.png']
    : ['icon.png', 'icon.ico'];
  for (const name of candidates) {
    const iconPath = path.join(__dirname, name);
    if (!fs.existsSync(iconPath)) continue;
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) return image;
  }
  return null;
}

const APP_ICON = resolveAppIcon();

function killProcessTree(proc) {
  if (!proc || proc.killed) return;
  if (process.platform === 'win32') {
    exec(`taskkill /PID ${proc.pid} /T /F`, { windowsHide: true });
  } else {
    proc.kill('SIGTERM');
  }
}

function cleanupPartFiles(logText) {
  for (const m of logText.matchAll(/\[download\]\s+Destination:\s*(.+)/g)) {
    const partPath = `${m[1].trim()}.part`;
    try {
      if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
    } catch { /* ignore */ }
  }
}
const APP_SIZE = { width: 540, height: 820, minWidth: 480, minHeight: 720 };

function isTwitterOrXUrl(url) {
  try {
    const h = new URL(url.trim()).hostname.toLowerCase();
    return h === 'twitter.com' || h === 'www.twitter.com' || h === 'mobile.twitter.com' ||
      h === 'x.com' || h === 'www.x.com';
  } catch {
    return false;
  }
}

function buildYtDlpArgs(ffmpegPath, outputTemplate, { youtube = false, twitter = false } = {}) {
  const args = [
    '--ffmpeg-location', ffmpegPath,
    '--windows-filenames',
    '--continue',
    '--retries', '10',
    '--fragment-retries', '10',
    '--concurrent-fragments', '8',
    '--http-chunk-size', '10M',
    '-o', outputTemplate
  ];

  if (youtube) {
    args.push('--remote-components', 'ejs:github');
    args.push('--js-runtimes', `node:${process.execPath}`);
  }

  if (twitter) {
    args.push('--extractor-args', 'twitter:api=syndication');
  }

  return args;
}

function extractErrorMessage(log) {
  const errors = log.split('\n').filter((line) => /^\s*ERROR:/i.test(line));
  if (errors.length) {
    return errors.map((line) => line.replace(/^\s*ERROR:\s*/i, '')).join(' ');
  }
  return log.trim().split('\n').filter(Boolean).slice(-3).join(' ');
}

function extractSavedLabel(log) {
  const merger = log.match(/\[Merger\] Merging formats into "(.+?)"/);
  if (merger) return path.basename(merger[1]);
  const destLines = [...log.matchAll(/\[download\] Destination:\s*(.+)/g)];
  if (destLines.length) return path.basename(destLines[destLines.length - 1][1].trim());
  return null;
}

function buildDownloadCommand(url, format) {
  const downloadsDir = path.join(os.homedir(), 'Downloads', 'MediaPullDownloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const outputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');
  const ytDlpPath = binariesManager.getYtDlpPath();
  const ffmpegPath = binariesManager.getFfmpegPath();
  const urlTrimmed = url.trim();
  const isTwitter = isTwitterOrXUrl(urlTrimmed);
  const args = buildYtDlpArgs(ffmpegPath, outputTemplate, { youtube: !isTwitter, twitter: isTwitter });

  if (format === 'bestaudio') {
    args.push('-f', 'bestaudio', '-x', '--audio-format', 'mp3');
  } else if (isTwitter) {
    args.push(
      '-f', 'best[protocol=https][ext=mp4]/best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
      '--merge-output-format', 'mp4'
    );
  } else {
    args.push('-f', format, '--merge-output-format', 'mp4');
  }
  args.push(urlTrimmed);

  return { ytDlpPath, args };
}

const RE_PROGRESS = /(\d{1,3}\.\d+)%\s+of\s+~?\s*([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+)(?:\s+ETA\s+(\d{2}:\d{2}))?/;
const RE_PROGRESS_DONE = /100%\s+of\s+~?\s*([\d.]+\s*\S+)/;

function spawnDownload(sender, url, format) {
  const { ytDlpPath, args } = buildDownloadCommand(url, format);
  console.log('YT-DLP:', ytDlpPath, args.join(' '));

  const proc = spawn(ytDlpPath, args, {
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });

  const session = {
    proc,
    sender,
    url,
    format,
    paused: false,
    pausing: false,
    cancelled: false,
    stderrAcc: '',
    lastPercent: -1,
    streamIndex: 0
  };
  activeDownload = session;

  function parseAndSend(chunk) {
    const lines = chunk.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const m = trimmed.match(RE_PROGRESS);
      if (m) {
        const pct = parseFloat(m[1]);
        if (pct < session.lastPercent - 2) {
          session.streamIndex++;
          sender.send('download-stream', session.streamIndex);
        }
        session.lastPercent = pct;
        sender.send('download-progress', {
          percent: pct,
          size: m[2].trim(),
          speed: m[3].trim(),
          eta: m[4] ? m[4].trim() : null,
          stream: session.streamIndex
        });
        continue;
      }
      if (RE_PROGRESS_DONE.test(trimmed)) {
        session.lastPercent = 100;
        sender.send('download-progress', { percent: 100, size: null, speed: null, eta: null, stream: session.streamIndex });
        continue;
      }
      if (/\[Merger\]/.test(trimmed)) {
        sender.send('download-phase', 'merging');
      } else if (/\[ffmpeg\]/.test(trimmed)) {
        sender.send('download-phase', 'converting');
      } else if (/\[download\]\s+Destination:/.test(trimmed)) {
        sender.send('download-phase', 'downloading');
      } else if (/\[youtube\]|\[twitter\]|\[x\]|\[info\]|\[generic\]/i.test(trimmed)) {
        sender.send('download-phase', 'analyzing');
      }

      if (!RE_PROGRESS.test(trimmed) && !RE_PROGRESS_DONE.test(trimmed)) {
        sender.send('download-log', trimmed);
      }
    }
  }

  sender.send('download-phase', 'analyzing');

  proc.stdout.on('data', (data) => { parseAndSend(data.toString()); });

  proc.stderr.on('data', (data) => {
    const text = data.toString();
    session.stderrAcc += text;
    console.error('yt-dlp stderr:', text);
    parseAndSend(text);
  });

  proc.on('error', (err) => {
    if (activeDownload !== session) return;
    if (session.pausing || session.cancelled) return;
    activeDownload = null;
    sender.send('download-error', err.message);
  });

  proc.on('close', (code) => {
    if (activeDownload !== session) return;

    if (session.pausing) {
      session.pausing = false;
      session.paused = true;
      session.proc = null;
      sender.send('download-paused');
      return;
    }

    activeDownload = null;

    if (session.cancelled) {
      cleanupPartFiles(session.stderrAcc);
      sender.send('download-cancelled');
      return;
    }

    if (code === 0) {
      const label = extractSavedLabel(session.stderrAcc) || 'Dosya';
      sender.send('download-complete', label);
    } else {
      const errTail = extractErrorMessage(session.stderrAcc);
      sender.send('download-error', errTail || `yt-dlp çıkış kodu: ${code}`);
    }
  });

  return session;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: APP_SIZE.width,
    height: APP_SIZE.height,
    minWidth: APP_SIZE.minWidth,
    minHeight: APP_SIZE.minHeight,
    autoHideMenuBar: true,
    icon: APP_ICON || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

async function checkAndDownloadBinaries() {
  const status = await binariesManager.ensureBinariesExist();
  
  if (status.needsDownload) {
    const loadingWin = new BrowserWindow({
      width: 400,
      height: 250,
      frame: false,
      transparent: true,
      icon: APP_ICON || undefined,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    loadingWin.loadFile('loading.html');

    try {
      if (!status.ytdlpExists) {
        loadingWin.webContents.send('download-status', 'yt-dlp indiriliyor...');
        await binariesManager.downloadYtDlp((progress) => {
          loadingWin.webContents.send('download-progress', { tool: 'yt-dlp', progress });
        });
      }

      if (!status.ffmpegExists) {
        loadingWin.webContents.send('download-status', 'FFmpeg indiriliyor...');
        await binariesManager.downloadFfmpeg((progress) => {
          loadingWin.webContents.send('download-progress', { tool: 'ffmpeg', progress });
        });
      }

      const verified = await binariesManager.verifyBinaries();
      if (verified) {
        loadingWin.webContents.send('download-status', 'Hazır.');
        setTimeout(() => {
          loadingWin.close();
        }, 1000);
      } else {
        throw new Error('Binary doğrulama başarısız');
      }
    } catch (error) {
      loadingWin.close();
      dialog.showErrorBox('Hata', 'Gerekli araçlar indirilemedi: ' + error.message);
      app.quit();
    }
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.mediapull.app');
  }
  if (APP_ICON && process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(APP_ICON);
  }
  await checkAndDownloadBinaries();
  createWindow();

  ipcMain.on('pause-ytdlp', () => {
    if (!activeDownload?.proc || activeDownload.paused || activeDownload.pausing) return;
    activeDownload.pausing = true;
    killProcessTree(activeDownload.proc);
  });

  ipcMain.on('resume-ytdlp', () => {
    if (!activeDownload?.paused) return;
    const { sender, url, format } = activeDownload;
    activeDownload.paused = false;
    sender.send('download-resumed');
    spawnDownload(sender, url, format);
  });

  ipcMain.on('stop-ytdlp', () => {
    if (!activeDownload) return;
    const { sender, stderrAcc, proc } = activeDownload;
    activeDownload.cancelled = true;
    if (proc) {
      killProcessTree(proc);
      return;
    }
    cleanupPartFiles(stderrAcc);
    activeDownload = null;
    sender.send('download-cancelled');
  });

  ipcMain.on('start-ytdlp', (event, url, format) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      event.sender.send('download-error', 'Geçerli bir video bağlantısı girilmedi.');
      return;
    }

    if (activeDownload?.proc) {
      activeDownload.cancelled = true;
      killProcessTree(activeDownload.proc);
    }
    activeDownload = null;

    spawnDownload(event.sender, url, format);
  });
});