/**
 * Regression tests for the cluster-projection join and centroid feature
 * selection used by the /clusters page.
 *
 * These exercise the pure functions in src/utils/clusterProjection.ts without
 * rendering React, so they run under `node --test` like the other utils tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { joinPcaAndKmeans, selectHeatmapFeatures } from '../src/utils/clusterProjection.ts';

const pca = (runId, components) => ({ runId, result: { components, n_regions: components.length, n_categories: 131 } });
const kmeans = (runId, results) => ({ runId, results });

function component(regionId, region, pc1, pc2) {
  return { region_id: regionId, region, scores: [{ component: 'PC1', score: pc1 }, { component: 'PC2', score: pc2 }] };
}
function assignment(regionId, clusterId) {
  return { region: `State · ${regionId}`, region_id: regionId, cluster_id: clusterId };
}
function cluster(clusterId, size, centroid) {
  return { cluster_id: clusterId, size, centroid };
}

test('joinPcaAndKmeans joins PCA scores to K-means assignments by stable unit id', () => {
  const comps = [component('u1', 'A · X', 1, 2), component('u2', 'B · Y', 3, 4), component('u3', 'C · Z', 5, 6)];
  const assigns = [assignment('u1', 0), assignment('u2', 1), assignment('u3', 0)];
  const res = joinPcaAndKmeans(pca('run-1', comps), kmeans('run-1', { 3: { assignment_records: assigns, clusters: [cluster(0, 2, {}), cluster(1, 1, {})], n_regions: 3 } }), 3);
  assert.equal(res.error, null);
  assert.equal(res.cohortSize, 3);
  assert.deepEqual(res.points.map(p => p.regionId).sort(), ['u1', 'u2', 'u3']);
  assert.equal(res.points.find(p => p.regionId === 'u1').cluster, 0);
  assert.equal(res.points.find(p => p.regionId === 'u3').cluster, 0);
  assert.equal(res.points.find(p => p.regionId === 'u2').cluster, 1);
});

test('joinPcaAndKmeans rejects duplicate PCA ids', () => {
  const comps = [component('u1', 'A · X', 1, 2), component('u1', 'A · X', 3, 4)];
  const assigns = [assignment('u1', 0), assignment('u2', 0)];
  const res = joinPcaAndKmeans(pca('run-1', comps), kmeans('run-1', { 3: { assignment_records: assigns, clusters: [cluster(0, 2, {})], n_regions: 2 } }), 3);
  assert.ok(res.error && res.error.includes('Duplicate'), `got: ${res.error}`);
  assert.equal(res.points.length, 0);
});

test('joinPcaAndKmeans rejects unmatched units without fabricating a cluster', () => {
  const comps = [component('u1', 'A · X', 1, 2)];
  const assigns = [assignment('u2', 0)];
  const res = joinPcaAndKmeans(pca('run-1', comps), kmeans('run-1', { 3: { assignment_records: assigns, clusters: [cluster(0, 1, {})], n_regions: 1 } }), 3);
  assert.ok(res.error && res.error.includes('unmatched'), `got: ${res.error}`);
  assert.equal(res.points.length, 0);
});

test('joinPcaAndKmeans rejects mismatched run ids', () => {
  const comps = [component('u1', 'A · X', 1, 2)];
  const assigns = [assignment('u1', 0)];
  const res = joinPcaAndKmeans(pca('run-1', comps), kmeans('run-2', { 3: { assignment_records: assigns, clusters: [cluster(0, 1, {})], n_regions: 1 } }), 3);
  assert.ok(res.error && res.error.includes('different analysis runs'), `got: ${res.error}`);
});

test('joinPcaAndKmeans returns unavailable when PCA is missing', () => {
  const res = joinPcaAndKmeans({ runId: 'run-1', result: null }, kmeans('run-1', { 3: { assignment_records: [], clusters: [], n_regions: 0 } }), 3);
  assert.ok(res.error && res.error.includes('PCA scores are not available'), `got: ${res.error}`);
  assert.equal(res.points.length, 0);
});

test('selectHeatmapFeatures picks a deterministic spread-ranked subset', () => {
  const clusters = [
    cluster(0, 10, { 'Theft': 2, 'Murder': -1, 'Assault': 0.5 }),
    cluster(1, 10, { 'Theft': -2, 'Murder': 1, 'Assault': 0.5 }),
    cluster(2, 10, { 'Theft': 0, 'Murder': 0, 'Assault': 0 }),
  ];
  const categories = [{ id: 't1', label: 'Theft' }, { id: 'm1', label: 'Murder' }, { id: 'a1', label: 'Assault' }];
  const cols = selectHeatmapFeatures(clusters, categories, 10);
  assert.ok(cols.length <= 10);
  assert.deepEqual(cols.map(c => c.fullLabel).sort(), ['Assault', 'Murder', 'Theft']);
  // Deterministic across calls.
  assert.deepEqual(selectHeatmapFeatures(clusters, categories, 10), cols);
  // Column carries shortened label, full label and resolved id.
  const theft = cols.find(c => c.fullLabel === 'Theft');
  assert.equal(theft.label, 'Theft');
  assert.equal(theft.id, 't1');
});

test('selectHeatmapFeatures ranks by spread across clusters', () => {
  const clusters = [
    cluster(0, 10, { 'Wide': 10, 'Narrow': 1 }),
    cluster(1, 10, { 'Wide': -10, 'Narrow': 1 }),
  ];
  const cols = selectHeatmapFeatures(clusters, undefined, 10);
  assert.equal(cols[0].fullLabel, 'Wide'); // largest spread first
  assert.equal(cols[1].fullLabel, 'Narrow');
});
