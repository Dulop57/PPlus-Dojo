import type {ReferenceCell,ReferenceSheet} from './reference';
export type AttributeSection={title:string;columns:string[];rows:ReferenceCell[][];description?:string;kind?:'groups'};
export function attributeSections(sheet:ReferenceSheet){
  const cells=new Map(sheet.cells.map(c=>[`${c.r}:${c.c}`,c])),used=new Set<string>();
  const get=(r:number,c:number):ReferenceCell=>cells.get(`${r}:${c}`)??{r,c,v:null};
  const mark=(r:number,c:number)=>used.add(`${r}:${c}`);
  const sections:AttributeSection[]=[];
  function table(title:string,columns:string[],cols:number[],first:number,last:number,description?:string){
    const rows:ReferenceCell[][]=[];
    for(let r=first;r<=last;r++){const row=cols.map(c=>get(r,c));row.forEach(c=>mark(c.r,c.c));if(row.some(c=>c.v!==null))rows.push(row);}
    sections.push({title,columns,rows,description});
  }
  function groups(title:string,cols:number[],header:number,first:number,last:number,description?:string){
    const rows=cols.map(c=>{mark(header,c);const row=[get(header,c)];for(let r=first;r<=last;r++){mark(r,c);if(get(r,c).v!==null)row.push(get(r,c));}return row;});
    sections.push({title,columns:[],rows,kind:'groups',description});
  }
  const range=(a:number,b:number)=>Array.from({length:b-a+1},(_,i)=>a+i);
  switch(sheet.name){
    case 'Misc':
      groups('Jumpsquat',[1,2,3],2,3,19,'Frames before leaving the ground.');
      groups('Dash length',range(7,14),3,4,13,String(get(2,7).v));
      groups('Empty landing lag',[1,2],23,24,29,'Landing without using an aerial attack.');
      table('Notable outliers',['Rank','Z-score','Attribute','Fighter'],[7,8,9,11],24,33);
      groups('Number of jumps',range(1,5),33,34,36);
      groups('Crawl options',[1,2],40,41,50);
      table('True spikes',['Fighter','Attack'],[4,5],40,59,'These attacks cannot be meteor cancelled.');
      groups('Costumes',[7,8,9],40,41,60);
      groups('Wall movement',[1,2],53,54,66);
      for(const [r,a,b] of [[1,1,3],[1,7,14],[22,1,2],[22,7,11],[23,7,11],[32,1,5],[39,1,2],[39,4,5],[39,7,9],[52,1,2]])for(const c of range(a,b))mark(r,c);
      mark(2,7);break;
    case 'Dodges':
      table('Rolls',['Fighter / option','Intangible from','Intangible through','Actionable'],[1,2,3,4],4,8);
      table('Spotdodges',['Group','Intangible from','Intangible through','Actionable'],[6,7,8,9],4,6);
      table('Airdodges',['Fighter','Intangible from','Intangible through','Ledge grab'],[11,12,13,14],3,7);
      groups('Spotdodge groups',[6,7,9],8,9,27);
      table('Techs',['Option','Intangible from','Intangible through','Actionable'],[1,2,3,4],17,18,'Frame data for techs is universal across the cast.');
      for(const cell of sheet.cells)if(cell.r<=3&&(cell.c<11||cell.r<3)||cell.r===13||cell.r===14&&cell.c===1||[15,16].includes(cell.r)&&cell.c<=4)mark(cell.r,cell.c);
      break;
    case 'Grab Timings':
      for(const [name,start] of [['Standing',2],['Dash',5],['Pivot',8]] as const)table(`${name} grab`,['Fighter','First active frame','Last active frame','SAF'],[1,start,start+1,start+2],3,43);
      break;
    case 'Grab Range':
      table('Grab reach',['Fighter','Standing','Dash','Pivot'],[1,2,3,4],2,43,'Distance from the center of the character.');
      for(const [name,start] of [['Standing',7],['Dash',9],['Pivot',11]] as const)table(`${name} collision`,['Fighter','Offset','Size','Size multiplier'],[1,start,start+1,13],2,43);
      break;
    case 'Aerial Landing Lags':
      for(const [name,start] of [['L-cancelled',2],['Not L-cancelled',8]] as const)table(name,['Fighter','Neutral','Forward','Back','Up','Down','Total'],[1,...range(start,start+5)],3,43,'Landing lag in frames.');
      break;
    case 'Ledge stuff':
      for(const [condition,offset] of [['Below 100%',0],['At or above 100%',12]] as const){
        for(const [name,start] of [['Stand',2],['Roll',5]] as const)table(`${condition} · ${name}`,['Fighter','Vulnerable','Ledge available','SAF'],[1,start+offset,start+offset+1,start+offset+2],4,44);
        table(`${condition} · Attack`,['Fighter','Vulnerable','Hit from','Hit through','Ledge available','SAF'],[1,...range(8+offset,12+offset)],4,44);
        table(`${condition} · Jump`,['Fighter','Frame'],[1,13+offset],4,44);
      }
      // Notes belong to the fighter, even though they occupy a separate column.
      table('Fighter notes',['Fighter','Note'],[1,26],4,44);
      sections[sections.length-1].rows=sections[sections.length-1].rows.filter(r=>r[1].v!==null);
      break;
    case 'SH Times':table('Short-hop airtime',['Fighter','Short hop','Short hop + fastfall'],[1,2,3],2,43);break;
    case 'Item Throws':
      for(const [name,start] of [['Ground · Forward',2],['Ground · Back',4],['Ground · Up',6],['Ground · Down',8],['Ground · Dash',10],['Air · Forward',12],['Air · Back',14],['Air · Up',16],['Air · Down',18]] as const)table(name,['Fighter','Item release','FAF'],[1,start,start+1],4,45);
      table('Totals',['Fighter','Ground','Air','Overall'],[1,20,21,22],4,45);break;
    case 'Shine':
      table('Shine distance',['Fighter','Distance'],[1,2],2,43);
      table('Shine interactions',['Fighter','Weight','Traction','Knockback','Velocity','Hitstun','Frame advantage'],[1,4,5,6,7,8,9],2,43);break;
  }
  // Data-table headers are replaced by player-facing labels, not lettered cells.
  if(!['Misc','Dodges'].includes(sheet.name))for(const c of sheet.cells)if(c.r<Math.min(...sections.flatMap(s=>s.rows.map(r=>r[0]?.r??99))))mark(c.r,c.c);
  const notes=sheet.cells.filter(c=>!used.has(`${c.r}:${c.c}`)&&c.v!==null);
  const comments=sheet.cells.filter(c=>c.note);
  return {sections:sections.filter(s=>s.rows.length),notes,comments};
}
export function attributeFields(sheet:ReferenceSheet){
  const headings=sheet.cells.filter(c=>c.r===1).sort((a,b)=>a.c-b.c);
  const fields=sheet.cells.filter(c=>c.r===2&&c.c>1&&(sheet.name!=='Calculations'||c.c!==59)).map(c=>{
    const parent=sheet.name==='Calculations'?headings.filter(h=>h.c<=c.c).at(-1):undefined;
    return {column:c.c,label:[parent?.v,typeof c.v==='number'?`Frame ${c.v}`:c.v].filter(v=>v!==null&&v!==undefined).join(' · '),note:c.note};
  });
  if(sheet.name==='Calculations')for(const c of headings.filter(c=>c.c>=102))fields.push({column:c.c,label:String(c.v),note:c.note});
  return fields;
}
export function fieldRows(sheet:ReferenceSheet,column:number){
  const key=sheet.name==='Calculations'&&column>=59&&column<=101?59:1;
  const last=sheet.name==='Raw Data'?46:44;
  const cells=new Map(sheet.cells.map(c=>[`${c.r}:${c.c}`,c]));
  const rows:ReferenceCell[][]=[];
  for(let r=3;r<=last;r++){const fighter=cells.get(`${r}:${key}`);if(!fighter)continue;rows.push([fighter,cells.get(`${r}:${column}`)??{r,c:column,v:null}]);}
  return rows;
}
