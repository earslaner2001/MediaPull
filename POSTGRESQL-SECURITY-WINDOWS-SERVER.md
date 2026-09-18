# PostgreSQL Güvenlik Düzeltmesi - Windows Server 2022 🪟

## 🚨 **MEVCUT DURUM**

```
Port 5432: 🔴 AÇIK (İnternete erişilebilir)
IP: 179.61.147.59
OS: Windows Server 2022
Risk: KRİTİK
```

---

## 🚀 **HEMEN YAPILMASI GEREKENLER**

### **Yöntem 1: Windows Firewall ile Port Kapatma (ÖNERİLEN - 2 Dakika)**

#### **PowerShell ile (Yönetici Olarak Çalıştırın):**

```powershell
# RDP ile VDS'ye bağlanın
# PowerShell'i YÖNETİCİ olarak açın (Run as Administrator)

# 1. PostgreSQL port 5432'yi engelleyen kural ekle
New-NetFirewallRule -DisplayName "Block PostgreSQL Port 5432" `
    -Direction Inbound `
    -LocalPort 5432 `
    -Protocol TCP `
    -Action Block `
    -Enabled True

# 2. Kuralın eklendiğini kontrol et
Get-NetFirewallRule -DisplayName "Block PostgreSQL Port 5432"

# 3. Aktif firewall kurallarını listele
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*PostgreSQL*"}
```

#### **GUI ile (Grafik Arayüz):**

```
1. Start → Windows Defender Firewall with Advanced Security
2. Sol menüden "Inbound Rules" seç
3. Sağ tarafta "New Rule..." tıkla
4. Rule Type: "Port" seç → Next
5. Protocol: TCP seç
6. Specific local ports: 5432 yaz → Next
7. Action: "Block the connection" seç → Next
8. Profile: Tümünü işaretle (Domain, Private, Public) → Next
9. Name: "Block PostgreSQL Port 5432" → Finish
```

---

### **Yöntem 2: PostgreSQL Yapılandırması (5 Dakika)**

#### **PostgreSQL'in Sadece Localhost'tan Dinlemesi:**

```powershell
# 1. PostgreSQL veri dizinini bulun
# Varsayılan: C:\Program Files\PostgreSQL\14\data
# (Versiyon 12, 13, 14, 15 olabilir)

# 2. postgresql.conf dosyasını düzenleyin
# Yol: C:\Program Files\PostgreSQL\14\data\postgresql.conf

# Notepad ile açın:
notepad "C:\Program Files\PostgreSQL\14\data\postgresql.conf"
```

**postgresql.conf içinde değiştirin:**

```conf
# Satır ~59 civarında bulun:
# listen_addresses = '*'          # ← KÖTÜ! (Tüm IP'ler)

# Şu şekilde değiştirin:
listen_addresses = 'localhost'    # ← İYİ! (Sadece localhost)

# Kaydet ve kapat
```

**pg_hba.conf Güvenlik Ayarları:**

```powershell
# pg_hba.conf dosyasını düzenleyin
notepad "C:\Program Files\PostgreSQL\14\data\pg_hba.conf"
```

**pg_hba.conf'da kontrol edin:**

```conf
# Şu satır OLMAMALI:
# host    all    all    0.0.0.0/0    md5        ← KÖTÜ!

# Şu satırlar olmalı:
host    all    all    127.0.0.1/32    md5       ← İYİ!
host    all    all    ::1/128         md5       ← İYİ!

# Uzaktan erişim satırlarını kaldırın veya # ile yorum yapın:
# host    all    all    0.0.0.0/0    md5
```

#### **PostgreSQL Servisini Yeniden Başlatın:**

```powershell
# Services.msc'yi açın
services.msc

# VEYA PowerShell ile:
Restart-Service postgresql-x64-14
# (Servis adı: postgresql-x64-14 veya postgresql-x64-15)

# Servis durumunu kontrol et
Get-Service postgresql-x64-14
```

**GUI ile:**

```
1. Start → Services (services.msc)
2. "postgresql-x64-14" servisini bulun
3. Sağ tıklayın → Restart
4. Status: "Running" olmalı
```

---

### **Yöntem 3: Şifre Değiştirme (KRİTİK)**

#### **pgAdmin ile:**

```
1. pgAdmin 4'ü açın
2. Servers → PostgreSQL 14 → Login/Group Roles → postgres
3. Sağ tıklayın → Properties
4. Definition sekmesi
5. Password: YENİ-ÇOK-GÜÇLÜ-ŞİFRE
6. Save
```

#### **psql.exe ile (PowerShell):**

```powershell
# PostgreSQL bin dizinine gidin
cd "C:\Program Files\PostgreSQL\14\bin"

