# newUI Migration Notes

## Foundation

- Design tokens live in `src/newUI/foundation/tokens.ts`. Update or extend scales here.
- Theme definitions (light/dark) are exported from `src/newUI/foundation/themes.ts`.
- Global CSS primitives are defined in `src/newUI/foundation/globals.css`. Import once near the application root when enabling the new UI.

## Primitives

- Core building blocks live under `src/newUI/primitives/`.
- Available primitives:
  - `Spinner` for loading indicators. Accepts `size` (`'sm' | 'md' | 'lg'`).
  - `Button` with variants `primary | neutral | danger`, tones `solid | soft | outline | ghost`, sizes `sm | md | lg`.
  - `IconButton` mirroring `Button` tones/variants but requiring `icon`.

## Layout

- `src/newUI/layout/AppShell.tsx` organizes the main frame with sticky header, optional sidebar, and padded content regions.
- `src/newUI/layout/AppHeader.tsx` renders title, subtitle, and action slots.
- `src/newUI/layout/Sidebar.tsx` supports sectioned navigation with link or button items. Styling lives in `src/newUI/layout/layout.css`.

### Sample composition

```tsx
import { AppShell, AppHeader, Sidebar } from '@/newUI/layout';
import { Button } from '@/newUI/primitives';

const header = (
  <AppHeader
    title="Randevu Yönetimi"
    subtitle="Bugün için 12 ders planlandı"
    actions={<Button variant="primary">Yeni Ders</Button>}
  />
);

const sidebar = (
  <Sidebar
    sections={[
      {
        key: 'main',
        title: 'Menü',
        items: [
          { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
          { key: 'calendar', label: 'Takvim', href: '/calendar', active: true },
        ],
      },
    ]}
  />
);

export function CalendarPage() {
  return (
    <AppShell header={header} sidebar={sidebar}>
      {/* Page content goes here */}
    </AppShell>
  );
}
```

## Form primitives

- `src/newUI/primitives/TextField.tsx` handles labeled inputs with description and validation messaging using `forms.css`.
- `src/newUI/primitives/SelectField.tsx` provides dropdowns with placeholder handling for controlled/uncontrolled modes.

### Usage example

```tsx
import { TextField, SelectField } from '@/newUI/primitives';

function LessonForm() {
  return (
    <form className="grid gap-4 md:grid-cols-2">
      <TextField
        name="lessonName"
        label="Ders Adı"
        placeholder="Yoga - Başlangıç"
        required
      />
      <SelectField
        name="branchId"
        label="Şube"
        placeholder="Şube seçin"
        options={[
          { value: 'central', label: 'Merkez' },
          { value: 'balat', label: 'Balat' },
        ]}
        required
      />
    </form>
  );
}
```

## Next steps

- Implement feedback components (Toast, Badge, Alert) to cover standard UI interactions.
- Construct feature modules under `src/newUI/modules/` starting with Calendar and Members.
- Add routing glue in `src/newUI/pages/` and wire via a feature flag in `App.tsx` for incremental rollout.
- Introduce Storybook or a playground page to iterate on new components in isolation.

### Integration guidance

- **Feature flag**: gate the new UI with a runtime toggle (e.g., Firebase Remote Config, Firestore flag, or `.env` variable).
- **Router setup**: add a wrapper in `App.tsx` that uses the flag to decide between legacy and new routes.
- **Global styles**: import `src/newUI/foundation/globals.css` exactly once near the application root when enabling the new UI.

#### Feature flag options

- Set `VITE_USE_NEW_CALENDAR=true` in `.env` to force-enable the new UI for everyone.
- Set `VITE_USE_NEW_CALENDAR=false` to force-disable the new UI.
- Leave the env unset and toggle per-device using `localStorage.setItem('useNewCalendar', 'true')` (or `'false'`) in the browser console.

### Routing example

```tsx
import { useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CalendarPage } from '@/newUI/pages/CalendarPage';
import '@/newUI/foundation/globals.css';

export function App() {
  const useNewUI = useMemo(() => window.localStorage.getItem('useNewUI') === 'true', []);

  return (
    <BrowserRouter>
      <Routes>
        {useNewUI ? (
          <Route path="/calendar" element={<CalendarPage />} />
        ) : (
          <Route path="/calendar" element={<LegacyCalendar />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
```

### Testing strategy

- **Storybook/Playground**: spin up a Storybook instance (or Vite preview route) to exercise primitives and modules in isolation.
- **Component tests**: use React Testing Library to validate rendering of primitives and modules (e.g., `CalendarSummary`, `LessonCard`).
- **Integration tests**: add Cypress/Playwright flows for feature-flag switching and navigation parity between legacy and new UI.
- **Visual regression**: optional screenshot testing (Chromatic, Percy) once component inventory stabilizes.

