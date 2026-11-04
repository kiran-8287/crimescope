import { useKmeansQuery, useHierarchicalQuery } from "@/api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AlertTriangle, Share2 } from "lucide-react";

export function ClustersPage() {
  const [year, setYear] = useState(2020);
  const [k, setK] = useState(3);
  const years = [2020, 2021, 2022, 2023, 2024];
  const kValues = [3, 4, 5];
  const kmeansResult = useKmeansQuery(year, k);
  const hierResult = useHierarchicalQuery(year);
  const kmeans = kmeansResult.data as any;
  const hierarchical = hierResult.data as any;
  const isLoading = kmeansResult.isLoading || hierResult.isLoading;
  const error = kmeansResult.error || hierResult.error;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">Loading clustering results…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle size={20} />
          <span>Failed to load clustering: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Clustering</h1>
        <p className="text-sm text-muted-foreground">
          K-means and hierarchical clustering of regions by crime category profile.
        </p>
      </header>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex items-center gap-2">
          <Share2 size={18} className="text-muted-foreground" />
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
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">K (K-means):</span>
          <select
            value={k}
            onChange={(e) => setK(parseInt(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {kValues.map((kv) => (
              <option key={kv} value={kv}>{kv}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">K-means Clustering (k={k})</CardTitle>
          </CardHeader>
          <CardContent>
            {kmeans?.message ? (
              <p className="text-muted-foreground text-xs">{kmeans.message}</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {kmeans.cluster_sizes.map((size: number, i: number) => (
                    <Card key={i} className="p-3">
                      <CardTitle className="text-xs font-medium">Cluster {i}</CardTitle>
                      <div className="text-2xl font-bold">{size}</div>
                      <p className="text-xs text-muted-foreground">regions</p>
                    </Card>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        {["Cluster", "Size", "Regions"].map((h) => (
                          <th key={h} className="text-left border-b border-slate-200 pb-2 font-medium text-muted-foreground">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {kmeans.clusters.map((c: any) => (
                        <tr key={c.cluster_id} className="border-b border-slate-100">
                          <td className="py-2 font-medium">Cluster {c.cluster_id}</td>
                          <td className="py-2">{c.size}</td>
                          <td className="py-2">{c.regions.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Inertia: {kmeans.inertia.toFixed(2)} | Regions: {kmeans.n_regions}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Hierarchical Clustering (Ward)</CardTitle>
          </CardHeader>
          <CardContent>
            {hierarchical?.message ? (
              <p className="text-muted-foreground text-xs">{hierarchical.message}</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        {["Merge", "Clusters Merged", "Distance", "Remaining"].map(
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
                      {hierarchical.merge_history.map((m: any, i: number) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-2 font-medium">Step {i + 1}</td>
                          <td className="py-2">{m.clusters_merged.join(" + ")}</td>
                          <td className="py-2">{m.distance.toFixed(2)}</td>
                          <td className="py-2">{m.remaining_clusters}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">Final Clusters</h3>
                  {hierarchical.clusters.map((c: any) => (
                    <div key={c.cluster_id} className="mb-2 p-2 rounded bg-slate-50">
                      <span className="font-medium">Cluster {c.cluster_id}</span>
                      <span className="text-xs text-muted-foreground ml-2">({c.size} regions)</span>
                      <p className="text-xs mt-1">{c.regions.join(", ")}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
