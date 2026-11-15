import {handleAuthProxyRequest} from '@neondatabase/auth/server';
import {createProxy} from './proxy.mjs';

// Pages Functions adapter. Not auto-deployed: first configure the exact public
// origin and server-side secret, then bundle this into the Pages build.
export async function onRequest({request, env}) {
  if (!env.VIAGGIO_PUBLIC_ORIGIN || !env.NEON_AUTH_COOKIE_SECRET) {
    return Response.json({message: 'Authentication is not configured'}, {
      status: 503, headers: {'cache-control': 'no-store'}
    });
  }
  try {
    return await createProxy({
      origin: env.VIAGGIO_PUBLIC_ORIGIN,
      cookieSecret: env.NEON_AUTH_COOKIE_SECRET,
      handleAuthProxyRequest
    })(request);
  } catch {
    return Response.json({message: 'Authentication configuration unavailable'}, {
      status: 503, headers: {'cache-control': 'no-store'}
    });
  }
}
