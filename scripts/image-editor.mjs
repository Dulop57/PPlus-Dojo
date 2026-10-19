import {readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';

// Only registered for the explicitly enabled, loopback-only owner dev server.
export function imageEditorPlugin(){
  let queue=Promise.resolve();
  return {name:'dojo-owner-image-editor',apply:'serve',configureServer(server){
    if(process.env.VITE_DOJO_IMAGE_EDITOR!=='true')return;
    const register=(endpoint,file)=>server.middlewares.use(endpoint,(req,res)=>{
      const respond=(code,data)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
      if(req.method!=='POST')return respond(405,{error:'POST required.'});
      if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host??'')||req.headers.origin!==`http://${req.headers.host}`||!req.headers['content-type']?.startsWith('application/json'))return respond(403,{error:'Local editor requests only.'});
      let body='';
      req.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy();});
      req.on('end',()=>{
        let input;
        try{input=JSON.parse(body);}catch{return respond(400,{error:'Invalid JSON.'});}
        if(!input||typeof input!=='object'||Array.isArray(input))return respond(400,{error:'Invalid image framing.'});
        const {id,framing}=input;
        if(typeof id!=='string'||! /^[a-z0-9-]{1,80}$/.test(id)||!framing||!['x','y','scale'].every(key=>typeof framing[key]==='number'&&Number.isFinite(framing[key]))||Math.abs(framing.x)>100||Math.abs(framing.y)>100||framing.scale<1||framing.scale>3.5)return respond(400,{error:'Invalid image framing.'});
        queue=queue.catch(()=>{}).then(async()=>{
          const defaults=JSON.parse(await readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT')return '{}';throw error;}));
          defaults[id]={x:framing.x,y:framing.y,scale:framing.scale};
          await writeFile(file+'.tmp',JSON.stringify(defaults,null,2)+'\n');
          await rename(file+'.tmp',file);
          respond(200,{saved:true});
        }).catch(()=>respond(500,{error:'Could not save project defaults.'}));
      });
    });
    register('/__dojo-owner/stage-framing',resolve(process.env.DOJO_IMAGE_EDITOR_DEFAULTS_FILE??'src/data/stage-framings.json'));
    register('/__dojo-owner/roster-framing',resolve(process.env.DOJO_ROSTER_EDITOR_DEFAULTS_FILE??'src/data/roster-framings.json'));
  }};
}
