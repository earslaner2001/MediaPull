# VDS Lisans Sunucusu - License Verification Endpoint

Bu dosya, MediaPull uygulamasının lisans bypass açığını kapatmak için VDS sunucusuna eklenmesi gereken `/api/v1/license/verify` endpoint'inin örnek implementasyonudur.

## Node.js + Express Örnek Implementasyon

```javascript
// /api/v1/license/verify endpoint
app.post('/api/v1/license/verify', async (req, res) => {
  try {
    const { token, machineId, product } = req.body;
    
    // Input validation
    if (!token || !machineId || !product) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Token, machineId ve product gerekli'
      });
    }
    
    if (product !== 'mediapull') {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Geçersiz product'
      });
    }
    
    // SECURITY: Verify JWT token signature and expiration
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('Token verification failed:', err.message);
      return res.json({
        success: true,
        valid: false,
        message: 'Token doğrulanamadı veya süresi dolmuş'
      });
    }
    
    // Check if token belongs to this machineId
    if (decodedToken.machineId !== machineId) {
      return res.json({
        success: true,
        valid: false,
        message: 'Token bu cihaz için geçerli değil'
      });
    }
    
    // Check if license is still active in database
    const license = await db.licenses.findOne({
      where: {
        token: token,
        machineId: machineId,
        product: 'mediapull',
        isActive: true
      }
    });
    
    if (!license) {
      return res.json({
        success: true,
        valid: false,
        message: 'Lisans bulunamadı veya aktif değil'
      });
    }
    
    // Check if license key is still valid (not revoked, not expired)
    const licenseKey = await db.licenseKeys.findOne({
      where: {
        key: license.licenseKey,
        isRevoked: false
      }
    });
    
    if (!licenseKey) {
      return res.json({
        success: true,
        valid: false,
        message: 'Lisans anahtarı iptal edilmiş'
      });
    }
    
    // Optional: Check expiration date
    if (licenseKey.expiresAt && new Date(licenseKey.expiresAt) < new Date()) {
      return res.json({
        success: true,
        valid: false,
        message: 'Lisans süresi dolmuş'
      });
    }
    
    // Update last verified timestamp
    await license.update({
      lastVerifiedAt: new Date()
    });
    
    // License is valid!
    return res.json({
      success: true,
      valid: true,
      message: 'Lisans geçerli',
      data: {
        plan: licenseKey.plan || 'pro',
        expiresAt: licenseKey.expiresAt || null
      }
    });
    
  } catch (error) {
    console.error('License verification error:', error);
    return res.status(500).json({
      success: false,
      valid: false,
      message: 'Sunucu hatası'
    });
  }
});
```

## Veritabanı Şeması Örneği

```sql
-- License Keys Table (Satın alınan lisanslar)
CREATE TABLE license_keys (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'pro',
  is_revoked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Licenses Table (Aktif edilmiş lisanslar)
CREATE TABLE licenses (
  id SERIAL PRIMARY KEY,
  license_key VARCHAR(255) NOT NULL,
  token TEXT NOT NULL,
  machine_id VARCHAR(64) NOT NULL,
  product VARCHAR(50) NOT NULL DEFAULT 'mediapull',
  is_active BOOLEAN DEFAULT TRUE,
  activated_at TIMESTAMP DEFAULT NOW(),
  last_verified_at TIMESTAMP NULL,
  deactivated_at TIMESTAMP NULL,
  UNIQUE(license_key, machine_id),
  FOREIGN KEY (license_key) REFERENCES license_keys(key)
);

-- Index for fast lookups
CREATE INDEX idx_licenses_token ON licenses(token);
CREATE INDEX idx_licenses_machine_id ON licenses(machine_id);
CREATE INDEX idx_licenses_active ON licenses(is_active);
```

## Güvenlik Önlemleri

### 1. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına maksimum 100 doğrulama
  message: {
    success: false,
    valid: false,
    message: 'Çok fazla doğrulama isteği. Lütfen 15 dakika bekleyin.'
  }
});

app.post('/api/v1/license/verify', verifyLimiter, async (req, res) => {
  // ... implementation
});
```

### 2. JWT Token Configuration
```javascript
const jwt = require('jsonwebtoken');

// Token oluştururken (activate endpoint'inde):
const token = jwt.sign(
  {
    licenseKey: licenseKey,
    machineId: machineId,
    product: 'mediapull',
    plan: 'pro'
  },
  process.env.JWT_SECRET,
  {
    expiresIn: '365d', // 1 yıl
    issuer: 'mediapull-license-server',
    subject: machineId
  }
);
```

### 3. Environment Variables
```bash
# .env file (VDS sunucusunda)
JWT_SECRET=<güçlü-rastgele-secret-key>
DATABASE_URL=postgresql://user:pass@localhost:5432/mediapull_licenses
NODE_ENV=production
```

## Test

### Valid Token Test
```bash
curl -X POST http://localhost:50000/api/v1/license/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "machineId": "abc123...",
    "product": "mediapull"
  }'
```

**Beklenen Cevap:**
```json
{
  "success": true,
  "valid": true,
  "message": "Lisans geçerli",
  "data": {
    "plan": "pro",
    "expiresAt": null
  }
}
```

### Invalid Token Test
```bash
curl -X POST http://localhost:50000/api/v1/license/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "sahte-token",
    "machineId": "abc123...",
    "product": "mediapull"
  }'
```

**Beklenen Cevap:**
```json
{
  "success": true,
  "valid": false,
  "message": "Token doğrulanamadı veya süresi dolmuş"
}
```

## Deployment

1. Bu kodu VDS sunucunuzdaki lisans API'sine ekleyin
2. JWT_SECRET ortam değişkenini ayarlayın
3. Veritabanı şemasını oluşturun
4. Nginx'i yeniden başlatın
5. MediaPull uygulamasını yeniden derleyin

## Güvenlik Avantajları

✅ Client tarafında `license.json` manipülasyonu artık işe yaramaz
✅ Her Pro format indirmeden önce sunucu doğrulaması yapılır
✅ Uygulama başlangıcında otomatik token doğrulaması
✅ Token süre dolumu kontrolü
✅ Lisans iptal (revoke) desteği
✅ Machine ID doğrulaması (lisans başka cihazda kullanılamaz)
✅ Rate limiting ile brute force koruması

## Offline Kullanım

Eğer kullanıcılar offline çalışabilsin istiyorsanız, cache mekanizması ekleyebilirsiniz:

```javascript
// Client tarafında (main.js):
let lastVerificationTime = 0;
const VERIFICATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat

async function isLicenseValidCached(token) {
  const now = Date.now();
  if (now - lastVerificationTime < VERIFICATION_CACHE_TTL) {
    return true; // Cache'ten kullan
  }
  
  const isValid = await verifyLicenseWithServer(token);
  if (isValid) {
    lastVerificationTime = now;
  }
  return isValid;
}
```

Bu sayede 24 saat boyunca offline çalışabilir.
