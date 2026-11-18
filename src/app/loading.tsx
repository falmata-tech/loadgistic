import {RouteLoading} from '@/components/route-loading';

// This boundary also covers authenticated layouts. Never briefly substitute the
// public header for a dashboard whose own shell is still being resolved.
export default function AppLoading(){
  return <RouteLoading/>;
}
