const fs=require('node:fs');
const assert=require('node:assert/strict');
const src=fs.readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
const a=src.indexOf('function ticketCoverPickerFeedback(');
const b=src.indexOf("document.getElementById('ticket_card_cover_remove')?.addEventListener(",a);
assert.ok(a>0&&b>a,'Actual picker listener code found');
const code=src.slice(a,b);
const listeners={};
const logs=[];
let setterCount=0, value='previous-file';
let file=null;
const input={
 get value(){return value;},
 set value(v){setterCount++;value=v;},
 get files(){return file?[file]:[];},
 addEventListener(name,handler){(listeners[name]??=[]).push(handler);},
 emit(name){for(const handler of listeners[name]||[])handler({currentTarget:this,type:name});}
};
const feedback={dataset:{},textContent:''};
const hint={textContent:''};
const save={disabled:false};
const elements={ticket_card_cover_input:input,ticket_card_cover_feedback:feedback,ticket_card_cover_hint:hint,ticket_metadata_save:save};
const document={getElementById:id=>{assert.ok(elements[id],id);return elements[id];}};
const windowMock={addEventListener(name,handler){(listeners['window:'+name]??=[]).push(handler);}};
let fakeTimer=null;
const calls=[];
const make=new Function('document','window','setTimeout','selectTicketCardCoverFile','console',
 'let ticketEditorContext={coverPending:false,coverPickerState:"idle",coverPickerToken:0};'+code+
 'return {context:ticketEditorContext};'
);
const instance=make(document,windowMock,cb=>{fakeTimer=cb;return 1;},f=>{calls.push(f);return Promise.resolve();},{warn:(...args)=>logs.push(args)});
assert.ok(listeners.click&&listeners.input&&listeners.change&&listeners.cancel);
input.emit('click');
assert.equal(value,'');
assert.equal(setterCount,1,'Value cleared only before opening picker');
assert.equal(instance.context.coverPickerState,'waiting');
assert.match(feedback.textContent,/Escolha uma foto/);
file={name:'IMG_0411.jpeg',type:'image/jpeg',size:234000};
input.emit('input');
input.emit('change');
assert.equal(calls.length,1,'input and change must not process same photo twice');
assert.equal(calls[0],file);
assert.equal(instance.context.coverPickerState,'received');
assert.equal(setterCount,1,'File selection must not be cleared after OK');
assert.equal(input.files[0],file,'Native FileList remains readable');
input.emit('click');
assert.equal(instance.context.coverPickerState,'waiting');
file=null;
input.emit('cancel');
assert.equal(instance.context.coverPickerState,'cancelled');
assert.match(feedback.textContent,/Nenhuma foto foi recebida/);
assert.match(hint.textContent,/Foto não recebida/);
input.emit('click');
assert.equal(instance.context.coverPickerState,'waiting');
for(const fn of listeners['window:focus'])fn();
assert.equal(typeof fakeTimer,'function');
fakeTimer();
assert.match(feedback.textContent,/Ainda não recebemos/);
assert.equal(calls.length,1,'Missing native callback cannot be treated as successful selection');
console.log('PASS picker: no premature clearing, iOS input/change dedupe, cancel and no-callback feedback');
