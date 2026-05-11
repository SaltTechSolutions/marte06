# Marte Design System

## 🎨 Genel Bakış

Bu design system, Marte uygulaması için mobil-öncelikli (mobile-first), erişilebilir ve tutarlı bir UI deneyimi sağlamak amacıyla oluşturulmuştur.

## 📦 Kurulum

Design system'i kullanmak için ana CSS dosyasını import edin:

```tsx
// src/main.tsx veya src/App.tsx
import './design-system/index.css';
```

## 🧱 Component'ler

### Primitives

| Component | Açıklama |
|-----------|----------|
| `Button` | Primary, secondary, ghost, danger varyantları |
| `Input` | Form input'u - label, hint, error desteği |
| `Card` | Kart container - elevated, outlined, filled |
| `Avatar` | Kullanıcı avatarı - initials veya image |
| `Badge` | Durum badge'i - success, warning, error vb. |

### Layout

| Component | Açıklama |
|-----------|----------|
| `AppShell` | Ana uygulama layout'u - sidebar, header, content |
| `Header` | Sayfa başlığı - title, actions |
| `BottomNav` | Mobil alt navigasyon |

## 🎯 Kullanım

### Button

```tsx
import { Button } from './design-system';

<Button variant="primary" leftIcon={<FiPlus />}>
  Yeni Ekle
</Button>

<Button variant="secondary" loading>
  Kaydediliyor...
</Button>
```

### Input

```tsx
import { Input } from './design-system';

<Input
  label="E-posta"
  placeholder="ornek@email.com"
  error={errors.email}
  leftIcon={<FiMail />}
/>
```

### Card

```tsx
import { Card, CardHeader, CardContent } from './design-system';

<Card variant="outlined" padding="none">
  <CardHeader title="Üye Bilgileri" action={<Button size="sm">Düzenle</Button>} />
  <CardContent>
    İçerik...
  </CardContent>
</Card>
```

### Layout

```tsx
import { AppShell, Header, BottomNav } from './design-system';

<AppShell
  header={<Header title="Üyeler" />}
  bottomNav={<BottomNav />}
>
  <main>İçerik...</main>
</AppShell>
```

## 🎨 Tema

Tüm renkler, boyutlar ve spacing değerleri CSS custom properties olarak tanımlanmıştır:

```css
/* Renkler */
--color-primary-500: #6366f1;
--color-success-500: #10b981;
--color-error-500: #f43f5e;

/* Spacing */
--space-4: 1rem;
--space-6: 1.5rem;

/* Border Radius */
--radius-lg: 0.75rem;
--radius-xl: 1rem;
```

### Dark Mode

Dark mode otomatik olarak sistem tercihine göre uygulanır veya manuel olarak aktifleştirilebilir:

```html
<html>
```

## 📱 Responsive Design

Design system mobil-öncelikli tasarlanmıştır:

- **Mobile**: 0 - 639px (default)
- **Tablet**: 640 - 1023px (`@media (min-width: 640px)`)
- **Desktop**: 1024px+ (`@media (min-width: 1024px)`)

## 📖 Storybook

Component'leri Storybook'ta görüntüleyin:

```bash
npm run storybook
```

## 📂 Dosya Yapısı

```
src/design-system/
├── index.css          # Ana CSS entry
├── index.ts           # Component exports
├── theme.css          # CSS custom properties
├── reset.css          # CSS reset
├── utilities.css      # Utility classes
├── components/
│   ├── Button/
│   ├── Input/
│   ├── Card/
│   ├── Avatar/
│   ├── Badge/
│   └── Layout/
├── stories/           # Storybook stories
└── pages/             # Page-level components
```
