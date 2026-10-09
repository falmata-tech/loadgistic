"use client";


import {Text,Localized} from '@/components/localization';
import {CalendarClock,Sparkles} from 'lucide-react';

type Controls={featured_mode:string;featured_target_count:number};

export function FeaturedControlsForm({controls}:{controls:Pick<Controls,'featured_mode'|'featured_target_count'>}){
  return <Localized as="section" copy={["aria-label"]} className="card platform-control-card" aria-label="Featured selection settings"><header><Sparkles aria-hidden="true"/><div><h2><Text message="Daily selection"/></h2><p><Text message="Choose automatically by the day’s truck type, or curate each day."/></p></div></header>
    <form action="/api/admin/settings" method="post" className="stack"><input type="hidden" name="section" value="FEATURED"/>
      <div className="form-grid"><div className="form-group"><label htmlFor="featured-selection-mode"><Text message="Selection"/></label><select id="featured-selection-mode" name="mode" defaultValue={controls.featured_mode}><option value="AUTO"><Text message="Automatic daily selection"/></option><option value="MANUAL"><Text message="Manual only"/></option></select></div><div className="form-group"><label htmlFor="featured-selection-count"><Text message="Maximum Drivers per day"/></label><input id="featured-selection-count" type="number" name="targetCount" min="1" max="8" required defaultValue={controls.featured_target_count}/></div></div>
      <p className="meta"><Text message="Random truck-and-Driver pairs rotate without repeats until the eligible round is complete. The actual roster size sets airtime. Saved days and manual drafts are kept."/></p>
      <button className="button secondary"><Text message="Save selection settings"/></button>
    </form>

  </Localized>;
}


export function FeaturedPrepareForm(){
 return <form action="/api/admin/settings" method="post" className="featured-prepare-form"><input type="hidden" name="section" value="PREPARE_FEATURED"/><button className="button secondary"><CalendarClock aria-hidden="true"/><Text message="Prepare upcoming days"/></button></form>;
}
