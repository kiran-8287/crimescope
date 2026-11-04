import { useTrendsQuery, useRegionalComparisonQuery } from "@/api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Plot } from "react-plotly.js";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function TrendsPage() {
  const [year, setYear] = useState(2020);
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const { data: comparison } = useRegionalComparisonQuery(year);
  const { data, isLoading, error } = useTrendsQuery(region, category);

  const regions = comparison?.regions.map((r) => r.region) ?? [];
  const categories = [
    "Murder",
    "Culpable Homicide not amounting to Murder",
    "Rape",
    "Kidnapping and Abduction Total",
    "Theft Total",
    "Robbery",
    "Dacoity Total",
    "Rioting Total",
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">Loading trend data…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle size={20} />
          <span>Failed to load: {error.message}</span>
        </div>
      </div>
    );
  }

  const trend = data?.trend ?? [];

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Trends</h1>
        <p className="text-sm text-muted-foreground">
          Year-over-year change in reported cases for a region and category.
        </p>
      </header>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex items-center gap-2">
          <RefreshCw size={18} className="text-muted-foreground" />
          <span className="text-sm font-medium">Year:</span>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {[2020, 2021, 2022, 2023, 2024].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Region:</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Select region</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Category:</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {region && category ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Trend: {category} in {region}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <Plot
                  data={[
                    {
                      x: trend.map((t) => t.year),
                      y: trend.map((t) => t.curr_total),
                      type: "scatter",
                      mode: "lines+markers",
                      line: { color: "#2563eb" },
                    },
                  ]}
                  layout={{
                    margin: { l: 60, r: 20, t: 30, b: 50 },
                    xaxis: { title: "Year" },
                    yaxis: { title: "Total Cases" },
                    showlegend: false,
                  }}
                  useResizeHandler={true}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Year-over-Year Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      {["Year", "Prev Total", "Curr Total", "Abs Change", "Pct Change"].map(
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
                    {trend.map((t) => (
                      <tr key={t.year} className="border-b border-slate-100">
                        <td className="py-2">{t.year}</td>
                        <td className="py-2">{t.prev_total}</td>
                        <td className="py-2">{t.curr_total}</td>
                        <td className="py-2">{t.abs_change}</td>
                        <td className="py-2">{t.pct_change ?? "—"}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="p-6 flex items-center justify-center min-h-[400px] text-muted-foreground">
          Select a region and category to view the trend.
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
