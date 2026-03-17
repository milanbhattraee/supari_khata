"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toNepaliDateShort, formatDashboardCurrency } from "@/lib/format";

const MONTH_NAMES = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

interface CashflowChartProps {
  data: {
    daily: {
      date: string;
      moneyIn: number;
      moneyOut: number;
    }[];
    monthly: {
      date: string;
      moneyIn: number;
      moneyOut: number;
    }[];
  };
}

export function CashflowChart({ data }: CashflowChartProps) {
  const [viewType, setViewType] = useState<"daily" | "monthly">("daily");

  const chartData = useMemo(() => {
    const list = data[viewType];
    
    if (viewType === "monthly") {
      return list.map((d) => {
        const [, m] = d.date.split("-");
        const monthIndex = parseInt(m, 10) - 1;
        return {
          ...d,
          displayDate: MONTH_NAMES[monthIndex],
        };
      });
    }

    return list.map((d) => ({
      ...d,
      displayDate: toNepaliDateShort(d.date),
    }));
  }, [data, viewType]);

  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">Cashflow Trend <span className="font-normal text-muted-foreground">({viewType === "daily" ? "Last 7 Days" : "Last 6 Months"})</span></h3>
        <select 
          className="text-xs bg-transparent border-0 outline-none text-muted-foreground focus:ring-0"
          value={viewType}
          onChange={(e) => setViewType(e.target.value as "daily" | "monthly")}
        >
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div className="h-[200px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis 
              dataKey="displayDate" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
            />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-background border rounded-lg shadow-sm p-3 space-y-1.5">
                      <p className="text-xs font-medium text-foreground">{payload[0].payload.displayDate}</p>
                      {payload.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-[11px] text-muted-foreground">{entry.name === "moneyIn" ? "Money In" : "Money Out"}</span>
                          </div>
                          <span className="text-[11px] font-semibold">{formatDashboardCurrency(entry.value as number)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="moneyIn" name="moneyIn" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={8} />
            <Bar dataKey="moneyOut" name="moneyOut" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={8} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">Money In</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-xs text-muted-foreground">Money Out</span>
        </div>
      </div>
    </div>
  );
}