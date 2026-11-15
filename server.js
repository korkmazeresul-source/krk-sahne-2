import express from 'express';
import cors from 'cors';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
const app=express();
app.use(cors({origin:['https://korkmazeresul-source.github.io','http://localhost:3000']}));
const username=(process.env.TIKTOK_USERNAME||'krkmedya').replace(/^@/,'');
const clients=new Set();
let status={connected:false,username,error:null,lastEvent:null};
let connection=null;
function emit(payload){const msg='data: '+JSON.stringify(payload)+'\n\n';for(const res of clients){try{res.write(msg)}catch{clients.delete(res)}}}
function safeUser(d){return String(d?.user?.uniqueId||d?.uniqueId||'').replace(/^@/,'').slice(0,64)}
function connect(){
 if(connection){try{connection.disconnect()}catch{}}
 connection=new TikTokLiveConnection(username,{processInitialData:false});
 connection.on(WebcastEvent.CHAT,d=>{const user=safeUser(d);if(!user)return;status.lastEvent=new Date().toISOString();emit({type:'comment',user,comment:String(d.comment||'').slice(0,200)})});
 connection.on(WebcastEvent.GIFT,d=>{const user=safeUser(d);if(!user)return;if(d.giftType===1&&d.repeatEnd===false)return;status.lastEvent=new Date().toISOString();emit({type:'gift',user,giftId:d.giftId,giftName:d.giftName||d.extendedGiftInfo?.name||'',repeatCount:d.repeatCount||1})});
 connection.on(WebcastEvent.STREAM_END,()=>{status.connected=false;emit({type:'status',...status})});
 connection.connect().then(()=>{status={...status,connected:true,error:null};emit({type:'status',...status})}).catch(err=>{status={...status,connected:false,error:String(err.message||err).slice(0,180)};emit({type:'status',...status});setTimeout(connect,30000)});
}
app.get('/health',(req,res)=>res.json(status));
app.get('/events',(req,res)=>{res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('Connection','keep-alive');res.flushHeaders();res.write('data: '+JSON.stringify({type:'status',...status})+'\n\n');clients.add(res);req.on('close',()=>clients.delete(res))});
setInterval(()=>{for(const res of clients)res.write(': heartbeat\n\n')},20000);
app.listen(process.env.PORT||3000,'0.0.0.0',()=>{console.log('KRK TikTok listener ready');connect()});
