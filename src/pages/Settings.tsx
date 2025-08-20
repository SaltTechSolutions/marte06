// src/pages/Settings.tsx
import { useTheme } from '../components/ThemeContext';

const themes: { key: 'light' | 'forest' | 'ocean'; name: string; desc: string }[] = [
  { key: 'light', name: 'Açık', desc: 'Varsayılan açık tema' },
  { key: 'forest', name: 'Orman', desc: 'Koyu yeşil tonlar, yüksek kontrast' },
  { key: 'ocean', name: 'Okyanus', desc: 'Canlı mavi/deniz tonları' },
];

const presets: { key: 'material' | 'simple' | 'modern'; name: string; desc: string }[] = [
  { key: 'material', name: 'Material Design', desc: 'Daha büyük köşeler, daha belirgin gölgeler ve Roboto fontu' },
  { key: 'simple', name: 'Simple Design', desc: 'Düz çizgiler, küçük köşeler ve sistem fontu' },
  { key: 'modern', name: 'Modern Design', desc: 'Inter font, orta köşeler ve yumuşak gölgeler' },
];

export default function Settings() {
  const { theme, setTheme, preset, setPreset } = useTheme();

  return (
    <div className="settings-page">
      <h2>Görünüm Ayarları</h2>
      <p className="text-sm" style={{ color: 'var(--muted-color)' }}>
        Uygulamanın görünüm temasını buradan değiştirebilirsiniz. İşlevler aynı kalır, yalnızca görünüm değişir.
      </p>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Tema Seçimi</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {themes.map((t) => (
            <label
              key={t.key}
              className="flex items-center gap-3 p-3 rounded border"
              style={{
                cursor: 'pointer',
                borderColor: 'var(--color-border)',
                background: 'var(--color-card)'
              }}
            >
              <input
                type="radio"
                name="app-theme"
                value={t.key}
                checked={theme === t.key}
                onChange={() => setTheme(t.key)}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ color: 'var(--muted-color)', fontSize: 13 }}>{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Şablon (UI/UX) Seçimi</h3>
        <p className="text-sm" style={{ color: 'var(--muted-color)' }}>
          Kart köşe yuvarlaklığı, gölge, font ve genel his bu seçimle değişir.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {presets.map((p) => (
            <label
              key={p.key}
              className="flex items-center gap-3 p-3 rounded border"
              style={{
                cursor: 'pointer',
                borderColor: 'var(--color-border)',
                background: 'var(--color-card)'
              }}
            >
              <input
                type="radio"
                name="app-preset"
                value={p.key}
                checked={preset === p.key}
                onChange={() => setPreset(p.key)}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ color: 'var(--muted-color)', fontSize: 13 }}>{p.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Önizleme</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Kart Başlığı</div>
            <div style={{ color: 'var(--muted-color)' }}>Bu bir kart önizlemesidir.</div>
          </div>
          <button className="w-full" style={{ background: 'var(--color-primary)' }}>Birincil Buton</button>
        </div>
      </div>
    </div>
  );
}
