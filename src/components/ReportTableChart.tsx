// src/components/ReportTableChart.tsx
import React from 'react';

interface ReportTableChartProps {
  data: Array<{ [key: string]: any }>;
  columns: Array<{ key: string; label: string }>;
  chartTitle?: string;
  tableTitle?: string;
}

const ReportTableChart: React.FC<ReportTableChartProps> = ({ data, columns, chartTitle, tableTitle }) => {
  // Basit bir Çizgi Grafik (Line Chart) — responsive SVG ile
  // Not: Prod için chart.js/recharts gibi bir kütüphane önerilir.
  const chartData = data.slice(0, Math.min(data.length, 12)); // En fazla 12 nokta (aylar için ideal)
  const maxVal = Math.max(...chartData.map(row => Number(row[columns[1].key]) || 0), 1);

  const tableStyle: React.CSSProperties = {
    width: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
  };
  const thTdStyle: React.CSSProperties = {
    padding: 8,
    wordBreak: 'break-word',
    borderTop: `1px solid var(--color-border)`,
  };
  const headCellStyle: React.CSSProperties = {
    ...thTdStyle,
    textAlign: 'left',
    color: 'var(--muted-color)',
    fontWeight: 600,
  };

  return (
    <div className="report-table-chart card">
      {chartTitle && <h3>{chartTitle}</h3>}
      {/* Responsive Line Chart (SVG) */}
      <div className="line-chart" style={{ width: '100%', margin: '0.5rem 0', overflow: 'hidden' }}>
        {chartData.length > 0 ? (
          (() => {
            const W = 800; // viewBox genişliği — width% ile ölçeklenir
            const H = 240; // toplam yükseklik
            const M = { top: 16, right: 16, bottom: 36, left: 40 };
            const PW = W - M.left - M.right; // plot width
            const PH = H - M.top - M.bottom; // plot height
            const n = chartData.length;
            const xStep = n > 1 ? PW / (n - 1) : PW / 2;
            const points = chartData.map((row, i) => {
              const x = M.left + (n > 1 ? i * xStep : PW / 2);
              const v = Number(row[columns[1].key]) || 0;
              const y = M.top + (1 - v / maxVal) * PH;
              return { x, y, label: String(row[columns[0].key]), value: v };
            });
            const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            const gridYs = [0, 0.25, 0.5, 0.75, 1].map(t => M.top + t * PH);
            return (
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Katılım çizgi grafiği">
                {/* Gridlines */}
                {gridYs.map((gy, i) => (
                  <line key={i} x1={M.left} y1={gy} x2={W - M.right} y2={gy} stroke="var(--color-border)" strokeWidth={1} opacity={i === gridYs.length - 1 ? 1 : 0.6} />
                ))}
                {/* Line path */}
                <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                {/* Points */}
                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={3.5} fill="var(--color-primary)" />
                    <title>{`${p.label}: ${p.value}`}</title>
                  </g>
                ))}
                {/* X labels */}
                {points.map((p, i) => (
                  <text key={`x-${i}`} x={p.x} y={H - 12} textAnchor="middle" fontSize={11} fill="var(--muted-color)">
                    {p.label}
                  </text>
                ))}
                {/* Y axis (0 baseline) */}
                <line x1={M.left} y1={M.top + PH} x2={W - M.right} y2={M.top + PH} stroke="var(--color-border)" strokeWidth={1.5} />
              </svg>
            );
          })()
        ) : (
          <div style={{ color: 'var(--muted-color)', fontSize: 14 }}>Gösterilecek veri yok</div>
        )}
      </div>
      {tableTitle && <h4>{tableTitle}</h4>}
      <div className="table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="report-table" style={tableStyle}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={headCellStyle}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ ...thTdStyle, textAlign: 'center', color: 'var(--muted-color)' }}>Veri yok</td></tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx}>
                  {columns.map(col => (
                    <td key={col.key} style={thTdStyle}>{row[col.key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportTableChart;
