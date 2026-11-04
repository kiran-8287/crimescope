import { useAnomaliesQuery } from "@/api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AlertTriangle, TrendingUp } from "lucide-react";

export function AnomaliesPage() {
  const [year, setYear] = useState(2020);
  const { data, isLoading, error } = useAnomaliesQuery(year);

  const years = [2020, 2021, 2022, 2023, 2024];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">Loading anomaly detection results…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle size={20} />
          <span>Failed to load anomalies: {error.message}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
          No anomaly data available. Select a year.
        </div>
      </div>
    );
  }

  const cs = data.cross_sectional ?? [];
  const yoy = data.year_on_year ?? [];

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Unusual Changes & Anomaly Detection</h1>
        <p className="text-sm text-muted-foreground">
          Flagged regions where crime values deviate from expected patterns.
        </p>
      </header>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Year:</span>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="border rounded px-2 py-1 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cross-Sectional Anomalies</CardTitle>
            <AlertTriangle className="text-muted-foreground" size={16} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data.cross_sectional_count}</div>
            <p className="text-xs text-muted-foreground">
              Regions deviating ≥2.5σ from the category mean
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Year-on-Year Anomalies</CardTitle>
            <TrendingUp className="text-muted-foreground" size={16} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data.year_on_year_count}</div>
            <p className="text-xs text-muted-foreground">
              Region-category pairs with ≥50% YoY change
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Cross-Sectional Anomalies (Top 20)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {["Region", "Category", "Value", "Z-Score", "Direction"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left border-b border-slate-200 pb-2 font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {cs.slice(0, 20).map((a: any) => (
                    <tr key={`${a.region}-${a.category}`} className="border-b border-slate-100">
                      <td className="py-1 font-medium">{a.region}</td>
                      <td className="py-1">{a.category}</td>
                      <td className="py-1">{a.value}</td>
                      <td className="py-1">{a.z_score}</td>
                      <td className="py-1">
                        <span
                          className={`text-xs font-medium ${
                            a.direction === "high" ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {a.direction}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Year-on-Year Anomalies (Top 20)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {["Region", "Category", "Prev", "Curr", "Change %", "Direction"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left border-b border-slate-200 pb-2 font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {yoy.slice(0, 20).map((a: any) => (
                    <tr key={`${a.region}-${a.category}-${a.year}`} className="border-b border-slate-100">
                      <td className="py-1 font-medium">{a.region}</td>
                      <td className="py-1">{a.category}</td>
                      <td className="py-1">{a.prev_total}</td>
                      <td className="py-1">{a.curr_total}</td>
                      <td className="py-1">{a.pct_change}%</td>
                      <td className="py-1">
                        <span
                          className={`text-xs font-medium ${
                            a.direction === "increase" ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {a.direction}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
