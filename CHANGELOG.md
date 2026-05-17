# Değişiklik günlüğü

## [2.0.0] — 2026-05-17

### Özet

**MediaPull** ilk ana sürüm çizgisi. Uygulama adı ve paket kimliği önceki **Arslaner Download Express** döneminden ayrılır; yapılandırma ve kurulum yolları buna göre güncellendi.

### Eklenenler

- Twitter / X: tweet veya video bağlantısından, mümkün olan en yüksek kalitede indirme (`yt-dlp`).
- Arayüz sesleri: buton tıklama ve indirme tamamlanma (`assets`).
- Windows: `build-setup.bat` ile bağımlılık + `electron-builder` kurulum paketi üretimi.
- YouTube: bağlantı doğrulama; dosya adı video başlığından otomatik; format seçiminin `yt-dlp` ile gerçekten uygulanması; Windows’ta güvenli çalıştırma (`spawn`).

### Değişenler

- **Marka:** `MediaPull`, `com.mediapull.app`, kısayol ve yükleyici metinleri.
- **İndirme klasörü:** `Downloads/MediaPullDownloads` (eski `ArslanerDownloads` otomatik taşınmaz).
- Pencere boyutu ve düzen; üst menü çubuğu varsayılan olarak gizli (`autoHideMenuBar`).
- Güvenlik politikası destek tablosu: aktif sürüm **v2.0.x**.

### Kaldırılanlar

- Genel “düz HTTP dosya indir” akışı (ana pencerede kaldırıldı); odak YouTube ve Twitter / X üzerinde.
- YouTube için elle dosya adı zorunluluğu; gereksiz dekoratif emojiler (ana arayüz).

### Kurulum ve kaldırma

- İlk çalıştırmada `yt-dlp` ve `ffmpeg` gerekirse uygulama tarafından hazırlanır.
- Kaldırıcı, `MediaPull` kurulum dizini, `MediaPullDownloads` ve `%APPDATA%\mediapull` temizliğini hedefler (`uninstall.nsh`).

### Bilinen notlar

- Eski sürümlerden kalan dosyalar `ArslanerDownloads` altında kalabilir; isteğe bağlı elle birleştirin.

[2.0.0]: https://github.com/earslaner2001/Arslaner-Download-Express/releases/tag/v2.0.0
