"use client";

import dynamic from 'next/dynamic';

const LeafletRouteMap = dynamic(() => import('./route-coverage-map-leaflet').then(module => module.LeafletRouteMap), {
  ssr:false,
  loading:() => <div className="route-map loading-map" aria-label="Loading coverage map">Loading route map...</div>
});

export function RouteCoverageMap({ routes, comparisonRoutes = [],areas=[],comparisonAreas=[] }: { routes:any[]; comparisonRoutes?:any[];areas?:any[];comparisonAreas?:any[] }) {
  return <LeafletRouteMap routes={routes} comparisonRoutes={comparisonRoutes} areas={areas} comparisonAreas={comparisonAreas}/>;
}
