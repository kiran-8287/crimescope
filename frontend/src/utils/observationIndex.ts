import type { Observation } from '../types';

type Index = Map<string, Observation>;
const indexes = new WeakMap<Observation[], Index>();
const keyOf = (regionId: string, year: number, category: string) => `${regionId}\u001f${year}\u001f${category}`;

/** Build once for a dataset array and reuse it across route mounts and filter changes. */
export function getObservationIndex(observations: Observation[]): Index {
  const cached = indexes.get(observations);
  if (cached) return cached;
  const index: Index = new Map();
  for (const observation of observations) index.set(keyOf(observation.regionId, observation.year, observation.category), observation);
  indexes.set(observations, index);
  return index;
}

export function observationAt(index: Index, regionId: string, year: number, category: string): Observation | undefined {
  return index.get(keyOf(regionId, year, category));
}
