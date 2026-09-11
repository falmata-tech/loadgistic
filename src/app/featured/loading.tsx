import {PublicHeader} from '@/components/public-header';

export default function FeaturedLoading(){return <><PublicHeader/><main className="public-app-page featured-workspace-page featured-page-skeleton" aria-busy="true" aria-label="Loading Daily Featured Trucks"><section className="container regional-expo-shell"><div className="featured-skeleton-intro"><span/><strong/><small/></div><div className="featured-skeleton-command"><span/><span/><span/></div><div className="featured-skeleton-layout"><div className="featured-skeleton-board">{Array.from({length:6},(_,index)=><span key={index}/>)}</div><aside>{Array.from({length:3},(_,index)=><span key={index}/>)}</aside></div></section></main></>
}
