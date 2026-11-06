import type {CategoryMeta,Dataset} from '../types';

const warned = new Set<string>();

export function cleanCategoryName(rawLabel: string): string {
  if (!rawLabel) return "";
  let cleaned = rawLabel.replace(/^[a-z0-9]\)\s*/i, '').replace(/^[A-Z]\.\s*/, '').trim();
  cleaned = cleaned.replace(/\s*\([^)]*BNS[^)]*\)/gi, '');
  cleaned = cleaned.replace(/\s*\([^)]*IPC[^)]*\)/gi, '');
  cleaned = cleaned.replace(/\s*\([^)]*Sec[^)]*\)/gi, '');
  cleaned = cleaned.replace(/\s*BNS\)?/gi, '');
  cleaned = cleaned.replace(/\s*\/[0-9/A-Z\s]+BNS\/IPC\)?/gi, '');
  cleaned = cleaned.replace(/\s*\/Section\s*[0-9A-Z\s/]+IPC\)?/gi, '');
  cleaned = cleaned.replace(/\s*\/[0-9]+\s*IPC\)?/gi, '');
  cleaned = cleaned.replace(/\s*\/\s*$/, '');
  return cleaned.trim() || rawLabel;
}

export function categoryLabel(data: Dataset, id: string): string {
  const value = data.meta.categories?.find(category => category.id === id)?.label;
  if (value) return cleanCategoryName(value);
  if (!warned.has(id)) {
    console.warn(`CrimeScope category metadata missing for ${id}`);
    warned.add(id);
  }
  return `[Unknown category: ${id}]`;
}

export function rawCategoryLabel(data: Dataset, id: string): string {
  return data.meta.categories?.find(category => category.id === id)?.label ?? id;
}

export function categoryParentGroup(data: Dataset, id: string): string {
  const cat = data.meta.categories?.find(c => c.id === id);
  if (!cat || !cat.sourceHeaders) return "All Offences";
  const header = Object.values(cat.sourceHeaders)[0]?.[0] || "";
  if (header && header.includes(" | ")) {
    return header.split(" | ")[0].trim();
  }
  return "All Offences";
}

export function categoryDetails(data: Dataset, id: string) {
  const cat = data.meta.categories?.find(c => c.id === id);
  const rawLabel = cat?.label || id;
  const displayName = cleanCategoryName(rawLabel);
  const parent = categoryParentGroup(data, id);
  const header = cat?.sourceHeaders ? Object.values(cat.sourceHeaders)[0]?.[0] : null;
  return {
    id,
    displayName,
    originalLabel: rawLabel,
    parentGroup: parent,
    sourceHeader: header
  };
}

export function categoriesForYear(data: Dataset, year: number): CategoryMeta[] {
  const list = data.meta.categories ?? [...new Map(data.observations.filter(row => row.year === year).map(row => [row.category, { id: row.category, label: row.categoryLabel ?? row.category, years: [year] }])).values()];
  return list.filter(category => category.years.includes(year)).sort((a, b) => cleanCategoryName(a.label).localeCompare(cleanCategoryName(b.label)));
}

export function roleFor(data: Dataset, id: string, year: number): string {
  return data.meta.categories?.find(category => category.id === id)?.rolesByYear?.[String(year)]?.[0] ?? 'unclassified';
}
