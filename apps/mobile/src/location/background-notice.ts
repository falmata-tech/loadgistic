export function backgroundNoticeVisible(platform:string,actorId:string,noticeActor:string,needed:boolean,error:string){
 return platform!=='web'&&!!actorId&&noticeActor===actorId&&(needed||!!error);
}

export function navigationHeaderEdges(noticeAbove:boolean):('top'|'left'|'right')[]{
 return noticeAbove?['left','right']:['top','left','right'];
}
