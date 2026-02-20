import React, { useMemo } from 'react';

const ELEMENT_META = [
  { key: 'Wood', label: '목', color: '#22c55e' },
  { key: 'Fire', label: '화', color: '#ef4444' },
  { key: 'Earth', label: '토', color: '#f59e0b' },
  { key: 'Metal', label: '금', color: '#64748b' },
  { key: 'Water', label: '수', color: '#3b82f6' },
];

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function getTextAnchor(angle) {
  const cos = Math.cos(angle);
  if (cos > 0.25) return 'start';
  if (cos < -0.25) return 'end';
  return 'middle';
}

function getDy(angle) {
  const sin = Math.sin(angle);
  if (sin > 0.35) return '0.8em';
  if (sin < -0.35) return '-0.2em';
  return '0.35em';
}

function FiveElementRadarChart({
  distribution = null,
  rows = null,
  size = 230,
  levels = 4,
  className = '',
  maxValue = null,
}) {
  const valueMap = useMemo(() => {
    const map = {};
    ELEMENT_META.forEach((item) => {
      map[item.key] = 0;
    });

    if (Array.isArray(rows)) {
      rows.forEach((item) => {
        const key = String(item?.key || '');
        if (!Object.prototype.hasOwnProperty.call(map, key)) return;
        map[key] = toNumber(item?.value);
      });
      return map;
    }

    if (distribution && typeof distribution === 'object') {
      ELEMENT_META.forEach((item) => {
        map[item.key] = toNumber(distribution[item.key]);
      });
    }

    return map;
  }, [distribution, rows]);

  const chart = useMemo(() => {
    const center = size / 2;
    const outerRadius = Math.max(52, size * 0.34);
    const labelRadius = outerRadius + 24;
    const startAngle = -Math.PI / 2;
    const step = (Math.PI * 2) / ELEMENT_META.length;
    const values = ELEMENT_META.map((item) => valueMap[item.key]);
    const fallbackMax = Math.max(...values, 1);
    const resolvedMax = toNumber(maxValue) > 0 ? toNumber(maxValue) : fallbackMax;

    const points = ELEMENT_META.map((item, index) => {
      const angle = startAngle + (step * index);
      const ratio = clamp01(valueMap[item.key] / resolvedMax);
      const radius = outerRadius * ratio;
      const x = center + (Math.cos(angle) * radius);
      const y = center + (Math.sin(angle) * radius);
      return { key: item.key, angle, ratio, x, y };
    });

    const axisPoints = ELEMENT_META.map((item, index) => {
      const angle = startAngle + (step * index);
      const x = center + (Math.cos(angle) * outerRadius);
      const y = center + (Math.sin(angle) * outerRadius);
      const labelX = center + (Math.cos(angle) * labelRadius);
      const labelY = center + (Math.sin(angle) * labelRadius);
      return { key: item.key, angle, x, y, labelX, labelY };
    });

    const levelPolygons = Array.from({ length: Math.max(1, levels) }, (_, levelIndex) => {
      const ratio = (levelIndex + 1) / Math.max(1, levels);
      const polygonPoints = axisPoints.map((point) => {
        const x = center + ((point.x - center) * ratio);
        const y = center + ((point.y - center) * ratio);
        return `${x},${y}`;
      });
      return polygonPoints.join(' ');
    });

    const dataPolygon = points.map((point) => `${point.x},${point.y}`).join(' ');
    const avgRatio = points.reduce((acc, point) => acc + point.ratio, 0) / points.length;
    const alpha = 0.18 + (avgRatio * 0.18);

    return {
      center,
      axisPoints,
      points,
      levelPolygons,
      dataPolygon,
      fillColor: `rgba(59, 130, 246, ${alpha.toFixed(3)})`,
      strokeColor: '#2563eb',
    };
  }, [size, levels, maxValue, valueMap]);

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="오행 분포 레이더 차트" className="w-full h-auto">
        {chart.levelPolygons.map((polygon, index) => (
          <polygon
            key={`grid-${index}`}
            points={polygon}
            fill="none"
            stroke="#cbd5e1"
            strokeOpacity={0.9}
            strokeWidth={index === chart.levelPolygons.length - 1 ? 1.4 : 1}
          />
        ))}

        {chart.axisPoints.map((point) => (
          <line
            key={`axis-${point.key}`}
            x1={chart.center}
            y1={chart.center}
            x2={point.x}
            y2={point.y}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
        ))}

        <polygon
          points={chart.dataPolygon}
          fill={chart.fillColor}
          stroke={chart.strokeColor}
          strokeWidth="2.2"
        />

        {chart.points.map((point) => {
          const meta = ELEMENT_META.find((item) => item.key === point.key);
          return (
            <circle
              key={`dot-${point.key}`}
              cx={point.x}
              cy={point.y}
              r="3.8"
              fill={meta?.color || '#2563eb'}
              stroke="#ffffff"
              strokeWidth="1.2"
            />
          );
        })}

        {chart.axisPoints.map((point) => {
          const meta = ELEMENT_META.find((item) => item.key === point.key);
          return (
            <text
              key={`label-${point.key}`}
              x={point.labelX}
              y={point.labelY}
              fill="#334155"
              fontSize="13"
              fontWeight="800"
              textAnchor={getTextAnchor(point.angle)}
              dominantBaseline="middle"
              dy={getDy(point.angle)}
            >
              {meta?.label || point.key}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default FiveElementRadarChart;
