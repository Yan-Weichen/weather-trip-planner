import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import type { TripPlan } from '../types';
import './BudgetChart.css';

interface Props {
  tripPlan: TripPlan;
}

const CATEGORY_LABELS: Record<string, string> = {
  attraction: '\u666F\u9EDE',
  meal: '\u9910\u98F2',
  lodging: '\u4F4F\u5BBF',
  transit: '\u4EA4\u901A',
};

const CATEGORY_COLORS: Record<string, string> = {
  attraction: '#8b5cf6',
  meal: '#f59e0b',
  lodging: '#3b82f6',
  transit: '#6b7280',
};

export default function BudgetChart({ tripPlan }: Props) {
  const totals: Record<string, number> = {};

  for (const day of tripPlan.dailyPlans) {
    for (const item of day.items) {
      const avg = Math.round((item.costMin + item.costMax) / 2);
      totals[item.type] = (totals[item.type] || 0) + avg;
    }
  }

  const data = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .map(([type, value]) => ({
      name: CATEGORY_LABELS[type] || type,
      value,
      color: CATEGORY_COLORS[type] || '#94a3b8',
    }));

  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="budget-chart no-print">
      <h3>{'\u{1F4CA}'} {'\u9810\u7B97\u5206\u4F48'}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            dataKey="value"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const v = Number(value);
              const pct = total > 0 ? (v / total * 100).toFixed(0) : '0';
              return [`NT$${v.toLocaleString()} (${pct}%)`, name];
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="budget-chart-total">
        {'\u5E73\u5747\u9810\u4F30\u7E3D\u8CBB\u7528\uFF1A'}NT${total.toLocaleString()}
      </div>
    </div>
  );
}
