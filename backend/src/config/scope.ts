/**
 * Single source of truth for the active analytical scope.
 *
 * The active serving release covers 2021–2024 only. Partial Andhra
 * Pradesh-only 2020 data is preserved in the archive but excluded from the
 * active scope, so it must be rejected everywhere a year is accepted.
 */
export const SUPPORTED_YEARS = [2021, 2022, 2023, 2024] as const;

export const MIN_SUPPORTED_YEAR: number = SUPPORTED_YEARS[0];
export const MAX_SUPPORTED_YEAR: number = SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1];
export const DEFAULT_YEAR: number = MAX_SUPPORTED_YEAR;

export function isSupportedYear(year: number): boolean {
  return (SUPPORTED_YEARS as readonly number[]).includes(year);
}

export function unsupportedYearMessage(year: number): string {
  return `Year ${year} is not supported. Active scope is ${MIN_SUPPORTED_YEAR}–${MAX_SUPPORTED_YEAR}.`;
}