### Follow-ups

- Wire `CalendarPage` behind a feature flag in `App.tsx` (see routing example above).
- ✅ Replace sample data hook with real Firestore queries once backend endpoints are ready.
- Add new UI Storybook/preview entries and component tests.
- ✅ Sync lesson attendance updates with backend by replacing the local override logic used by `LessonDetailDrawer` in `CalendarPage`.
- Integrate `LessonDetailDrawer` into modal/drawer orchestration once a shared primitive exists (current version uses a basic overlay for scaffolding).

## 📱 Mobile-First Architecture

### Responsive Breakpoints
- **Mobile**: `< 768px` (iPhone 14: 390×844)
- **Tablet**: `768px - 1023px`
- **Desktop**: `≥ 1024px`

### Layout Strategy
- **Mobile (<1024px)**: Flex-column layout with hamburger menu triggering slide-in drawer
- **Desktop (≥1024px)**: Grid layout with persistent sidebar (260px) and content area

### Key Mobile Optimizations

#### AppShell & Navigation
- Hamburger button appears only on mobile (`<1024px`)
- Sidebar drawer slides from left with backdrop overlay
- Touch-friendly tap targets (min 44×44px)
- Reduced padding on mobile (1rem vs 1.5rem desktop)

#### Calendar Views

**Weekly Grid**
- **Mobile**: Shows 3 days (today + next 2) to fit viewport width
- **Desktop**: Shows full 7-day week
- Time column: 60px mobile, 100px desktop
- Font sizes: 0.75rem mobile, 0.85-0.95rem desktop
- Cell heights: 60px mobile, 72px desktop

**Daily Timeline**
- Vertical timeline with hourly slots (07:00-21:00)
- Time column: 80px mobile, 100px desktop
- Lesson cards: full-width with gradient backgrounds
- Empty slots: dashed border with "+" action

#### Typography Scale
```css
/* Mobile-first, then desktop overrides */
.ui-app-header__title {
  font-size: 1.25rem; /* mobile */
}
@media (min-width: 768px) {
  .ui-app-header__title {
    font-size: 1.5rem; /* desktop */
  }
}
```

#### Summary Cards
- Grid columns: `minmax(100px, 1fr)` mobile, `minmax(160px, 1fr)` desktop
- Padding: 0.75rem mobile, 1rem desktop
- Font sizes: 0.7rem labels, 1.3rem values on mobile

### Overflow Prevention
```css
.ui-app-shell {
  overflow-x: hidden; /* Prevent horizontal scroll */
}
.ui-app-shell__content {
  max-width: 100vw;
  overflow-x: hidden;
}
```

### Testing Checklist

#### Mobile (iPhone 14 - 390×844)
- [ ] Hamburger menu opens/closes sidebar drawer
- [ ] Weekly grid shows exactly 3 days without horizontal scroll
- [ ] Daily timeline fits viewport width
- [ ] Summary cards stack properly (2 columns max)
- [ ] Navigation buttons wrap without overflow
- [ ] Lesson cards are readable and tappable
- [ ] Empty slot buttons are touch-friendly

#### Tablet (768-1023px)
- [ ] Weekly grid shows 7 days
- [ ] Hamburger still visible, sidebar drawer functional
- [ ] Increased font sizes apply
- [ ] Summary shows 3-4 columns

#### Desktop (≥1024px)
- [ ] Persistent sidebar visible
- [ ] Hamburger hidden
- [ ] Weekly grid shows 7 days with full spacing
- [ ] Summary shows 4+ columns
- [ ] All hover states functional

#### Cross-Device
- [ ] View mode toggles (day/week) work consistently
- [ ] Date navigation (prev/next/today) updates correctly
- [ ] Lesson detail drawer opens on all devices
- [ ] Attendance marking persists to Firestore
- [ ] Refetch updates calendar after CRUD operations

### Performance Notes
- Build size: ~22KB CSS, ~22KB JS for CalendarPage (gzipped: 4.3KB + 6.5KB)
- Firestore queries use composite indexes (memberIds + date)
- Refetch debounced 500ms after attendance updates
- Member data fetched once (non-realtime) to prevent loops

### Known Limitations
- LessonModal is scaffolding only (member selection, time picker pending)
- Walk-in management not yet wired to new UI
- Birthday/expiring package widgets not implemented
- No real-time listener for lessons (manual refetch only)
