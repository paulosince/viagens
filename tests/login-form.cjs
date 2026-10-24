const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const source = fs.readFileSync('experiments/neon-pilot/app/main-neon.js', 'utf8');
test('initial login offers an existing credential and disables hidden signup inputs', () => {
  assert.match(html, /id="auth_email"[^>]*autocomplete="username"/);
  assert.match(html, /id="auth_password"[^>]*autocomplete="current-password"/);
  const signup = html.match(/<form id="signup_form"[\s\S]*?<\/form>/)[0];
  for (const input of signup.match(/<input\b[^>]*>/g)) assert.match(input, /\bdisabled\b/);
});
test('switching auth mode enables only the active form and preserves entered values', () => {
  const form = () => ({inputs:[{disabled:false,value:'existing'}],setAttribute(){},querySelectorAll(){return this.inputs;}});
  const dom = {authCard:{dataset:{}},authIntro:{},authForm:form(),signupForm:form(),authMessage:{},signupMessage:{}};
  const context = vm.createContext({dom});
  vm.runInContext(source.slice(source.indexOf('function setAuthMode('), source.indexOf('async function enterWithUser(')), context);
  for (const mode of ['signup','login','signup','login']) {
    context.setAuthMode(mode);
    assert.equal(dom.authForm.inputs[0].disabled, mode === 'signup');
    assert.equal(dom.signupForm.inputs[0].disabled, mode !== 'signup');
    assert.equal(dom.authForm.inputs[0].value, 'existing');
  }
});
test('service worker precaches the entry module used by the login page', () => {
  const entry = html.match(/experiments\/neon-pilot\/app\/main-neon\.js\?v=[^"']+/)[0];
  assert.ok(fs.readFileSync('sw.js','utf8').includes(entry));
});
