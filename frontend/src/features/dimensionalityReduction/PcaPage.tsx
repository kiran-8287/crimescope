import { usePcaQuery } from "@/api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Plot } from "react-plotly.js";
import { AlertTriangle } from "lucide-react";

export function PcaPage() {
  const [year, setYear] = useState(2020);
  const result = usePcaQuery(year);
  const data = result.data as any;
  const { isLoading, error } = result;

  const years = [2020, 2021, 2022, 2023, 2024];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">Loading PCA results…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle size={20} />
          <span>Failed to load PCA: {error.message}</span>
        </div>
      </div>
    );
  }

  if (!data || data.message) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
          {data?.message || "No PCA data available. Select a year."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Principal Component Analysis (PCA)</h1>
        <p className="text-sm text-muted-foreground">
          Dimensionality reduction on the region × category crime matrix for {year}.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Explained Variance Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <Plot
                data={[
                  {
                    x: data.explained_variance_ratio.map((_v: any, i: number) => `PC${i + 1}`),
                    y: data.explained_variance_ratio.map((v: any) => v * 100),
                    type: "bar",
                    marker: { color: "#2563eb" },
                  },
                ]}
                layout={{
                  margin: { l: 60, r: 20, t: 30, b: 40 },
                  xaxis: { title: "Principal Component" },
                  yaxis: { title: "Explained Variance (%)" },
                  showlegend: false,
                }}
                useResizeHandler={true}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cumulative: {(data.cumulative_variance_ratio[data.cumulative_variance_ratio.length - 1] * 100).toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Eigenvalues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <Plot
                data={[
                  {
                    x: data.eigenvalues.map((_v: any, i: number) => `PC${i + 1}`),
                    y: data.eigenvalues,
                    type: "bar",
                    marker: { color: "#059669" },
                  },
                ]}
                layout={{
                  margin: { l: 60, r: 20, t: 30, b: 40 },
                  xaxis: { title: "Principal Component" },
                  yaxis: { title: "Eigenvalue" },
                  showlegend: false,
                }}
                useResizeHandler={true}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">PCA Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Regions analyzed</span>
              <span>{data.n_regions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Categories</span>
              <span>{data.n_categories}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Components</span>
              <span>{data.n_components}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Year</span>
              <span>{data.year}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Component Loadings (Top Features)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <Plot
                data={data.loadings.flatMap((loading: any) =>
                  loading.features
                    .sort((a: any, b: any) => Math.abs(b.loading) - Math.abs(a.loading))
                    .slice(0, 8)
                    .map((f: any) => ({
                      x: f.loading,
                      y: `${loading.component} – ${f.category}`,
                      type: "bar",
                      orientation: "h",
                    }))
                )}
                layout={{
                  barmode: "group",
                  margin: { l: 140, r: 20, t: 30, b: 40 },
                  xaxis: { title: "Loading" },
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
            <CardTitle className="text-sm font-semibold">Region Scores (PC1 vs PC2)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <Plot
                data={[
                  {
                    x: data.components.map((c: any) =>
                      c.scores.find((s: any) => s.component === "PC1")?.score ?? 0
                    ),
                    y: data.components.map((c: any) =>
                      c.scores.find((s: any) => s.component === "PC2")?.score ?? 0
                    ),
                    mode: "markers+text",
                    type: "scatter",
                    text: data.components.map((c: any) => c.region),
                    textposition: "top center",
                    marker: { color: "#2563eb", size: 10 },
                  },
                ]}
                layout={{
                  margin: { l: 60, r: 20, t: 30, b: 50 },
                  xaxis: { title: "PC1" },
                  yaxis: { title: "PC2" },
                  showlegend: false,
                }}
                useResizeHandler={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
