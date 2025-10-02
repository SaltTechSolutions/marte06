import type { CalendarOverview } from '../types';
import { Badge } from '../../../primitives/Badge';
import './calendar.css';

export type CalendarSummaryProps = {
  overview: CalendarOverview;
};

export const CalendarSummary = ({ overview }: CalendarSummaryProps) => {
  return (
    <section className="calendar-summary">
      <header className="calendar-summary__header">
        <h2>{overview.rangeLabel}</h2>
        <Badge variant="primary">
          %{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(
            overview.attendanceRate * 100,
          )}{' '}
          katılım
        </Badge>
      </header>
      <div className="calendar-summary__stats">
        <div className="calendar-summary__stat">
          <span className="calendar-summary__stat-label">Toplam Ders</span>
          <span className="calendar-summary__stat-value">{overview.totalLessons}</span>
        </div>
        <div className="calendar-summary__stat">
          <span className="calendar-summary__stat-label">Katılım Oranı</span>
          <span className="calendar-summary__stat-value">
            %{Math.round(overview.attendanceRate * 100)}
          </span>
        </div>
        <div className="calendar-summary__stat">
          <span className="calendar-summary__stat-label">Süresi Dolan Paketler</span>
          <span className="calendar-summary__stat-value">{overview.expiringPackages}</span>
        </div>
      </div>
    </section>
  );
};
