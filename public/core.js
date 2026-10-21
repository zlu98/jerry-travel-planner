import {DESTINATIONS,PACE} from './data.js';
export const LIMIT_DAYS = 14;
export function initialState(destination='paris') {
  const d=DESTINATIONS[destination];
  if(!d) throw new Error('请选择内置目的地：巴黎、新加坡、马尔代夫');
  return {version:1,destination,days:d.defaultDays,people:2,budget:12000,startDate:'',pace:destination==='maldives'?'relaxed':'balanced',hotel:'',selectedIds:[...d.defaultIds],plan:[],activeDay:1,rainDays:[],reserve:0,layover:0,canEnter:'unknown'};
}
export function clampNumber(value,min,max,label){const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${label}需在${min}至${max}之间`);return n;}
function dayNumber(value,s){const n=clampNumber(value,1,s.days,'天序');if(!Number.isInteger(n))throw new Error('天序需为整数');return n;}
export function validateState(raw){
  if(!raw||typeof raw!=='object'||!DESTINATIONS[raw.destination])throw new Error('存档目的地无效');
  const s={...initialState(raw.destination),...raw};
  s.days=clampNumber(s.days,1,LIMIT_DAYS,'天数');s.people=clampNumber(s.people,1,12,'人数');s.budget=clampNumber(s.budget,0,1000000,'预算');
  if(!Number.isInteger(s.days)||!Number.isInteger(s.people))throw new Error('天数和人数需为整数');
  if(!Object.hasOwn(PACE,s.pace))throw new Error('节奏无效');
  if(s.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(s.startDate))throw new Error('日期格式应为年-月-日');
  if(s.startDate){const dt=new Date(s.startDate+'T12:00:00Z');if(!Number.isFinite(+dt)||dt.toISOString().slice(0,10)!==s.startDate)throw new Error('日期无效');}
  s.hotel=String(s.hotel||'').slice(0,120);s.reserve=clampNumber(s.reserve,0,1000000,'额外预留');s.layover=clampNumber(s.layover,0,48,'转机时长');
  if(!['yes','no','unknown'].includes(s.canEnter))throw new Error('入境条件无效');
  const validIds=new Set(DESTINATIONS[s.destination].points.map(p=>p.id));
  if(!Array.isArray(s.selectedIds)||s.selectedIds.some(id=>!validIds.has(id)))throw new Error('存档含未知景点');
  s.selectedIds=[...new Set(s.selectedIds)];
  if(!Array.isArray(s.rainDays)||s.rainDays.some(d=>!Number.isInteger(d)||d<1||d>s.days))throw new Error('雨天日期无效');
  s.rainDays=[...new Set(s.rainDays)];
  if(!Array.isArray(s.plan)||s.plan.length>s.days)throw new Error('存档行程无效');
  const seen=new Set();s.plan=s.plan.map((day,i)=>{if(!day||day.day!==i+1||!Array.isArray(day.ids))throw new Error('存档天序无效');for(const id of day.ids){if(!s.selectedIds.includes(id)||seen.has(id))throw new Error('存档景点重复或无效');seen.add(id);}return {day:i+1,ids:[...day.ids]};});
  if(s.plan.length && (s.plan.length!==s.days||seen.size!==s.selectedIds.length))throw new Error('存档行程不完整');
  s.activeDay=dayNumber(s.activeDay,s);return s;
}
export function distanceKm(a,b){if(!a||!b||a.lat===null||b.lat===null)return null;const r=Math.PI/180;const h=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));}
export function getPoint(s,id){return DESTINATIONS[s.destination].points.find(p=>p.id===id);}
function orderNear(points){if(points.length<2)return points;const result=[points[0]],rest=points.slice(1);while(rest.length){let idx=0,best=Infinity;rest.forEach((p,i)=>{const n=distanceKm(result.at(-1),p)??1;if(n<best){best=n;idx=i;}});result.push(...rest.splice(idx,1));}return result;}
export function generatePlan(raw){
  const s=validateState(raw);const days=Array.from({length:s.days},(_,i)=>({day:i+1,ids:[]}));
  const target=s.pace==='relaxed'?240:s.pace==='packed'?540:390;
  const points=s.selectedIds.map(id=>getPoint(s,id));
  // 先按地理最近邻排列；雨天优先室内，保留所有用户已选景点。
  const sorted=orderNear(points);
  for(const p of sorted){let best=0,score=Infinity;days.forEach((day,i)=>{const load=day.ids.reduce((n,id)=>n+getPoint(s,id).minutes,0);const previous=getPoint(s,day.ids.at(-1));const dist=distanceKm(previous,p)??0;const rain=s.rainDays.includes(i+1)&&!p.indoor?600:0;const locality=day.ids.length?dist*15:45;const overload=Math.max(0,load+p.minutes-target)*4;const dayBias=i*12;const val=load+locality+rain+overload+dayBias;if(val<score){score=val;best=i;}});days[best].ids.push(p.id);}
  if(s.destination==='maldives' && s.pace==='relaxed'){
    const indoor=sorted.filter(p=>p.indoor),outdoor=sorted.filter(p=>!p.indoor);days.forEach(d=>d.ids=[]);
    [...outdoor,...indoor].forEach((p,i)=>{let slot=i%s.days;if(s.rainDays.includes(slot+1)&&!p.indoor){const dry=days.find(d=>!s.rainDays.includes(d.day)&&!d.ids.length);if(dry)slot=dry.day-1;}days[slot].ids.push(p.id);});
  }
  days.forEach(day=>{day.ids=orderNear(day.ids.map(id=>getPoint(s,id))).map(p=>p.id);});
  return {...s,plan:days,activeDay:Math.min(s.activeDay,s.days)};
}
export function daySummary(s,day){const points=day.ids.map(id=>getPoint(s,id));let km=0,travel=0;for(let i=1;i<points.length;i++){const n=distanceKm(points[i-1],points[i]);if(n!==null){km+=n;travel+=s.destination==='maldives'?0:Math.ceil(n*1.35/4.5*60)+10;}}const minutes=points.reduce((n,p)=>n+p.minutes,0)+travel+(points.length?60:0);const warnings=[];if(minutes>(s.pace==='relaxed'?360:s.pace==='packed'?660:540))warnings.push('安排偏满，可移走一个景点');if(points.some(p=>s.rainDays.includes(day.day)&&!p.indoor))warnings.push('假设下雨：户外项目需确认或改期');if(s.destination==='maldives'&&points.length>1)warnings.push('活动或跨岛接送时间待运营方确认');return {points,km,travel,minutes,warnings};}
export function costSummary(s){const d=DESTINATIONS[s.destination];const activity=s.selectedIds.reduce((n,id)=>n+getPoint(s,id).cost,0)*s.people;const hotel=Math.max(0,s.days-1)*d.dailyHotel*Math.ceil(s.people/2);const food=s.days*d.dailyFood*s.people;const transit=s.destination==='maldives'?0:s.days*100*s.people;const total=activity+hotel+food+transit+s.reserve;return {activity,hotel,food,transit,reserve:s.reserve,total,remaining:s.budget-total};}
export function timeline(s,day){let time=9*60;return day.ids.map((id,i)=>{const p=getPoint(s,id);if(i){const prev=getPoint(s,day.ids[i-1]);const km=distanceKm(prev,p);time+=s.destination==='maldives'?0:Math.ceil((km??0)*1.35/4.5*60)+10;}if(time>=12*60&&time<13*60)time=13*60;const start=time;time+=p.minutes;return {...p,start,end:time};});}
export function timeLabel(n){if(n>=1440)return `次日${String(Math.floor(n/60)%24).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
export function applyAction(raw,action){
  let s=validateState(structuredClone(raw));const a=action;
  if(a.type==='destination')return initialState(a.value);
  if(a.type==='patch'){const changedDays=a.value.days!==undefined&&Number(a.value.days)!==s.days;const changedPace=a.value.pace!==undefined&&a.value.pace!==s.pace;s={...s,...a.value};if(changedDays){s.plan=[];s.rainDays=s.rainDays.filter(d=>d<=s.days);s.activeDay=1;}s=validateState(s);if(changedDays||(raw.plan.length&&changedPace))return generatePlan(s);return s;}
  if(a.type==='generate')return generatePlan(s);
  if(a.type==='view'){s.activeDay=dayNumber(a.day,s);return s;}
  if(a.type==='rain'){const n=dayNumber(a.day,s);if(a.clear)s.rainDays=s.rainDays.filter(d=>d!==n);else if(!s.rainDays.includes(n))s.rainDays.push(n);return generatePlan(s);}
  if(a.type==='add'){if(!getPoint(s,a.id))throw new Error('未找到这个景点');if(s.selectedIds.includes(a.id))throw new Error('这个景点已经在行程里');s.selectedIds.push(a.id);s.plan=[];return generatePlan(s);}
  if(a.type==='remove'){if(!s.selectedIds.includes(a.id))throw new Error('这个景点不在行程里');s.selectedIds=s.selectedIds.filter(id=>id!==a.id);s.plan=s.plan.map(d=>({...d,ids:d.ids.filter(id=>id!==a.id)}));return s.plan.length?s:generatePlan(s);}
  if(a.type==='move'){if(!s.plan.length)throw new Error('请先生成行程');if(!s.selectedIds.includes(a.id))throw new Error('这个景点不在行程里');const day=dayNumber(a.day,s);s.plan.forEach(d=>d.ids=d.ids.filter(id=>id!==a.id));s.plan[day-1].ids.push(a.id);s.activeDay=day;return s;}
  if(a.type==='reorder'){if(!s.plan.length)throw new Error('请先生成行程');const day=s.plan.find(d=>d.ids.includes(a.id));if(!day)throw new Error('未找到景点');const from=day.ids.indexOf(a.id),to=from+(a.direction==='up'?-1:1);if(to<0||to>=day.ids.length)throw new Error('已经在当天的最前或最后');[day.ids[from],day.ids[to]]=[day.ids[to],day.ids[from]];return s;}
  throw new Error('不支持的操作');
}
const cn={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
export function numberFromText(v){if(/^\d+(\.\d+)?$/.test(v))return Number(v);if(v.includes('万')){const [a,b]=v.split('万');return numberFromText(a)*10000+(b?numberFromText(b):0);}if(v.includes('千')){const [a,b]=v.split('千');return numberFromText(a)*1000+(b?numberFromText(b):0);}if(v.includes('百')){const [a,b]=v.split('百');return numberFromText(a)*100+(b?numberFromText(b):0);}if(v.includes('十')){const [a,b]=v.split('十');return (a?cn[a]:1)*10+(b?cn[b]:0);}if(Object.hasOwn(cn,v))return cn[v];throw new Error('数字没识别清楚，请使用阿拉伯数字');}
const NUM='([零一二两三四五六七八九十百千万\\d.]+)';
export function parseCommand(input,s){
  let t=String(input).normalize('NFKC').trim().replace(/(\d),(?=\d{3}(?:\D|$))/g,'$1').replace(/[，。！？、,!?]/g,' ').replace(/\s+/g,' ');if(!t)throw new Error('请先输入一句操作');
  const destination=Object.entries(DESTINATIONS).find(([,d])=>t.includes(d.name));
  if(destination&&/(切换|目的地|去|选择)/.test(t))return [{type:'destination',value:destination[0]}];
  const point=DESTINATIONS[s.destination].points.find(p=>t.includes(p.name)) || DESTINATIONS[s.destination].points.find(p=>p.id==='eiffel'&&t.includes('铁塔'));
  const day=t.match(new RegExp('第?'+NUM+'天'));const dayNo=day?numberFromText(day[1]):s.activeDay;
  if(/(加入|添加|增加)/.test(t)&&point)return [{type:'add',id:point.id}];
  if(/(删除|移除|去掉)/.test(t)&&point)return [{type:'remove',id:point.id}];
  if(/(移到|挪到|换到)/.test(t)&&point&&day)return [{type:'move',id:point.id,day:dayNo}];
  if(/(上移|提前一位)/.test(t)&&point)return [{type:'reorder',id:point.id,direction:'up'}];
  if(/(下移|推后一位)/.test(t)&&point)return [{type:'reorder',id:point.id,direction:'down'}];
  if(/(取消.*下雨|取消.*雨天|恢复晴天)/.test(t))return [{type:'rain',day:dayNo,clear:true}];
  if(/(下雨|雨天)/.test(t))return [{type:'rain',day:dayNo}];
  if(/(查看|显示|打开)/.test(t)&&day)return [{type:'view',day:dayNo}];
  if(/^(保存|保存行程)$/.test(t))return [{type:'save'}];
  if(/^(恢复|恢复行程|读取存档)$/.test(t))return [{type:'restore'}];
  if(/^(导出|导出行程|下载行程)$/.test(t))return [{type:'export'}];
  if(/^(撤销|撤销上一步)$/.test(t))return [{type:'undo'}];
  if(/^(生成|生成行程|重新规划|重新生成)$/.test(t))return [{type:'generate'}];
  const patch={};const capture=(rx,key)=>{const m=t.match(rx);if(m)patch[key]=numberFromText(m[1]);};
  capture(new RegExp('(?:玩|安排|天数(?:改成|设为)?|改成|改为)\\s*'+NUM+'天'),'days');
  if(/^\S+天$/.test(t)&&day)patch.days=dayNo;
  capture(new RegExp(NUM+'(?:个)?人'),'people');capture(new RegExp('预算(?:改成|设为|是|为)?\\s*'+NUM),'budget');capture(new RegExp('(?:预留|额外费用)(?:改成|设为)?\\s*'+NUM),'reserve');capture(new RegExp('转机\\s*'+NUM+'小时'),'layover');
  if(/轻松|少走|慢一点/.test(t))patch.pace='relaxed';else if(/适中/.test(t))patch.pace='balanced';else if(/充实|紧凑/.test(t))patch.pace='packed';
  const date=t.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?/);if(date)patch.startDate=`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`;
  const hotel=t.match(/(?:酒店|住宿)(?:在|设为|改成)?\s*(.+)$/);if(hotel)patch.hotel=hotel[1].slice(0,120);
  if(/入境条件已确认/.test(t))patch.canEnter='yes';if(/不能入境/.test(t))patch.canEnter='no';if(/入境条件待确认/.test(t))patch.canEnter='unknown';
  if(Object.keys(patch).length)return [{type:'patch',value:patch}];
  throw new Error('没识别清楚。可说“预算改成8000”“查看第二天”“添加奥赛博物馆”“保存行程”。');
}
export function markdown(s){const d=DESTINATIONS[s.destination],cost=costSummary(s);return `# ${d.name} ${s.days}天行程\n\n${s.people}人，预算 ¥${s.budget}，节奏${PACE[s.pace]}\n${s.startDate?'出发日期：'+s.startDate:'日期待定'}\n住宿区域：${s.hotel||'待定'}\n\n`+s.plan.map(day=>`## 第${day.day}天${s.rainDays.includes(day.day)?'（假设下雨）':''}\n\n`+timeline(s,day).map(p=>`- ${s.destination==='maldives'?'时段待运营方确认':timeLabel(p.start)+'–'+timeLabel(p.end)} ${p.name}，停留约${p.minutes}分钟。${p.note} [官方信息](${p.url})`).join('\n')).join('\n\n')+`\n\n## 预算估算（人民币）\n活动：${cost.activity}\n住宿：${cost.hotel}\n餐饮：${cost.food}\n市内交通：${cost.transit}\n额外预留：${cost.reserve}\n合计：${cost.total}\n\n费用均为演示预算占位，非实时价格。不含国际机票、保险、购物及未填入的跨岛接送。地图连线为地点顺序示意，不是道路导航。停留与通行时间是估算，营业时间、预约、转机入境、天气和运营条件请查官方。\n\n工具：旅行攻略规划器，MIT 开源。\n`;}
