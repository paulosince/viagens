import { createHash } from 'node:crypto';
import pg from 'pg';
import { attachDatabasePool } from '@neon/functions';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { makeHandler } from './service.mjs';

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.pathname = '/viaggio_lab';
const pool = new pg.Pool({ connectionString: databaseUrl.href, max: 3, connectionTimeoutMillis: 8000 });
attachDatabasePool(pool);
const s3 = new S3Client({ forcePathStyle: true, region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3, maxAttempts: 2,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}) } });
const bucket = 'viaggio-lab-media';
const dataApi = process.env.VIAGGIO_MEDIA_PROJECT === 'b' ? 'https://ep-spring-moon-b8fi6yxc.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1' : 'https://ep-empty-pine-b8r7sa8d.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function authorize(token, sourceBucket, path, write) {
  const r = await fetch(dataApi + '/rpc/media_access', { method: 'POST', redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: { authorization: token, 'content-type': 'application/json', 'content-profile': 'viaggio_app' },
    body: JSON.stringify({ p_bucket: sourceBucket, p_path: path, p_write: write }) });
  if (!r.ok) throw Object.assign(new Error('ACCESS_DENIED'), { status: r.status >= 500 ? 503 : 403 });
  const result = await r.json();
  if (!result?.authorized || !result.actor) throw Object.assign(new Error('ACCESS_DENIED'), { status: 403 });
}

export default { fetch: makeHandler({ authorize,
  async read(sourceBucket, path) {
    const r = await pool.query('SELECT * FROM viaggio_identity.media WHERE bucket_id=$1 AND object_key=$2 AND deleted_at IS NULL AND status=$3', [sourceBucket, path, 'ready']);
    return r.rows[0] || null;
  },
  async download(row) {
    const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: row.storage_key }));
    return r.Body.transformToWebStream();
  },
  async sign(row, seconds) {
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: row.storage_key }), { expiresIn: seconds });
  },
  async upload(sourceBucket, path, bytes, contentType, upsert) {
    const digest = sha(bytes);
    const key = 'live/' + sourceBucket + '/' + path + '/' + digest;
    const client = await pool.connect();
    let existing;
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('viaggio_operational_media_quota'))");
      existing = (await client.query('SELECT * FROM viaggio_identity.media WHERE bucket_id=$1 AND object_key=$2 FOR UPDATE', [sourceBucket, path])).rows[0];
      if (existing && (!upsert || existing.sha256 !== digest || Number(existing.bytes) !== bytes.length))
        throw Object.assign(new Error('IMMUTABLE_KEY_CONFLICT'), { status: 409 });
      if (!existing) {
        const used = Number((await client.query('SELECT coalesce(sum(bytes),0)::text AS n FROM viaggio_identity.media')).rows[0].n);
        if (used + bytes.length > 4000000000) throw Object.assign(new Error('STORAGE_QUOTA_EXCEEDED'), { status: 413 });
        await client.query("INSERT INTO viaggio_identity.media(bucket_id,object_key,storage_key,bytes,sha256,content_type,status) VALUES($1,$2,$3,$4,$5,$6,'pending')",
          [sourceBucket, path, key, bytes.length, digest, contentType]);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
    if (!existing || existing.status !== 'ready') {
      try { await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes,
        ContentType: contentType, ContentLength: bytes.length, IfNoneMatch: '*', Metadata: { sha256: digest } })); }
      catch (e) { if (e.$metadata?.httpStatusCode !== 412) throw e; }
      const physical = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const actual = Buffer.from(await physical.Body.transformToByteArray());
      if (actual.length !== bytes.length || sha(actual) !== digest) throw new Error('STORAGE_INTEGRITY_FAILURE');
    }
    await pool.query("UPDATE viaggio_identity.media SET status='ready',deleted_at=NULL WHERE bucket_id=$1 AND object_key=$2 AND sha256=$3", [sourceBucket,path,digest]);
    return { path, sha256: digest, bytes: bytes.length };
  },
  async remove(sourceBucket, paths) {
    // Logical deletion retains bytes for rollback and historical references.
    await pool.query('UPDATE viaggio_identity.media SET deleted_at=now() WHERE bucket_id=$1 AND object_key=ANY($2::text[])', [sourceBucket,paths]);
    return paths.map(name => ({ name }));
  }
}) };
