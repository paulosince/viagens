const fs=require('node:fs');
const assert=require('node:assert/strict');
const main=fs.readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
const from=main.indexOf('function ticketCoverMime(file) {');
const to=main.indexOf('async function selectTicketCardCoverFile(file) {',from);
assert.ok(from>=0&&to>from,'Image MIME and transformation functions exist');
const body=main.slice(from,to);

async function scenario({file,bitmapFailure=false,webpFailure=false,jpegFailure=false}) {
  let bitmapCalls=0,objectUrlCalls=0,revokes=0,drew=false,closed=false;
  const outputs=[];
  const url={createObjectURL:()=>{objectUrlCalls++;return 'blob:iphone-original';},
    revokeObjectURL:()=>{revokes++;}};
  class ImageMock {
    naturalWidth=3024; naturalHeight=4032;
    set src(value){assert.equal(value,'blob:iphone-original');queueMicrotask(()=>this.onload?.());}
  }
  const canvas={width:0,height:0,getContext:()=>({drawImage:()=>{drew=true;}})};
  const make=new Function('createImageBitmap','URL','Image','document','canvasBlob','DAY_ATTACHMENT_MAX_BYTES',
    body+';return {prepareTicketCardCover,ticketCoverUploadInfo};')(
    async()=>{bitmapCalls++;if(bitmapFailure)throw new Error('WebKit cannot decode bitmap');
      return {width:3024,height:4032,close:()=>{closed=true;}};},
    url,ImageMock,{createElement:type=>{assert.equal(type,'canvas');return canvas;}},
    async(_canvas,type,quality)=>{
      assert.equal(_canvas,canvas);
      outputs.push(type);
      if(type==='image/webp' && webpFailure)throw new Error('WebP unavailable');
      if(type==='image/jpeg' && jpegFailure)throw new Error('JPEG unavailable');
      return {type,size:320_000};
    },6*1024*1024
  );
  const result=await make.prepareTicketCardCover(file);
  return {result,media:make.ticketCoverUploadInfo(result),bitmapCalls,objectUrlCalls,revokes,drew,closed,outputs,canvas};
}
(async()=>{
  const jpg={name:'IMG_1234.jpeg',type:'image/jpeg',size:4_200_000};
  const jpeg=await scenario({file:jpg,bitmapFailure:true,webpFailure:true});
  assert.equal(jpeg.result,jpg,'Valid iPhone JPEG must be retained without canvas');
  assert.equal(jpeg.media.extension,'jpg');
  assert.equal(jpeg.bitmapCalls,0,'Never decode or reencode a JPEG within storage limit');
  assert.equal(jpeg.objectUrlCalls,0);

  const png={name:'IMG_444.png',type:'image/png',size:1_000_000};
  const nativePng=await scenario({file:png});
  assert.equal(nativePng.result,png);
  assert.equal(nativePng.media.mime,'image/png');

  const heic={name:'IMG_9876.HEIC',type:'image/heic',size:4_000_000};
  const decoded=await scenario({file:heic,bitmapFailure:false});
  assert.equal(decoded.result.type,'image/webp');
  assert.equal(decoded.media.extension,'webp');
  assert.equal(decoded.canvas.width,900);
  assert.equal(decoded.canvas.height,1200);
  assert.equal(decoded.closed,true);

  const legacySafari=await scenario({file:heic,bitmapFailure:true,webpFailure:true});
  assert.equal(legacySafari.result.type,'image/jpeg','Safari JPEG fallback used when WebP fails');
  assert.equal(legacySafari.media.extension,'jpg');
  assert.equal(legacySafari.objectUrlCalls,1);
  assert.equal(legacySafari.revokes,1);
  assert.deepEqual(legacySafari.outputs,['image/webp','image/jpeg']);

  const heicOriginal=await scenario({file:heic,bitmapFailure:true,webpFailure:true,jpegFailure:true});
  assert.equal(heicOriginal.result,heic,'Native iPhone HEIC can be retained when encoding fails');
  assert.equal(heicOriginal.media.extension,'heic');

  const hugeJpg={name:'Huge.jpg',type:'image/jpeg',size:9*1024*1024};
  const compressed=await scenario({file:hugeJpg,bitmapFailure:true,webpFailure:true});
  assert.equal(compressed.media.extension,'jpg','Oversized JPEG is resized instead of blindly uploaded');
  assert.equal(compressed.result.size,320_000);
  console.log('PASS native iPhone JPEG/PNG, WebP and JPEG transcode, HEIC fallbacks and correct content types');
})().catch(error=>{console.error(error);process.exitCode=1;});
