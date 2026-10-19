import {test,expect} from '@playwright/test';

test('Attribute descriptions stay inside their chart and remain unobscured',async({page,isMobile})=>{
  if(!isMobile)await page.setViewportSize({width:1090,height:602});
  for(const route of ['Main?metric=Weight','Misc']){
    await page.goto(`/#/attributes/${route}`);
    if(isMobile)await page.getByRole('button',{name:'Chart',exact:true}).click();
    const description=page.locator('.chart-description:visible').first();
    await description.locator('summary').click();
    await expect(description.locator('p')).toBeVisible();
    const bounds=await description.locator('p').evaluate(p=>{
      const box=p.getBoundingClientRect(),card=p.closest('.attribute-chart-card')!.getBoundingClientRect();
      const hit=document.elementFromPoint(box.left+18,box.top+18);
      return {inside:box.left>=card.left&&box.right<=card.right&&box.left>=0&&box.right<=innerWidth,unobscured:hit===p||p.contains(hit),noHorizontalOverflow:p.scrollWidth<=p.clientWidth};
    });
    expect(bounds).toEqual({inside:true,unobscured:true,noHorizontalOverflow:true});
    await description.locator('summary').click();
    await expect(description.locator('p')).not.toBeVisible();
  }
});

test('Desktop overview fits the roster, compact details and both side menus',async({page,isMobile})=>{
  test.skip(isMobile,'Desktop side menus adapt to a category strip on mobile.');
  for(const [width,height] of [[1090,602],[1280,720],[1024,768],[1920,1080]]){
    await page.setViewportSize({width,height});await page.goto('/#/attributes/Main?metric=Weight');
    await expect(page.locator('.chart-columns .chart-roster-row')).toHaveCount(42);
    await expect(page.locator('.attribute-metric-sidebar .metric-option')).toHaveCount(28);
    await page.getByRole('combobox',{name:'Chart measurement'}).selectOption('0');
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('textbox',{name:'Search attribute entries'}).focus();
    await page.getByRole('button',{name:'Inspect Fox',exact:true}).focus();
    await expect(page.getByRole('complementary',{name:'Chart details'})).toContainText('75');
    await expect(page.getByRole('complementary',{name:'Chart details'})).not.toContainText('Exact value');
    await expect(page.getByRole('complementary',{name:'Chart details'})).not.toContainText('Main!');
    await page.getByRole('combobox',{name:'Chart measurement'}).selectOption('1');
    expect(await page.locator('rect[data-value]').evaluateAll(rects=>rects.every(rect=>Number(rect.getAttribute('y'))>=0&&Number(rect.getAttribute('y'))+Number(rect.getAttribute('height'))<=100.01))).toBe(true);
    expect(await page.locator('rect[data-value]').evaluateAll(rects=>rects.some(rect=>Number(rect.getAttribute('data-value'))<0))).toBe(true);
  }
  await page.setViewportSize({width:1090,height:602});await page.goto('/#/attributes/Misc');
  await expect(page.getByRole('navigation',{name:'Misc categories'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Choose a fighter group'})).toHaveCount(0);
  await expect(page.locator('.chart-group-face')).toHaveCount(42);
  await expect(page.locator('.chart-details')).toHaveCount(1);
  expect(await page.locator('.chart-group-face').evaluateAll(faces=>faces.every(face=>face.getBoundingClientRect().bottom<=face.parentElement!.getBoundingClientRect().bottom))).toBe(true);
  await page.getByRole('button',{name:'Dash length',exact:true}).click();
  expect(await page.locator('.chart-group-face').evaluateAll(faces=>faces.every(face=>face.getBoundingClientRect().bottom<=face.parentElement!.getBoundingClientRect().bottom))).toBe(true);
  for(const name of ['Number of jumps','Empty landing lag']){
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.chart-group-face')).not.toHaveCount(0);
    expect(await page.locator('.chart-group-face').evaluateAll(faces=>faces.every(face=>face.getBoundingClientRect().bottom<=face.parentElement!.getBoundingClientRect().bottom))).toBe(true);
  }
  await page.getByRole('button',{name:'True spikes',exact:true}).click();
  await expect(page.locator('.true-spike-card')).toHaveCount(20);
  expect(await page.locator('.true-spike-grid').evaluate(grid=>grid.getBoundingClientRect().bottom<=grid.parentElement!.getBoundingClientRect().bottom)).toBe(true);
});

test('Misc fixes preserve icons, descriptions, ability dependencies and sorting',async({page,isMobile})=>{
  const errors:string[]=[];page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  if(!isMobile)await page.setViewportSize({width:1090,height:602});
  await page.goto('/#/attributes/Misc');
  const categories=page.getByRole('navigation',{name:'Misc categories'});
  await categories.getByRole('button',{name:'Empty landing lag',exact:true}).click();
  await expect(page.locator('rect[data-value]')).toHaveCount(2);
  expect(await page.locator('rect[data-value]').evaluateAll(rects=>rects.map(rect=>Number(rect.getAttribute('data-value'))).sort())).toEqual([4,5]);
  await expect(page.locator('.chart-group-face img')).toHaveCount(42);
  await page.getByRole('combobox',{name:'Sort chart'}).selectOption('name');
  await page.getByRole('textbox',{name:'Search reference entries'}).fill('Fox');
  await page.getByRole('textbox',{name:'Search reference entries'}).fill('');
  await expect(page.locator('.chart-group-face img')).toHaveCount(42);
  await expect.poll(()=>page.locator('.chart-group-face img').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0))).toBe(true);
  if(!isMobile)expect(await page.locator('.chart-group-members').evaluateAll(members=>members.every(el=>el.getBoundingClientRect().bottom<=el.closest('.chart-comparison-plot')!.getBoundingClientRect().bottom))).toBe(true);
  await categories.getByRole('button',{name:'Notable outliers',exact:true}).click();
  await expect(page.locator('.chart-row-label img')).toHaveCount(10);await expect(page.locator('.chart-entry-description')).toHaveCount(10);
  await expect(page.locator('.chart-entry-description').last()).toHaveText('Glide Toss');
  expect(await page.locator('.chart-entry-description').evaluateAll(items=>items.every(el=>getComputedStyle(el).whiteSpace==='normal'&&getComputedStyle(el).textOverflow!=='ellipsis'))).toBe(true);
  await categories.getByRole('button',{name:'Number of jumps',exact:true}).click();await expect(page.getByRole('combobox',{name:'Sort chart'})).toHaveValue('name');
  await expect(page.locator('.chart-row-label')).toHaveText(['2','3','4','5','6']);
  for(const [category,base,extended] of [['Crawl options','Crawl','Crawl-Attack'],['Wall movement','Can Wall-Jump','Can Wall-Cling']]){
    await categories.getByRole('button',{name:category,exact:true}).click();
    expect(await page.locator('.chart-matrix-overview').evaluate(table=>{const rows=[...table.querySelectorAll('tbody tr')];const a=rows[0].querySelectorAll('button'),b=rows[1].querySelectorAll('button');return [...b].every((cell,index)=>cell.getAttribute('data-member')!=='true'||a[index].getAttribute('data-member')==='true');})).toBe(true);
    await expect(page.getByRole('rowheader',{name:base,exact:true})).toBeVisible();await expect(page.getByRole('rowheader',{name:extended,exact:true})).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('True Spikes cards use Grid PNGs and all fit in the desktop viewport',async({page,isMobile})=>{
  if(!isMobile)await page.setViewportSize({width:1090,height:602});
  await page.goto('/#/attributes/Misc');await page.getByRole('button',{name:'True spikes',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cards',exact:true})).toBeVisible();await expect(page.locator('.true-spike-card')).toHaveCount(20);
  await expect(page.locator('.chart-matrix-overview,.chart-row-svg')).toHaveCount(0);
  expect(await page.locator('.true-spike-card img').evaluateAll(images=>images.length===20&&images.every(img=>(img as HTMLImageElement).src.includes('_Grid.png')))).toBe(true);
  await expect(page.locator('[data-fighter-id=bowser]')).toContainText('Side B (Aerial down)');
  if(!isMobile){expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);expect(await page.locator('.true-spike-card').evaluateAll(cards=>cards.every(card=>[...card.querySelectorAll('img,h3,p')].every(el=>el.getBoundingClientRect().bottom<=card.getBoundingClientRect().bottom)))).toBe(true);}
  await page.getByRole('textbox',{name:'Search reference entries'}).fill('Bowser');await expect(page.locator('.true-spike-card')).toHaveCount(1);
});

test('Main defaults to Sum when A, B and Sum measurements are available',async({page})=>{
  await page.goto('/#/attributes/Main?metric=Horizontal%20Air%20Accel.');
  const measurement=page.getByRole('combobox',{name:'Chart measurement'});
  await expect(measurement).toHaveValue('2');await expect(measurement.locator('option:checked')).toHaveText('Sum');
  await page.getByRole('button',{name:'Weight',exact:true}).click();await expect(measurement).toHaveValue('0');
  await page.getByRole('button',{name:'Horizontal Air Accel.',exact:true}).click();await expect(measurement).toHaveValue('2');
});

test('Inspection, search, sorting and table views work without fighter selection',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/#/attributes/Main?metric=Weight');await expect(page.locator('[data-chart-kind=bars]')).toBeVisible();
  await page.getByRole('button',{name:'Inspect Fox',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'Chart details'})).toContainText('Fox');
  await expect(page.locator('.chart-member-list,.chart-selections,[data-selected=true]')).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Highlight fighter'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Inspect Fox',exact:true})).not.toHaveAttribute('aria-pressed');
  await page.getByRole('combobox',{name:'Sort chart'}).selectOption('name');await expect(page.locator('.chart-roster-row').first()).toContainText('Bowser');
  await page.getByRole('textbox',{name:'Search attribute entries'}).fill('fox');await expect(page.locator('.chart-roster-row')).toHaveCount(1);
  await page.getByRole('button',{name:'Table',exact:true}).click();await expect(page.locator('.ranking-table tbody tr')).toHaveCount(1);await expect(page.locator('.ranking-table tbody')).toContainText('75');
  await page.getByRole('button',{name:'Chart',exact:true}).click();await expect(page.locator('[data-chart-kind=bars]')).toBeVisible();
  await page.getByRole('link',{name:'Grab Timings',exact:true}).click();await expect(page.locator('[data-chart-kind=timeline]')).toBeVisible();
  await page.getByRole('button',{name:'Inspect Fox',exact:true}).focus();
  await expect(page.getByRole('complementary',{name:'Chart details'})).toContainText('First active frame');
  await expect(page.getByRole('complementary',{name:'Chart details'})).not.toContainText('Grab Timings!');
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('F/B is omitted and timing charts contain only horizontal event markers',async({page})=>{
  await page.goto('/#/attributes/Main?metric=Glide%20Toss');
  const measurement=page.getByRole('combobox',{name:'Chart measurement'});
  await expect(measurement.locator('option')).toHaveText(['Distance','Z-score']);
  await expect(measurement).toHaveValue('0');
  for(const category of ['Grab%20Timings','Ledge%20stuff']){
    await page.goto(`/#/attributes/${category}`);
    if(category==='Ledge%20stuff')await page.getByRole('button',{name:'Below 100% · Attack',exact:true}).click();
    await expect(page.locator('[data-chart-kind=timeline]')).toBeVisible();
    await expect(page.locator('.chart-plot-button svg rect,.chart-track')).toHaveCount(0);
    expect(await page.locator('.chart-plot-button svg line').evaluateAll(lines=>lines.every(line=>line.getAttribute('y1')===line.getAttribute('y2')))).toBe(true);
  }
  await expect(page.getByRole('button',{name:'Fighter notes',exact:true})).toHaveCount(0);
});

test('Group faces and membership matrices expose readable hover details',async({page})=>{
  await page.goto('/#/attributes/Aerial%20Landing%20Lags');await expect(page.locator('[data-chart-kind=heatmap]')).toBeVisible();
  await page.locator('.heatmap-cell').first().focus();await expect(page.getByRole('complementary',{name:'Chart details'})).toContainText('Neutral');
  await page.getByRole('button',{name:'Not L-cancelled',exact:true}).click();await expect(page.getByRole('heading',{name:'Not L-cancelled',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Misc',exact:true}).click();await expect(page.locator('[data-chart-kind=groups]')).toBeVisible();
  await expect(page.locator('.chart-group-members')).toHaveCount(3);await expect(page.locator('.chart-details')).toHaveCount(0);
  await page.getByRole('button',{name:'Crawl options',exact:true}).click();await expect(page.locator('[data-chart-kind=matrix]')).toBeVisible();
  await page.locator('.membership-cell[data-member=true]').first().focus();await expect(page.getByRole('complementary',{name:'Chart details'})).toContainText('Yes');
  await expect(page.getByRole('complementary',{name:'Chart details'})).not.toContainText('Source value');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Short-hop bars use the full plot and explorer data remains searchable',async({page})=>{
  await page.goto('/#/attributes/SH%20Times');await expect(page.locator('[data-chart-kind=grouped]')).toBeVisible();
  expect(await page.locator('.chart-row-svg').first().evaluate(svg=>svg.getBoundingClientRect().height/svg.parentElement!.getBoundingClientRect().height)).toBeGreaterThan(.9);
  await page.goto('/#/attributes/Raw%20Data');await page.getByRole('combobox',{name:'Reference value'}).selectOption({label:'Weight'});
  await page.getByRole('textbox',{name:'Search reference entries'}).fill('Fox');await expect(page.locator('.chart-roster-row')).toHaveCount(1);await expect(page.locator('.chart-row-values')).toContainText('75');
  await page.getByRole('textbox',{name:'Search reference entries'}).fill('no-matching-fighter');await expect(page.getByRole('status')).toContainText('No entries match');
});

test('Dodges show all four information groups without charts or scrolling',async({page,isMobile})=>{
  if(!isMobile)await page.setViewportSize({width:1090,height:602});
  await page.goto('/#/attributes/Dodges');await expect(page.locator('.dodge-panel')).toHaveCount(4);
  for(const name of ['Rolls','Spotdodges','Airdodges','Techs'])await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(page.locator('.attribute-chart-card,.chart-view-switch')).toHaveCount(0);
  await expect(page.locator('.dodge-faces .fighter-name-icon')).toHaveCount(41);
  await expect(page.locator('.dodge-reference')).toContainText('32');await expect(page.locator('.dodge-reference')).toContainText('51');
  if(!isMobile){expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);expect(await page.locator('.dodge-panel').evaluateAll(panels=>panels.every(panel=>[...panel.querySelectorAll('tr,.dodge-faces')].every(row=>row.getBoundingClientRect().bottom<=panel.getBoundingClientRect().bottom)))).toBe(true);}
});

test('EXTRA links open the archive and the About page retains source credits',async({page,isMobile})=>{
  await page.goto('/#/attributes');await expect(page.getByRole('navigation',{name:'Attribute worksheets'}).getByRole('link',{name:'Other Resources',exact:true})).toHaveCount(0);
  if(isMobile)await page.getByRole('button',{name:'Open navigation'}).click();
  const extra=page.getByRole('navigation',{name:'Extra'});
  await expect(extra.getByRole('link')).toHaveText(['Dragdown P+ Wiki','Other resources','About the project']);
  await expect(extra.getByRole('link',{name:'Dragdown P+ Wiki'})).toHaveAttribute('href','https://dragdown.wiki/wiki/PPlus');
  await expect(extra.getByRole('link',{name:'Other resources',exact:true})).toHaveAttribute('href','https://docs.google.com/document/d/15xMsKn6yFBGoMR5DKT_cOaGCrVQkqQaO7ebGLQzu698/edit?usp=sharing');
  await page.goto('/#/resources');await expect(page.getByRole('heading',{name:'Other resources',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'P+ Google Docs Archive'})).toHaveAttribute('href','https://docs.google.com/document/d/15xMsKn6yFBGoMR5DKT_cOaGCrVQkqQaO7ebGLQzu698/edit?usp=sharing');
  await page.goto('/#/attributes/Other%20Resources');await expect(page).toHaveURL(/#\/resources$/);
  await page.goto('/#/about');await expect(page.getByRole('link',{name:'P+ Google Docs Archive'})).toHaveAttribute('href','https://docs.google.com/document/d/15xMsKn6yFBGoMR5DKT_cOaGCrVQkqQaO7ebGLQzu698/edit?usp=sharing');await expect(page.getByRole('heading',{name:'Credits & sources'})).toBeVisible();await expect(page.locator('.about-credits')).toContainText('OrangeChris, Iris Flower');
  await expect(page.getByRole('heading',{name:'What’s next?'})).toBeVisible();for(const item of ['Adding platforms to the Stage viewer.','Add special attack cards to study.','Add olimar data for each pikmin.','Fix bugs, erroneous data, etc.'])await expect(page.locator('.guide-note').filter({has:page.getByRole('heading',{name:'What’s next?'})})).toContainText(item);
  const discord=page.getByRole('link',{name:'P+ Discord server'});await expect(discord).toHaveAttribute('href','https://discord.gg/bpWW4vvNx');await expect(discord).toHaveCSS('text-decoration-line','underline');await expect(page.locator('.about-credits')).toContainText('P+ Dojo is made by Dulop, thanks to the efforts of the amazing P+ Community');
});
