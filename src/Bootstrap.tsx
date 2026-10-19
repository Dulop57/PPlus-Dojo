import {useEffect,useState,useSyncExternalStore} from 'react';
import App from './App';
import {initializeCloud,subscribeAccount,accountSnapshot} from './cloud';
import {preloadPreference,setPreload,subscribePreload,preloadSnapshot} from './data/preload';
import type {DesktopInfo} from './desktop';
import {flushStudyWrites} from './data/study-progress';
import {initializeWeb} from './data/web-storage';
let startup:Promise<DesktopInfo|null>|undefined;
function start(){return startup??=(async()=>{const desktop=window.dojoDesktop?await window.dojoDesktop.info():null;const web=desktop?null:await initializeWeb();await initializeCloud(desktop?.firebase??web?.firebase??null);if(desktop?.skipPreload)await setPreload(false);else if(preloadPreference())await setPreload(true);return desktop;})();}
export default function Bootstrap(){
  const [ready,setReady]=useState(false),[desktop,setDesktop]=useState<DesktopInfo|null>(null),[error,setError]=useState('');
  const account=useSyncExternalStore(subscribeAccount,accountSnapshot),preload=useSyncExternalStore(subscribePreload,preloadSnapshot);
  useEffect(()=>{let active=true;start().then(info=>{if(active){setDesktop(info);setReady(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  useEffect(()=>window.dojoDesktop?.beforeClose(flushStudyWrites),[]);
  if(!ready)return <main className="desktop-startup"><h1>P+ DOJO</h1><p role="status">{error||preload.message||(import.meta.env.VITE_DOJO_WEB==='1'?'NOW LOADING...':'Opening your local app…')}</p>{preload.loading&&<><progress value={preload.done} max={preload.total||1}/><p>{preload.done.toLocaleString()} / {preload.total.toLocaleString()} animations</p><button className="button secondary" onClick={()=>void setPreload(false)}>Skip preload</button></>}{error&&<button className="button secondary" onClick={()=>{setStudyOffline();setReady(true);}}>Continue offline</button>}</main>;
  return <App key={account.uid??'guest'} desktop={desktop}/>;
}
function setStudyOffline(){void initializeCloud(null);}
