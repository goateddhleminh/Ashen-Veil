const key='ashenv:settings';
export const DEFAULT_SETTINGS={quality:'high',reducedMotion:false,volume:.5,muted:false};
const valid=s=>s&&['high','low'].includes(s.quality)&&typeof s.reducedMotion==='boolean'&&typeof s.muted==='boolean'&&Number.isFinite(s.volume)&&s.volume>=0&&s.volume<=1;
export function loadSettings(storage=globalThis.localStorage){
 try{const data=JSON.parse(storage.getItem(key));if(valid(data))return {...DEFAULT_SETTINGS,...data};}catch{}
 return {...DEFAULT_SETTINGS,reducedMotion:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false};
}
export function saveSettings(settings,storage=globalThis.localStorage){
 if(!valid(settings))return {ok:false,message:'Invalid settings.'};
 try{storage.setItem(key,JSON.stringify(settings));return {ok:true};}catch{return {ok:false,message:'Settings could not be saved in this browser.'};}
}
