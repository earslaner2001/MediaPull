# PostgreSQL Servisini Bulma ve Yönetme - Windows Server 2022

## 🔍 PostgreSQL Servisini Bulma

### **Yöntem 1: Tüm PostgreSQL Servislerini Listele**

```powershell
# PowerShell (Yönetici):
Get-Service | Where-Object {$_.Name -like "*postgres*"}
```

**Veya:**

```powershell
Get-Service | Where-Object {$_.DisplayName -like "*PostgreSQL*"}
```

### **Yöntem 2: Services.msc ile Görsel Olarak Bul**

```
1. Win + R → services.msc
2. Aşağı kaydırarak "PostgreSQL" içeren servisleri bulun
3. Servis adını not edin
```

---

## 🔧 Olası PostgreSQL Servis İsimleri

```
postgresql-x64-12
postgresql-x64-13
postgresql-x64-14
postgresql-x64-15
postgresql-x64-16
PostgreSQL
PostgreSQL 14 Server
PostgreSQL 15 Server
```

---

## 🚀 Servis İsmini Bulduktan Sonra

### **Servisi Yeniden Başlat:**

```powershell
# Gerçek servis adını buraya yazın:
Restart-Service "GERÇEK-SERVİS-ADI"

# Örnek:
Restart-Service "PostgreSQL 14 Server"
```

### **Servis Durumunu Kontrol Et:**

```powershell
Get-Service "GERÇEK-SERVİS-ADI" | Select-Object Name, Status, DisplayName
```

---

## 📋 HIZLI KOMUT

PostgreSQL servisini bulup yeniden başlatmak için:

```powershell
# 1. Servisi bul ve göster
$pgService = Get-Service | Where-Object {$_.DisplayName -like "*PostgreSQL*"}
$pgService | Select-Object Name, DisplayName, Status

# 2. Bulduğun servisin adını kullanarak yeniden başlat
# Örnek: Eğer Name "postgresql-x64-15" ise:
Restart-Service $pgService.Name

# VEYA doğrudan:
Get-Service | Where-Object {$_.DisplayName -like "*PostgreSQL*"} | Restart-Service
```

---

## 🎯 ADIM ADIM

### **Adım 1: Servisi Bul**

```powershell
PS C:\Users\Administrator> Get-Service | Where-Object {$_.DisplayName -like "*PostgreSQL*"}

# Çıktı örneği:
# Status   Name               DisplayName
# ------   ----               -----------
# Running  postgresql-x64-15  postgresql-x64-15 - PostgreSQL Server 15
```

### **Adım 2: Servis Adını Kopyala**

Yukarıdaki çıktıda **Name** sütunundaki değeri kullanın.

### **Adım 3: Yeniden Başlat**

```powershell
# Örnek (sizin servis adınızı yazın):
Restart-Service "postgresql-x64-15"
```

---

## 💡 ALTERNATIF: GUI İle Yeniden Başlatma

```
1. Win + R → services.msc → Enter
2. "PostgreSQL" içeren servisi bulun
3. Sağ tıklayın → Restart
```

---

## ✅ KONTROL

```powershell
# Servis çalışıyor mu?
Get-Service | Where-Object {$_.DisplayName -like "*PostgreSQL*"} | Select-Object Name, Status

# Beklenen:
# Status: Running ✅
```

---

## 🔍 PostgreSQL Kurulu Değilse?

Eğer hiçbir PostgreSQL servisi bulunamazsa:

```powershell
# PostgreSQL kurulu mu kontrol et
Test-Path "C:\Program Files\PostgreSQL"

# Eğer False dönerse:
# PostgreSQL kurulu DEĞİL!
```

**Olasılıklar:**
1. PostgreSQL farklı bir yola kurulu
2. PostgreSQL kurulu değil (MongoDB, MySQL gibi farklı DB kullanılıyor)
3. PostgreSQL portable olarak çalışıyor

**Hangi veritabanı kullanıldığını kontrol et:**

```powershell
# Tüm veritabanı servislerini listele
Get-Service | Where-Object {
    $_.DisplayName -like "*SQL*" -or 
    $_.DisplayName -like "*Database*" -or
    $_.DisplayName -like "*Mongo*" -or
    $_.DisplayName -like "*Maria*"
}
```
