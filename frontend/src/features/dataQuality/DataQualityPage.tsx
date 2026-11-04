import { useDataQualityQuery } from "@/api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AlertTriangle, Database, ShieldCheck, FileText } from "lucide-react";

export function DataQualityPage() {
  const result = useDataQualityQuery();
  const data: any = result.data;
  const { isLoading, error } = result;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">Loading data quality report…</div>
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

  const summary = data?.summary ?? {};
  const perSource = data?.per_source ?? {};

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Data Quality</h1>
        <p className="text-sm text-muted-foreground">
          Row accounting, duplicates, quarantine, and data quality metrics by source.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Source Rows</CardTitle>
            <Database className="text-muted-foreground" size={18} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_source_rows ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Canonical Observations</CardTitle>
            <ShieldCheck className="text-muted-foreground" size={18} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.total_canonical_observations ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quarantined</CardTitle>
            <AlertTriangle className="text-muted-foreground" size={18} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {summary.total_quarantined ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">duplicates + totals mismatches</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Summary Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sources processed</span>
              <span>{summary.total_sources}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Eligible for comparison</span>
              <span>{summary.eligible_for_comparison}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total duplicates</span>
              <span className="text-orange-600">{summary.total_duplicates}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Totals mismatches</span>
              <span className="text-orange-600">{summary.total_totals_mismatch}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Per-Source Accounting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    {["Source", "Rows", "Observations", "Quarantined", "Eligible"].map(
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
                  {Object.entries(perSource).map(([sourceId, acct]: [string, any]) => (
                    <tr key={sourceId} className="border-b border-slate-100">
                      <td className="py-2 text-xs truncate max-w-[200px]">{sourceId}</td>
                      <td className="py-2 text-xs">{acct.source_rows ?? 0}</td>
                      <td className="py-2 text-xs">{acct.canonical_observations ?? 0}</td>
                      <td className="py-2 text-xs text-orange-600">
                        {acct.quarantined ?? 0}
                      </td>
                      <td className="py-2 text-xs">{acct.eligible_for_comparison ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Methodology Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <FileText size={16} className="mr-2" />
            <p>
              All raw source files are preserved unchanged under data/raw/. Provenance is
              retained via source_id and source_row_reference in every canonical row.
            </p>
            <p>
              Quarantined rows are exact duplicates of an earlier row for the same
              year+state+region+category across sources. They are excluded from comparison.
            </p>
            <p>
              Totals validation checks component sums against aggregate rows; zero
              mismatches were found across all years.
            </p>
            <p>
              The 2024 table uses BNS sections instead of IPC sections (schema change),
              mapped via data/mappings/category_crosswalk.csv.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
