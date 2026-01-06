'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ViewsData {
  date: string;
  views: number;
}

interface LeadsData {
  date: string;
  leads: number;
}

interface AnalyticsChartsProps {
  data: ViewsData[] | LeadsData[];
  type: 'views' | 'leads';
}

export function AnalyticsCharts({ data, type }: AnalyticsChartsProps) {
  const dataKey = type === 'views' ? 'views' : 'leads';
  const color = type === 'views' ? '#3b82f6' : '#22c55e';
  const gradientId = `gradient-${type}`;

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length && typeof label === 'string') {
                return (
                  <div className="bg-popover border rounded-lg shadow-lg p-3">
                    <p className="text-sm text-muted-foreground">
                      {formatDate(label)}
                    </p>
                    <p className="text-lg font-semibold">
                      {payload[0].value} {type}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
