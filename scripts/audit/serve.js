// Serves a web export with the headers expo-sqlite needs: node scripts/audit/serve.js <export dir> (port 8099).
const http=require('http'),fs=require('fs'),path=require('path');
const root=process.argv[2];const types={'.js':'text/javascript','.html':'text/html','.wasm':'application/wasm','.ttf':'font/ttf','.png':'image/png','.json':'application/json','.ico':'image/x-icon'};
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(root,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(root,'index.html');
r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'credentialless'});fs.createReadStream(f).pipe(r);}).listen(8099);
