import {LoaderCircle} from 'lucide-react';

export function LoadingIndicator({label='Loading…'}:{label?:string}){
  return <span className="loading-indicator" role="status"><LoaderCircle aria-hidden="true"/><span>{label}</span></span>;
}

export function SurfaceSkeleton({kind='records',label='Loading content',className=''}:{kind?:'records'|'map'|'form'|'chat';label?:string;className?:string}){
  return <section className={`surface-skeleton skeleton-${kind} ${className}`} aria-busy="true" aria-label={label}>
    <span className="sr-only" role="status">{label}</span>
    <div className="skeleton-decoration" aria-hidden="true">
      {kind==='map'?<><div className="skeleton-map-tools"><i/><i/><i/></div><div className="skeleton-map-road"/><div className="skeleton-map-road secondary"/></>:<>
        <div className="skeleton-heading"><i/><i/></div>
        <div className="skeleton-items">{Array.from({length:kind==='chat'?3:kind==='form'?4:6},(_,index)=><div className="skeleton-item" key={index}><i/><span><i/><i/></span></div>)}</div>
      </>}
    </div>
  </section>;
}
