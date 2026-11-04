import { useOverviewQuery } from "@/api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { TrendingUp, Database, LayoutDashboard, AlertTriangle, Download } from "lucide-react";

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Overview</h1>
            <p className="text-sm text-muted-foreground">
              Reported crime patterns for {year}, {metadata.geographyLevel} level — {metadata.categoryScope}.
            </p>
          </div>
          <a
            href="/api/v1/export/canonical"
            download
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover border border-primary rounded"
          >
            <Download size={16} />
            <span>Download CSV</span>
          </a>
        </div>
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
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Regions by Recorded Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left border-b border-slate-200 pb-2 font-medium text-muted-foreground">Region</th>
                    <th className="text-right border-b border-slate-200 pb-2 font-medium text-muted-foreground">Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {topRegions.map((r) => (
                    <tr key={r.region} className="border-b border-slate-100">
                      <td className="py-2 font-medium">{r.region}</td>
                      <td className="py-2 text-right">{r.cases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Source: {metadata.datasetVersion} | Release: {releaseId} | Generated: {new Date(
                metadata.generatedAt
              ).toISOString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Categories by Recorded Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left border-b border-slate-200 pb-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-right border-b border-slate-200 pb-2 font-medium text-muted-foreground">Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {topCategories.map((c) => (
                    <tr key={c.category} className="border-b border-slate-100">
                      <td className="py-2 font-medium">{c.category}</td>
                      <td className="py-2 text-right">{c.cases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
