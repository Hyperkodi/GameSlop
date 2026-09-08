import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav'};
export function createServer(){return http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/'){res.writeHead(302,{Location:'/games/pac-chad/'});res.end();return;}
    const prefix='/games/pac-chad/';
    if(!pathname.startsWith(prefix)){res.writeHead(404);res.end('Not found');return;}
    const relative=pathname.slice(prefix.length)||'index.html';
    if(relative.split(/[\\/]/).some(v=>v==='..'||v.startsWith('.'))||!/^(index\.html|sound-lab\.html|style\.css|js\/[a-z-]+\.mjs|assets\/[A-Za-z-]+\.(svg|png|webp|mp3|wav|ogg)|integration\/gameslop-sdk\.js)$/.test(relative)){res.writeHead(404);res.end('Not found');return;}
    const file=path.join(root,relative);const info=await stat(file);if(!info.isFile())throw Error();
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.PAC_CHAD_PORT||8782);createServer().listen(port,'127.0.0.1',()=>process.stdout.write(`Pac-Chad: http://127.0.0.1:${port}/games/pac-chad/\n`));}
