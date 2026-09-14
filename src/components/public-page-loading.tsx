import {PublicHeader} from './public-header';
import {SurfaceSkeleton} from './loading-state';

export function PublicPageLoading({kind='map'}:{kind?:'map'|'records'|'form'}){
  return <><PublicHeader/><main className={`public-app-page ${kind==='map'?'public-market-workspace':'public-information-workspace'}`}><SurfaceSkeleton kind={kind} label={kind==='map'?'Loading capacity workspace':'Loading page'}/></main></>;
}
