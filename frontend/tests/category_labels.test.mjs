/**
 * Regression tests for the shared category display-label mapping.
 *
 * The raw source labels carry a lettered prefix ("f) In Any other place") that
 * is stripped for display. Stripping alone leaves ambiguous entries, so the
 * mapping must re-attach verified parent context from `sourceHeaders`, keyed by
 * the stable category id — never by cleaned-label matching.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanCategoryName,
  categoryContextLabel,
  categoryContextLabelByRaw,
  categoryContextStatus,
  PARENT_CONTEXT_UNAVAILABLE,
} from '../src/utils/categories.ts';

const here = dirname(fileURLToPath(import.meta.url));
const hierarchy = JSON.parse(readFileSync(resolve(here, '../../config/category_hierarchy.json'), 'utf8'));
const data = { meta: { categories: hierarchy.categories } };
const AMBIGUOUS_ID = '191b5a87122b8c7182fbc08f';

test('lettered prefixes are stripped from the raw source label', () => {
  assert.equal(cleanCategoryName('f) In Any other place'), 'In Any other place');
});

test('ambiguous leaf label gains verified parent context via its stable id', () => {
  assert.equal(
    categoryContextLabel(data, AMBIGUOUS_ID, 'f) In Any other place', 2024),
    'Sexual Harassment › In Any other place'
  );
});

test('raw-label resolution attaches context without inventing a parent', () => {
  assert.equal(
    categoryContextLabelByRaw(data, 'f) In Any other place', 2024),
    'Sexual Harassment › In Any other place'
  );
  // A raw label with no verified taxonomy entry keeps its cleaned label and is
  // explicitly marked as having unavailable parent context; no parent is fabricated.
  assert.equal(
    categoryContextLabelByRaw(data, 'Totally Unknown Offence', 2024),
    `Totally Unknown Offence · ${PARENT_CONTEXT_UNAVAILABLE}`
  );
});

test('context-free ids keep the cleaned raw label and mark unavailable context', () => {
  // Intentional behaviour change: a genuinely unresolved category must say so
  // rather than silently presenting a context-free label as if it were resolved.
  assert.equal(
    categoryContextLabel(data, 'does-not-exist', 'g) Some leaf', 2024),
    `Some leaf · ${PARENT_CONTEXT_UNAVAILABLE}`
  );
  assert.equal(categoryContextStatus(data, 'does-not-exist', 2024), 'unavailable');
});

test('legitimate top-level categories are not marked unresolved', () => {
  const fixture = {
    meta: {
      categories: [
        { id: 'TOP', label: 'Total Cognizable IPC crimes', years: [2024], sourceHeaders: { '2024': ['Total Cognizable IPC crimes'] } },
      ],
    },
  };
  assert.equal(categoryContextStatus(fixture, 'TOP', 2024), 'top_level');
  const label = categoryContextLabel(fixture, 'TOP', 'Total Cognizable IPC crimes', 2024);
  assert.equal(label, 'Total Cognizable IPC crimes');
  assert.ok(!label.includes(PARENT_CONTEXT_UNAVAILABLE));
});

test('categories with no verified header are marked unavailable', () => {
  const fixture = {
    meta: {
      categories: [
        { id: 'NOCTX', label: 'g) Some leaf', years: [2024], sourceHeaders: {} },
      ],
    },
  };
  assert.equal(categoryContextStatus(fixture, 'NOCTX', 2024), 'unavailable');
  assert.equal(
    categoryContextLabel(fixture, 'NOCTX', 'g) Some leaf', 2024),
    `Some leaf · ${PARENT_CONTEXT_UNAVAILABLE}`
  );
});

test('verified hierarchy reports hierarchical status', () => {
  assert.equal(categoryContextStatus(data, AMBIGUOUS_ID, 2024), 'hierarchical');
});

test('parent context keeps colliding cleaned leaves distinct', () => {
  const fixture = {
    meta: {
      categories: [
        { id: 'A', label: 'f) In Any other place', years: [2024], sourceHeaders: { '2024': ['Offences against Women and Child | Sexual Harassment | f) In Any other place'] } },
        { id: 'B', label: 'c) In Any other place', years: [2024], sourceHeaders: { '2024': ['Offences against Property | Theft | c) In Any other place'] } },
      ],
    },
  };
  // Both cleaned leaves are identical after prefix stripping ...
  assert.equal(cleanCategoryName('f) In Any other place'), cleanCategoryName('c) In Any other place'));
  // ... but the contextual labels remain distinct because parents differ.
  assert.notEqual(
    categoryContextLabel(fixture, 'A', 'f) In Any other place', 2024),
    categoryContextLabel(fixture, 'B', 'c) In Any other place', 2024)
  );
});

test('stable category ids are unique in the taxonomy', () => {
  const ids = data.meta.categories.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
});
