// src/components/ReportTableChart.tsx
import React from 'react';

interface ReportTableChartProps {
  data: Array<{ [key: string]: any }>;
  columns: Array<{ key: string; label: string }>;
  chartTitle?: string;
  tableTitle?: string;
}

const ReportTableChart: React.FC<ReportTableChartProps> = ({ data, columns, chartTitle, tableTitle }) => {
  // Basit bir çubuk grafik (Bar Chart) için veri hazırlama
  // (Gerçek projede chart.js, recharts, nivo gibi bir kütüphane önerilir)
  // Burada sadece basit bir SVG ile örnek çizim yapılacak
  const chartData = data.slice(0, 10); // İlk 10 satırı örnek olarak al
  const maxVal = Math.max(...chartData.map(row => row[columns[1].key] || 0), 1);

  return (
    <div className="report-table-chart card">
      {chartTitle && <h3>{chartTitle}</h3>}
      {/* Basit Bar Chart */}
      <div className="bar-chart" style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 12, margin: '0.5rem 0' }}>
        {chartData.map((row, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36 }}>
            <div
              style={{
                background: 'var(--color-primary)',
                width: 28,
                height: `${(row[columns[1].key] / maxVal) * 120}px`,
                borderRadius: 6,
                marginBottom: 4,
                transition: 'height 0.3s',
              }}
              aria-label={`${row[columns[0].key]}: ${row[columns[1].key]}`}
            />
            <span style={{ fontSize: 12, color: 'var(--muted-color)', maxWidth: 36, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row[columns[0].key]}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-color)' }}>{row[columns[1].key]}</span>
          </div>
        ))}
      </div>
      {tableTitle && <h4>{tableTitle}</h4>}
      <div className="table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="report-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--muted-color)' }}>Veri yok</td></tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx}>
                  {columns.map(col => (
                    <td key={col.key}>{row[col.key]}</td>
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
