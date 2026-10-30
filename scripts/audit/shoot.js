// Screenshot one route at phone size: node scripts/audit/shoot.js <dark|navy|light> <en|tk|tr|ru> <route> <out.png> [wait ms]
const {chromium}=require('playwright');
(async()=>{const [theme,lang,route,out,wait]=process.argv.slice(2);
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
await ctx.addInitScript(([t,l])=>{try{localStorage.setItem('payhas.theme',t);localStorage.setItem('payhas.lang',l);}catch(e){}},[theme,lang]);
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,200)));
await p.goto('http://localhost:8099/'+route);await p.waitForTimeout(+wait||5000);
await p.screenshot({path:out});if(errs.length)console.log(errs.join('\n'));await b.close();})();
