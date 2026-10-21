// 原始声音仅通过本机回环发送到本机听写。所有音频轨在结束/错误时关闭。
export function wavFromSamples(chunks,sampleRate){
  const size=chunks.reduce((n,a)=>n+a.length,0),buffer=new ArrayBuffer(44+size*2),v=new DataView(buffer);
  const word=(offset,text)=>{for(let i=0;i<text.length;i++)v.setUint8(offset+i,text.charCodeAt(i));};
  word(0,'RIFF');v.setUint32(4,36+size*2,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,size*2,true);
  let offset=44;for(const chunk of chunks)for(const sample of chunk){const x=Math.max(-1,Math.min(1,sample));v.setInt16(offset,x<0?x*32768:x*32767,true);offset+=2;}
  return buffer;
}
export function startLocalVoice({onStatus,onResult,onEnd,onError}){
  let stream,context,node,source,timer,ended=false,recording=false,permissionTimer;const chunks=[];
  async function release(){clearTimeout(timer);clearTimeout(permissionTimer);stream?.getTracks().forEach(t=>t.stop());node?.disconnect();source?.disconnect();if(context&&context.state!=='closed')await context.close();}
  async function finish(cancel=false){if(ended)return;ended=true;recording=false;await release();if(cancel){onEnd();return;}onStatus('正在本机识别，声音不会上传到外部服务。');try{const count=chunks.reduce((n,a)=>n+a.length,0);if(count<1000)throw new Error('录音太短，请说完一条命令再停止');const wav=wavFromSamples(chunks,context.sampleRate);const res=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':'audio/wav'},body:wav,signal:AbortSignal.timeout(35000)});const data=await res.json();if(!res.ok||!data.text)throw new Error(data.error||'没有识别出文字，请重试');onResult(data.text);}catch(e){onError(e.message);}finally{onEnd();}}
  permissionTimer=setTimeout(()=>{if(!recording&&!ended){ended=true;onError('麦克风尚未就绪，请检查浏览器和系统权限。');onEnd();}},15000);
  void(async()=>{try{
    onStatus('正在打开麦克风，请处理浏览器和系统权限提示。');
    stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
    if(ended){stream.getTracks().forEach(t=>t.stop());return {stop:()=>{}};}
    clearTimeout(permissionTimer);context=new AudioContext({sampleRate:16000});await context.resume();await context.audioWorklet.addModule('/pcm-worklet.js');
    if(ended){await release();return {stop:()=>{}};}
    source=context.createMediaStreamSource(stream);node=new AudioWorkletNode(context,'capture-pcm');let voiced=false,silent=0,total=0,voiceSeconds=0;
    node.port.onmessage=e=>{if(ended)return;const data=e.data;chunks.push(data);const seconds=data.length/context.sampleRate;total+=seconds;const rms=Math.sqrt(data.reduce((n,x)=>n+x*x,0)/data.length);if(rms>0.012){voiceSeconds+=seconds;voiced=voiceSeconds>.25;silent=0;}else silent+=seconds;if(voiced&&silent>1.2&&total>1.5)void finish();};
    source.connect(node);node.connect(context.destination);recording=true;timer=setTimeout(()=>void finish(),25000);onStatus('正在本机录音，请说一条命令。说完停顿约1秒，或点“停止”。');
    return {stop:()=>void finish(),cancel:()=>void finish(true)};
  }catch(e){await release();if(!ended){ended=true;onError(e.name==='NotAllowedError'?'麦克风未获许可，请在浏览器或系统设置中允许。':'本机录音未完成：'+e.message);onEnd();}}})();
  return {stop:()=>void finish(),cancel:()=>void finish(true)};
}
