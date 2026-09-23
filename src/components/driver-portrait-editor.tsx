
import {Localized,Text} from '@/components/localization';
import {Camera,Trash2,Upload,UserRound} from 'lucide-react';

export function DriverPortraitEditor({portrait}:{portrait:{imageUrl:string|null;hasPortrait:boolean;custom:boolean}}){
  return <Localized as="section" copy={["aria-label"]} className="card driver-portrait-editor" aria-label="Public Driver photo">
    <h2 className="panel-heading"><Camera aria-hidden="true"/><Text message="Public Driver photo"/></h2>
    <div className="driver-portrait-preview">{portrait.imageUrl?<Localized as="img" copy={["alt"]} src={portrait.imageUrl} alt="Your public Driver photo"/>:<UserRound aria-label="No Driver photo"/>}</div>
    {portrait.hasPortrait&&!portrait.custom?<p className="meta"><Text message="Demo artwork. Upload your own photo or remove it."/></p>:null}
    <p className="meta"><Text message="Your photo is public and may appear beside your name on Featured. Removing it stops future access here; downloaded copies may remain."/></p>
    <Localized as="form" copy={["aria-label"]} action="/api/account/portrait" method="post" encType="multipart/form-data" className="stack" aria-label="Upload Driver photo">
      <input type="hidden" name="command" value="UPLOAD"/>
      <div className="form-group"><label htmlFor="driver-photo"><Text message="Choose photo"/></label><input id="driver-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="driver-photo-help"/><p id="driver-photo-help" className="meta"><Text message="JPG, PNG or WebP, up to 4 MB. Cropped to a square."/></p></div>
      <label className="driver-portrait-consent"><input name="consent" type="checkbox" required/><Text message="I agree to make this photo public."/></label>
      <button className="button icon-button-label"><Upload aria-hidden="true"/>{portrait.custom?<Text message="Replace Driver photo"/>:<Text message="Upload Driver photo"/>}</button>
    </Localized>
    {portrait.hasPortrait?<form action="/api/account/portrait" method="post"><input type="hidden" name="command" value="REMOVE"/><button className="button secondary icon-button-label"><Trash2 aria-hidden="true"/><Text message="Remove Driver photo"/></button></form>:null}
  </Localized>;
}
