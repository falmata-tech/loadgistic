/**
 * Label a complete, already authorized plan. The stored RADIUS geometry
 * represents a town boundary here. A reported location radius is separate.
 * @param {'planned' | 'preferred'} scope
 * @param {unknown} geometry
 * @param {unknown} points
 */
export function capacityCoverageLabel(scope, geometry, points) {
  if (!Array.isArray(points)) return null;
  if (geometry === 'ROUTE' && points.length >= 2) return scope === 'planned' ? 'Planned route' : 'Preferred route';
  if (scope === 'preferred' && geometry === 'RADIUS' && points.length >= 3) return 'Preferred area';
  return null;
}
