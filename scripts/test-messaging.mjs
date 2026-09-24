import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { SignJWT } from 'jose';
import { io as connect } from 'socket.io-client';
import { attachMessaging } from '../src/server/messaging.mjs';

const userId='11111111-1111-4111-8111-111111111111', sessionId='22222222-2222-4222-8222-222222222222';
const secret='a-test-only-signing-secret-with-at-least-32-characters';
const messages=[];
let revoked=false;
const pool={ async query(sql,args=[]) {
  if(sql.includes('FROM sessions')) return {rows:!revoked && args[2]==='test-workspace' ? [{id:userId,name:'Test member',workspace_id:'test-room'}]:[]};
  if(sql.includes('count(*)')) return {rows:[{count:messages.length}]};
  if(sql.startsWith('INSERT')) { const m={id:args[0],body:args[3],userId:args[2],createdAt:new Date().toISOString()};messages.push(m);return {rows:[m]}; }
  if(sql.startsWith('SELECT id FROM workspace_messages')) return {rowCount:messages.filter(m=>m.id===args[0]).length};
  if(sql.includes('FROM workspace_messages m')) return {rows:[...messages].reverse().map(m=>({...m,name:'Test member'}))};
  return {rows:[]};
}, async connect(){return {...this,release(){}};} };
const server=createServer();
const sockets=attachMessaging(server,pool,secret,'http://localhost');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const token=await new SignJWT({sid:sessionId,type:'access'}).setProtectedHeader({alg:'HS256'}).setSubject(userId).setIssuer('teamflow').setAudience('teamflow-web').setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(secret));
const clients=[];
function client(slug='test-workspace',authenticated=true){const c=connect(`http://127.0.0.1:${server.address().port}`,{transports:['websocket'],reconnection:false,auth:{workspaceSlug:slug},extraHeaders:{Origin:'http://localhost',Cookie:authenticated?`teamflow_access=${token}`:''}});clients.push(c);return c;}
function event(c,name){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Timeout: ${name}`)),5000);c.once(name,data=>{clearTimeout(timer);resolve(data);});});}
function request(c,name,...args){return c.timeout(5000).emitWithAck(name,...args);}
try {
  const url = `http://127.0.0.1:${server.address().port}/socket.io/?EIO=4&transport=polling`;
  const sameOriginStatus = await new Promise((resolve, reject) => { const req = httpRequest(url, { headers: { Host: 'localhost', 'Sec-Fetch-Site': 'same-origin' } }, response => { response.resume(); resolve(response.statusCode); }); req.on('error', reject); req.end(); });
  assert.equal(sameOriginStatus, 200);
  assert.equal((await fetch(url, { headers: { Host: 'localhost', 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await fetch(url, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
  await event(client('test-workspace',false),'connect_error');
  await event(client('other-workspace'),'connect_error');
  const a=client(),b=client();await Promise.all([event(a,'connect'),event(b,'connect')]);
  assert.match((await request(a,'messages:send',{id:crypto.randomUUID(),body:' '})).error,/Enter/);
  const incoming=event(b,'messages:new');
  const data={id:crypto.randomUUID(),body:'Hello team'};
  assert.equal((await request(a,'messages:send',data)).ok,true);
  assert.equal((await incoming).body,'Hello team');
  await request(a,'messages:send',data);assert.equal(messages.length,1);
  assert.equal((await request(b,'messages:history')).messages.length,1);
  revoked=true;
  assert.ok((await request(a,'messages:send',{id:crypto.randomUUID(),body:'Blocked'})).error);
  assert.ok((await request(b,'messages:history')).error);
  console.log('PASS: authentication, workspace isolation, validation, delivery to second client, history, deduplication, revoked-session rejection.');
} finally {clients.forEach(c=>c.disconnect());await new Promise(resolve=>sockets.close(resolve));}
