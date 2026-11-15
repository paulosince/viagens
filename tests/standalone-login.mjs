import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindLoginForm} from '../src/login-neon.mjs';
const html=readFileSync('login.html','utf8');
assert.equal((html.match(/<form\b/g)||[]).length,1);
assert.equal((html.match(/<input\b/g)||[]).length,2);
assert.match(html,/<form[^>]+method="post"[^>]+action="\.\/login.html"/);
assert.match(html, /name="username" type="email" autocomplete="username"/);
assert.match(html, /name="password" type="password" autocomplete="current-password"/);
assert.ok(!html.includes('new-password'));
assert.ok(!html.includes('<template'));
const nativeFormData=globalThis.FormData;
globalThis.FormData=class {constructor(form){this.fields=form.fields} get(key){return this.fields[key]}};
try {
 let submit, calls=0, navigation=0, resolve;
 const form={fields:{username:' person@example.test ',password:'test-only-password'},reportValidity:()=>true,addEventListener(type,fn){assert.equal(type,'submit');submit=fn}};
 const button={},message={};
 bindLoginForm({form,button,message,authenticate:async credentials=>{calls++;assert.deepEqual(credentials,{email:'person@example.test',password:'test-only-password'});return new Promise(r=>{resolve=r})},navigate:()=>navigation++});
 let prevented=0;const event={preventDefault(){prevented++}};
 const pending=submit(event);await submit(event);
 assert.equal(calls,1);assert.equal(button.disabled,true);
 resolve({error:new Error('Login rejected')});await pending;
 assert.equal(navigation,0);assert.equal(message.textContent,'Login rejected');assert.equal(button.disabled,false);
 assert.equal(form.fields.password,'test-only-password');
 const retry=submit(event);resolve({data:{user:{id:'test'},session:{user:{id:'test'}}},error:null});await retry;
 assert.equal(navigation,1);assert.equal(calls,2);assert.equal(prevented,3);
}finally{globalThis.FormData=nativeFormData}
const sw=readFileSync('sw.js','utf8');assert.ok(sw.includes("'./login.html'"));assert.ok(sw.includes(html.match(/\.\/src\/login-neon\.mjs\?v=[^"]+/)[0]));
console.log('PASS: isolated login, native POST fallback, credential mapping, duplicate submits, errors and successful navigation');
