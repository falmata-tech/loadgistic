import {LoadingIndicator} from '@/components/loading-state';

// This boundary also covers authenticated layouts. Never briefly substitute the
// public header/map for a dashboard whose own shell is still being resolved.
export default function AppLoading(){
  return <main className="app-route-loading"><LoadingIndicator label="Loading page"/></main>;
}
