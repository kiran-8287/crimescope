import { useAssociationRulesQuery } from "@/api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AlertTriangle, Share2 } from "lucide-react";

export function AssociationRulesPage() {
  const [year, setYear] = useState(2020);
  const { data, isLoading, error } = useAssociationRulesQuery(year);

  const years = [2020, 2021, 2022, 2023, 2024];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">Loading association rules…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle size={20} />
          <span>Failed to load association rules: {error.message}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
          No association rule data available. Select a year.
        </div>
      </div>
    );
  }

  const rules = data.rules ?? [];

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Association Rules</h1>
        <p className="text-sm text-muted-foreground">
          Rules of the form "if category A occurs, category B also tends to occur"
          within the same region-year profile.
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Share2 className="text-muted-foreground" size={16} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.n_transactions}</div>
            <p className="text-xs text-muted-foreground">region-year profiles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.n_rules}</div>
            <p className="text-xs text-muted-foreground">significant association rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Lift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.length > 0 ? rules[0].lift.toFixed(2) : "—"}
            </div>
            <p className="text-xs text-muted-foreground">strongest association</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-significant">Top Association Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {["Antecedent → Consequent", "Support", "Confidence", "Lift"].map(
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
                {rules.slice(0, 15).map((rule: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 font-medium">
                      {rule.antecedent.join(", ")} → {rule.consequent.join(", ")}
                    </td>
                    <td className="py-2">{rule.support}</td>
                    <td className="py-2">{rule.confidence}</td>
                    <td className="py-2">{rule.lift}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rules.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No significant association rules found for {year} with the current
              support (≥15%) and confidence (≥60%) thresholds.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
