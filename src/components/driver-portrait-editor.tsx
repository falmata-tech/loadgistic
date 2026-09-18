import {Camera,Trash2,Upload,UserRound} from 'lucide-react';

export function DriverPortraitEditor({portrait}:{portrait:{imageUrl:string|null;hasPortrait:boolean;custom:boolean}}){
  return <section className="card driver-portrait-editor" aria-label="Public Driver photo">
    <h2 className="panel-heading"><Camera aria-hidden="true"/>Public Driver photo</h2>
    <div className="driver-portrait-preview">{portrait.imageUrl?<img src={portrait.imageUrl} alt="Your public Driver photo"/>:<UserRound aria-label="No Driver photo"/>}</div>
    {portrait.hasPortrait&&!portrait.custom?<p className="meta">Demo artwork. Upload your own photo or remove it.</p>:null}
    <p className="meta">Your photo is public and may appear beside your name on Featured. Removing it stops future access here; downloaded copies may remain.</p>
    <form action="/api/account/portrait" method="post" encType="multipart/form-data" className="stack" aria-label="Upload Driver photo">
      <input type="hidden" name="command" value="UPLOAD"/>
      <div className="form-group"><label htmlFor="driver-photo">Choose photo</label><input id="driver-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="driver-photo-help"/><p id="driver-photo-help" className="meta">JPG, PNG or WebP, up to 4 MB. Cropped to a square.</p></div>
      <label className="driver-portrait-consent"><input name="consent" type="checkbox" required/>I agree to make this photo public.</label>
      <button className="button icon-button-label"><Upload aria-hidden="true"/>{portrait.custom?'Replace Driver photo':'Upload Driver photo'}</button>
    </form>
    {portrait.hasPortrait?<form action="/api/account/portrait" method="post"><input type="hidden" name="command" value="REMOVE"/><button className="button secondary icon-button-label"><Trash2 aria-hidden="true"/>Remove Driver photo</button></form>:null}
  </section>;
}
