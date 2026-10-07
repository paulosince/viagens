const MEDIA_CACHE_NAME = 'viaggio-media-v1';
const objectUrls = new Map();

function cacheRequest(bucket, path, hash) {
  const url = new URL('/__viaggio_media_cache__/' + encodeURIComponent(bucket) + '/' + encodeURIComponent(path), window.location.origin);
  url.searchParams.set('hash', hash);
  return new Request(url.href, { method: 'GET' });
}

function mediaKey(bucket, path, hash) {
  return bucket + ':' + path + ':' + hash;
}

export async function hashBlob(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, value => value.toString(16).padStart(2, '0')).join('');
}

export function extensionForBlob(blob) {
  if (blob?.type === 'image/jpeg') return 'jpg';
  if (blob?.type === 'image/png') return 'png';
  return 'webp';
}

export async function putMediaBlob(bucket, path, hash, blob) {
  if (!bucket || !path || !hash || !blob) return;
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const request = cacheRequest(bucket, path, hash);
  await cache.put(request, new Response(blob, {
    headers: { 'Content-Type': blob.type || 'application/octet-stream' }
  }));

  const prefix = window.location.origin + '/__viaggio_media_cache__/' + encodeURIComponent(bucket) + '/' + encodeURIComponent(path);
  const keys = await cache.keys();
  await Promise.all(keys
    .filter(key => key.url.startsWith(prefix) && key.url !== request.url)
    .map(key => cache.delete(key)));

  for (const [key, url] of objectUrls) {
    if (key.startsWith(bucket + ':' + path + ':') && key !== mediaKey(bucket, path, hash)) {
      URL.revokeObjectURL(url);
      objectUrls.delete(key);
    }
  }
}

export async function getMediaBlob(bucket, path, hash) {
  if (!bucket || !path || !hash) return null;
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const response = await cache.match(cacheRequest(bucket, path, hash));
  return response ? response.blob() : null;
}

export async function ensureMediaBlob(client, bucket, path, hash) {
  let blob = await getMediaBlob(bucket, path, hash);
  if (blob) return blob;
  if (!client || !navigator.onLine) return null;

  const downloaded = await client.storage.from(bucket).download(path);
  if (downloaded.error) throw downloaded.error;
  blob = downloaded.data;

  const actualHash = await hashBlob(blob);
  if (actualHash !== hash) {
    throw new Error('A imagem baixada não corresponde à versão registrada.');
  }

  await putMediaBlob(bucket, path, hash, blob);
  return blob;
}

export async function mediaObjectUrl(client, bucket, path, hash) {
  if (!bucket || !path || !hash) return '';
  const key = mediaKey(bucket, path, hash);
  const existing = objectUrls.get(key);
  if (existing) return existing;

  const blob = await ensureMediaBlob(client, bucket, path, hash);
  if (!blob) return '';

  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
}

export async function prepareMediaBlob(bucket, path, blob) {
  if (!bucket || !path || !blob) throw new Error('Imagem incompleta.');
  const hash = await hashBlob(blob);
  await putMediaBlob(bucket, path, hash, blob);
  const url = await mediaObjectUrl(null, bucket, path, hash);
  return {
    bucket,
    path,
    hash,
    url,
    contentType: blob.type || 'image/webp'
  };
}

export async function uploadCachedMedia(client, bucket, path, hash, contentType = 'image/webp') {
  if (!client) throw new Error('Backend indisponível.');
  const blob = await getMediaBlob(bucket, path, hash);
  if (!blob) throw new Error('A cópia local da imagem não está disponível.');

  const actualHash = await hashBlob(blob);
  if (actualHash !== hash) throw new Error('A cópia local da imagem foi alterada.');

  const upload = await client.storage.from(bucket).upload(path, blob, {
    contentType: contentType || blob.type || 'image/webp',
    cacheControl: '31536000',
    upsert: true
  });
  if (upload.error) throw upload.error;
  return upload.data;
}