# psql ile bağlanın
.\psql.exe -U postgres

# Şifreyi değiştirin
ALTER USER postgres PASSWORD 'K9mP$zL2@vN7qR4&wT8xY3!hB6jF1nC5';

# Çıkış
\q
```

**Güçlü Şifre Üretici (PowerShell):**

```powershell
# 32 karakter rastgele şifre oluştur
-join ((48..57) + (65..90) + (97..122) + (33,35,36,37,38,42,43,45,61) | 
  Get-Random -Count 32 | ForEach-Object {[char]$_})
```

---

## 🧪 **TEST ETME**

### **Test 1: Firewall Kuralı Aktif mi?**

```powershell
# PowerShell (Yönetici):
Get-NetFirewallRule -DisplayName "Block PostgreSQL Port 5432" | 
  Select-Object DisplayName, Enabled, Direction, Action

# Beklenen:
# DisplayName: Block PostgreSQL Port 5432
# Enabled: True
# Direction: Inbound
# Action: Block
```

### **Test 2: Dışarıdan Port Erişimi (Local PC'den)**

```powershell
# Kendi bilgisayarınızdan (local PC):
Test-NetConnection -ComputerName 179.61.147.59 -Port 5432

# Beklenen:
# TcpTestSucceeded : False ✅
```

### **Test 3: Localhost Erişimi (VDS'de)**

```powershell
# VDS'de PowerShell:
cd "C:\Program Files\PostgreSQL\14\bin"
.\psql.exe -h localhost -U postgres -d licenses

# Şifre soracak ve bağlanmalı ✅
```

### **Test 4: PostgreSQL Dinleme Adresi**

```powershell
# VDS'de PowerShell (Yönetici):
netstat -ano | findstr :5432

# Beklenen:
# TCP    127.0.0.1:5432    0.0.0.0:0    LISTENING ✅
# Kötü:
# TCP    0.0.0.0:5432      0.0.0.0:0    LISTENING 🔴
```

---

## 📋 **HIZLI KOMUT LİSTESİ (Kopyala-Yapıştır)**

### **Tüm Adımları Tek PowerShell Scripti:**

```powershell
# PowerShell'i YÖNETİCİ olarak çalıştırın!

Write-Host "1. Firewall kuralı ekleniyor..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Block PostgreSQL Port 5432" `
    -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Block -Enabled True

Write-Host "2. PostgreSQL yapılandırması düzenleniyor..." -ForegroundColor Yellow
$pgVersion = "14"  # Versiyonunuzu yazın (12, 13, 14, 15)
$confPath = "C:\Program Files\PostgreSQL\$pgVersion\data\postgresql.conf"

# Backup al
Copy-Item $confPath "$confPath.backup"

# listen_addresses değiştir
(Get-Content $confPath) -replace "listen_addresses = '\*'", "listen_addresses = 'localhost'" | 
    Set-Content $confPath

Write-Host "3. PostgreSQL servisi yeniden başlatılıyor..." -ForegroundColor Yellow
Restart-Service postgresql-x64-$pgVersion

Write-Host "4. Test ediliyor..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
netstat -ano | findstr :5432

Write-Host "`n✅ Tamamlandı! Şimdi dışarıdan test edin:" -ForegroundColor Green
Write-Host "Test-NetConnection -ComputerName 179.61.147.59 -Port 5432" -ForegroundColor Cyan
Write-Host "Beklenen: TcpTestSucceeded : False" -ForegroundColor Green
```

---

## 🛡️ **EK WINDOWS GÜVENLİK ÖNERİLERİ**

### **1. Windows Defender Güvenlik Duvarı Logları**

```powershell
# Güvenlik duvarı loglarını etkinleştir
Set-NetFirewallProfile -Profile Domain,Public,Private -LogAllowed True -LogBlocked True -LogFileName "C:\Windows\System32\LogFiles\Firewall\pfirewall.log"

# Logları görüntüle
Get-Content "C:\Windows\System32\LogFiles\Firewall\pfirewall.log" -Tail 50
```

### **2. Otomatik Windows Updates**

```powershell
# Windows Update servisini kontrol et
Get-Service wuauserv

# Windows Update ayarları
Get-WindowsUpdateLog

# Otomatik güncellemeleri aktif et (GUI):
# Settings → Windows Update → Advanced options → Automatic updates: ON
```

### **3. RDP Güvenliği (Eğer Kullanıyorsanız)**

```powershell
# RDP portunu değiştir (varsayılan 3389)
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name PortNumber -Value 33890

