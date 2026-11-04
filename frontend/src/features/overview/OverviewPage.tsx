import { useOverviewQuery } from "@/api/queries";
import { Plot } from "react-plotly.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { TrendingUp, Database, LayoutDashboard, AlertTriangle } from "lucide-react";

export function OverviewPage() {
  const { data, isLoading, error } = useOverviewQuery();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">Loading overview data…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle size={20} />
          <span>Failed to load overview: {error.message}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">No overview data available.</div>
      </div>
    );
  }

  const { totalRegions, totalCategories, totalCases, topRegions, topCategories } = data.data;
  const { releaseId, year, metadata } = data;

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Reported crime patterns for {year}, {metadata.geographyLevel} level — {metadata.categoryScope}.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Regions</CardTitle>
            <Database className="text-muted-foreground" size={18} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRegions}</div>
            <p className="text-xs text-muted-foreground">eligible reporting units</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
            <LayoutDashboard className="text-muted-foreground" size={18} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCategories}</div>
            <p className="text-xs text-muted-foreground">crime categories tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recorded Cases</CardTitle>
            <TrendingUp className="text-muted-foreground" size={18} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCases.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{metadata.geographyLevel} level, {year}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Regions by Recorded Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <Plot
                data={[
                  {
                    x: topRegions.map((r) => r.cases),
                    y: topRegions.map((r) => r.region),
                    type: "bar",
                    orientation: "h",
                    marker: { color: "#2563eb" },
                  },
                ]}
                layout={{
                  margin: { l: 120, r: 20, t: 30, b: 40 },
                  xaxis: { title: "Recorded Cases" },
                  yaxis: { automargin: true },
                  showlegend: false,
                }}
                useResizeHandler={true}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Source: {metadata.datasetVersion} | Release: {releaseId} | Generated: {new Date(
                metadata.generatedAt
              ).toISOString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Categories by Recorded Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <Plot
                data={[
                  {
                    x: topCategories.map((c) => c.cases),
                    y: topCategories.map((c) => c.category),
                    type: "bar",
                    orientation: "h",
                    marker: { color: "#059669" },
                  },
                ]}
                layout={{
                  margin: { l: 120, r: 20, t: 30, b: 40 },
                  xaxis: { title: "Recorded Cases" },
                  yaxis: { automargin: true },
                  showlegend: false,
                }}
                useResizeHandler={true}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Coverage: {metadata.coverage} | Denominator:{" "}
              {metadata.denominator ?? "not available (rates not computed)"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Data Provenance</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p><strong>Release ID:</strong> {releaseId}</p>
          <p><strong>Year:</strong> {year}</p>
          <p><strong>Dataset version:</strong> {metadata.datasetVersion}</p>
          <p><strong>Geography level:</strong> {metadata.geographyLevel}</p>
          <p><strong>Category scope:</strong> {metadata.categoryScope}</p>
          <p><strong>Coverage:</strong> {metadata.coverage}</p>
          <p><strong>Generated at:</strong> {metadata.generatedAt}</p>
          <p>
            <strong>Note:</strong> This dashboard compares reported crime patterns. It does not
            rank actual safety — reporting behaviour, policing, population, and category definitions
            affect the figures.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
