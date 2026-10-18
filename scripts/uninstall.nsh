; Kaldırma sonrası temizlik scripti
!macro customUnInstall
  ; Binaries klasörünü sil (AppData/Local altında)
  RMDir /r "$LOCALAPPDATA\Programs\MediaPull\resources\binaries"
  
  ; İndirilen dosyaları sil (Downloads klasörü)
  RMDir /r "$PROFILE\Downloads\MediaPullDownloads"
  
  ; Uygulama verilerini temizle
  RMDir /r "$APPDATA\mediapull"
!macroend
