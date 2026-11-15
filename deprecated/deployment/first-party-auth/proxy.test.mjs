import test from 'node:test';
import assert from 'node:assert/strict';
import {createProxy} from './proxy.mjs';
import {handleAuthProxyRequest} from '@neondatabase/auth/server';
const origin='https://viaggio.example.test';
const cookieSecret='test-only-cookie-signing-secret-32-characters';
const req=(path,options={})=>new Request(origin+'/api/auth/'+path,options);
test('rejects cross-site mutations, arbitrary routes, methods and configuration',async()=>{
 let calls=0;const handler=createProxy({origin,cookieSecret,handleAuthProxyRequest:async()=>{calls++;return new Response('{}')}});
 const options={method:'POST',headers:{origin:'https://other.example.test','content-type':'application/json'},body:'{}'};
 assert.equal((await handler(req('sign-in/email',options))).status,403);
 assert.equal((await handler(req('sign-out',{method:'POST'}))).status,403);
 assert.equal((await handler(req('admin/list-users'))).status,404);
 assert.equal((await handler(req('sign-in/email'))).status,405);
 assert.equal((await handler(req('get-session?redirect=https://evil.example'))).status,400);
 assert.equal(calls,0);
 assert.throws(()=>createProxy({origin:'http://example.test',cookieSecret,handleAuthProxyRequest}));
 assert.throws(()=>createProxy({origin,cookieSecret:'short',handleAuthProxyRequest}));
});
test('preserves upstream error status; response is never cached',async()=>{
 const handler=createProxy({origin,cookieSecret,handleAuthProxyRequest:async options=>{assert.equal(options.sameSite,'lax');return Response.json({message:'Invalid credentials'},{status:401})}});
 const result=await handler(req('sign-in/email',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'}));
 assert.equal(result.status,401);assert.equal(result.headers.get('cache-control'),'no-store');
});
test('official SDK proxy emits first-party Secure HttpOnly cookies and forwards session',async()=>{
 const nativeFetch=globalThis.fetch;let seenCookie;
 globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  assert.equal(url.origin,'https://ep-small-bread-b7uq0zva.neonauth.c-13.us-east-1.aws.neon.tech');
  const headers=new Headers(init?.headers || input.headers);
  if(url.pathname.endsWith('/sign-in/email'))return Response.json({user:{id:'test-user'},token:'synthetic-test-token'},{headers:{'Set-Cookie':'__Secure-neon-auth.session_token=synthetic-test-token; Path=/; HttpOnly; Secure; SameSite=None; Partitioned'}});
  seenCookie=headers.get('cookie');
  return Response.json({session:{id:'test-session',expiresAt:'2099-01-01T00:00:00.000Z',createdAt:'2026-11-15T00:00:00.000Z',updatedAt:'2026-11-15T00:00:00.000Z'},user:{id:'test-user',email:'test@example.invalid',createdAt:'2026-11-15T00:00:00.000Z',updatedAt:'2026-11-15T00:00:00.000Z'}});
 };
 try {
  const handler=createProxy({origin,cookieSecret,handleAuthProxyRequest});
  const login=await handler(req('sign-in/email',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'test@example.invalid',password:'synthetic'})}));
  assert.equal(login.status,200);
  const cookie=login.headers.getSetCookie().find(c=>c.startsWith('__Secure-neon-auth.session_token='));
  assert.ok(cookie);assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=Lax/i);assert.doesNotMatch(cookie,/Partitioned|Domain=/i);
  const session=await handler(req('get-session',{headers:{cookie:cookie.split(';')[0],origin}}));
  assert.equal(session.status,200);assert.equal((await session.json()).user.id,'test-user');assert.match(seenCookie,/synthetic-test-token/);
 }finally{globalThis.fetch=nativeFetch}
});

test('Cloudflare adapter fails closed without secrets and rejects foreign origins',async()=>{
 const {onRequest}=await import('./cloudflare.mjs');
 const missing=await onRequest({request:req('get-session'),env:{}});
 assert.equal(missing.status,503);
 assert.equal(missing.headers.get('cache-control'),'no-store');
 const result=await onRequest({request:req('sign-out',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:'{}'}),env:{VIAGGIO_PUBLIC_ORIGIN:origin,NEON_AUTH_COOKIE_SECRET:cookieSecret}});
 assert.equal(result.status,403);
});
