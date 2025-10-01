# Marte06 - Üye ve Ders Yönetim Sistemi

Spor salonu, yoga stüdyosu veya benzeri işletmeler için geliştirilmiş kapsamlı üye ve ders yönetim sistemi.

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Teknoloji Stack](#-teknoloji-stack)
- [Kurulum](#-kurulum)
- [Yapılandırma](#-yapılandırma)
- [Kullanım](#-kullanım)
- [Veri Modeli](#-veri-modeli)
- [Güvenlik](#-güvenlik)
- [Deployment](#-deployment)
- [Katkıda Bulunma](#-katkıda-bulunma)

## ✨ Özellikler

### Admin Özellikleri
- **Üye Yönetimi**: Üye ekleme, düzenleme, silme ve detaylı profil görüntüleme
- **Paket Yönetimi**: Esnek paket tanımlama (ders sayısı veya süre bazlı)
- **Şube Yönetimi**: Çoklu şube desteği
- **Takvim Yönetimi**: Günlük/haftalık/aylık ders programlama
- **Randevu Sistemi**: Tekrarlayan randevu oluşturma, walk-in kayıtları
- **Yoklama Takibi**: Katılım/devamsızlık işaretleme
- **Raporlama**: Üye katılım raporları, aylık/yıllık istatistikler
- **Ödeme Takibi**: Paket ödemeleri ve ödeme geçmişi
- **Doğum Günü Takibi**: Takvimde doğum günü göstergeleri

### Üye Özellikleri
- **Üye Portalı**: Kişisel dashboard
- **Paket Bilgisi**: Aktif paket ve kalan ders sayısı görüntüleme
- **Randevu Görüntüleme**: Yaklaşan dersler listesi
- **Profil Yönetimi**: Kişisel bilgileri güncelleme

### Genel Özellikler
- **Responsive Tasarım**: Mobil, tablet ve masaüstü uyumlu
- **Tema Desteği**: Light, Dark ve Forest temaları
- **Türkçe Lokalizasyon**: Tam Türkçe dil desteği
- **Türkçe Alfabetik Sıralama**: Doğru sıralama (ç, ğ, ı, ö, ş, ü)
- **Güvenli Kimlik Doğrulama**: Firebase Authentication
- **Real-time Senkronizasyon**: Firestore ile anlık veri güncellemeleri

## 🛠 Teknoloji Stack

### Frontend
- **React 19.1.0**: UI framework
- **TypeScript 5.8.3**: Type safety
- **Vite 6.3.5**: Build tool ve dev server
- **React Router DOM 7.6.0**: Client-side routing
- **TailwindCSS 4.1.11**: Utility-first CSS framework
- **React Icons 5.5.0**: Icon library

### Backend & Database
- **Firebase 11.7.1**: Backend-as-a-Service
  - Authentication: Kullanıcı kimlik doğrulama
  - Firestore: NoSQL veritabanı
  - Cloud Functions: Serverless functions
  - Hosting: Static site hosting
- **Firebase Admin 11.11.1**: Server-side SDK

### Development Tools
- **ESLint 9.25.0**: Code linting
- **PostCSS 8.5.6**: CSS processing
- **Autoprefixer 10.4.21**: CSS vendor prefixes

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+ ve npm
- Firebase CLI (`npm install -g firebase-tools`)
- Git

### Adımlar

1. **Repository'yi klonlayın:**
```bash
git clone <repository-url>
cd marte06
```

2. **Bağımlılıkları yükleyin:**
```bash
npm install
```

3. **Firebase projesini oluşturun:**
- [Firebase Console](https://console.firebase.google.com/) üzerinden yeni proje oluşturun
- Authentication'ı etkinleştirin (Email/Password provider)
- Firestore Database oluşturun (production mode)
- Web app kaydı yapın ve config bilgilerini alın

4. **Environment variables ayarlayın:**
`.env` dosyası oluşturun:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

5. **Firebase'i yapılandırın:**
```bash
firebase login
firebase init
```
- Firestore, Functions ve Hosting'i seçin
- Mevcut proje yapılandırmasını kullanın

6. **Firestore indexes oluşturun:**
```bash
firebase deploy --only firestore:indexes
```

7. **Firestore rules deploy edin:**
```bash
firebase deploy --only firestore:rules
```

8. **Development server'ı başlatın:**
```bash
npm run dev
```

Uygulama `http://localhost:5173` adresinde çalışacaktır.

## ⚙️ Yapılandırma

### Admin Kullanıcı Oluşturma

İlk admin kullanıcıyı oluşturmak için:

1. Firebase Console > Authentication > Users > Add User
2. Email ve şifre ile kullanıcı oluşturun
3. `firestore.rules` dosyasında admin email'lerini güncelleyin:

```javascript
function isAdmin() {
  return isSignedIn() && (
    request.auth.token.email == 'your-admin@email.com' ||
    request.auth.token.email == 'second-admin@email.com'
  );
}
```

4. Rules'ı deploy edin: `firebase deploy --only firestore:rules`

### Tema Değiştirme

Tema değiştirmek için `src/components/ThemeContext.tsx` kullanılır:
- Light (varsayılan)
- Dark
- Forest

## 📖 Kullanım

### Admin Paneli

1. **Giriş**: `/login` sayfasından admin email ve şifre ile giriş yapın
2. **Üye Ekleme**: Üyeler sayfasında FAB (+) butonuna tıklayın
3. **Paket Atama**: Üye detayında "Paket Ata" bölümünden paket seçin
4. **Ders Programlama**: 
   - Takvim sayfasında boş saat hücresine tıklayın
   - Üyeleri seçin ve kaydedin
5. **Yoklama**: Takvimde derse tıklayın, üyelerin yanındaki checkbox ile işaretleyin
6. **Raporlar**: Raporlar sayfasından üye bazlı veya genel raporları görüntüleyin

### Üye Portalı

1. **Giriş**: `/portal` sayfasından üye email ve şifre ile giriş yapın
2. **Dashboard**: Aktif paket bilgisi ve yaklaşan randevuları görüntüleyin
3. **Profil Güncelleme**: Ad, soyad ve telefon bilgilerini güncelleyebilirsiniz

## 🗄️ Veri Modeli

### Collections

#### `members`
```typescript
{
  id: string;
  name: string;
  surname: string;
  email?: string;
  phone?: string;
  birthDate?: Timestamp;
  memberUid?: string; // Firebase Auth UID
  parentName?: string; // 18 yaş altı için
  parentPhone?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `packages`
```typescript
{
  id: string;
  name: string;
  description?: string;
  price: number;
  lessonCount?: number; // Ders sayısı bazlı paketler için
  durationDays?: number; // Süre bazlı paketler için
  isActive: boolean;
  createdAt: Timestamp;
}
```

#### `assigned_packages`
```typescript
{
  id: string;
  memberId: string;
  memberUid?: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  totalLessonCount?: number;
  startDate: Timestamp;
  endDate?: Timestamp;
  assignedAt: Timestamp;
}
```

#### `lessons`
```typescript
{
  id: string;
  date: Timestamp;
  memberIds: string[]; // Scheduled member IDs
  memberUids: string[]; // Scheduled member UIDs
  attendedMemberIds: string[]; // Legacy
  absentMemberIds: string[]; // Absent members
  absentMemberUids: string[];
  walkInMemberIds: string[]; // Walk-in members
  walkInMemberUids: string[];
  createdAt: Timestamp;
}
```

#### `branches`
```typescript
{
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: Timestamp;
}
```

### İlişkiler

- **Member → Assigned Packages**: One-to-Many (bir üyenin birden fazla paketi olabilir)
- **Package → Assigned Packages**: One-to-Many (bir paket birden fazla üyeye atanabilir)
- **Member → Lessons**: Many-to-Many (bir üye birden fazla derse, bir ders birden fazla üyeye sahip)

## 🔒 Güvenlik

### Firestore Security Rules

- **Admin**: Tüm collection'lara okuma/yazma erişimi
- **Member**: 
  - Kendi member doc'unu okuma (UID veya email match)
  - Kendi assigned_packages'ı okuma
  - Kendi lessons'ı okuma (UID array-contains)
  - Packages'ı okuma (paket isimlerini görmek için)
  - Kendi profilinde sınırlı güncelleme (name, surname, phone)

### UID Denormalization

Güvenlik ve performans için member ID'lere ek olarak Firebase Auth UID'leri de saklanır:
- `members.memberUid`
- `assigned_packages.memberUid`
- `lessons.memberUids`, `lessons.absentMemberUids`, `lessons.walkInMemberUids`

Bu sayede Firestore rules'da `request.auth.uid` ile doğrudan kontrol yapılabilir.

### Backfill Scripts

Mevcut verilere UID eklemek için:
```bash
npm run backfill-uids
npm run backfill-uids:apply:members
npm run backfill-uids:apply:lessons
```

## 🌐 Deployment

### Production Build

```bash
npm run build
```

Build dosyaları `dist/` klasöründe oluşturulur.

### Firebase Hosting

```bash
firebase deploy --only hosting
```

### Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### Tüm Servisleri Deploy Etme

```bash
firebase deploy
```

## 📊 Scripts

- `npm run dev`: Development server
- `npm run build`: Production build
- `npm run lint`: ESLint kontrolü
- `npm run preview`: Production build preview
- `npm run create-auth-users`: Üyeler için Auth user oluşturma (dry-run)
- `npm run create-auth-users:apply`: Auth user oluşturma (apply)
- `npm run backfill-uids`: UID backfill (dry-run)
- `npm run cleanup-portal-passwords`: Portal şifrelerini temizleme

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'feat: Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📝 Lisans

Bu proje özel kullanım içindir.

## 📞 İletişim

Sorularınız için: tarabyamarte@gmail.com

---

**Not**: Bu dokümantasyon sürekli güncellenmektedir. Eksik veya hatalı bilgi için issue açabilirsiniz.
