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
- Replace sample data hook with real Firestore queries once backend endpoints are ready.
- Add new UI Storybook/preview entries and component tests.
- Sync lesson attendance updates with backend by replacing the local override logic used by `LessonDetailDrawer` in `CalendarPage`.
- Integrate `LessonDetailDrawer` into modal/drawer orchestration once a shared primitive exists (current version uses a basic overlay for scaffolding).
