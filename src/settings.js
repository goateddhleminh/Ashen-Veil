import { validAutoSellConfig } from './economy.js';
const key='ashenv:settings';
export const DEFAULT_SETTINGS={quality:'high',reducedMotion:false,volume:.5,muted:false,autoSalvage:'none',autoSalvageExact:'none',autoEquip:true,autoSell:{enabled:false,rarities:[],types:[],currency:'gold'}};
const valid=s=>s&&['high','low'].includes(s.quality)&&typeof s.reducedMotion==='boolean'&&typeof s.muted==='boolean'&&Number.isFinite(s.volume)&&s.volume>=0&&s.volume<=1&&(s.autoSalvage===undefined||['none','common','magic','rare'].includes(s.autoSalvage))&&(s.autoSalvageExact===undefined||['none','common','magic','rare'].includes(s.autoSalvageExact))&&(s.autoEquip===undefined||typeof s.autoEquip==='boolean')&&(s.autoSell===undefined||validAutoSellConfig(s.autoSell));
const withDefaults=s=>({...DEFAULT_SETTINGS,...s,autoSell:{...(s?.autoSell??DEFAULT_SETTINGS.autoSell),rarities:[...(s?.autoSell?.rarities??[])],types:[...(s?.autoSell?.types??[])]}});
export function loadSettings(storage=globalThis.localStorage){
 try{const data=JSON.parse(storage.getItem(key));if(valid(data))return withDefaults(data);}catch{}
 return withDefaults({reducedMotion:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false});
}
export function saveSettings(settings,storage=globalThis.localStorage){
 if(!valid(settings))return {ok:false,message:'Invalid settings.'};
 try{storage.setItem(key,JSON.stringify(withDefaults(settings)));return {ok:true};}catch{return {ok:false,message:'Settings could not be saved in this browser.'};}
}
