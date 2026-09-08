import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url),port=Number(process.env.CASH_CANNON_PORT||8783);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.jpg':'image/jpeg','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{
  let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/games\/cash-cannon\//,'/');if(path==='/')path='/index.html';
  if(!/^\/(index\.html|style\.css|js\/[a-z-]+\.mjs|assets\/[a-z-]+\.png|assets\/cex\/[a-z-]+\.(png|ico|jpg))$/.test(path)){res.writeHead(404);res.end('Not found');return;}
  const data=await readFile(fileURLToPath(new URL(path.slice(1),root))),extension=path.slice(path.lastIndexOf('.'));res.writeHead(200,{'Content-Type':mime[extension]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
}catch{res.writeHead(404);res.end('Not found');}});
server.listen(port,'127.0.0.1',()=>console.log(`Cash Cannon: http://127.0.0.1:${port}`));
