// Privileged service-side SQL repository. Never import this in the PWA.
// pools: {central, a, b}; all Pg.Pool instances must use staging-only URLs.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function check(record) {
 if(!record||!UUID.test(record.neon_subject)||!UUID.test(record.legacy_user_id)
    ||record.proof_kind!=='dual_session')throw Error('UNVERIFIED_IDENTITY');
}
async function transaction(pool,fn) {
 const db=await pool.connect();
 try {
  await db.query('BEGIN');
  const value=await fn(db);
  await db.query('COMMIT');
  return value;
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}
 finally{db.release();}
}
export function createLinkRepository({central,a,b}) {
 if(!central?.connect||!a?.connect||!b?.connect)throw Error('LINK_POOLS_NOT_CONFIGURED');
 const pools={a,b};
 return {
  withLock(record,fn) {
   check(record);
   return transaction(central,async db=>{
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',
      ['viaggio-migration:'+record.legacy_user_id]);
    return fn();
   });
  },
  async prepare(project,record) {
   check(record);
   if(!Object.hasOwn(pools,project))throw Error('UNKNOWN_PROJECT');
   return transaction(pools[project],async db=>{
    // Ensure the legacy identity actually exists and is verified in this project.
    const dir=await db.query(
      'SELECT id FROM viaggio_identity.users WHERE id=$1::uuid AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL FOR SHARE',
      [record.legacy_user_id]);
    if(dir.rowCount!==1)throw Error('IDENTITY_DIRECTORY_MISSING');
    await db.query(
      `INSERT INTO viaggio_identity.neon_auth_links(neon_subject,legacy_user_id,proof_kind,verified_at,activated_at)
       VALUES($1::uuid,$2::uuid,'dual_session',now(),NULL) ON CONFLICT DO NOTHING`,
       [record.neon_subject,record.legacy_user_id]);
    const existing=await db.query(
      `SELECT neon_subject::text AS neon_subject,legacy_user_id::text AS legacy_user_id
       FROM viaggio_identity.neon_auth_links
       WHERE neon_subject=$1::uuid OR legacy_user_id=$2::uuid FOR UPDATE`,
       [record.neon_subject,record.legacy_user_id]);
    if(existing.rowCount!==1 || existing.rows[0].neon_subject!==record.neon_subject.toLowerCase()
       || existing.rows[0].legacy_user_id!==record.legacy_user_id.toLowerCase())
       throw Error('IDENTITY_MAPPING_CONFLICT');
  });
  },
  async activate(project,record) {
   check(record);
   if(!Object.hasOwn(pools,project))throw Error('UNKNOWN_PROJECT');
   const result=await pools[project].query(
     `UPDATE viaggio_identity.neon_auth_links SET activated_at=COALESCE(activated_at,now())
      WHERE neon_subject=$1::uuid AND legacy_user_id=$2::uuid
        AND verified_at IS NOT NULL AND proof_kind='dual_session'
      RETURNING neon_subject`,
     [record.neon_subject,record.legacy_user_id]);
   if(result.rowCount!==1)throw Error('LINK_ACTIVATION_NOT_READY');
  },
  async deactivate(project,record) {
   check(record);
   if(!Object.hasOwn(pools,project))throw Error('UNKNOWN_PROJECT');
   const result=await pools[project].query(
     'UPDATE viaggio_identity.neon_auth_links SET activated_at=NULL WHERE neon_subject=$1::uuid AND legacy_user_id=$2::uuid',
     [record.neon_subject,record.legacy_user_id]);
   if(result.rowCount!==1)throw Error('LINK_REVOCATION_FAILED');
  }
 };
}
