// Server-only identity migration. The verified legacy principal determines
// which data projects require an identity map; the browser never chooses.
export async function linkTwoProjects({record,repository}) {
  if (!record || typeof record.neon_subject!=='string'
      || typeof record.legacy_user_id!=='string'
      || record.proof_kind!=='dual_session') throw Error('UNVERIFIED_IDENTITY');
  if (!repository || typeof repository.withLock!=='function'
      || typeof repository.projectsForLegacy!=='function'
      || typeof repository.prepare!=='function'
      || typeof repository.activate!=='function'
      || typeof repository.deactivate!=='function')
    throw Error('LINK_STORE_NOT_CONFIGURED');
  return repository.withLock(record, async()=>{
    const projects=await repository.projectsForLegacy(record);
    if (!Array.isArray(projects) || projects.length<1
        || projects.length>2 || new Set(projects).size!==projects.length
        || projects.some(p=>p!=='a'&&p!=='b')) throw Error('INVALID_PROJECT_ROUTE');

    // Both links remain inactive until ALL required projects are prepared.
    for (const project of projects) await repository.prepare(project,record);
    try {
      for (const project of projects) await repository.activate(project,record);
      return Object.freeze({status:'linked'});
    } catch {
      // Compensating transaction, NOT a distributed atomic commit.
      const repairs=await Promise.allSettled(
        projects.map(project=>repository.deactivate(project,record))
      );
      if (repairs.some(x=>x.status==='rejected'))
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
    let proof;
    try { proof=await prove({centralToken:neonToken,legacyToken}); }
    catch { return Response.json({error:'UNAUTHORIZED'},{status:401,headers}); }
    try {
      const outcome=await link(proof);
      return Response.json(outcome,{status:200,headers});
    } catch {
      // Database, conflict and reconciliation failures are retriable and never
      // confused with invalid personal credentials. Do not leak internal errors.
      return Response.json({error:'MIGRATION_UNAVAILABLE'},{status:503,headers});
    }
  };
}
