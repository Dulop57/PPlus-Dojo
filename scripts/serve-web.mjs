import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
const root=resolve('dist-web'),port=Number(process.env.DOJO_WEB_PORT||4180);
const config=await readFile(join(root,'_headers'),'utf8');const csp=config.match(/Content-Security-Policy: (.+)/)?.[1];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.pak':'application/octet-stream','.gz':'application/octet-stream'};
createServer(async(request,response)=>{try{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname),file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  // Match Cloudflare's canonical homepage redirect during offline testing.
  if(pathname==='/index.html'){response.writeHead(301,{Location:'/'});response.end();return;}
  if(!file.startsWith(root+sep)){response.writeHead(403);response.end();return;}
  const info=await stat(file);if(!info.isFile())throw new Error('Not a file');
  response.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':pathname.startsWith('/web-data/')?'public, max-age=31536000, immutable':'no-cache',...(csp?{'Content-Security-Policy':csp}:{}),'X-Content-Type-Options':'nosniff'});
  if(request.method==='HEAD')response.end();else createReadStream(file).pipe(response);
}catch{response.writeHead(404);response.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Local URL: http://127.0.0.1:${port}`));
