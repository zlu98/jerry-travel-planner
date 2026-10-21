import http from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const root = fileURLToPath(new URL('./public/', import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'};
const port = Number(process.env.PORT || process.argv[2] || 8024);
let voiceBinary,voiceDirectory,busy=false;
if(process.platform==='darwin'){
  try {
    voiceDirectory=await mkdtemp(resolve(tmpdir(),'jerry-travel-voice-'));
    voiceBinary=resolve(voiceDirectory,'voice');
    await run('/usr/bin/swiftc',[fileURLToPath(new URL('./voice-macos.swift',import.meta.url)),'-o',voiceBinary],{timeout:30000});
    const {stdout}=await run(voiceBinary,['--check'],{timeout:15000});
    if(!JSON.parse(stdout).ok)voiceBinary=undefined;
  } catch {voiceBinary=undefined;}
}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(value));}
const allowedHosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
http.createServer(async (req,res) => {
  try {
    if(!allowedHosts.has(req.headers.host)){json(res,403,{error:'仅允许本机访问'});return;}
    const url = new URL(req.url, 'http://localhost');
    if(url.pathname==='/api/capabilities'&&req.method==='GET'){json(res,200,{localVoice:Boolean(voiceBinary),engine:voiceBinary?'macos-local':'browser'});return;}
    if(url.pathname==='/api/transcribe'){
      const origin=req.headers.origin;
      if(req.method!=='POST'||!origin||!allowedHosts.has(new URL(origin).host)||!origin.startsWith('http://')){json(res,403,{error:'仅允许本机网页发起听写'});return;}
      if(!voiceBinary){json(res,503,{error:'本机听写不可用，请使用浏览器语音或文字输入'});return;}
      if(busy){json(res,409,{error:'上一段听写尚未完成'});return;}
      if(!req.headers['content-type']?.startsWith('audio/wav')){json(res,415,{error:'只接受 WAV 音频'});return;}
      if(Number(req.headers['content-length'])>1048576){json(res,413,{error:'请把语音控制在25秒以内'});return;}
      busy=true;let dir;
      try {
        const chunks=[];let size=0;
        req.setTimeout(10000,()=>req.destroy());
        for await(const chunk of req){size+=chunk.length;if(size>1048576)throw new Error('音频过长');chunks.push(chunk);}
        const wav=Buffer.concat(chunks);
        if(wav.subarray(0,4).toString()!=='RIFF'||wav.subarray(8,12).toString()!=='WAVE')throw new Error('无效 WAV 音频');
        dir=await mkdtemp(resolve(tmpdir(),'jerry-travel-audio-'));
        const audio=resolve(dir,'input.wav');await writeFile(audio,wav,{mode:0o600});
        const {stdout}=await run(voiceBinary,[audio],{timeout:30000,maxBuffer:65536});
        const data=JSON.parse(stdout);
        if(!data.ok){json(res,422,{error:'本机听写失败，请检查系统语言模型后重试'});return;}
        json(res,200,{text:String(data.text).trim(),engine:'macos-local'});
      } catch {if(!res.headersSent&&!res.destroyed)json(res,422,{error:'音频未能识别，请重新录一条清楚的短命令'});}
      finally {busy=false;if(dir)await rm(dir,{recursive:true,force:true});}
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
    const target = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!target.startsWith(resolve(root) + sep)) {res.writeHead(403).end();return;}
    const data = await readFile(target);
    res.writeHead(200, {'Content-Type':mime[extname(target)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-cache'});
    res.end(data);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('未找到文件');}
}).listen(port,'127.0.0.1',()=>console.log(`旅行攻略工具：http://127.0.0.1:${port}`));
async function cleanup(){if(voiceDirectory)await rm(voiceDirectory,{recursive:true,force:true});process.exit(0);}
process.on('SIGINT',cleanup);process.on('SIGTERM',cleanup);
