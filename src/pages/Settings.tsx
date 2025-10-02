// src/pages/Settings.tsx
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from '../components/ThemeContext';
import Button from '../theme/components/Button';
import Card from '../theme/components/Card';
import Tag from '../theme/components/Tag';

const optionBaseStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  padding: 'var(--space-sm)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  cursor: 'pointer',
  transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
};

interface OptionCardProps {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  preview?: ReactNode;
  name: string;
  value: string;
}

const OptionCard = ({ label, description, selected, onSelect, preview, name, value }: OptionCardProps) => (
  <label
    style={{
      ...optionBaseStyle,
      borderColor: selected ? 'rgba(53, 192, 137, 0.45)' : 'var(--color-border)',
      boxShadow: selected ? '0 10px 24px rgba(53, 192, 137, 0.18)' : 'var(--shadow-soft)',
      transform: selected ? 'translateY(-2px)' : 'translateY(0)',
    }}
  >
    <input type="radio" name={name} value={value} checked={selected} onChange={onSelect} style={{ display: 'none' }} />
    <span className="ui-stack">
      <span className="ui-heading ui-heading--sm">{label}</span>
      <span className="ui-text ui-text--muted" style={{ fontSize: 'var(--font-size-xs)' }}>
        {description}
      </span>
      {preview && <span>{preview}</span>}
    </span>
  </label>
);

const Settings = () => {
  const { availableThemes, themeId, setThemeId, corners, setCorners, density, setDensity, resetTheme } = useTheme();

  const cornerOptions = useMemo(
    () => [
      { value: 'rounded' as const, label: 'Yuvarlak', description: 'Daha yumuşak kart ve buton köşeleri.' },
      { value: 'soft' as const, label: 'Orta', description: 'Dengeli köşeler ve standart boşluklar.' },
      { value: 'square' as const, label: 'Köşeli', description: 'Keskin kenarlar ve kompakt görünüm.' },
    ],
    [],
  );

  const densityOptions = useMemo(
    () => [
      { value: 'comfortable' as const, label: 'Rahat', description: 'Standart boşluklar ile okunabilirlik odaklı.' },
      { value: 'compact' as const, label: 'Kompakt', description: 'Daha yoğun arayüzler için azaltılmış boşluklar.' },
    ],
    [],
  );

  return (
    <div
      className="ui-stack"
      style={{ padding: 'var(--space-lg)', maxWidth: '920px', margin: '0 auto', gap: 'var(--space-lg)' }}
    >
      <div className="ui-stack" style={{ gap: '0.35rem' }}>
        <h1 className="ui-heading ui-heading--lg">Görünüm Ayarları</h1>
        <p className="ui-text">
          Uygulamanın temasını ve arayüz yoğunluğunu buradan yönetebilirsiniz. Tüm işlevler aynı kalır, yalnızca görünüm
          güncellenir.
        </p>
        <Tag tone="primary">Varsayılan tema: Fresh Mint</Tag>
      </div>

      <Card tone="subtle" padding="lg">
        <div className="ui-stack" style={{ gap: 'var(--space-md)' }}>
          <div className="ui-stack" style={{ gap: '0.25rem' }}>
            <span className="ui-heading ui-heading--md">Tema Paleti</span>
            <span className="ui-text">Pastel ve canlı renklerden oluşan temalardan birini seçin.</span>
          </div>
          <div className="ui-grid ui-grid--columns-2">
            {availableThemes.map((theme) => (
              <OptionCard
                key={theme.id}
                label={theme.name}
                description={theme.description}
                selected={themeId === theme.id}
                onSelect={() => setThemeId(theme.id)}
                name="theme"
                value={theme.id}
                preview={<span className="ui-chip">Örnek vurgu alanı</span>}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card tone="subtle" padding="lg">
        <div className="ui-stack" style={{ gap: 'var(--space-md)' }}>
          <div className="ui-stack" style={{ gap: '0.25rem' }}>
            <span className="ui-heading ui-heading--md">Köşe Stili</span>
            <span className="ui-text">Kart ve buton köşe yuvarlaklıklarını belirleyin.</span>
          </div>
          <div className="ui-grid ui-grid--columns-2">
            {cornerOptions.map((option) => (
              <OptionCard
                key={option.value}
                label={option.label}
                description={option.description}
                selected={corners === option.value}
                onSelect={() => setCorners(option.value)}
                name="corners"
                value={option.value}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card tone="subtle" padding="lg">
        <div className="ui-stack" style={{ gap: 'var(--space-md)' }}>
          <div className="ui-stack" style={{ gap: '0.25rem' }}>
            <span className="ui-heading ui-heading--md">Yoğunluk</span>
            <span className="ui-text">Liste ve form boşluklarını kolayca değiştirin.</span>
          </div>
          <div className="ui-grid ui-grid--columns-2">
            {densityOptions.map((option) => (
              <OptionCard
                key={option.value}
                label={option.label}
                description={option.description}
                selected={density === option.value}
                onSelect={() => setDensity(option.value)}
                name="density"
                value={option.value}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card tone="default" padding="lg">
        <div className="ui-stack" style={{ gap: 'var(--space-md)' }}>
          <div className="ui-stack" style={{ gap: '0.5rem' }}>
            <span className="ui-heading ui-heading--md">Önizleme</span>
            <span className="ui-text ui-text--muted">Aşağıdaki bileşenler seçtiğiniz ayarlar doğrultusunda güncellenir.</span>
          </div>

          <div className="ui-grid" style={{ gap: 'var(--space-sm)' }}>
            <Card tone="highlight" padding="md">
              <div className="ui-stack" style={{ gap: '0.5rem' }}>
                <span className="ui-heading ui-heading--sm">Kart Başlığı</span>
                <span className="ui-text">Pastel tonlardaki kartlar tüm panelde kullanılacak.</span>
                <Tag tone="primary">Örnek etiket</Tag>
              </div>
            </Card>
            <Button variant="primary">Birincil Buton</Button>
            <Button variant="secondary" tone="soft">Sekonder Buton</Button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={resetTheme}>
              Varsayılan ayarlara dön
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
