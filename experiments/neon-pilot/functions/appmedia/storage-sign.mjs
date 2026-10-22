import { createHash, createHmac } from 'node:crypto';

const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const sha = text => createHash('sha256').update(text).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();

export function signedReadUrl(storageKey, ttl = 60) {
  if (!/^uploads\/[0-9a-f-]{36}$/.test(storageKey)) throw Error('INVALID_STORAGE_KEY');
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const access = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION;
  if (!endpoint || !access || !secret || !region) throw Error('STORAGE_NOT_CONFIGURED');
  const base = new URL(endpoint);
  if (base.protocol !== 'https:') throw Error('INVALID_STORAGE_HOST');
  const time = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = time.slice(0, 8);
  const scope = day + '/' + region + '/s3/aws4_request';
  const path = '/viaggio-lab-media/' + storageKey.split('/').map(encode).join('/');
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': access + '/' + scope,
    'X-Amz-Date': time,
    'X-Amz-Expires': String(ttl),
    'X-Amz-SignedHeaders': 'host'
  };
  if (process.env.AWS_SESSION_TOKEN) params['X-Amz-Security-Token'] = process.env.AWS_SESSION_TOKEN;
  const query = Object.entries(params).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => encode(key) + '=' + encode(value)).join('&');
  const canonical = ['GET', path, query, 'host:' + base.host + '\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', time, scope, sha(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac('AWS4' + secret, day), region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return base.origin + path + '?' + query + '&X-Amz-Signature=' + signature;
}
