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
  if (value) return categoryContextLabel(data, id, value);
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

// Verified source-header hierarchy (top → leaf) for a stable category id.
// Uses the year-specific header when available so year distinctions are kept.
export function categoryHierarchyPath(data: Dataset, id: string, year?: number): string[] {
  const cat = data.meta.categories?.find(c => c.id === id);
  if (!cat?.sourceHeaders) return [];
  const header = (year != null ? cat.sourceHeaders[String(year)]?.[0] : undefined) || Object.values(cat.sourceHeaders)[0]?.[0];
  if (!header) return [];
  return header.split(" | ").map(segment => segment.trim()).filter(Boolean);
}

// Whether verified parent context is on record for a stable category id.
// `hierarchical` — a verified multi-segment source header exists.
// `top_level`    — a legitimate one-segment category (e.g. an official total);
//                  this is NOT an unresolved category and must not be flagged.
// `unavailable`  — no verified header is on record, so no parent may be shown.
export type CategoryContextStatus = 'hierarchical' | 'top_level' | 'unavailable';

export function categoryContextStatus(data: Dataset, id: string, year?: number): CategoryContextStatus {
  const cat = data.meta.categories?.find(c => c.id === id);
  if (!cat?.sourceHeaders) return 'unavailable';
  const path = categoryHierarchyPath(data, id, year);
  if (path.length >= 2) return 'hierarchical';
  if (path.length === 1) return 'top_level';
  return 'unavailable';
}

// Concise marker appended when a category has no verified parent context, so a
// context-free label is not mistaken for a resolved parent › leaf label.
export const PARENT_CONTEXT_UNAVAILABLE = 'Parent context unavailable';

// Contextual display label: immediate parent context → child label, resolved by
// stable category id (not by cleaned-label matching). A legitimate top-level
// category keeps its plain label; a category with no verified hierarchy keeps
// its label but is marked as having unavailable parent context.
export function categoryContextLabel(data: Dataset, id?: string, rawLabel?: string, year?: number): string {
  const fallback = cleanCategoryName(rawLabel ?? "");
  if (!id) return fallback;
  const path = categoryHierarchyPath(data, id, year);
  if (path.length < 2) {
    const base = fallback || cleanCategoryName(path[0] ?? "") || `[Unknown category: ${id}]`;
    if (path.length === 1) return base;
    return `${base} · ${PARENT_CONTEXT_UNAVAILABLE}`;
  }
  const leaf = cleanCategoryName(path[path.length - 1]);
  const parent = cleanCategoryName(path[path.length - 2]) || path[path.length - 2];
  if (!leaf) return parent;
  if (!parent || parent.toLowerCase() === leaf.toLowerCase()) return leaf;
  return `${parent} › ${leaf}`;
}

// Resolve a raw source label (as stored in analysis artifacts) to a contextual
// display label via its stable category id. Labels with no verified taxonomy
// entry — or an unresolvable year collision — keep the cleaned label but are
// marked as having unavailable parent context rather than guessing a parent.
export function categoryContextLabelByRaw(data: Dataset, rawLabel: string, year?: number): string {
  const matches = (data.meta.categories ?? []).filter(c => c.label === rawLabel);
  if (matches.length === 1) return categoryContextLabel(data, matches[0].id, rawLabel, year);
  const yearMatch = matches.find(c => year != null && c.years.includes(year));
  if (yearMatch) return categoryContextLabel(data, yearMatch.id, rawLabel, year);
  const cleaned = cleanCategoryName(rawLabel);
  return cleaned ? `${cleaned} · ${PARENT_CONTEXT_UNAVAILABLE}` : rawLabel;
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