# RDP için Network Level Authentication (NLA) zorunlu yap
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name UserAuthentication -Value 1

# RDP servisini yeniden başlat
Restart-Service TermService -Force
```

### **4. Event Log Monitoring**

```powershell
# PostgreSQL ile ilgili başarısız giriş denemelerini logla
# Event Viewer → Windows Logs → Security
# Event ID 4625: An account failed to log on

# PowerShell ile görüntüle:
Get-EventLog -LogName Security -InstanceId 4625 -Newest 50 | 
    Format-Table TimeGenerated, Message -AutoSize
```

### **5. Otomatik Backup (Task Scheduler ile)**

```powershell
# Backup scripti oluştur
$backupScript = @"
`$date = Get-Date -Format "yyyyMMdd_HHmmss"
`$backupDir = "C:\PostgreSQL_Backups"
if (-not (Test-Path `$backupDir)) { New-Item -ItemType Directory -Path `$backupDir }

cd "C:\Program Files\PostgreSQL\14\bin"
.\pg_dump.exe -U postgres -d licenses -F c -b -v -f "`$backupDir\licenses_`$date.backup"

# 7 günden eski backupları sil
Get-ChildItem `$backupDir -Filter "*.backup" | Where-Object { `$_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item
"@

Set-Content -Path "C:\Scripts\PostgreSQL_Backup.ps1" -Value $backupScript

# Task Scheduler'da günlük görev oluştur
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\Scripts\PostgreSQL_Backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "PostgreSQL Daily Backup" -Description "Daily backup of licenses database"
```

---

## 📊 **WINDOWS SERVER GÜVENLİK KONTROL LİSTESİ**

```
✅ Yapılacaklar:
[ ] Firewall kuralı: Port 5432 engellensin
[ ] PostgreSQL: listen_addresses = 'localhost'
[ ] PostgreSQL: pg_hba.conf temizlensin (0.0.0.0/0 kaldırılsın)
[ ] Güçlü PostgreSQL şifresi belirlensin
[ ] Windows Updates aktif olsun
[ ] Event Log monitoring aktif olsun
[ ] Otomatik backup sistemi kurulsun
[ ] RDP portu değiştirilsin (opsiyonel)
[ ] RDP NLA aktif olsun
[ ] Windows Defender aktif olsun
```

---

## 🎯 **ÖNCELIK SIRASI**

### **ŞİMDİ (2 dakika):**
```powershell
# Firewall kuralı ekle
New-NetFirewallRule -DisplayName "Block PostgreSQL Port 5432" `
    -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Block -Enabled True
```

### **BUGÜN (10 dakika):**
```
1. PostgreSQL yapılandırması (listen_addresses)
2. Güçlü şifre belirle
3. Test et
```

### **BU HAFTA:**
```
1. Backup sistemi kur
2. Event log monitoring
3. RDP güvenliği sıkılaştır
```

---

## 💡 **WINDOWS-SPECIFIC NOTLAR**

### **PostgreSQL Servis İsimleri:**

```
PostgreSQL 12: postgresql-x64-12
PostgreSQL 13: postgresql-x64-13
PostgreSQL 14: postgresql-x64-14
PostgreSQL 15: postgresql-x64-15
```

### **PostgreSQL Dizinleri:**

```
Program: C:\Program Files\PostgreSQL\{version}\
Data: C:\Program Files\PostgreSQL\{version}\data\
Config: C:\Program Files\PostgreSQL\{version}\data\postgresql.conf
HBA: C:\Program Files\PostgreSQL\{version}\data\pg_hba.conf
Bin: C:\Program Files\PostgreSQL\{version}\bin\
```

### **Windows Firewall Profilleri:**

```
Domain: Domain ağlarında
Private: Özel ağlarda (güvenli)
Public: Genel ağlarda (güvensiz)

Hepsinde 5432 engellenmelidir!
```

---

## 📞 **ÖZET**

**OS:** Windows Server 2022  
**Sorun:** Port 5432 internete açık 🔴  
**Çözüm Süresi:** 2 dakika (Firewall) + 10 dakika (PostgreSQL yapılandırması)  

**En Hızlı Çözüm (PowerShell Yönetici):**
```powershell
New-NetFirewallRule -DisplayName "Block PostgreSQL Port 5432" -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Block -Enabled True
```

**Test:**
```powershell
Test-NetConnection -ComputerName 179.61.147.59 -Port 5432
# Beklenen: TcpTestSucceeded : False ✅
```

Düzeltmeyi yaptıktan sonra tekrar test edin! 🚀
