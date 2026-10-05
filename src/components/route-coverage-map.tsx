"use client";

import dynamic from 'next/dynamic';
import {SurfaceSkeleton} from './loading-state';

const LeafletRouteMap = dynamic(() => import('./route-coverage-map-leaflet').then(module => module.LeafletRouteMap), {
  ssr:false,
  loading:() => <SurfaceSkeleton kind="map" className="route-map loading-map" label="Loading coverage map"/>
});

export function RouteCoverageMap({ routes, comparisonRoutes = [],areas=[],comparisonAreas=[] }: { routes:any[]; comparisonRoutes?:any[];areas?:any[];comparisonAreas?:any[] }) {
  return <LeafletRouteMap routes={routes} comparisonRoutes={comparisonRoutes} areas={areas} comparisonAreas={comparisonAreas}/>;
}
