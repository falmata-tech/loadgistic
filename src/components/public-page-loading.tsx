
import {Localized} from '@/components/localization';
import {PublicHeader} from './public-header';
import {SurfaceSkeleton} from './loading-state';

export function PublicPageLoading({kind='map'}:{kind?:'map'|'records'|'form'}){
  return <><PublicHeader/><main className={`public-app-page ${kind==='map'?'public-market-workspace':'public-information-workspace'}`}>
    {kind==='map'?<Localized as="section" copy={["aria-label"]} className="map-workspace-skeleton" aria-label="Loading capacity workspace" aria-busy="true">
      <aside className="skeleton-map-command" aria-hidden="true"><i/><i/><i/></aside>
      <SurfaceSkeleton kind="map" label="Loading capacity map"/>
    </Localized>:<SurfaceSkeleton kind={kind} label="Loading page"/>}
  </main></>;
}
