const fs=require('node:fs');
const assert=require('node:assert/strict');
const main=fs.readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
const from=main.indexOf('async function prepareTicketCardCover(file) {');
const to=main.indexOf('async function selectTicketCardCoverFile(file) {',from);
assert.ok(from>=0 && to>from,'iPhone image decoder is present');
const body=main.slice(from,to);
async function runScenario(failBitmap) {
  let revoked=false, fallbackUsed=false, drew=false, closed=false;
  const output={size:320_000,type:'image/webp'};
  const url={
    createObjectURL:()=>{fallbackUsed=true;return 'blob:iphone-test';},
    revokeObjectURL:()=>{revoked=true;}
  };
  class ImageMock {
    naturalWidth=3024;
    naturalHeight=4032;
    set src(value) {assert.equal(value,'blob:iphone-test');queueMicrotask(()=>this.onload?.());}
  }
  const canvas={
    width:0,height:0,
    getContext:()=>({drawImage:()=>{drew=true;}})
  };
  const make=new Function('createImageBitmap','URL','Image','document','canvasBlob',
    body+';return prepareTicketCardCover;')(
    async()=>{
      if(failBitmap)throw new Error('Safari cannot createImageBitmap(HEIC)');
      return {width:3024,height:4032,close:()=>{closed=true;}};
    },
    url,ImageMock,
    {createElement:type=>{assert.equal(type,'canvas');return canvas;}},
    async(node,type,quality)=>{
      assert.equal(node,canvas);
      assert.equal(type,'image/webp');
      assert.equal(quality,.8);
      return output;
    }
  );
  const blob=await make({name:'IMG_9876.HEIC',type:'image/heic',size:4_000_000});
  assert.equal(blob,output);
  assert.equal(drew,true);
  assert.equal(canvas.width,1050);
  assert.equal(canvas.height,1400);
  assert.equal(fallbackUsed,failBitmap);
  assert.equal(revoked,failBitmap);
  assert.equal(closed,!failBitmap);
}
(async()=>{
  await runScenario(false);
  await runScenario(true);
  console.log('PASS Safari/iPhone HEIC fallback and WebP canvas normalization');
})().catch(error=>{console.error(error);process.exitCode=1;});
