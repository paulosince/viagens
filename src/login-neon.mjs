import {createLoginDiagnostics} from './login-diagnostics.mjs?v=20261115-diag2';
// Deliberately standalone: no app forms, signup password fields or field swapping.
export function bindLoginForm({form, button, message, authenticate, navigate}) {
  let pending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    if (!form.reportValidity()) return;
    pending = true; button.disabled = true; button.textContent = 'Entrando…';
    message.textContent = '';
    try {
      const fields = new FormData(form);
      const result = await authenticate({
        email: String(fields.get('username') || '').trim(),
        password: String(fields.get('password') || '')
      });
      if (result.error) throw result.error;
      if (!result.data?.session || !result.data?.user) throw new Error('Não foi possível confirmar a sessão. Tente novamente.');
      navigate();
    } catch (error) {
      message.textContent = error.message || 'Não foi possível entrar. Tente novamente.';
    } finally {
      pending = false; button.disabled = false; button.textContent = 'Entrar';
    }
  });
  button.disabled = false;
}

if (typeof document !== 'undefined') {
  let clientPromise;
  const diagnosticOutput=document.getElementById('login-diagnostic-output');
  const diagnosticPanel=document.getElementById('login-diagnostic');
  let diagnostic;
  const initializeDiagnostics=backend=>{
    if(diagnostic)return;
    diagnostic=createLoginDiagnostics({
      authUrl:backend.NEON_AUTH_URL,apiRoots:backend.API_ROOTS,
      standalone:matchMedia('(display-mode: standalone)').matches || navigator.standalone===true,
      online:navigator.onLine,
      render:text=>{diagnosticOutput.textContent=text;diagnosticPanel.hidden=!text;diagnosticPanel.open=!!text}
    });
    window.fetch=diagnostic.wrapFetch(window.fetch.bind(window));
  };
  async function authenticate(credentials) {
    clientPromise ||= Promise.all([
      import('../experiments/neon-pilot/app/backend-neon.mjs?v=20261115-media1'),
      import('https://cdn.jsdelivr.net/npm/@neondatabase/neon-js@0.9.0-beta/+esm'),
      import('https://cdn.jsdelivr.net/npm/@neondatabase/postgrest-js@0.2.0-beta/+esm')
    ]).then(([backend, {createClient, SupabaseAuthAdapter}, {NeonPostgrestClient, fetchWithToken}]) => {
      initializeDiagnostics(backend);
      const authSdk = createClient({auth:{url:backend.NEON_AUTH_URL,adapter:SupabaseAuthAdapter()},dataApi:{url:backend.API_ROOTS.a}});
      return backend.createNeonPreview({authSdk, NeonPostgrestClient, fetchWithToken});
    }).catch(error => { clientPromise = null; throw error; });
    const client = await clientPromise;
    diagnostic.start();
    diagnostic.note('etapa: autenticacao e perfil');
    let failed=true;
    try {
      const result=await client.auth.signInWithPassword(credentials);
      failed=!!result.error || !result.data?.session || !result.data?.user;
      diagnostic.note(result.error?'resultado: falha':result.data?.session?'resultado: sessao confirmada':'resultado: sem sessao');
      return result;
    }finally{await diagnostic.finish(failed)}
  }
  bindLoginForm({
    form: document.getElementById('login-form'),
    button: document.getElementById('login-submit'),
    message: document.getElementById('login-message'),
    authenticate,
    // The destination is fixed and local. No password or token is put in a URL.
    navigate: () => location.replace('./index.html' + location.hash)
  });
}
