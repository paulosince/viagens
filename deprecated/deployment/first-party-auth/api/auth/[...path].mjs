import {handleAuthProxyRequest} from '@neondatabase/auth/server';
import {createProxy} from '../../proxy.mjs';
let handler;
export default async function(req,res) {
  try {
    const origin=process.env.VIAGGIO_PUBLIC_ORIGIN;
    handler ||= createProxy({origin,cookieSecret:process.env.NEON_AUTH_COOKIE_SECRET,handleAuthProxyRequest});
    const headers=new Headers();
    for(const [name,value] of Object.entries(req.headers)){if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(', '):value)}
    if(headers.get('host')!==new URL(origin).host){res.statusCode=403;res.end();return}
    const url=new URL(req.url,origin);
    let body;
    if(req.method!=='GET' && req.method!=='HEAD') {
      // Vercel parses JSON bodies before invoking a Node handler.
      if(req.body!==undefined)body=typeof req.body==='string'?req.body:JSON.stringify(req.body);
      else {const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){res.statusCode=413;res.end();return}chunks.push(chunk)}body=Buffer.concat(chunks)}
    }
    const response=await handler(new Request(url,{method:req.method,headers,body,duplex:'half'}));
    res.statusCode=response.status;
    for(const [name,value] of response.headers){if(name!=='set-cookie')res.setHeader(name,value)}
    const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch {res.statusCode=503;res.setHeader('Cache-Control','no-store');res.end('Authentication is not configured.');}
}
