import {DESTINATIONS,PACE} from './data.js';
import {initialState,validateState,applyAction,parseCommand,getPoint,daySummary,costSummary,timeline,timeLabel,markdown} from './core.js';
import {startLocalVoice} from './local-voice.js';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='jerry-travel-v1';let state=initialState(),history=[],events=[],map,markers,route,lastDestination,recognition,listening=false;
let localVoice=false,localSession;
fetch('/api/capabilities').then(r=>r.ok?r.json():null).then(data=>{localVoice=Boolean(data?.localVoice);if(localVoice){$('#mic').title='使用 macOS 本机听写，音频仅通过本机回环处理';$('.privacy').textContent='本机听写已启用，音频仅通过本机回环发送到本机 SpeechTranscriber，处理后删除临时文件。行程保存在本机浏览器。地图服务会接收到请求的地图区域。';}}).catch(()=>{});
function message(text,error=false){$('#status').textContent=text;$('#status').classList.toggle('error',error);}
function log(label){let safe=label;if(label.startsWith('已执行：')){try{safe=parseCommand(label.slice(4),state).map(a=>a.type==='patch'?'修改条件：'+Object.keys(a.value).join(','):a.type+(a.id?':'+a.id:'')).join(',');}catch{safe='输入操作';}}events.push({time:new Date().toISOString(),elapsed:Math.round(performance.now())/1000,label:safe,destination:state.destination,day:state.activeDay});if(events.length>500)events.shift();}
function dateFor(day){if(!state.startDate)return `第${day}天`;const d=new Date(state.startDate+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+day-1);return `${d.getUTCMonth()+1}月${d.getUTCDate()}日`;}
function perform(action,label='操作完成'){
  try{
    if(action.type==='save'){localStorage.setItem(STORAGE,JSON.stringify(state));message('已保存到当前浏览器。关闭页面后仍可恢复。');log('保存行程');return;}
    if(action.type==='restore'){const raw=localStorage.getItem(STORAGE);if(!raw)throw new Error('还没有存档，请先保存行程');const next=validateState(JSON.parse(raw));history.push(structuredClone(state));state=next;render();message('已恢复本机保存的行程');log('恢复行程');return;}
    if(action.type==='export'){if(!state.plan.length)throw new Error('请先生成行程');download(markdown(state),`旅行攻略-${DESTINATIONS[state.destination].name}.md`,'text/markdown');message('已导出行程单，包含来源与估算说明');log('导出行程');return;}
    if(action.type==='undo'){if(!history.length)throw new Error('没有可撤销的修改');state=history.pop();render();message('已撤销上一步');log('撤销');return;}
    const next=applyAction(state,action);history.push(structuredClone(state));if(history.length>30)history.shift();state=next;render();message(label);log(label);
  }catch(e){message(e.message,true);}
}
function runCommand(input){try{const actions=parseCommand(input,state);for(const a of actions)perform(a,`已执行：${input}`);}catch(e){message(e.message,true);}}
function download(text,name,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:type+';charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function render(){
  const d=DESTINATIONS[state.destination];$('#destination').value=d.name;for(const name of ['days','people','budget','startDate','hotel','reserve'])$('#'+name).value=state[name];$('#pace').value=PACE[state.pace];
  $('#country').textContent=`${d.english.toUpperCase()} / ${d.country}`;$('#trip-title').textContent=`${d.name} · ${state.days}天`;
  const c=costSummary(state);$('#summary').innerHTML=`<span>${state.people}人同行</span><span>${PACE[state.pace]}节奏</span><span>预算 <strong>¥${state.budget.toLocaleString()}</strong></span><span class="${c.remaining<0?'over-budget':''}">估算 ¥${c.total.toLocaleString()}</span>`;
  $('#days-nav').innerHTML=Array.from({length:state.days},(_,i)=>`<button data-day="${i+1}" class="${state.activeDay===i+1?'active':''}" aria-pressed="${state.activeDay===i+1}">第${i+1}天${state.rainDays.includes(i+1)?' · 雨':''}</button>`).join('');
  const day=state.plan[state.activeDay-1];
  $('#day-heading').innerHTML=`<div><strong>${dateFor(state.activeDay)}</strong><small> ${day?day.ids.length:0}个安排${state.rainDays.includes(state.activeDay)?' · 假设下雨':''}</small></div><button class="rain-action" id="rain">${state.rainDays.includes(state.activeDay)?'取消雨天假设':'假设这一天下雨'}</button>`;
  if(!day)$('#itinerary').innerHTML='<div class="empty"><strong>把想去的地方，排进每一天</strong>左侧填条件，点击“生成我的行程”<br>也可以在下方输入或说“生成行程”</div>';
  else{
    const sum=daySummary(state,day);$('#itinerary').innerHTML=sum.warnings.map(w=>`<p class="warn">${esc(w)}</p>`).join('')+(day.ids.length?timeline(state,day).map((p,i)=>`<article class="stop"><span class="stop-num">${i+1}</span><p class="stop-time">${state.destination==='maldives'?'时段待运营方确认':`${timeLabel(p.start)} — ${timeLabel(p.end)}`} · ${p.indoor?'室内为主':'户外为主'}</p><h3>${esc(p.name)}</h3><p class="stop-desc">停留约 ${p.minutes} 分钟${p.note?' · '+esc(p.note):''}</p><div class="stop-foot"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">官方信息 ↗</a><select data-move="${p.id}" aria-label="移动${esc(p.name)}到哪一天">${Array.from({length:state.days},(_,n)=>`<option value="${n+1}" ${n+1===state.activeDay?'selected':''}>第${n+1}天</option>`).join('')}</select><button data-up="${p.id}" aria-label="上移${esc(p.name)}">↑</button><button data-down="${p.id}" aria-label="下移${esc(p.name)}">↓</button><button data-remove="${p.id}" class="remove">移除</button></div></article>`).join(''):'<div class="empty"><strong>这一天，留点自由时间</strong>添加一个地点，或者把其他天的景点移过来。</div>');
  }
  $('#places').innerHTML=d.points.filter(p=>!state.selectedIds.includes(p.id)).map(p=>`<option value="${esc(p.name)}">`).join('');
  $('#budget-summary').textContent=`预算估算 ¥${c.total.toLocaleString()} · ${c.remaining<0?'超出':'余量'} ¥${Math.abs(c.remaining).toLocaleString()}`;
  $('#budget-breakdown').innerHTML=[['活动预算占位',c.activity],['住宿预算占位',c.hotel],['餐饮预算占位',c.food],['市内交通预算占位',c.transit],['额外预留',c.reserve]].map(([name,v])=>`<div class="budget-row"><span>${name}</span><strong>¥${v.toLocaleString()}</strong></div>`).join('');
  let note='<strong>计划可以先做，细节记得确认</strong>时间与费用为估算，开放时间、预约和票价请查景点官网。住宿区域仅作备忘，未作为路线起点。';
  if(state.destination==='singapore')note='<strong>转机去星耀樟宜，需要先核实入境</strong>瀑布位于公共区。请确认通行资格、转机衔接和行李。<a href="https://www.jewelchangiairport.com/en/getting-to-jewel.html" target="_blank" rel="noopener noreferrer">官方指引 ↗</a><div class="inline"><div><label for="layover">转机时长 / 小时</label><input id="layover" type="number" min="0" max="48" value="'+state.layover+'" list="layovers"><datalist id="layovers"><option value="4"><option value="6"><option value="8"><option value="12"></datalist></div><div><label for="can-enter">入境条件</label><select id="can-enter"><option value="unknown" '+(state.canEnter==='unknown'?'selected':'')+'>待确认</option><option value="yes" '+(state.canEnter==='yes'?'selected':'')+'>本人已确认</option><option value="no" '+(state.canEnter==='no'?'selected':'')+'>不能入境</option></select></div></div><span>此处仅作条件备忘，不给出是否赶得上航班的结论。</span>';
  if(state.destination==='maldives')note='<strong>水屋和海上活动，位置由酒店确认</strong>这些是可编辑的度假活动模板，不代表任何具体酒店。地图仅显示已知地理地点，未知位置不画虚假坐标。接送、跨岛交通、活动条件及报价请找酒店核实。';
  $('#travel-note').innerHTML=note;
  updateQuickActions();drawMap();
}
function updateQuickActions(){const q=$('#quick-action');q.querySelectorAll('[data-dynamic]').forEach(n=>n.remove());const commands=[];for(let i=1;i<=state.days;i++)if(i>2)commands.push([`查看第${i}天`,`查看第${i}天`]);for(const p of DESTINATIONS[state.destination].points){if(!state.selectedIds.includes(p.id))commands.push([`添加${p.name}`,`添加 · ${p.name}`]);else{commands.push([`删除${p.name}`,`移除 · ${p.name}`]);for(let i=1;i<=state.days;i++)commands.push([`把${p.name}移到第${i}天`,`${p.name} → 第${i}天`]);commands.push([`上移${p.name}`,`上移 · ${p.name}`],[`下移${p.name}`,`下移 · ${p.name}`]);}}for(const [value,label] of commands){const o=document.createElement('option');o.value=value;o.textContent=label;o.dataset.dynamic='1';q.append(o);}}
function drawMap(){if(!window.L){$('#map-status').hidden=false;$('#map-status').textContent='地图组件未加载，行程编辑和导出仍可使用。';return;}const d=DESTINATIONS[state.destination];if(!map){map=L.map('map',{zoomControl:true,scrollWheelZoom:false}).setView(d.center,d.zoom);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',updateWhenIdle:true}).on('tileerror',()=>{$('#map-status').hidden=false;$('#map-status').textContent='底图暂时无法加载，地点标记仍可查看。请检查网络。';}).addTo(map);markers=L.layerGroup().addTo(map);route=L.layerGroup().addTo(map);}
  markers.clearLayers();route.clearLayers();const ids=state.plan[state.activeDay-1]?.ids??state.selectedIds;const pts=ids.map(id=>getPoint(state,id)).filter(p=>p.lat!==null);pts.forEach((p,i)=>{L.marker([p.lat,p.lng],{icon:L.divIcon({className:'map-marker',html:String(i+1),iconSize:[30,30],iconAnchor:[15,15]})}).bindTooltip(p.name,{direction:'top',offset:[0,-15]}).addTo(markers);});if(pts.length>1)L.polyline(pts.map(p=>[p.lat,p.lng]),{color:'#14776d',weight:3,dashArray:'6 8',opacity:.8}).addTo(route);
  if(lastDestination!==state.destination){map.setView(d.center,d.zoom);lastDestination=state.destination;}if(pts.length)map.fitBounds(pts.map(p=>[p.lat,p.lng]),{paddingTopLeft:[45,140],paddingBottomRight:[45,200],maxZoom:14,animate:true});else map.setView(d.center,d.zoom);setTimeout(()=>map.invalidateSize(),50);
}
$('#trip-form').addEventListener('submit',e=>{e.preventDefault();if(!readForm())return;perform({type:'generate'},'行程已生成。点选每一天，在地图上查看安排。');});
function readForm(){try{const destination=Object.entries(DESTINATIONS).find(([,d])=>d.name===$('#destination').value.trim());if(!destination)throw new Error('当前支持巴黎、新加坡、马尔代夫，请从目的地选项中选择');if(destination[0]!==state.destination)perform({type:'destination',value:destination[0]},'已切换目的地');const pace=Object.entries(PACE).find(([,v])=>v===$('#pace').value.trim());if(!pace)throw new Error('节奏请选择轻松、适中或充实');const value={pace:pace[0]};for(const name of ['days','people','budget','reserve']){if(!$('#'+name).value.trim())throw new Error('请填好'+name);value[name]=Number($('#'+name).value);}for(const name of ['startDate','hotel'])value[name]=$('#'+name).value;const next=applyAction(state,{type:'patch',value});history.push(structuredClone(state));state=next;return true;}catch(e){message(e.message,true);return false;}}
$('#destination').addEventListener('change',()=>{const id=Object.entries(DESTINATIONS).find(([,d])=>d.name===$('#destination').value.trim())?.[0];if(id)perform({type:'destination',value:id},'已切换目的地。原行程可用“撤销”找回。');else message('请选择巴黎、新加坡或马尔代夫',true);});
for(const field of ['days','people','budget','pace','startDate','hotel','reserve'])$('#'+field).addEventListener('change',()=>{if(readForm()){render();message('条件已更新'+(state.plan.length?'，行程与预算已重算':''));log('更新条件：'+field);}});
$('#days-nav').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(b)perform({type:'view',day:Number(b.dataset.day)},`查看第${b.dataset.day}天`);});
$('#day-heading').addEventListener('click',e=>{if(e.target.id==='rain')perform({type:'rain',day:state.activeDay,clear:state.rainDays.includes(state.activeDay)},'已按雨天假设重新分配，户外安排仍需核实。');});
$('#itinerary').addEventListener('change',e=>{if(e.target.dataset.move)perform({type:'move',id:e.target.dataset.move,day:Number(e.target.value)},'景点已换天，地图已更新。');});
$('#itinerary').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.remove)perform({type:'remove',id:b.dataset.remove},'已移除景点，可撤销。');if(b.dataset.up)perform({type:'reorder',id:b.dataset.up,direction:'up'},'已调整顺序');if(b.dataset.down)perform({type:'reorder',id:b.dataset.down,direction:'down'},'已调整顺序');});
$('#add-place').onclick=()=>{const p=DESTINATIONS[state.destination].points.find(p=>p.name===$('#place-choice').value.trim());if(!p){message('请从当前目的地的景点列表中选择',true);return;}perform({type:'add',id:p.id},`已添加${p.name}，行程已重新分配。`);$('#place-choice').value='';};
$('#travel-note').addEventListener('change',e=>{if(e.target.id==='layover')perform({type:'patch',value:{layover:Number(e.target.value)}},'已更新转机时长备忘，是否可出机场仍需自行核实。');if(e.target.id==='can-enter')perform({type:'patch',value:{canEnter:e.target.value}},'已更新入境条件备忘。');});
for(const id of ['save','restore','export','undo'])$('#'+id).onclick=()=>perform({type:id});
$('#command-form').onsubmit=e=>{e.preventDefault();runCommand($('#command').value);};$('#quick-action').onchange=e=>{if(e.target.value){const t=e.target.value;e.target.blur();setTimeout(()=>{$('#command').value=t;runCommand(t);$('#quick-action').value='';},50);}};
const examples=['生成行程','玩三天','两个人','预算改成8000','节奏轻松','查看第二天','第二天下雨','取消第二天下雨','添加奥赛博物馆','把卢浮宫移到第二天','删除凯旋门','上移卢浮宫','酒店在市中心附近','日期2026年12月12日','预留6000','转机8小时','入境条件已确认','保存行程','恢复行程','导出行程','撤销','切换目的地马尔代夫'];
$('.help-examples').innerHTML=examples.map(t=>`<button type="button" data-example="${esc(t)}">${esc(t)}</button>`).join('');$('#help').onclick=()=>$('#help-dialog').showModal();$('#close-help').onclick=()=>$('#help-dialog').close();$('.help-examples').onclick=e=>{if(e.target.dataset.example){$('#command').value=e.target.dataset.example;$('#help-dialog').close();$('#command').focus();}};
$('#mic').onclick=()=>{
  if(localVoice){
    if(listening){localSession?.stop();return;}
    listening=true;$('#mic').classList.add('listening');$('#mic').textContent='停止';$('#mic').setAttribute('aria-label','停止本机语音输入');
    localSession=startLocalVoice({onStatus:text=>{message(text);if(text.startsWith('正在本机识别')){$('#mic').textContent='识别中';$('#mic').disabled=true;}},onResult:text=>{$('#command').value=text;runCommand(text);log('本机听写完成');},onError:text=>{message(text,true);log('本机语音未完成');},onEnd:()=>{listening=false;localSession=null;$('#mic').disabled=false;$('#mic').textContent='语音';$('#mic').classList.remove('listening');$('#mic').setAttribute('aria-label','开始语音输入');}});
    return;
  }
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SpeechRecognition){message('此浏览器不支持语音识别，请使用支持 Web Speech 的 Chrome，或改用输入/下拉选项。',true);return;}
  if(listening){recognition.abort();return;}recognition=new SpeechRecognition();recognition.lang='zh-CN';recognition.interimResults=true;recognition.continuous=false;let done=false,started=false;
  listening=true;$('#mic').classList.add('listening');$('#mic').textContent='取消';$('#mic').setAttribute('aria-label','取消语音输入');message('正在连接浏览器语音服务，请先处理麦克风权限提示。');
  const readyTimer=setTimeout(()=>{if(!started){recognition.abort();message('语音服务未就绪。请检查系统麦克风权限与网络，或先用文字/下拉操作。',true);}},12000);
  recognition.onstart=()=>{started=true;clearTimeout(readyTimer);$('#mic').textContent='停止';$('#mic').setAttribute('aria-label','停止语音输入');message('正在听，请说一条命令。浏览器可能使用在线语音识别，本工具不保存音频。');};
  recognition.onresult=e=>{const text=Array.from(e.results).map(r=>r[0].transcript).join('');$('#command').value=text;if(e.results[e.results.length-1].isFinal&&!done){done=true;runCommand(text);}};
  recognition.onerror=e=>{const reasons={'not-allowed':'麦克风未获许可，请在浏览器站点设置中允许。','network':'浏览器在线语音识别连接失败，请稍后重试或用文字。','no-speech':'没有听到声音，请再试一次。','audio-capture':'未找到可用麦克风。','service-not-allowed':'此设备的语音服务不可用。'};message(reasons[e.error]||`语音识别未完成：${e.error}`,true);log('语音失败：'+e.error);};
  recognition.onend=()=>{clearTimeout(readyTimer);listening=false;$('#mic').classList.remove('listening');$('#mic').textContent='语音';$('#mic').setAttribute('aria-label','开始语音输入');};try{recognition.start();}catch(e){clearTimeout(readyTimer);listening=false;$('#mic').classList.remove('listening');$('#mic').textContent='语音';$('#mic').setAttribute('aria-label','开始语音输入');message('无法开始识别：'+e.message,true);}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&listening){if(localSession)localSession.cancel();else recognition?.abort();}});
// 仅公开拍摄事件的时间和动作标签，不导出行程字段或原始音频。
window.addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.code==='KeyL')download(JSON.stringify(events,null,2),'操作时间记录.json','application/json');});
render();
