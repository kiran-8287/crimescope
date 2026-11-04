import { useRegionalComparisonQuery, useTopCategoriesQuery } from "@/api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Plot } from "react-plotly.js";
import { AlertTriangle, Search } from "lucide-react";

export function RegionalComparisonPage() {
  const [year, setYear] = useState(2020);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const { data, isLoading, error } = useRegionalComparisonQuery(year, category);
  const { data: topCats } = useTopCategoriesQuery(year, 10);

  const years = [2020, 2021, 2022, 2023, 2024];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">Loading regional comparison data…</div>
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

  const regions = data?.regions ?? [];
  const cats = topCats ?? [];

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Regional Comparison</h1>
        <p className="text-sm text-muted-foreground">
          Compare reported crime cases across regions for a selected year.
        </p>
      </header>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-muted-foreground" />
          <span className="text-sm font-medium">Year:</span>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Category:</span>
          <select
            value={category ?? ""}
            onChange={(e) =>
              setCategory(e.target.value === "" ? undefined : e.target.value)
            }
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Total Cases by Region ({year})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <Plot
                data={[
                  {
                    x: regions.map((r) => r.total_cases),
                    y: regions.map((r) => r.region),
                    type: "bar",
                    orientation: "h",
                    marker: { color: "#2563eb" },
                  },
                ]}
                layout={{
                  margin: { l: 140, r: 20, t: 30, b: 40 },
                  xaxis: { title: "Total Cases" },
                  yaxis: { automargin: true },
                  showlegend: false,
                }}
                useResizeHandler={true}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Top Categories by Cases ({year})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <Plot
                data={[
                  {
                    x: cats.map((c) => c.total_cases),
                    y: cats.map((c) => c.category),
                    type: "bar",
                    orientation: "h",
                    marker: { color: "#059669" },
                  },
                ]}
                layout={{
                  margin: { l: 140, r: 20, t: 30, b: 40 },
                  xaxis: { title: "Total Cases" },
                  yaxis: { automargin: true },
                  showlegend: false,
                }}
                useResizeHandler={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Regional Data Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {[
                    "Region",
                    "Total Cases",
                    "Observations",
                    "Mean",
                    "Median",
                    "Std Dev",
                    "Min",
                    "Max",
                  ].map((h) => (
                    <th key={h} className="text-left border-b border-slate-200 pb-2 font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={r.region} className="border-b border-slate-100">
                    <td className="py-2 font-medium">{r.region}</td>
                    <td className="py-2">{r.total_cases}</td>
                    <td className="py-2">{r.observations}</td>
                    <td className="py-2">{r.mean}</td>
                    <td className="py-2">{r.median}</td>
                    <td className="py-2">{r.std}</td>
                    <td className="py-2">{r.min}</td>
                    <td className="py-2">{r.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
