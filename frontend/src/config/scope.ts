// Active analytical scope for CrimeScope.
// Mirror of backend/src/config/scope.ts. Year selectors and chart axes are driven
// by API-provided `meta.years`; this constant only guards the bootstrap request so
// a stale/bookmarked unsupported year (e.g. 2020) recovers instead of erroring.
export const SUPPORTED_YEARS = [2021, 2022, 2023, 2024] as const;
export const DEFAULT_YEAR: number = SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1];

export function isSupportedYear(year: number): boolean {
  return (SUPPORTED_YEARS as readonly number[]).includes(year);
}
