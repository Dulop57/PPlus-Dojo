export type ReferenceCatalog={schemaVersion:number;packs:{path:string;size:number;sha256:string}[];files:Record<string,{pack:string;offset:number;length:number;gzip:boolean}>};
export function packReference(source:string,output:string,target?:number):Promise<{path:string;catalog:ReferenceCatalog}>;
export function checkCloudflare(folder:string):Promise<{count:number;bytes:number}>;
