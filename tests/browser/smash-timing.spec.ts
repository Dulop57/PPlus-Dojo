import {test,expect} from '@playwright/test';
import {readFile,access} from 'node:fs/promises';
import {moveLabel} from '../../src/data/moves';
const source=JSON.parse(await readFile('src/data/smash-timing.json','utf8'));
const dataRoot='public/data/';
test('Checked smash frames, follow-up playback, raw view and study previews agree',async({page,isMobile})=>{
  test.setTimeout(150_000);
  if(!isMobile)await page.setViewportSize({width:1340,height:602});
  try{await access(dataRoot+'manifest.json');}catch{test.skip(true,'Requires the prepared local extraction.');return;}
  const manifest=JSON.parse(await readFile(dataRoot+'manifest.json','utf8'));
  const names=[['bowser','AttackHi4'],['charizard','AttackS4S'],['king-dedede','AttackHi4'],['rob','AttackHi4'],['snake','AttackHi4'],['ness','AttackHi4'],['ike','AttackLw41'],['ike','AttackLw42'],['link','AttackS4S2'],['pit','AttackS4S2']];
  for(const [fighterId,name]of names){
    const index=JSON.parse(await readFile(dataRoot+manifest.fighters.find((f:{id:string})=>f.id===fighterId).path,'utf8'));
    const entry=index.moves.find((m:{internalName:string})=>m.internalName===name);
    const timing=(source.fighters as unknown as Record<string,Record<string,{active:number[][];actionable:number}>>)[fighterId][name];
    await page.goto(`/#/fighters/${fighterId}/${entry.id}`);
    const summary=page.getByLabel('Move summary');
    await expect(summary.locator('.move-summary-item').filter({hasText:'Actionable'})).toContainText(`${timing.actionable}f`);
    const active=timing.active.map(([a,b])=>a===b?`${a}`:`${a}–${b}`).join(', ');
    await expect(summary.locator('.move-summary-item').filter({hasText:'Active'})).toContainText(active);
    await expect(page.locator('.move-viewer-card canvas')).toBeVisible();
    await expect(page.getByText(/^Smash timing: owner's/)).toHaveCount(0);
    if(fighterId==='bowser'&&!isMobile){
      await page.getByRole('button',{name:'Go to frame 13',exact:true}).click();
      await expect(page.locator('.hitbox-section tbody tr')).not.toHaveCount(0);
      await page.screenshot({path:'artifacts/bowser-collision-details-fixed.png'});
    }
    for(const [a,b]of timing.active){
      await expect(page.getByRole('button',{name:`Go to frame ${a}`,exact:true})).toHaveClass(/active-frame/);
      await expect(page.getByRole('button',{name:`Go to frame ${b}`,exact:true})).toHaveClass(/active-frame/);
    }
    if(fighterId==='king-dedede'){
      await page.getByRole('button',{name:'Go to frame 26',exact:true}).click();
      await expect(page.locator('.hitbox-section tbody tr')).not.toHaveCount(0);
      await page.screenshot({path:`artifacts/smash-dedede-${isMobile?'mobile':'desktop'}.png`});
    }
    if(fighterId==='ness')await expect(page.getByText('Active timing is checked; this attack has no extracted collision geometry. Hitboxes are unavailable.',{exact:true})).toBeVisible();
    if(name==='AttackS4S2'){
      await expect(page.getByRole('link',{name:/View (release subaction|full smash)/})).toHaveCount(0);
      await page.goto(`/#/fighters/${fighterId}/${entry.id}?frame=1&view=raw`);
      await expect(page.getByLabel('Move summary').locator('.move-summary-item').filter({hasText:'Actionable'})).toHaveCount(0);
      await page.goto(`/#/fighters/${fighterId}/${entry.id}`);
      await expect(summary.locator('.move-summary-item').filter({hasText:'Active'})).toContainText(active);
    }
  }
  const compendium=JSON.parse(await readFile('public/study/compendium.json','utf8'));
  const card=compendium.cards.find((c:{subjectId:string;topic:string;field:string;move?:{name:string}})=>c.subjectId==='link'&&c.topic==='Move stats · Smashes'&&c.field==='Active Frames'&&c.move?.name===moveLabel('AttackS4S2','link').name);
  expect(card).toBeTruthy();
  await page.goto(`/#/study?deck=attributes&subject=link&card=${encodeURIComponent(card.id)}&mode=library`);
  await expect(page.locator('.study-question')).toContainText('Hit 2');
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
  await expect(page.locator('.study-answer')).toContainText('14-17, 28-32');
  await page.getByRole('button',{name:'View animation',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.locator('canvas')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Go to frame 28',exact:true})).toHaveClass(/active-frame/);
  await dialog.getByRole('button',{name:'Go to frame 28',exact:true}).click();
  await expect(dialog.getByRole('slider',{name:'Animation frame'})).toHaveValue('28');
  await dialog.getByRole('button',{name:'Close animation',exact:true}).click();
  const bubble=compendium.cards.find((c:{subjectId:string;deck:string;move?:{id:string}})=>c.subjectId==='link'&&c.deck==='hitboxes'&&c.move?.id===card.move.id);
  expect(bubble).toBeTruthy();
  await page.goto(`/#/study?deck=hitboxes&subject=link&card=${encodeURIComponent(bubble.id)}&mode=library`);
  await expect(page.locator('.study-hit-view canvas')).toBeVisible();
  await expect(page.locator('.study-hit-view [role=alert]')).toHaveCount(0);
  await page.screenshot({path:`artifacts/smash-link-card-${isMobile?'mobile':'desktop'}.png`});
});
