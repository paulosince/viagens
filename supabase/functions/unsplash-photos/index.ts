import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const accessKey = Deno.env.get('UNSPLASH_ACCESS_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') || '';
  if (!accessKey || !supabaseUrl || !serviceKey) return json({ error: 'Busca de fotos não configurada.' }, 503);

  const database = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: { user } } = await database.auth.getUser(token);
  if (!user) return json({ error: 'Sessão inválida.' }, 401);

  const body = await request.json().catch(() => ({}));
  if (body.action === 'track') {
    const downloadLocation = String(body.downloadLocation || '');
    if (!/^https:\/\/api\.unsplash\.com\/photos\/[\w-]+\/download(?:\?|$)/.test(downloadLocation)) {
      return json({ error: 'Endereço de download inválido.' }, 400);
    }
    const tracked = await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${accessKey}` } });
    return tracked.ok ? json({ ok: true }) : json({ ok: false }, tracked.status);
  }

  const query = String(body.query || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (query.length < 3) return json({ error: 'Busca muito curta.' }, 400);
  const cacheKey = query.toLocaleLowerCase('pt-BR');
  const cached = await database.from('unsplash_search_cache').select('results').eq('query', cacheKey).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (cached.data?.results) return json({ photos: cached.data.results, cached: true });

  const endpoint = new URL('https://api.unsplash.com/search/photos');
  endpoint.search = new URLSearchParams({ query, orientation: 'landscape', per_page: '12', content_filter: 'high' });
  const response = await fetch(endpoint, { headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' } });
  if (response.status === 403 || response.status === 429) return json({ photos: [], quotaExceeded: true }, 200);
  if (!response.ok) return json({ error: 'Não foi possível buscar fotos agora.' }, response.status);

  const payload = await response.json();
  const photos = (payload.results || []).map((photo: any) => ({
    id: photo.id,
    description: photo.alt_description || photo.description || '',
    thumbUrl: photo.urls?.small,
    imageUrl: photo.urls?.regular,
    author: photo.user?.name || '',
    authorUrl: photo.user?.links?.html || '',
    sourceUrl: photo.links?.html || '',
    downloadLocation: photo.links?.download_location || '',
  })).filter((photo: any) => photo.thumbUrl && photo.imageUrl);

  await database.from('unsplash_search_cache').upsert({
    query: cacheKey,
    results: photos,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  return json({ photos, cached: false });
});
