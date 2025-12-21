const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class BinariesManager {
  constructor() {
    this.binariesDir = app.isPackaged
      ? path.join(process.resourcesPath, 'binaries')
      : path.join(__dirname, 'binaries');
    
    this.ytdlpPath = path.join(this.binariesDir, 'yt-dlp.exe');
    this.ffmpegPath = path.join(this.binariesDir, 'ffmpeg.exe');
    
    this.YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    this.FFMPEG_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
  }

  async ensureBinariesExist() {
    // Binaries klasörünü oluştur
    if (!fs.existsSync(this.binariesDir)) {
      fs.mkdirSync(this.binariesDir, { recursive: true });
    }

    const ytdlpExists = fs.existsSync(this.ytdlpPath);
    const ffmpegExists = fs.existsSync(this.ffmpegPath);

    if (!ytdlpExists || !ffmpegExists) {
      return {
        needsDownload: true,
        ytdlpExists,
        ffmpegExists
      };
    }

    return {
      needsDownload: false,
      ytdlpExists: true,
      ffmpegExists: true
    };
  }

  async downloadFile(url, outputPath, onProgress) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      
      https.get(url, (response) => {
        // Yönlendirmeleri takip et
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.close();
          fs.unlinkSync(outputPath);
          return this.downloadFile(response.headers.location, outputPath, onProgress)
            .then(resolve)
            .catch(reject);
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (onProgress && totalSize) {
            const percent = Math.floor((downloadedSize / totalSize) * 100);
            onProgress(percent);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlinkSync(outputPath);
        reject(err);
      });
    });
  }

  async downloadYtDlp(onProgress) {
    try {
      await this.downloadFile(this.YTDLP_URL, this.ytdlpPath, onProgress);
      return true;
    } catch (error) {
      console.error('yt-dlp indirme hatası:', error);
      return false;
    }
  }

  async downloadFfmpeg(onProgress) {
    try {
      const zipPath = path.join(this.binariesDir, 'ffmpeg.zip');
      
      // FFmpeg zip'i indir
      await this.downloadFile(this.FFMPEG_URL, zipPath, onProgress);
      
      // Zip'i aç ve sadece ffmpeg.exe'yi çıkar
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();
      
      // ffmpeg.exe'yi bul ve çıkar
      for (const entry of zipEntries) {
        if (entry.entryName.endsWith('bin/ffmpeg.exe')) {
          zip.extractEntryTo(entry, this.binariesDir, false, true);
          fs.renameSync(
            path.join(this.binariesDir, 'ffmpeg.exe'),
            this.ffmpegPath
          );
          break;
        }
      }
      
      // Zip dosyasını sil
      fs.unlinkSync(zipPath);
      return true;
    } catch (error) {
      console.error('FFmpeg indirme hatası:', error);
      return false;
    }
  }

  async updateYtDlp() {
    try {
      const { stdout } = await execAsync(`"${this.ytdlpPath}" -U`);
      return stdout.includes('Updated') || stdout.includes('up to date');
    } catch (error) {
      console.error('yt-dlp güncelleme hatası:', error);
      return false;
    }
  }

  getYtDlpPath() {
    return this.ytdlpPath;
  }

  getFfmpegPath() {
    return this.ffmpegPath;
  }

  async verifyBinaries() {
    try {
      // yt-dlp'yi test et
      await execAsync(`"${this.ytdlpPath}" --version`);
      
      // ffmpeg'i test et
      await execAsync(`"${this.ffmpegPath}" -version`);
      
      return true;
    } catch (error) {
      console.error('Binary doğrulama hatası:', error);
      return false;
    }
  }
}

module.exports = BinariesManager;
