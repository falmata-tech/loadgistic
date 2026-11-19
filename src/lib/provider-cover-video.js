// Store only an ID. The public clients construct playback and poster URLs locally.
export function youtubeCoverId(input) {
  const text=String(input??'').trim();
  if (!text) return null;
  let url;
  try { url=new URL(text); } catch { throw Error('INVALID_COVER_VIDEO'); }
  let id=null;
  if (url.protocol==='https:' && !url.username && !url.password && !url.port) {
    if (url.hostname==='youtu.be') id=url.pathname.slice(1);
    if (['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)) {
      id=url.pathname==='/watch' ? url.searchParams.get('v') : /^\/(?:shorts|embed|live)\/([^/]+)$/.exec(url.pathname)?.[1];
    }
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw Error('INVALID_COVER_VIDEO');
  return id;
}

export function coverPosterPath(id) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return id==='WZMVTHGhlbg' ? '/marketing/covers/ethiopian-sinotruk.jpg' : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
