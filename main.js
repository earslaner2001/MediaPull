const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
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
const binariesManager = new BinariesManager();
const APP_SIZE = { width: 540, height: 720, minWidth: 480, minHeight: 640 };

function isTwitterOrXUrl(url) {
  try {
    const h = new URL(url.trim()).hostname.toLowerCase();
    return h === 'twitter.com' || h === 'www.twitter.com' || h === 'mobile.twitter.com' ||
      h === 'x.com' || h === 'www.x.com';
  } catch {
    return false;
  }
}

function buildYtDlpArgs(ffmpegPath, outputTemplate) {
  return [
    '--ffmpeg-location', ffmpegPath,
    '--windows-filenames',
    '--remote-components', 'ejs:github',
    '--js-runtimes', `node:${process.execPath}`,
    '-o', outputTemplate
  ];
}

function extractErrorMessage(log) {
  const errors = log.split('\n').filter((line) => /^\s*ERROR:/i.test(line));
  if (errors.length) {
    return errors.map((line) => line.replace(/^\s*ERROR:\s*/i, '')).join(' ');
  }
  return log.trim().split('\n').filter(Boolean).slice(-3).join(' ');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: APP_SIZE.width,
    height: APP_SIZE.height,
    minWidth: APP_SIZE.minWidth,
    minHeight: APP_SIZE.minHeight,
    autoHideMenuBar: true,
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
  await checkAndDownloadBinaries();
  createWindow();

  ipcMain.on('start-ytdlp', (event, url, format) => {
    if (!url || typeof url !== "string" || url.trim() === "") {
      event.sender.send('download-error', 'Geçerli bir video bağlantısı girilmedi.');
      return;
    }

    const downloadsDir = path.join(os.homedir(), 'Downloads', 'MediaPullDownloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const outputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');
    const ytDlpPath = binariesManager.getYtDlpPath();
    const ffmpegPath = binariesManager.getFfmpegPath();

    const urlTrimmed = url.trim();
    const args = buildYtDlpArgs(ffmpegPath, outputTemplate);

    if (format === 'bestaudio') {
      args.push('-f', 'bestaudio', '-x', '--audio-format', 'mp3');
    } else if (isTwitterOrXUrl(urlTrimmed)) {
      args.push(
        '-f', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4'
      );
    } else {
      args.push('-f', format, '--merge-output-format', 'mp4');
    }
    args.push(urlTrimmed);

    console.log('YT-DLP:', ytDlpPath, args.join(' '));

    const proc = spawn(ytDlpPath, args, {
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });

    let stderrAcc = '';
    let lastPercent = -1;  // geri gidişi önlemek için
    let streamIndex = 0;   // kaçıncı akış indiriliyor (video=0, ses=1)

    const RE_PROGRESS      = /(\d{1,3}\.\d+)%\s+of\s+~?\s*([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+)(?:\s+ETA\s+(\d{2}:\d{2}))?/;
    const RE_PROGRESS_DONE = /100%\s+of\s+~?\s*([\d.]+\s*\S+)/;

    function parseAndSend(chunk) {
      const lines = chunk.split('\n');
      for (const line of lines) {
        const m = line.match(RE_PROGRESS);
        if (m) {
          const pct = parseFloat(m[1]);
          // Yüzde önceki değerden küçükse yeni bir akış başladı (ses/video)
          if (pct < lastPercent - 2) {
            streamIndex++;
            event.sender.send('download-stream', streamIndex);
          }
          lastPercent = pct;
          event.sender.send('download-progress', {
            percent: pct,
            size: m[2].trim(),
            speed: m[3].trim(),
            eta: m[4] ? m[4].trim() : null,
            stream: streamIndex
          });
          continue;
        }
        if (RE_PROGRESS_DONE.test(line)) {
          lastPercent = 100;
          event.sender.send('download-progress', { percent: 100, size: null, speed: null, eta: null, stream: streamIndex });
          continue;
        }
        if (/\[Merger\]/.test(line)) {
          event.sender.send('download-phase', 'merging');
          continue;
        }
        if (/\[ffmpeg\]/.test(line)) {
          event.sender.send('download-phase', 'converting');
          continue;
        }
        if (/\[download\]\s+Destination:/.test(line)) {
          event.sender.send('download-phase', 'downloading');
          continue;
        }
        if (/\[youtube\]|\[twitter\]|\[x\]|\[info\]|\[generic\]/i.test(line)) {
          event.sender.send('download-phase', 'analyzing');
        }
      }
    }

    function extractSavedLabel(log) {
      const merger = log.match(/\[Merger\] Merging formats into "(.+?)"/);
      if (merger) return path.basename(merger[1]);
      const destLines = [...log.matchAll(/\[download\] Destination:\s*(.+)/g)];
      if (destLines.length) return path.basename(destLines[destLines.length - 1][1].trim());
      return null;
    }

    event.sender.send('download-phase', 'analyzing');

    proc.stdout.on('data', (data) => { parseAndSend(data.toString()); });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderrAcc += text;
      console.error('yt-dlp stderr:', text);
      parseAndSend(text);
    });

    proc.on('error', (err) => {
      event.sender.send('download-error', err.message);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const label = extractSavedLabel(stderrAcc) || 'Dosya';
        event.sender.send('download-complete', label);
      } else {
        const errTail = extractErrorMessage(stderrAcc);
        event.sender.send(
          'download-error',
          errTail || `yt-dlp çıkış kodu: ${code}`
        );
      }
    });
  });
});