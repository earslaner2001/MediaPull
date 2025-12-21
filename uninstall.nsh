; Kaldırma sonrası temizlik scripti
!macro customUnInstall
  ; Binaries klasörünü sil (AppData/Local altında)
  RMDir /r "$LOCALAPPDATA\Programs\Arslaner Download Express\resources\binaries"
  
  ; İndirilen dosyaları sil (Downloads klasörü)
  RMDir /r "$PROFILE\Downloads\ArslanerDownloads"
  
  ; Uygulama verilerini temizle
  RMDir /r "$APPDATA\arslaner-download-express"
!macroend
