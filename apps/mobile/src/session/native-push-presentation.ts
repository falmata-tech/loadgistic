// Android can deliver during its foreground-to-background lifecycle debounce.
// The in-app feed handles active screens; other states allow generic OS alerts.
export function nativePushPresentation(appState:string|null){
 const present=appState!=='active';
 return {shouldPlaySound:present,shouldSetBadge:false,shouldShowBanner:present,shouldShowList:present};
}
