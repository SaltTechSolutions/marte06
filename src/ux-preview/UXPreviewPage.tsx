import { FiActivity, FiBarChart2, FiCalendar, FiChevronRight, FiClock, FiCreditCard, FiFilter, FiGrid, FiPlus, FiSearch, FiUsers, FiZap } from 'react-icons/fi';
import './ux-preview.css';

type Variant = 'desktop' | 'mobile';
type NavKey = 'dashboard' | 'members' | 'calendar' | 'reports';

const mockMembers = [
  { name: 'Elif A.', status: 'Aktif', meta: 'Paket: 12 Ders · 18 gün kaldı' },
  { name: 'Mert K.', status: 'Ödeme Bekliyor', meta: 'Son ödeme: 12 gün önce' },
  { name: 'Sena Y.', status: 'Süresi Doldu', meta: 'Paket bitti: 3 gün önce' },
  { name: 'Ahmet D.', status: 'Aktif', meta: 'Paket: Aylık · 9 gün kaldı' },
  { name: 'Derya T.', status: 'Aktif', meta: 'Paket: PT 8 Seans · 2 seans kaldı' },
];

const mockLessons = [
  { time: '07:30', title: 'PT · Üst Vücut', coach: 'Kaan', count: 1, room: 'Studio' },
  { time: '12:15', title: 'Fonksiyonel', coach: 'Zeynep', count: 8, room: 'Salon A' },
  { time: '18:30', title: 'Pilates', coach: 'Ece', count: 10, room: 'Salon B' },
  { time: '20:00', title: 'Cross Training', coach: 'Baran', count: 12, room: 'Salon A' },
];

function Chip({ label, tone }: { label: string; tone: 'neutral' | 'hot' | 'ok' }) {
  return <span className={`uxp-chip uxp-chip--${tone}`}>{label}</span>;
}

function Shell({
  variant,
  active,
  title,
  primaryActionLabel,
  children,
}: {
  variant: Variant;
  active: NavKey;
  title: string;
  primaryActionLabel?: string;
  children: React.ReactNode;
}) {
  const nav = [
    { key: 'dashboard' as const, label: 'Dashboard', icon: <FiGrid /> },
    { key: 'members' as const, label: 'Üyeler', icon: <FiUsers /> },
    { key: 'calendar' as const, label: 'Takvim', icon: <FiCalendar /> },
    { key: 'reports' as const, label: 'Raporlar', icon: <FiBarChart2 /> },
  ];

  return (
    <div className={`uxp-app uxp-app--${variant}`}>
      {variant === 'desktop' && (
        <aside className="uxp-sidebar">
          <div className="uxp-brandMark">
            <img className="uxp-logo" src="/images/logo.png" alt="Tarabya Marte" />
            <div className="uxp-brandText">
              <div className="uxp-brandName">Tarabya Marte</div>
              <div className="uxp-brandSub">Fight Academy</div>
            </div>
          </div>
          <nav className="uxp-nav">
            {nav.map((item) => (
              <a key={item.key} className={`uxp-navItem ${active === item.key ? 'is-active' : ''}`} href="#">
                <span className="uxp-navIcon">{item.icon}</span>
                <span className="uxp-navLabel">{item.label}</span>
              </a>
            ))}
          </nav>
          <div className="uxp-sidebarFoot">
            <div className="uxp-miniCard">
              <div className="uxp-miniCardTitle">Bugün</div>
              <div className="uxp-miniCardValue">4 ders · 31 katılımcı</div>
            </div>
          </div>
        </aside>
      )}

      <main className="uxp-main">
        <header className="uxp-header">
          <div className="uxp-headerLeft">
            <div className="uxp-titleWrap">
              <div className="uxp-title">{title}</div>
              <div className="uxp-subtitle">Hızlı aksiyonlar · tek ekran akışı</div>
            </div>
          </div>
          <div className="uxp-headerRight">
            <div className="uxp-search">
              <FiSearch />
              <input placeholder="Üye, ders, ödeme ara" />
            </div>
            {primaryActionLabel && (
              <button className="uxp-primaryBtn" type="button">
                <FiPlus />
                <span>{primaryActionLabel}</span>
              </button>
            )}
          </div>
        </header>

        <section className="uxp-content">{children}</section>

        {variant === 'mobile' && (
          <nav className="uxp-bottomNav" aria-label="Alt menü">
            {nav.map((item) => (
              <a key={item.key} className={`uxp-bottomNavItem ${active === item.key ? 'is-active' : ''}`} href="#">
                <span className="uxp-bottomNavIcon">{item.icon}</span>
                <span className="uxp-bottomNavLabel">{item.label}</span>
              </a>
            ))}
          </nav>
        )}
      </main>
    </div>
  );
}

