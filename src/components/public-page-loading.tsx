
import {PublicHeader} from './public-header';
import {MapWorkspaceSkeleton,SurfaceSkeleton} from './loading-state';

export function PublicPageLoading({kind='map'}:{kind?:'map'|'records'|'form'}){
  return <><PublicHeader/><main className={`public-app-page ${kind==='map'?'public-market-workspace':'public-information-workspace'}`}>
    {kind==='map'?<MapWorkspaceSkeleton/>:<SurfaceSkeleton kind={kind} label="Loading page"/>}
  </main></>;
}
