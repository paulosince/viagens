// Server-only federation link operation. Does not create accounts or accept client UUIDs.
// Dependencies are injected to make unauthorized and interrupted flows testable.
export async function linkTwoProjects({record,repository}) {
  if (!record || typeof record.neon_subject!=='string' || typeof record.legacy_user_id!=='string'
      || record.proof_kind!=='dual_session') throw Error('UNVERIFIED_IDENTITY');
  if (!repository || typeof repository.withLock!=='function'
      || typeof repository.prepare!=='function' || typeof repository.activate!=='function'
      || typeof repository.deactivate!=='function') throw Error('LINK_STORE_NOT_CONFIGURED');
  return repository.withLock(record, async()=>{
    // Both records remain INACTIVE until both projects have prepared successfully.
    await repository.prepare('a',record);
    await repository.prepare('b',record);
    try {
      await repository.activate('a',record);
      await repository.activate('b',record);
      return Object.freeze({status:'linked'});
    } catch (error) {
      // A compensating rollback is necessary because PostgreSQL transactions
      // cannot span two separate Neon projects. This is NOT atomic commit.
      const repairs=await Promise.allSettled([
        repository.deactivate('a',record),
        repository.deactivate('b',record)
      ]);
      if (repairs.some(r=>r.status==='rejected'))
        throw Error('LINK_REQUIRES_ADMIN_RECONCILIATION');
      throw Error('LINK_ACTIVATION_ROLLED_BACK');
    }
  });
}

const ALLOWED_METHODS = 'POST, OPTIONS';
export function createLinkHandler({prove,link,origin='https://paulosince.github.io',enabled=false}) {
  if (typeof prove!=='function'||typeof link!=='function') throw Error('LINK_SERVICE_NOT_CONFIGURED');
  const common={
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  };
  return async request=>{
    const headers={...common};
    const requestOrigin=request.headers.get('origin');
    if (requestOrigin!==origin)
      return Response.json({error:'ORIGIN_NOT_ALLOWED'},{status:403,headers});
    headers['Access-Control-Allow-Origin']=origin;
    headers['Vary']='Origin';
    headers['Access-Control-Allow-Methods']=ALLOWED_METHODS;
    headers['Access-Control-Allow-Headers']='authorization, x-legacy-access-token';
    if (request.method==='OPTIONS')
      return new Response(null,{status:204,headers});
    const url=new URL(request.url);
    if (url.pathname!=='/link' || request.method!=='POST')
      return Response.json({error:'NOT_FOUND'},{status:404,headers});
    if (!enabled)
      return Response.json({error:'MIGRATION_NOT_ENABLED'},{status:503,headers});
    const auth=request.headers.get('authorization')||'';
    const neonToken=auth.startsWith('Bearer ')?auth.slice(7):'';
    const legacyToken=request.headers.get('x-legacy-access-token')||'';
    if (!neonToken||!legacyToken || neonToken.length>8192 || legacyToken.length>8192)
      return Response.json({error:'UNAUTHORIZED'},{status:401,headers});
    try {
      const proof=await prove({centralToken:neonToken,legacyToken});
      const outcome=await link(proof);
      return Response.json(outcome,{status:200,headers});
    }catch(error) {
      const retry=error?.message==='LINK_ACTIVATION_ROLLED_BACK'
          || error?.message==='LINK_REQUIRES_ADMIN_RECONCILIATION';
      return Response.json({error:retry?'MIGRATION_UNAVAILABLE':'UNAUTHORIZED'},
        {status:retry?503:401,headers});
    }
  };
}
