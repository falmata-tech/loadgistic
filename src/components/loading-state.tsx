export function LoadingIndicator({label='Loading…',className=''}:{label?:string;className?:string}){
  return <span className={`loading-indicator ${className}`} role="status">
    <span className="sr-only">{label}</span>
    <span className="loading-progress-track" aria-hidden="true"><span/></span>
  </span>;
}

export function SurfaceSkeleton({kind='records',label='Loading content',className=''}:{kind?:'records'|'map'|'form'|'chat';label?:string;className?:string}){
  return <section className={`surface-skeleton skeleton-${kind} ${className}`} aria-busy="true" aria-label={label}>
    <span className="sr-only" role="status">{label}</span>
    <div className="skeleton-decoration" aria-hidden="true">
      {kind==='map'?<>
        <svg className="skeleton-map-canvas" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g className="skeleton-map-blocks"><path d="M75 50h155l-25 110-125 15zM280 35h150l35 115-150 40zM515 60h210l-35 130-155-20zM65 270l140-35 35 150-180 25zM335 270l150-35 25 150-160 25zM580 285l150-25 25 150-185 10z"/></g>
          <g className="skeleton-map-streets"><path d="M-20 220C160 170 235 245 375 210S610 210 820 240M250-20C270 120 215 220 285 330S325 440 300 520M-20 430C170 440 220 360 395 430S610 410 830 440M535-20C495 145 560 230 535 520"/></g>
          <g className="skeleton-map-markers"><circle cx="230" cy="205" r="18"/><circle cx="540" cy="255" r="18"/><circle cx="360" cy="370" r="14"/></g>
        </svg>
        <div className="skeleton-map-zoom"><i/><i/></div><div className="skeleton-map-key"><i/><i/><i/></div>
      </>:<>
        <div className="skeleton-heading"><i/><i/></div>
        <div className="skeleton-items">{Array.from({length:kind==='chat'?3:kind==='form'?4:6},(_,index)=><div className="skeleton-item" key={index}><i/><span><i/><i/></span></div>)}</div>
      </>}
    </div>
  </section>;
}
