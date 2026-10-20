// Federation smoke test for the two isolated Neon validation branches.
// A short-lived central Auth JWT must be passed through the process environment.
// Never persist or log tokens, passwords, session cookies or family identifiers.
export const ENDPOINTS = Object.freeze({
  a: 'https://ep-empty-pine-b8r7sa8d.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1',
  b: 'https://ep-spring-moon-b8fi6yxc.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1'
});

function options(jwt, method = 'GET') {
  return {
    method,
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'Accept-Profile': 'viaggio_app',
      'Content-Profile': 'viaggio_app',
      ...(jwt ? {Authorization: 'Bearer ' + jwt} : {}),
      ...(method === 'POST' ? {'Content-Type': 'application/json'} : {})
    },
    ...(method === 'POST' ? {body: '{}'} : {})
  };
}

async function read(fetcher, url, opt) {
  const response = await fetcher(url, opt);
  let data = null;
  try { data = await response.json(); } catch {}
  return {status: response.status, ok: response.ok, data};
}

export async function checkFederation({
  token,
  expectedHome = 'none',
  endpoints = ENDPOINTS,
  fetcher = fetch
} = {}) {
  if (typeof token !== 'string' || !token.trim() || token.includes('\n') || /^Bearer\s/i.test(token))
    throw Error('Short-lived central JWT required in environment; never send it through chat.');
  if (!['none','a','b'].includes(expectedHome)) throw Error('Invalid expectedHome.');
  const result = {passed: false, projects: {}};
  for (const [key, root] of Object.entries(endpoints)) {
    const u = new URL(root);
    if (u.protocol !== 'https:' || !u.pathname.endsWith('/rest/v1'))
      throw Error('Invalid staging URL');
    const base = u.href.replace(/\/$/, '');
    const fake = await read(fetcher, base + '/rpc/project_context',
      options('not.a.valid.jwt','POST'));
    if (fake.status !== 401 && fake.status !== 403)
      throw Error('Project ' + key + ': invalid token was not rejected.');

    const anon = await read(fetcher, base + '/trips?select=id&limit=1',
      options(null));
    if (anon.ok && (!Array.isArray(anon.data) || anon.data.length !== 0))
      throw Error('Project ' + key + ': anonymous data exposure.');
    if (!anon.ok && ![401,403,404].includes(anon.status))
      throw Error('Project ' + key + ': unexpected anonymous error.');

    const context = await read(fetcher, base + '/rpc/project_context',
      options(token,'POST'));
    if (!context.ok || typeof context.data?.is_home !== 'boolean')
      throw Error('Project ' + key + ': signed session or context rejected.');
    const trips = await read(fetcher, base + '/trips?select=id&limit=1000',
      options(token));
    if (!trips.ok || !Array.isArray(trips.data))
      throw Error('Project ' + key + ': signed trip query rejected.');
    result.projects[key] = {home: context.data.is_home, visibleTrips: trips.data.length};
  }
  const homes = Object.entries(result.projects).filter(([,p])=>p.home).map(([key])=>key);
  if (expectedHome === 'none') {
    if (homes.length || Object.values(result.projects).some(p=>p.visibleTrips))
      throw Error('Unlinked account unexpectedly accessed private data.');
  } else if (homes.length !== 1 || homes[0] !== expectedHome) {
    throw Error('Wrong or ambiguous home project.');
  }
  result.passed = true;
  return result;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const result = await checkFederation({
      token: process.env.VIAGGIO_CENTRAL_NEON_JWT,
      expectedHome: process.env.VIAGGIO_EXPECTED_HOME || 'none'
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Federation check NOT PASSED: ' + error.message);
    process.exitCode = 1;
  }
}
