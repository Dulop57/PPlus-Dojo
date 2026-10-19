export type UpdateState={status:'unconfigured'|'development'|'checking'|'current'|'downloading'|'ready'|'error';version?:string;percent?:number;message?:string};
export type FirebaseConfig={apiKey:string;authDomain:string;projectId:string;appId:string};
export type DesktopInfo={version:string;firebase:FirebaseConfig|null;releaseRepository:string|null;update:UpdateState;skipPreload?:boolean};
declare global {interface Window {dojoDesktop?:{info:()=>Promise<DesktopInfo>;checkUpdate:()=>Promise<UpdateState>;installUpdate:()=>Promise<void>;onUpdate:(callback:(state:UpdateState)=>void)=>()=>void;beforeClose:(flush:()=>Promise<void>)=>()=>void}}}
