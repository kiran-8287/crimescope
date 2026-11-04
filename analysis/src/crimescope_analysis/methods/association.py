"""Association rules: aggregate region-year profile transactions."""

from __future__ import annotations

import csv
import json
import math
from itertools import combinations
from pathlib import Path
from typing import Optional


def load_feature_matrix(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["total"] = int(row["total"]) if row.get("total") else 0
            row["year"] = int(row["year"])
            if "reported_value" not in row:
                row["reported_value"] = row["total"]
            rows.append(row)
    return rows


def build_transactions(
    rows: list[dict],
    year: int,
    min_cases: int = 10,
) -> list[set]:
    """Build transactions: one per region, items are categories with cases >= min_cases."""
    year_rows = [r for r in rows if r["year"] == year]
    transactions = []
    regions = sorted({r["region_name"] for r in year_rows})

    for reg in regions:
        reg_rows = [r for r in year_rows if r["region_name"] == reg]
        items = {r["category"] for r in reg_rows if r["total"] >= min_cases}
        if items:
            transactions.append(items)

    return transactions


def apriori(
    transactions: list[set],
    min_support: float = 0.1,
    min_confidence: float = 0.5,
    max_itemset_size: int = 3,
) -> dict:
    """Simple Apriori algorithm for association rules."""
    n_transactions = len(transactions)
    if n_transactions == 0:
        return {
            "n_transactions": 0,
            "rules": [],
            "itemsets": [],
            "message": "No transactions",
        }

    # Count individual items
    item_counts: dict[str, int] = {}
    for txn in transactions:
        for item in txn:
            item_counts[item] = item_counts.get(item, 0) + 1

    # Filter by min_support
    min_support_count = min_support * n_transactions
    frequent_items = {
        item: count for item, count in item_counts.items() if count >= min_support_count
    }

    if not frequent_items:
        return {
            "n_transactions": n_transactions,
            "rules": [],
            "itemsets": [],
            "message": "No frequent items",
        }

    # Generate frequent itemsets up to max_itemset_size
    frequent_itemsets = []
    k = 1
    current_itemsets = {frozenset([item]): count for item, count in frequent_items.items()}

    while current_itemsets and k < max_itemset_size:
        for itemset, count in current_itemsets.items():
            support = count / n_transactions
            frequent_itemsets.append(
                {
                    "itemset": sorted(itemset),
                    "support": round(support, 4),
                    "count": count,
                    "size": k,
                }
            )

        # Generate candidates of size k+1
        candidates = {}
        itemsets_list = list(current_itemsets.keys())
        for i in range(len(itemsets_list)):
            for j in range(i + 1, len(itemsets_list)):
                union = itemsets_list[i] | itemsets_list[j]
                if len(union) == k + 1:
                    # Count support
                    count = sum(1 for txn in transactions if union.issubset(txn))
                    if count >= min_support_count:
                        candidates[union] = count

        current_itemsets = candidates
        k += 1

    # Add the last level
    for itemset, count in current_itemsets.items():
        support = count / n_transactions
        frequent_itemsets.append(
            {
                "itemset": sorted(itemset),
                "support": round(support, 4),
                "count": count,
                "size": k,
            }
        )

    # Generate rules
    rules = []
    for itemset_info in frequent_itemsets:
        itemset = frozenset(itemset_info["itemset"])
        if len(itemset) < 2:
            continue

        itemset_count = itemset_info["count"]

        # Generate all possible antecedent/consequent splits
        for r in range(1, len(itemset)):
            for antecedent in combinations(sorted(itemset), r):
                antecedent = frozenset(antecedent)
                consequent = itemset - antecedent

                # Find antecedent count
                antecedent_count = sum(
                    1 for txn in transactions if antecedent.issubset(txn)
                )
                if antecedent_count == 0:
                    continue

                confidence = itemset_count / antecedent_count
                if confidence < min_confidence:
                    continue

                # Support of the rule = support of itemset
                support = itemset_count / n_transactions

                # Lift = confidence / support(consequent)
                consequent_count = sum(
                    1 for txn in transactions if consequent.issubset(txn)
                )
                consequent_support = consequent_count / n_transactions
                lift = confidence / consequent_support if consequent_support > 0 else 0

                rules.append(
                    {
                        "antecedent": sorted(antecedent),
                        "consequent": sorted(consequent),
                        "support": round(support, 4),
                        "confidence": round(confidence, 4),
                        "lift": round(lift, 4),
                    }
                )

    rules.sort(key=lambda r: (r["lift"], r["confidence"], r["support"]), reverse=True)

    return {
        "n_transactions": n_transactions,
        "n_itemsets": len(frequent_itemsets),
        "n_rules": len(rules),
        "itemsets": frequent_itemsets,
        "rules": rules,
    }


def run_association_rules(
    input_csv: Path,
    output_dir: Path,
    years: list[int],
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = load_feature_matrix(input_csv)

    results = {}
    for year in years:
        transactions = build_transactions(rows, year)
        result = apriori(transactions, min_support=0.15, min_confidence=0.6)
        result["year"] = year
        results[year] = result
        with (output_dir / f"association_rules_{year}.json").open("w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

    return {
        "method": "09_association_rules",
        "years_analyzed": years,
        "output_dir": str(output_dir),
    }
