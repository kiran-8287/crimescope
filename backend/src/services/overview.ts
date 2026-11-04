import { getDatabaseAsync } from "../db/connection.js";

export interface OverviewMetrics {
  totalRegions: number;
  totalCategories: number;
  totalCases: number;
  year: number;
  releaseId: string;
  topRegions: Array<{ region: string; cases: number }>;
  topCategories: Array<{ category: string; cases: number }>;
}

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const db = await getDatabaseAsync();

  const yearResult = db.exec(
    "SELECT DISTINCT year FROM crime_observations LIMIT 1"
  );
  const year = yearResult.length > 0 ? (yearResult[0].values[0][0] as number) : 2020;

  const regionsResult = db.exec(
    "SELECT COUNT(DISTINCT region_name) FROM crime_observations WHERE comparison_status = 'eligible'"
  );
  const totalRegions = (regionsResult[0].values[0][0] as number) || 0;

  const categoriesResult = db.exec(
    "SELECT COUNT(DISTINCT category_id) FROM crime_observations WHERE comparison_status = 'eligible'"
  );
  const totalCategories = (categoriesResult[0].values[0][0] as number) || 0;

  const totalCasesResult = db.exec(
    "SELECT SUM(reported_value) FROM crime_observations WHERE comparison_status = 'eligible' AND region_type != 'aggregate'"
  );
  const totalCases = (totalCasesResult[0].values[0][0] as number | null) || 0;

  const topRegionsResult = db.exec(
    "SELECT region_name, SUM(reported_value) as cases FROM crime_observations " +
    "WHERE comparison_status = 'eligible' AND region_type != 'aggregate' " +
    "GROUP BY region_name ORDER BY cases DESC LIMIT 5"
  );
  const topRegions = topRegionsResult[0].values.map((row: unknown[]) => ({
    region: row[0] as string,
    cases: row[1] as number,
  }));

  const topCategoriesResult = db.exec(
    "SELECT original_category, SUM(reported_value) as cases FROM crime_observations " +
    "WHERE comparison_status = 'eligible' AND region_type != 'aggregate' " +
    "GROUP BY original_category ORDER BY cases DESC LIMIT 5"
  );
  const topCategories = topCategoriesResult[0].values.map((row: unknown[]) => ({
    category: row[0] as string,
    cases: row[1] as number,
  }));

  return {
    totalRegions,
    totalCategories,
    totalCases,
    year,
    releaseId: "2020_cci_district_children",
    topRegions,
    topCategories,
  };
}
