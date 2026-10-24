const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
const a=source.indexOf('async function selectTicketCardCoverFile(file) {');
const b=source.indexOf('function clearTicketCardCover() {',a);
assert.ok(a>0 && b>a,'Source cover selection function is available');
const calls=[];
let resolveImage;
let request=0;
const formElements={
  ticket_metadata_error:{textContent:''},
  ticket_card_cover_feedback:{textContent:'',dataset:{}},
  ticket_card_cover_hint:{textContent:''},
  ticket_metadata_save:{disabled:false}
};
const doc={getElementById:id=>{assert.ok(formElements[id],id);return formElements[id];}};
const urls={
  createObjectURL:()=>('blob:mock-'+(++request)),
  revokeObjectURL:url=>calls.push(['revoke',url])
};
const prepare=()=>new Promise(resolve=>{resolveImage=resolve;});
const snapshot=[];
const make=new Function('document','URL','prepareTicketCardCover','showTicketCardCoverPreview','console',
  'const DAY_ATTACHMENT_MAX_BYTES=6*1024*1024;let ticketCardCoverRequest=0;let ticketEditorContext={file:{id:"one",cardSignedUrl:""},coverDraftUrl:null,coverBlob:null,coverPending:false,removeCover:false};'+
  source.slice(a,b)+';return {selectTicketCardCoverFile,getContext:()=>ticketEditorContext};'
);
const ui=make(doc,urls,prepare,url=>snapshot.push(url),{warn:()=>{}});
(async()=>{
  const file={type:'image/jpeg',name:'IMG_001.jpeg',size:456789};
  const work=ui.selectTicketCardCoverFile(file);
  assert.equal(snapshot[0],'blob:mock-1','Show original photo immediately');
  assert.equal(ui.getContext().coverPending,true);
  assert.equal(formElements.ticket_metadata_save.disabled,true,'Disable save while encoding');
  assert.match(formElements.ticket_card_cover_feedback.textContent,/Preparando/);
  resolveImage({size:245000,type:'image/webp'});
  await work;
  assert.equal(ui.getContext().coverPending,false);
  assert.equal(ui.getContext().coverBlob.type,'image/webp');
  assert.equal(ui.getContext().coverDraftUrl,'blob:mock-2');
  assert.equal(snapshot.at(-1),'blob:mock-2');
  assert.equal(formElements.ticket_metadata_save.disabled,false);
  assert.match(formElements.ticket_card_cover_feedback.textContent,/Foto pronta para salvar/);
  assert.ok(calls.some(x=>x[0]==='revoke'&&x[1]==='blob:mock-1'));
  console.log('PASS photo is previewed immediately and is marked ready only after transcoding');
})().catch(e=>{console.error(e);process.exitCode=1;});
