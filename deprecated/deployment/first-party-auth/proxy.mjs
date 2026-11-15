const UPSTREAM='https://ep-small-bread-b7uq0zva.neonauth.c-13.us-east-1.aws.neon.tech/viaggio_auth/auth';
const ROUTES=new Map([['sign-in/email','POST'],['get-session','GET'],['token','GET'],['sign-out','POST']]);
const fail=(status,message)=>Response.json({message},{status,headers:{'cache-control':'no-store'}});
export function createProxy({origin,cookieSecret,handleAuthProxyRequest}) {
  const expected=new URL(origin);
  if(expected.protocol!=='https:' || expected.origin!==origin)throw new Error('An exact HTTPS application origin is required.');
  if(typeof cookieSecret!=='string'||cookieSecret.length<32)throw new Error('Cookie signing secret must contain at least 32 characters.');
  return async request=>{
    const url=new URL(request.url);
    if(url.origin!==origin)return fail(403,'Invalid host');
    const route=url.pathname.slice('/api/auth/'.length);
    if(!url.pathname.startsWith('/api/auth/') || !ROUTES.has(route))return fail(404,'Not found');
    if(request.method!==ROUTES.get(route))return fail(405,'Method not allowed');
    // No cross-origin authentication proxy, wildcard CORS, or arbitrary upstream.
    const incomingOrigin=request.headers.get('origin');
    if((incomingOrigin && incomingOrigin!==origin) || request.headers.get('sec-fetch-site')==='cross-site')return fail(403,'Invalid origin');
    if(request.method==='POST' && incomingOrigin!==origin)return fail(403,'Origin required');
    if(url.search)return fail(400,'Unsupported query');
    if(request.method==='POST' && !request.headers.get('content-type')?.startsWith('application/json'))return fail(415,'JSON required');
    // Only small credential/empty sign-out requests; never log or persist them.
    if(request.body){
      const reader=request.body.getReader();let size=0;const chunks=[];
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();return fail(413,'Request too large')}chunks.push(value)}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
      request=new Request(request.url,{method:request.method,headers:request.headers,body:bytes,duplex:'half'});
    }
    try {
      const response=await handleAuthProxyRequest({request,path:route,baseUrl:UPSTREAM,cookieSecret,sessionDataTtl:0,sameSite:'lax',logLevel:'silent'});
      response.headers.set('cache-control','no-store');
      return response;
    }catch{return fail(502,'Authentication service unavailable')}
  };
}
