export type ReferenceCell = {r:number;c:number;v:string|number|boolean|null;bold?:boolean;formula?:string;note?:string;link?:string;format?:string};
export type ReferenceSheet = {name:string;rows:number;columns:number;cells:ReferenceCell[];merges:number[][]};
export type ReferenceBook = {schemaVersion:number;source:string;sha256:string;sheets:ReferenceSheet[];missingCachedValues:string[]};
export type Ranking = {name:string;columns:ReferenceCell[];rows:ReferenceCell[][];description?:string;start:number};
const numberFormats=new Map<string,Intl.NumberFormat>();
export function rankings(sheet:ReferenceSheet):Ranking[] {
  const byPosition=new Map(sheet.cells.map(c=>[`${c.r}:${c.c}`,c]));
  const headings=sheet.cells.filter(c=>c.r===1&&typeof c.v==='string').sort((a,b)=>a.c-b.c);
  return headings.map((heading,i)=>{
    const end=(headings[i+1]?.c??sheet.columns+2)-2;
    const columns=sheet.cells.filter(c=>c.r===2&&c.c>=heading.c&&c.c<=end).sort((a,b)=>a.c-b.c);
    const rows:ReferenceCell[][]=[];
    for(let r=3;r<=sheet.rows;r++){
      const rank=byPosition.get(`${r}:${heading.c}`),name=byPosition.get(`${r}:${heading.c+1}`);
      if(typeof rank?.v!=='number'||typeof name?.v!=='string')continue;
      rows.push(columns.map(c=>byPosition.get(`${r}:${c.c}`)??{r,c:c.c,v:null}));
    }
    return {name:String(heading.v),columns,rows,description:heading.note,start:heading.c};
  });
}
export function displayCell(cell:Pick<ReferenceCell,'v'|'format'|'formula'>):string {
  if(cell.v===null)return cell.formula?'Unavailable':'—';
  if(typeof cell.v!=='number')return String(cell.v);
  const format=cell.format??'',percent=format.includes('%');
  let formatter=numberFormats.get(format);
  if(!formatter){const decimals=format.match(/\.([0#]+)/)?.[1].length;formatter=new Intl.NumberFormat('en-US',{style:percent?'percent':'decimal',maximumFractionDigits:decimals??6,minimumFractionDigits:format.includes('#')?0:decimals??0});if(numberFormats.size>=32)numberFormats.delete(numberFormats.keys().next().value!);numberFormats.set(format,formatter);}
  return formatter.format(cell.v);
}
export function columnLetter(n:number){let result='';while(n>0){n--;result=String.fromCharCode(65+n%26)+result;n=Math.floor(n/26);}return result;}
export type Stage = {id:string;name:string;variant:string;summary:{width:number;top:number;side:number;bottom:number;low:number|null;high:number|null;platformWidth:number|string|null};geometry:{left:number;right:number;ledgeY:number;blastLeft:number;blastTop:number;blastRight:number;blastBottom:number;platformLow:number|null;platformHigh:number|null;platformLeft:number|null;platformRight:number|null};notes:string|null;cellNotes:{cell:string;text:string}[];sourceRow:number;rawRow:number};
export type StageBook = ReferenceBook & {stages:Stage[]};
export type PlatformLine = {left:number;right:number;y:number;label:string;schematic:boolean};
// The workbook records one horizontal span per stage, not every platform's X.
// Solid segments use recorded X coordinates. Dashed segments explicitly show
// schematic placement; no inferred geometry is presented as a measured value.
export function stagePlatforms(stage:Stage,position:number):PlatformLine[] {
  const g=stage.geometry,s=stage.summary;
  if(g.platformLeft===null||g.platformRight===null||s.low===null)return [];
  const left=g.platformLeft,right=g.platformRight,width=right-left;
  const moving=/oscillate/i.test(stage.notes??'')||stage.id==='green-hill-zone'||stage.id==='ceres-space-colony';
  if(moving){const low=s.low,high=s.high??low;return [{left,right,y:low+(high-low)*position,label:'Moving platform',schematic:false}];}
  const low=(g.platformLow??(s.low+g.ledgeY))-g.ledgeY,high=g.platformHigh===null?null:g.platformHigh-g.ledgeY;
  const centered=left<0&&right>0;
  if(stage.id==='smashville')return [{left,right,y:low,label:'Moving platform (recorded position)',schematic:false}];
  if(high!==null&&centered){
    const center=(g.left+g.right)/2,sideOffset=s.width*.3;
    return [{left,right,y:high,label:'Upper platform',schematic:false},...[-1,1].map(sign=>({left:center+sign*sideOffset-width/2,right:center+sign*sideOffset+width/2,y:low,label:sign<0?'Left platform':'Right platform',schematic:true}))];
  }
  const lines:PlatformLine[]=[{left,right,y:stage.id==='dream-land'?low+.1003:low,label:centered?'Platform':'Right platform',schematic:false}];
  if(!centered){
    const center=(g.left+g.right)/2;
    lines.push({left:2*center-right,right:2*center-left,y:low,label:'Left platform',schematic:true});
    if(high!==null)lines.push({left:center-width/2,right:center+width/2,y:high,label:'Upper platform',schematic:true});
  }
  return lines;
}
