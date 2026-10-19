import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Check,Download,Eye,Pause,Play,Search,Upload} from 'lucide-react';
import {createEmptyCard,type Grade} from 'ts-fsrs';
import {loadMove,loadPresentedMove} from '../data/loader';
import type {Manifest,MoveData} from '../data/types';
import type {StudyCard,StudyFighter,StudyIndex} from '../data/study-types';
import {fighterStudyCards,referenceStudyCards,stageBook,bubbleColumns,bubbleAnswerCells,bubbleAnswer} from '../data/study-cards';
import {defaultSettings,exportStudyBackup,importStudyBackup,loadSettings,loadStudyProgress,rateCard,Rating,restoreProgress,saveProgress,saveReview,saveSettings,scheduler,studyQueue,type Progress,type StudySettings} from '../data/study-progress';
import {catalog} from '../data/catalog';
import {fighterStockImage} from '../data/fighter-images';
import FighterSelect from './FighterSelect';
import {selectedStudyCards,deckHasSelectedStats} from '../data/study-selection';
import {isExcludedStudyFighter} from '../data/study-exclusions';
import {knowledgeSummary,cardIsDue,categoryKey} from '../data/study-metrics';
import type {Route} from '../router';
import {studyFile} from '../data/preload';
import '../study.css';
const CollisionViewer=lazy(()=>import('../viewer/CollisionViewer'));
const StudyAnimation=lazy(()=>import('./StudyAnimation'));
const referenceCards=selectedStudyCards(referenceStudyCards());
const layers={hit:true,hurt:true,collision:false,ledge:false,wireframe:false};
const ratings:[Grade,string][]=[[Rating.Again,'Again'],[Rating.Hard,'Hard'],[Rating.Good,'Good'],[Rating.Easy,'Easy']];
const deckLabels={attributes:'Character stats',hitboxes:'Hitbubbles',stages:'Stage stats'};
type StudyDeckView={subject:string;topic:string;field:string;query:string;mode:'library'|'review';selectedId:string;revealed:boolean;page:number;dueOnly:boolean;moveFilter:string;categoryFilter:string;animationCard:StudyCard|null};
type StudyModeView={selectedId:string;revealed:boolean;page:number};
function emptyDeckView(deck:StudyCard['deck']):StudyDeckView{return {subject:deck==='stages'?'all':'marth',topic:'all',field:'all',query:'',mode:'library',selectedId:'',revealed:false,page:0,dueOnly:false,moveFilter:'',categoryFilter:'',animationCard:null};}
const emptyModeView:StudyModeView={selectedId:'',revealed:false,page:0};
function download(name:string,content:string,type='application/json'){
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function interval(due:Date,now:Date){const minutes=Math.max(1,Math.round((due.getTime()-now.getTime())/60000));return minutes<60?`${minutes}m`:minutes<1440?`${Math.round(minutes/60)}h`:`${Math.round(minutes/1440)}d`;}
function questionWithoutFighterName(card:StudyCard){
  if(card.move)return `${card.move.name} · ${card.field==='SAF'?'First Actionable Frame':card.field}`;
  let prompt=card.question;
  for(const prefix of [`${card.subject}: `,`${card.subject} · `])if(prompt.startsWith(prefix)){prompt=prompt.slice(prefix.length);break;}
  const contextual=prompt.match(/^(.+?):\s*(.+?)\??$/);
  if(contextual){
    const context=contextual[1].trim(),value=contextual[2].replace(/^what is\s+/i,'').trim();
    const displayValue=value==='SAF'?'First Actionable Frame':value;
    return context.toLowerCase()===value.toLowerCase()?displayValue:`${context} · ${displayValue}`;
  }
  return prompt.replace(/^what is\s+/i,'').replace(/\?+$/,'').trim()||card.field;
}
export default function Study({manifest,route}:{manifest:Manifest|null;route:Route}){
  const [deck,setDeck]=useState<StudyCard['deck']>('attributes'),[subject,setSubject]=useState('marth'),[topic,setTopic]=useState('all'),[field,setField]=useState('all'),[query,setQuery]=useState('');
  const [index,setIndex]=useState<StudyIndex|null>(null),[fighterCards,setFighterCards]=useState<StudyCard[]>([]),[loading,setLoading]=useState(false),[catalogError,setCatalogError]=useState(''),[retry,setRetry]=useState(0);
  const [progress,setProgress]=useState(new Map<string,Progress>()),[settings,setSettings]=useState(defaultSettings),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false);
  const [mode,setMode]=useState<'library'|'review'>('library'),[selectedId,setSelectedId]=useState(''),[revealed,setRevealed]=useState(false),[page,setPage]=useState(0),[now,setNow]=useState(new Date());
  const [dueOnly,setDueOnly]=useState(false);
  const [animationCard,setAnimationCard]=useState<StudyCard|null>(null);
  const [moveFilter,setMoveFilter]=useState(''),[categoryFilter,setCategoryFilter]=useState('');
  const deckViews=useRef<Partial<Record<StudyCard['deck'],StudyDeckView>>>({});
  const modeViews=useRef<Partial<Record<StudyCard['deck'],Partial<Record<'library'|'review',StudyModeView>>>>>({});
  const linkKey=JSON.stringify(route.study??{});
  useEffect(()=>{const link=route.study??{};setDeck(link.deck??'attributes');setSubject(link.subject??(link.deck==='stages'?'all':'marth'));setTopic(link.topic??'all');setField(link.field??'all');setMode(link.mode??'library');setSelectedId(link.card??'');setDueOnly(!!link.due);setMoveFilter(link.move??'');setCategoryFilter(link.category??'');setQuery('');setPage(0);setRevealed(false);},[linkKey]);
  useEffect(()=>{deckViews.current[deck]={subject,topic,field,query,mode,selectedId,revealed,page,dueOnly,moveFilter,categoryFilter,animationCard};},[deck,subject,topic,field,query,mode,selectedId,revealed,page,dueOnly,moveFilter,categoryFilter,animationCard]);
  useEffect(()=>{modeViews.current[deck]={...modeViews.current[deck],[mode]:{selectedId,revealed,page}};},[deck,mode,selectedId,revealed,page]);
  const upload=useRef<HTMLInputElement>(null),busy=useRef(false);
  useEffect(()=>{let active=true;const refresh=()=>{if(busy.current)return;Promise.all([loadStudyProgress(),loadSettings()]).then(([p,s])=>{if(active&&!busy.current){setProgress(p);setSettings(s);setReady(true);}}).catch(e=>{if(active)setStorageError(e.message);});};window.addEventListener('study-cloud-changed',refresh);return()=>{active=false;window.removeEventListener('study-cloud-changed',refresh);};},[]);
  useEffect(()=>{const abort=new AbortController();studyFile<StudyIndex>('index.json',abort.signal).then(value=>{if(value.schemaVersion!==1||value.version!=='3.2'||!Array.isArray(value.fighters))throw new Error('Unsupported study catalog. Rebuild it from the current dataset.');setIndex(value);}).catch(e=>{if(!abort.signal.aborted)setCatalogError(e.message);});return()=>abort.abort();},[retry]);
  useEffect(()=>{let active=true;Promise.all([loadStudyProgress(),loadSettings()]).then(([p,s])=>{if(active){setProgress(p);setSettings(s);setReady(true);}}).catch(e=>{if(active)setStorageError(e.message);});return()=>{active=false;};},[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),15000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    const abort=new AbortController();setFighterCards([]);setLoading(false);
    if(deck==='stages'||!index||!deckHasSelectedStats(deck))return()=>abort.abort();
    const entries=index.fighters.filter(f=>!isExcludedStudyFighter(f.id)&&(subject==='all'||f.id===subject));
    setLoading(true);setCatalogError('');
    (async()=>{
      const cards:StudyCard[]=[];
      for(let i=0;i<entries.length;i+=4){
        const group=await Promise.all(entries.slice(i,i+4).map(async entry=>{
          const f=await studyFile<StudyFighter>(entry.path,abort.signal);
          if(f.schemaVersion!==1||f.id!==entry.id||!Array.isArray(f.hits)||!Array.isArray(f.moves))throw new Error(`Invalid study catalog for ${entry.name}.`);
          if(manifest&&(!manifest.fighters.some(m=>m.id===f.id&&m.path===f.sourcePath)||manifest.verification!==index.verification))throw new Error('Study cards belong to an older dataset. Rebuild the study catalog before studying extracted data.');
          return selectedStudyCards(fighterStudyCards(f,index.verification,deck as 'attributes'|'hitboxes'));
        }));cards.push(...group.flat());
      }
      if(!abort.signal.aborted)setFighterCards(cards);
    })().catch(e=>{if(!abort.signal.aborted)setCatalogError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[index,deck,subject,manifest,retry,fighterStudyCards]);
  const subjects=deck==='stages'?stageBook.stages.map(s=>({id:s.id,name:s.name})):[...catalog,...(index?.fighters.filter(f=>!isExcludedStudyFighter(f.id)&&!catalog.some(c=>c.id===f.id))??[])].sort((a,b)=>a.name.localeCompare(b.name));
  const pool=useMemo(()=>selectedStudyCards([...referenceCards,...fighterCards]).filter(c=>!isExcludedStudyFighter(c.subjectId)&&c.deck===deck&&(subject==='all'||c.subjectId===subject)&&(!moveFilter||c.move?.id===moveFilter)&&(!categoryFilter||categoryKey(c)===categoryFilter)),[fighterCards,deck,subject,moveFilter,categoryFilter]);
  const topics=useMemo(()=>[...new Set(pool.map(c=>c.topic))].sort(),[pool]);
  const fields=useMemo(()=>[...new Set(pool.filter(c=>topic==='all'||c.topic===topic).map(c=>c.field))].sort(),[pool,topic]);
  const filtered=useMemo(()=>pool.filter(c=>(topic==='all'||c.topic===topic)&&(field==='all'||c.field===field)&&`${c.question} ${c.topic}`.toLowerCase().includes(query.toLowerCase())),[pool,topic,field,query]);
  const queue=useMemo(()=>{const q=studyQueue(filtered,progress,settings,now);return dueOnly?{...q,cards:q.cards.filter(c=>cardIsDue(c,progress.get(c.id),now)),new:0}:q;},[filtered,progress,settings,now,dueOnly]);
  const currentList=mode==='review'?queue.cards:filtered;
  const current=selectedId?currentList.find(c=>c.id===selectedId):currentList[0];
  const scheduled=current?progress.get(current.id):undefined;
  const preview=useMemo(()=>current?scheduler(settings).repeat(scheduled?.answer===current.answer?scheduled.card:createEmptyCard(now),now):null,[current,scheduled,settings,now]);
  const suspended=filtered.filter(c=>progress.get(c.id)?.suspended).length;
  const summary=useMemo(()=>knowledgeSummary(filtered,progress,now),[filtered,progress,now]);
  const learned=summary.studied;
  const nextDue=filtered.flatMap(c=>{const p=progress.get(c.id);return p&&!p.suspended&&p.card.due>now?[p.card.due.getTime()]:[];}).sort((a,b)=>a-b)[0];
  useEffect(()=>{setRevealed(false);},[current?.id]);
  useEffect(()=>{if(mode==='library'&&selectedId){const i=filtered.findIndex(c=>c.id===selectedId);if(i>=0)setPage(Math.floor(i/40));}},[filtered,selectedId,mode]);
  function reset(){modeViews.current[deck]={library:{...emptyModeView},review:{...emptyModeView}};setMode('library');setSelectedId('');setRevealed(false);setPage(0);setDueOnly(false);}
  function changeMode(value:'library'|'review'){
    if(value===mode)return;
    modeViews.current[deck]={...modeViews.current[deck],[mode]:{selectedId,revealed,page}};
    const next=modeViews.current[deck]?.[value]??emptyModeView;
    setMode(value);setSelectedId(next.selectedId);setRevealed(next.revealed);setPage(next.page);
  }
  function changeDeck(value:StudyCard['deck']){
    if(value===deck)return;
    modeViews.current[deck]={...modeViews.current[deck],[mode]:{selectedId,revealed,page}};
    deckViews.current[deck]={subject,topic,field,query,mode,selectedId,revealed,page,dueOnly,moveFilter,categoryFilter,animationCard};
    const next=deckViews.current[value]??emptyDeckView(value);
    const selection=modeViews.current[value]?.[next.mode]??{selectedId:next.selectedId,revealed:next.revealed,page:next.page};
    setDeck(value);setSubject(next.subject);setTopic(next.topic);setField(next.field);setQuery(next.query);setMode(next.mode);setSelectedId(selection.selectedId);setRevealed(selection.revealed);setPage(selection.page);setDueOnly(next.dueOnly);setMoveFilter(next.moveFilter);setCategoryFilter(next.categoryFilter);setAnimationCard(next.animationCard);
  }
  async function rate(grade:Grade){
    if(!current||!revealed||!ready||busy.current)return;
    busy.current=true;setSaving(true);setStorageError('');
    try{
      const at=new Date(),result=rateCard(current.id,current.answer,progress.get(current.id),grade,settings,at);
      await saveReview(result.progress,result.review);
      const updated=new Map(progress);updated.set(current.id,result.progress);setProgress(updated);setNow(at);setRevealed(false);setSelectedId('');
    }catch(e){setStorageError(e instanceof Error?e.message:'Review could not be saved.');}
    finally{busy.current=false;setSaving(false);}
  }
  async function toggleSuspend(){
    if(!current||busy.current||!ready)return;busy.current=true;setSaving(true);
    try{const old=progress.get(current.id),p:Progress=old?{...old,suspended:!old.suspended}:{id:current.id,card:createEmptyCard(),introduced:'',suspended:true,answer:current.answer};await saveProgress(p);setProgress(new Map(progress).set(p.id,p));setNotice(p.suspended?'Card suspended. It will stay out of reviews.':'Card resumed.');}catch(e){setStorageError(String(e));}finally{busy.current=false;setSaving(false);}
  }
  async function updateSettings(value:StudySettings){
    if(busy.current)return;busy.current=true;setSaving(true);
    try{await saveSettings(value);setSettings(value);}catch(e){setStorageError(String(e));}finally{busy.current=false;setSaving(false);}
  }
  async function backup(){try{download('pplus-dojo-study-backup.json',JSON.stringify(await exportStudyBackup()));setNotice('Progress backup downloaded.');}catch(e){setStorageError(String(e));}}
  async function restore(file:File){
    if(busy.current)return;busy.current=true;setSaving(true);
    try{if(file.size>100*1024*1024)throw new Error('This backup is larger than 100 MB.');await importStudyBackup(JSON.parse(await file.text()));setProgress(await loadStudyProgress());setSettings(await loadSettings());setReady(true);setStorageError('');reset();setNotice('Backup restored. Existing newer progress was preserved.');}catch(e){setStorageError(e instanceof Error?e.message:'Backup could not be restored.');}finally{busy.current=false;setSaving(false);if(upload.current)upload.current.value='';}
  }
  function exportCards(){
    const escape=(text:string)=>`"${text.replaceAll('"','""')}"`;
    const text=['#separator:Tab','#html:false','#columns:ID\tFront\tBack\tSource\tTags',...filtered.map(c=>[c.id,c.question,`${c.answer}${c.note?`\n${c.note}`:''}`,c.source,`pplus_dojo ${c.deck} ${c.subjectId}`].map(escape).join('\t'))].join('\n');
    download(`pplus-dojo-${deck}-${subject}.tsv`,text,'text/tab-separated-values;charset=utf-8');setNotice('Cards exported. In Anki, map Front and Back to your template; retain ID as the first field for updates.');
  }
  return <div className="study-page">
    <nav className="study-decks" aria-label="Study decks">{(Object.keys(deckLabels)as StudyCard['deck'][]).map(d=><button key={d} aria-pressed={deck===d} onClick={()=>changeDeck(d)} disabled={saving}>{deckLabels[d]}</button>)}</nav>
    <section className="study-filters" aria-label="Study filters">
      {deck==='stages'?<label>Stage<select aria-label="Study stage" value={subject} disabled={saving} onChange={event=>{setSubject(event.target.value);setTopic('all');setField('all');reset();}}><option value="all">All stages</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>:<div className="study-filter-field"><span>Fighter</span><FighterSelect fighters={subjects} value={subject} disabled={saving} onChange={value=>{setSubject(value);setTopic('all');setField('all');reset();}}/></div>}
      <label>Topic<select aria-label="Study topic" value={topic} disabled={saving} onChange={e=>{setTopic(e.target.value);setField('all');reset();}}><option value="all">All topics</option>{topics.map(t=><option key={t}>{t}</option>)}</select></label>
      <label>Stat<select aria-label="Study stat" value={field} disabled={saving} onChange={e=>{setField(e.target.value);reset();}}><option value="all">Every stat</option>{fields.map(f=><option key={f}>{f}</option>)}</select></label>
      <label className="study-search">Search<div><Search size={16}/><input aria-label="Search study cards" placeholder="Move, attribute, or question…" value={query} disabled={saving} onChange={e=>{setQuery(e.target.value);reset();}}/></div></label>
    </section>
    <div className="study-messages">
    {loading&&<p className="study-status" role="status">Loading fighter cards…</p>}
    {catalogError&&deck!=='stages'&&<div className="study-warning" role="alert">{catalogError} <button onClick={()=>{setIndex(null);setRetry(v=>v+1);}}>Retry catalog</button></div>}
    {storageError&&<div className="study-warning" role="alert">{storageError}</div>}
    {notice&&<p className="study-status" role="status">{notice}</p>}
    {dueOnly&&<p className="study-status">Due reviews only. <button onClick={()=>setDueOnly(false)}>Include new cards</button></p>}
    {(moveFilter||categoryFilter)&&<p className="study-status">Compendium selection · {categoryFilter==='moves'?'Move stats':categoryFilter==='attributes'?'Character attributes':categoryFilter==='hitboxes'?'Hitbubbles':categoryFilter==='stages'?'Stage stats':''}{moveFilter&&current?.move?` · ${current.move.name}`:''} <button onClick={()=>{setMoveFilter('');setCategoryFilter('');setTopic('all');reset();}}>Show whole deck</button></p>}
    {!loading&&index&&selectedId&&!current&&<p className="study-warning" role="alert">This card is unavailable in the current selection. <button onClick={reset}>Browse current cards</button></p>}
    </div>
    <div className="study-summary"><div><strong>{filtered.length.toLocaleString()}</strong><span>cards in selection</span></div><div><strong>{queue.due.toLocaleString()}</strong><span>due now</span></div><div><strong>{queue.new}</strong><span>new available today</span></div><div><strong>{learned.toLocaleString()}</strong><span>cards studied · {suspended} suspended</span></div><button className="button primary" disabled={!ready||loading||saving||!queue.cards.length} onClick={()=>changeMode('review')}><Play size={16}/>Study now</button></div>
    <div className="study-toolbar"><div className="filter-tabs"><button className={mode==='library'?'selected':''} disabled={saving} onClick={()=>changeMode('library')}>Browse cards</button><button className={mode==='review'?'selected':''} disabled={!ready||saving||loading} onClick={()=>changeMode('review')}>Daily review</button></div><span>{mode==='review'?'Reviews save on this device.':'Preview any card without changing your schedule.'}</span></div>
    {animationCard&&<Suspense fallback={<p role="status">Loading animation viewer…</p>}><StudyAnimation card={animationCard} manifest={manifest} onClose={()=>setAnimationCard(null)}/></Suspense>}
    <div className={`study-layout ${mode==='review'?'review-mode':''}`}>
      <section hidden={mode!=='library'} style={{display:mode==='library'?undefined:'none'}} className="study-library" aria-label="Card library"><header><h2>Card library</h2><span>{filtered.length.toLocaleString()} cards</span></header><div className="study-card-list">{filtered.slice(page*40,page*40+40).map(c=>{const icon=c.deck!=='stages'?fighterStockImage(c.subjectId,c.subject):undefined;return <button className={current?.id===c.id?'selected':''} key={c.id} onClick={()=>{setSelectedId(c.id);setRevealed(false);}}><small>{c.deck==='hitboxes'?`${c.subject} - ${c.topic}`:`${c.subject} · ${c.topic}`}{progress.get(c.id)?.suspended?' · suspended':''}</small>{icon&&c.deck==='hitboxes'&&c.move&&c.hit?<span className="study-card-question"><img className="study-card-fighter-icon" src={icon} alt={c.subject}/><span>{c.move.name} · Frame {c.hit.frame} · ID {c.hit.hitboxId}</span></span>:icon?<span className="study-card-question"><img className="study-card-fighter-icon" src={icon} alt={c.subject}/><span>{questionWithoutFighterName(c)}</span></span>:<span>{c.question}</span>}</button>;})}{!filtered.length&&!loading&&<p>No cards match this selection.</p>}</div><footer><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>{page+1} / {Math.max(1,Math.ceil(filtered.length/40))}</span><button disabled={(page+1)*40>=filtered.length} onClick={()=>setPage(p=>p+1)}>Next</button></footer></section>
      <section className="study-session" aria-label={mode==='review'?'Review card':'Card preview'}>
        {current?<>
          <div className="study-card-meta"><span>{current.subject} / {current.topic}</span><span>{mode==='review'?(scheduled?'REVIEW':'NEW CARD'):'PREVIEW'}</span></div>
          <h2 className="study-question">{current.deck==='hitboxes'&&current.move&&current.hit?<span className="study-card-question"><img className="study-card-fighter-icon" src={fighterStockImage(current.subjectId,current.subject)} alt={current.subject}/><span>{current.move.name} · Frame {current.hit.frame} · ID {current.hit.hitboxId}</span></span>:current.deck==='attributes'&&fighterStockImage(current.subjectId,current.subject)?<span className="study-card-question"><img className="study-card-fighter-icon" src={fighterStockImage(current.subjectId,current.subject)} alt={current.subject}/><span>{questionWithoutFighterName(current)}</span></span>:current.question}</h2>
          {scheduled&&scheduled.answer!==current.answer&&<p className="study-warning">This answer changed since your last review. Review the updated source.</p>}
          {current.hit&&<HitbubblePreview card={current} manifest={manifest}/>}
          {!revealed?<button className="button primary study-reveal" onClick={()=>setRevealed(true)}><Eye size={17}/>Reveal answer</button>:<div className={`study-answer ${current.bubbleAnswer?'study-bubble-answer':''}`}><span className="eyebrow">ANSWER</span>{current.bubbleAnswer?<div className="study-answer-table-scroll"><table aria-label="Selected hitbubble data"><thead><tr>{bubbleColumns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody><tr>{bubbleAnswerCells(current.bubbleAnswer).map((cell,i)=><td key={i}>{cell}</td>)}</tr></tbody></table></div>:<><p>{current.answer}</p>{current.deck!=='attributes'&&current.exact&&current.exact!==current.answer&&<details><summary>Exact source value</summary><code>{current.exact}</code></details>}{current.deck!=='attributes'&&current.note&&<p className="study-card-note">{current.note}</p>}</>}</div>}
          <div className="study-source"><span>{current.source}</span><div className="study-reference-actions">{(current.move||current.hit)&&<button onClick={()=>setAnimationCard(current)}><Play size={14}/>View animation</button>}<a href={current.href}>{current.move||current.hit?'Open full reference ↗':'Open reference ↗'}</a></div></div>
          {mode==='review'&&revealed&&<><div className="study-ratings">{ratings.map(([grade,label])=><button key={grade} className={`rating-${label.toLowerCase()}`} disabled={saving||!ready} onClick={()=>rate(grade)}><strong>{label}</strong><span>{preview?interval(preview[grade].card.due,now):''}</span></button>)}</div><p className="study-grading">Again = forgot · Hard = recalled with difficulty · Good = recalled · Easy = effortless</p></>}
          <div className="study-card-footer"><span>{scheduled?.card.reps?`${scheduled.card.reps} reviews · ${scheduled.card.lapses} lapses${scheduled.suspended?' · suspended':` · due ${scheduled.card.due.toLocaleString()}`}`:'Not studied yet'}</span><button disabled={!ready||saving} onClick={toggleSuspend}><Pause size={13}/>{scheduled?.suspended?'Resume card':'Suspend card'}</button></div>
        </>:<div className="study-empty"><Check size={38}/><h2>{mode==='review'?'You’re caught up.':'Choose your next detail.'}</h2><p>{!deckHasSelectedStats(deck)?'No flashcard stats are enabled for this deck in your selection.':loading?'Loading your cards…':mode==='review'?`No cards are due in this selection. ${nextDue?`Next review: ${new Date(nextDue).toLocaleString()}.`:'Browse cards or choose another topic.'}`:'Choose a fighter, topic, or stage to browse its cards.'}</p>{mode==='review'&&<button className="button secondary" onClick={()=>changeMode('library')}>Browse the library</button>}</div>}
      </section>
    </div>
    <div className="study-tools"><details className="study-settings"><summary>Scheduling, backups & export</summary><div className="study-settings-body"><div className="study-settings-grid"><label>Desired retention<select aria-label="Desired retention" value={settings.retention} disabled={!ready||saving} onChange={e=>updateSettings({...settings,retention:Number(e.target.value)})}><option value={.8}>80% · fewer reviews</option><option value={.85}>85%</option><option value={.9}>90% · recommended</option><option value={.95}>95% · more reviews</option><option value={.97}>97%</option></select></label><label>New cards per day<select aria-label="New cards per day" value={settings.newPerDay} disabled={!ready||saving} onChange={e=>updateSettings({...settings,newPerDay:Number(e.target.value)})}>{[...new Set([0,5,10,20,30,50,100,200,settings.newPerDay])].sort((a,b)=>a-b).map(n=><option key={n}>{n}</option>)}</select></label><div className="study-file-actions"><button className="button secondary" disabled={!ready||saving} onClick={backup}><Download size={15}/>Back up progress</button><button className="button secondary" disabled={saving} onClick={()=>upload.current?.click()}><Upload size={15}/>Restore backup</button><button className="button secondary" disabled={!filtered.length||loading} onClick={exportCards}><Download size={15}/>Export cards for Anki</button><input ref={upload} type="file" accept=".json,application/json" aria-label="Restore study backup" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void restore(file);}}/></div></div><p>Powered by FSRS with 1m / 10m learning steps and 10m relearning. Daily limits apply across decks, using your local calendar day. Changing retention affects future reviews. Progress is saved on this device. Sign in under Account & app to sync across devices. Anki exports have separate scheduling. Download a backup to keep a copy.</p><p>Anki export includes stable IDs, questions, answers, sources, and tags. The interactive 3D viewer remains in Dojo; exports include a text description of each bubble’s context.</p></div></details>
    <details className="study-settings"><summary>Coverage & data accuracy</summary><div className="study-settings-body"><p>Cards follow your selected stats. Deleted entries are excluded from browsing, reviews, and exports. Main attribute metrics combine their values and rank in one card. Multi-component metrics retain their labeled values. Decks with no selected stats contain no cards.</p><p>Extracted data is {index?.verification??'not loaded'}. The attributes workbook has a 3.2 filename and a 3.1.5 internal version note. Sources remain separate. Missing values are excluded.</p></div></details></div>
  </div>;
}
function HitbubblePreview({card,manifest}:{card:StudyCard;manifest:Manifest|null}){
  const [move,setMove]=useState<MoveData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const hit=card.hit!;
  useEffect(()=>{const abort=new AbortController();setMove(null);setError('');setLoading(true);(hit.view==='full'?loadPresentedMove(hit.path,abort.signal,manifest):loadMove(hit.path,abort.signal)).then(m=>{
    const box=hit.boxIndex===null?undefined:m.frames[hit.frame-1]?.hit_boxes[hit.boxIndex];
    if(m.fighterId!==card.subjectId||m.moveId!==hit.moveId||!box||box.hitbox_id!==hit.hitboxId)throw new Error('The collision card does not match the current animation. Rebuild the study catalog.');
    const actual=bubbleAnswer({...hit,kind:'Hit'in box.next_values?'hit':'grab',radius:box.next_size,values:'Hit'in box.next_values?box.next_values.Hit:box.next_values.Grab});
    if(JSON.stringify(actual)!==JSON.stringify(card.bubbleAnswer))throw new Error('The bubble data does not match this frame. Rebuild the study catalog.');
    setMove(m);
  }).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[hit.path,hit.frame,hit.boxIndex,hit.view,card.subjectId,card.bubbleAnswer,manifest]);
  return <div className="study-hit-view"><div className="study-bubble-label"><span>TARGET BUBBLE ID {hit.hitboxId}</span><span>Frame {hit.frame}</span></div>{loading?<p role="status">Loading 3D collision view…</p>:error?<p role="alert" className="study-warning">{error}</p>:<Suspense fallback={<p>Loading viewer…</p>}><CollisionViewer move={move} frame={hit.frame-1} layers={layers} selectedHitboxIndex={hit.boxIndex??undefined}/></Suspense>}
    {move?.timing?.geometryRetimed&&<p className="study-warning">Timing follows the checked sheet; collision poses are retimed from unverified extracted data.</p>}
    <p>The cyan bubble and ID marker identify the target. Recall its ID / type, Damage, Angle, KBG, BKB, and WDSK at frame {hit.frame}. Drag to orbit, scroll to zoom.</p></div>;
}