function LoginMock({ variant }: { variant: Variant }) {
  return (
    <div className={`uxp-login uxp-login--${variant}`}>
      <div className="uxp-loginCard">
        <div className="uxp-loginBrand">
          <img className="uxp-loginLogo" src="/images/logo.png" alt="Tarabya Marte" />
          <div>
            <div className="uxp-loginTitle">Tarabya Marte</div>
            <div className="uxp-loginSub">Spor salonu yönetimi</div>
          </div>
        </div>

        <div className="uxp-field">
          <label>E-posta</label>
          <div className="uxp-input">
            <input placeholder="admin@salon.com" />
          </div>
        </div>

        <div className="uxp-field">
          <label>Şifre</label>
          <div className="uxp-input">
            <input placeholder="••••••••" />
          </div>
        </div>

        <button className="uxp-cta" type="button">
          Giriş Yap
          <FiChevronRight />
        </button>

        <div className="uxp-loginHint">
          <span className="uxp-badge">Admin/Resepsiyon</span>
          <span className="uxp-sep">·</span>
          <span className="uxp-dim">Hızlı giriş, net aksiyon</span>
        </div>
      </div>
    </div>
  );
}

function DashboardMock({ variant }: { variant: Variant }) {
  return (
    <Shell variant={variant} active="dashboard" title="Dashboard" primaryActionLabel="Hızlı Kayıt">
      <div className="uxp-grid2">
        <div className="uxp-stat uxp-stat--glow">
          <div className="uxp-statTop">
            <div className="uxp-statLabel">Aktif Üyeler</div>
            <div className="uxp-statIcon">
              <FiUsers />
            </div>
          </div>
          <div className="uxp-statValue">412</div>
          <div className="uxp-statMeta">
            <Chip label="+18 / 30 gün" tone="ok" />
            <span className="uxp-muted">Yenileme oranı yüksek</span>
          </div>
        </div>

        <div className="uxp-stat">
          <div className="uxp-statTop">
            <div className="uxp-statLabel">Tahsilat</div>
            <div className="uxp-statIcon">
              <FiCreditCard />
            </div>
          </div>
          <div className="uxp-statValue">₺86.4K</div>
          <div className="uxp-statMeta">
            <Chip label="Bu ay" tone="neutral" />
            <span className="uxp-muted">3 ödeme bekliyor</span>
          </div>
        </div>
      </div>

      <div className="uxp-panel">
        <div className="uxp-panelHead">
          <div className="uxp-panelTitle">Bugünün Dersleri</div>
          <button className="uxp-ghostBtn" type="button">
            <FiCalendar />
            Takvime Git
          </button>
        </div>

        <div className="uxp-list">
          {mockLessons.slice(0, 3).map((l) => (
            <div className="uxp-row" key={l.time + l.title}>
              <div className="uxp-rowLeft">
                <div className="uxp-time">
                  <FiClock />
                  {l.time}
                </div>
                <div className="uxp-rowTitle">{l.title}</div>
                <div className="uxp-rowMeta">
                  <span className="uxp-badge">{l.room}</span>
                  <span className="uxp-muted">Koç: {l.coach}</span>
                </div>
              </div>
              <div className="uxp-rowRight">
                <Chip label={`${l.count} kişi`} tone="hot" />
                <FiChevronRight className="uxp-chevron" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="uxp-panel">
        <div className="uxp-panelHead">
          <div className="uxp-panelTitle">Dikkat Gerektiren</div>
          <button className="uxp-ghostBtn" type="button">
            <FiActivity />
            Detay
          </button>
        </div>
        <div className="uxp-alertStrip">
          <div className="uxp-alert">
            <div className="uxp-alertKey">Süresi dolan paket</div>
            <div className="uxp-alertVal">5 üye</div>
          </div>
          <div className="uxp-alert">
            <div className="uxp-alertKey">Tahsilat bekleyen</div>
            <div className="uxp-alertVal">3 üye</div>
          </div>
          <div className="uxp-alert">
            <div className="uxp-alertKey">Bugün yeni kayıt</div>
            <div className="uxp-alertVal">2</div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function MembersMock({ variant }: { variant: Variant }) {
  return (
    <Shell variant={variant} active="members" title="Üyeler" primaryActionLabel="Üye Ekle">
      <div className="uxp-toolbar">
        <div className="uxp-filterBar">
          <button className="uxp-pill" type="button">
            <FiFilter />
            Durum
          </button>
          <button className="uxp-pill" type="button">
            <FiClock />
            Süre
          </button>
          <button className="uxp-pill" type="button">
            <FiCreditCard />
            Ödeme
          </button>
        </div>
        <div className="uxp-kpi">
          <span className="uxp-kpiLabel">Bugün check-in</span>
          <span className="uxp-kpiValue">27</span>
        </div>
      </div>

      <div className="uxp-panel">
        <div className="uxp-panelHead">
          <div className="uxp-panelTitle">Üye Listesi</div>
          <div className="uxp-panelHint">Hızlı arama + durum etiketleri</div>
        </div>

        <div className="uxp-list">
          {mockMembers.map((m) => (
            <div className="uxp-row" key={m.name}>
              <div className="uxp-rowLeft">
                <div className="uxp-avatar">{m.name.slice(0, 1)}</div>
                <div>
                  <div className="uxp-rowTitle">{m.name}</div>
                  <div className="uxp-rowMeta">
                    <span className={`uxp-status ${m.status === 'Aktif' ? 'is-ok' : m.status === 'Ödeme Bekliyor' ? 'is-hot' : 'is-warn'}`}>{m.status}</span>
                    <span className="uxp-muted">{m.meta}</span>
                  </div>
                </div>
              </div>
              <div className="uxp-rowRight">
                <FiChevronRight className="uxp-chevron" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function CalendarMock({ variant }: { variant: Variant }) {
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  return (
    <Shell variant={variant} active="calendar" title="Takvim" primaryActionLabel="Ders Oluştur">
      <div className="uxp-panel">
        <div className="uxp-panelHead">
          <div className="uxp-panelTitle">Haftalık Özet</div>
          <button className="uxp-ghostBtn" type="button">
            <FiSearch />
            Ders Ara
          </button>
        </div>
        <div className="uxp-week">
          {days.map((d, idx) => (
            <div key={d} className={`uxp-day ${idx === 2 ? 'is-active' : ''}`}>
              <div className="uxp-dayName">{d}</div>
              <div className="uxp-dayNo">{12 + idx}</div>
              <div className="uxp-dayDots">
                <span />
                <span />
                <span />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="uxp-panel">
        <div className="uxp-panelHead">
          <div className="uxp-panelTitle">Günün Akışı</div>
          <div className="uxp-panelHint">Saat blokları + katılımcı sayısı</div>
        </div>
        <div className="uxp-timeline">
          {mockLessons.map((l) => (
            <div className="uxp-lesson" key={l.time + l.title}>
              <div className="uxp-lessonTime">{l.time}</div>
              <div className="uxp-lessonBody">
                <div className="uxp-lessonTop">
                  <div className="uxp-lessonTitle">{l.title}</div>
                  <Chip label={`${l.count} kişi`} tone={l.count >= 10 ? 'hot' : 'neutral'} />
                </div>
                <div className="uxp-lessonMeta">
                  <span className="uxp-badge">{l.room}</span>
                  <span className="uxp-muted">Koç: {l.coach}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function ReportsMock({ variant }: { variant: Variant }) {
  const bars = [
    { label: 'Oca', v: 64 },
    { label: 'Şub', v: 58 },
    { label: 'Mar', v: 71 },
    { label: 'Nis', v: 79 },
    { label: 'May', v: 86 },
  ];
  return (
    <Shell variant={variant} active="reports" title="Raporlar" primaryActionLabel="Dışa Aktar">
      <div className="uxp-grid2">
        <div className="uxp-stat">
          <div className="uxp-statTop">
            <div className="uxp-statLabel">Yeni Üye</div>
            <div className="uxp-statIcon">
              <FiUsers />
            </div>
          </div>
          <div className="uxp-statValue">+24</div>
          <div className="uxp-statMeta">
            <Chip label="Son 30 gün" tone="neutral" />
            <span className="uxp-muted">Kanal: referral ağırlıklı</span>
          </div>
        </div>
        <div className="uxp-stat">
          <div className="uxp-statTop">
            <div className="uxp-statLabel">Dolu Ders Oranı</div>
            <div className="uxp-statIcon">
              <FiActivity />
            </div>
          </div>
          <div className="uxp-statValue">%78</div>
          <div className="uxp-statMeta">
            <Chip label="Bu hafta" tone="ok" />
            <span className="uxp-muted">Yoğun saat: 18:00</span>
          </div>
        </div>
      </div>

      <div className="uxp-panel">
        <div className="uxp-panelHead">
          <div className="uxp-panelTitle">Aylık Gelir</div>
          <div className="uxp-panelHint">Trend + hızlı okuma</div>
        </div>
        <div className="uxp-chart">
          {bars.map((b) => (
            <div key={b.label} className="uxp-bar">
              <div className="uxp-barFill" style={{ height: `${b.v}%` }} />
              <div className="uxp-barLabel">{b.label}</div>
            </div>
          ))}
        </div>
        <div className="uxp-note">
          <span className="uxp-badge">İpucu</span>
          <span className="uxp-muted">Ödeme gecikmesi olan üyeleri “Üyeler” ekranından tek filtreyle yakala.</span>
        </div>
      </div>
    </Shell>
  );
}

function ScreenRow({
  name,
  desktop,
  mobile,
}: {
  name: string;
  desktop: React.ReactNode;
  mobile: React.ReactNode;
}) {
  return (
    <section className="uxp-rowBlock">
      <div className="uxp-rowHead">
        <div className="uxp-rowName">{name}</div>
        <div className="uxp-rowLegend">
          <span className="uxp-dot uxp-dot--cyan" />
          Web
          <span className="uxp-sep">·</span>
          <span className="uxp-dot uxp-dot--lime" />
          Mobile
        </div>
      </div>
      <div className="uxp-frames">
        <div className="uxp-frame uxp-frame--desktop">
          <div className="uxp-frameInner">{desktop}</div>
        </div>
        <div className="uxp-frame uxp-frame--mobile">
          <div className="uxp-frameInner">{mobile}</div>
        </div>
      </div>
    </section>
  );
}

export default function UXPreviewPage() {
  return (
    <div className="uxp-root">
      <div className="uxp-hero">
        <div className="uxp-heroLeft">
          <div className="uxp-kicker">
            <span className="uxp-pillBadge">UX Preview</span>
            <span className="uxp-sep">·</span>
            <span className="uxp-dim">Admin/Resepsiyon · Koyu/Neon</span>
          </div>
          <h1 className="uxp-h1">Spor Salonu Yönetimi · Yeni Arayüz Taslağı</h1>
          <p className="uxp-lead">
            Önce akışları netleştiren, sonra detayları parlatan bir yaklaşım: hızlı arama, tek tık aksiyon, durum etiketleri ve
            mobil/desktop tutarlı navigasyon.
          </p>
        </div>
        <div className="uxp-heroRight">
          <div className="uxp-heroCard">
            <div className="uxp-heroCardTop">
              <div className="uxp-heroCardTitle">Tasarım prensipleri</div>
              <div className="uxp-heroCardTag">
                <FiZap /> Speed
              </div>
            </div>
            <ul className="uxp-heroList">
              <li>Tek satır arama: üye/ders/ödeme</li>
              <li>Durum etiketleri: Aktif, Ödeme Bekliyor, Süresi Doldu</li>
              <li>Hızlı CTA: “Üye Ekle”, “Ders Oluştur”, “Dışa Aktar”</li>
              <li>Takvim akışı: saat blokları + katılımcı</li>
            </ul>
          </div>
        </div>
      </div>

      <ScreenRow name="Login" desktop={<LoginMock variant="desktop" />} mobile={<LoginMock variant="mobile" />} />
      <ScreenRow name="Dashboard" desktop={<DashboardMock variant="desktop" />} mobile={<DashboardMock variant="mobile" />} />
      <ScreenRow name="Üyeler" desktop={<MembersMock variant="desktop" />} mobile={<MembersMock variant="mobile" />} />
      <ScreenRow name="Takvim" desktop={<CalendarMock variant="desktop" />} mobile={<CalendarMock variant="mobile" />} />
      <ScreenRow name="Raporlar" desktop={<ReportsMock variant="desktop" />} mobile={<ReportsMock variant="mobile" />} />
    </div>
  );
}
