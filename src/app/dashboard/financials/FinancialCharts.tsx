"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

interface Props {
  revenue: number;
  expenses: number;
  netProfit: number;
}

export default function FinancialCharts({ revenue, expenses, netProfit }: Props) {
  const data = [
    { name: "Net Profit", value: Math.max(0, netProfit), color: "#10b981" },
    { name: "Expenses", value: expenses, color: "#ef4444" },
  ];

  // If revenue is 0, show a grey empty chart
  const isEmpty = revenue === 0;
  const renderData = isEmpty ? [{ name: "No Data", value: 1, color: "#e5e7eb" }] : data;

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={renderData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {renderData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          {!isEmpty && <Tooltip formatter={(value: unknown) => `₹${Number(value).toLocaleString()}`} />}
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
