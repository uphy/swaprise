/* catalog.js の宣言データだけを参照。file:// でも fetch なしで開ける。 */
'use strict';
const $=id=>document.getElementById(id), catalog=window.CHARACTER_CATALOG;
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
let person,asset,sheet,frame=0,playing=false,ready=false,last=null,elapsed=0,loadId=0;
const actionGroups=window.CHARACTER_ACTION_GROUPS;
function link(label,url){const a=document.createElement('a');a.textContent=label;a.href=url;return a;}
function draw(){
 if(!ready||asset.kind!=='animation')return;
 const f=asset.frames?.[frame];
 const w=f?.width??asset.frameWidth,h=f?.height??asset.frameHeight,col=frame%asset.columns,row=Math.floor(frame/asset.columns),s=(asset.scale||1)*(f?.scale??1);
 const anchor=f?.pivotX??asset.pivotX?.[frame]??w/2;
 ctx.imageSmoothingEnabled=!asset.pixelArt;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(sheet,f?.x??col*w,f?.y??row*h,w,h,canvas.width/2-anchor*s,canvas.height-24-(f?.baselineY??asset.baselineY??h)*s,w*s,h*s);
 if($('guide').checked){ctx.save();ctx.strokeStyle='#d3536e';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(canvas.width/2,0);ctx.lineTo(canvas.width/2,canvas.height);ctx.stroke();ctx.restore();}
 $('counter').textContent=`${frame+1} / ${asset.frameCount}`;$('play').textContent=playing?'一時停止':'再生';
}
function mode(){const animated=asset?.kind==='animation'&&$('mode').value==='animation';canvas.hidden=!animated;$('still').hidden=animated;for(const id of ['play','next','guide','fps'])$(id).disabled=!animated||!ready;$('counter').hidden=!animated;draw();}
function selectAsset(a){
 asset=a;$('version').value=a.id;$('adoption').textContent=person.adoptedAssets?.[a.action]===a.id?(a.action==='victory'?'採用版 · 暫定採用':'採用版'):person.adoptedAssets?.[a.action]?'過去の試作・比較用':'採用未定 · 試作';frame=0;elapsed=0;last=null;ready=false;playing=false;const token=++loadId;
 $('viewer').hidden=false;$('empty').hidden=true;$('notes').textContent=a.notes||'';$('status').textContent='読み込み中…';
 $('model').textContent='生成モデル：'+(a.model||'未記録');$('fps').value=a.fps||6;$('rate').textContent=$('fps').value+'fps';$('playback').textContent=a.kind==='animation'?`既定 ${a.fps}fps · ${a.loop?'繰り返し':'一度だけ再生'}`:'';
 $('mode').value=a.kind==='animation'?'animation':'sheet';$('mode').disabled=a.kind!=='animation';
 $('links').replaceChildren(link('元画像を開く',a.image));if(a.prompt)$('links').append(link('生成プロンプト',a.prompt));
 $('history').replaceChildren(...(a.history||[]).map(h=>link(h.label,h.url)));$('still').src=a.image;$('still').alt=person.name+' '+a.label;canvas.setAttribute('aria-label',person.name+' '+a.label);
 for(const b of $('assets').children)b.setAttribute('aria-pressed',String(b.dataset.action===a.action));
 sheet=new Image();const current=sheet;mode();
 current.onload=()=>{if(token!==loadId)return;
 if(a.kind==='animation'&&(a.frames ? a.frames.length!==a.frameCount||a.frames.some(f=>f.x<0||f.y<0||f.x+f.width>current.width||f.y+f.height>current.height) : current.width!==a.columns*a.frameWidth||current.height!==a.rows*a.frameHeight)){ $('status').textContent='画像サイズとコマ設定が一致しません。管理データを確認してください。';return;}
 ready=true;playing=a.kind==='animation';$('status').textContent=a.status||'';mode();};
 current.onerror=()=>{if(token===loadId)$('status').textContent='画像を読み込めません。ファイルの場所を確認してください。';};current.src=a.image;
}
function selectPerson(p){person=p;loadId++;ready=false;playing=false;$('name').textContent=p.name;$('role').textContent=p.role;$('profile').href='../profiles/'+p.id+'.md';
 history.replaceState(null,'','#'+p.id);$('coverage').replaceChildren(...actionGroups.map(group=>{
 const section=document.createElement(group.optional?'details':'div');section.className='action-group';
 const title=document.createElement(group.optional?'summary':'h3');
 const count=group.items.filter(([key])=>p.assets.some(a=>a.action===key)).length;
 title.textContent=group.label+(group.optional?'（今後追加）':` · ${count} / ${group.items.length}種類に素材あり`);section.append(title);
 const list=document.createElement('div');list.className='action-list';
 for(const [key,label] of group.items){const e=document.createElement('span'),done=p.assets.some(a=>a.action===key);e.textContent=label+' · '+(done?'素材あり':group.optional?'未着手':'未生成');e.className=done?'done':'';list.append(e);}
 section.append(list);return section;
 }));
 const available=actionGroups.flatMap(g=>g.items).filter(([key])=>p.assets.some(a=>a.action===key));
 $('assets').replaceChildren(...available.map(([key,label])=>{const b=document.createElement('button');b.textContent=label;b.dataset.action=key;b.onclick=()=>selectAction(key);return b;}));
 $('viewer').hidden=!p.assets.length;$('empty').hidden=!!p.assets.length;
 if(available.length)selectAction(available.find(([key])=>p.adoptedAssets?.[key])?.[0]||available[0][0]);renderPeople();
}
function selectAction(action){
 const versions=person.assets.filter(a=>a.action===action),adopted=person.adoptedAssets?.[action];
 versions.sort((a,b)=>Number(b.id===adopted)-Number(a.id===adopted));
 $('version').replaceChildren(...versions.map(a=>{const o=document.createElement('option');o.value=a.id;o.textContent=(a.id===adopted?'採用 · ':'試作 · ')+a.label;return o;}));
 selectAsset(versions[0]);
}
$('version').onchange=()=>selectAsset(person.assets.find(a=>a.id===$('version').value));
function renderPeople(){const q=$('search').value.trim();$('characters').replaceChildren(...catalog.filter(p=>(p.name+p.role+p.id).includes(q)).map(p=>{const b=document.createElement('button');b.setAttribute('aria-pressed',String(p===person));const badge=document.createElement('span');badge.className='badge';badge.style.background=p.color;badge.textContent=p.name[0];const text=document.createElement('span');text.className='person';text.textContent=p.name;const sub=document.createElement('small');sub.textContent=p.role+' · '+(p.assets.length?p.assets.length+'点':'未生成');text.append(sub);b.append(badge,text);b.onclick=()=>selectPerson(p);return b;}));}
$('search').oninput=renderPeople;$('play').onclick=()=>{if(!playing&&frame===asset.frameCount-1)frame=0;playing=!playing;elapsed=0;last=null;draw();};$('next').onclick=()=>{playing=false;frame=(frame+1)%asset.frameCount;elapsed=0;draw();};$('fps').oninput=()=>{$('rate').textContent=$('fps').value+'fps';elapsed=0;last=null;};$('guide').onchange=draw;$('mode').onchange=()=>{elapsed=0;mode();};$('background').onchange=()=>{$('stage').dataset.bg=$('background').value;};
document.addEventListener('visibilitychange',()=>{last=null;elapsed=0;});
function tick(now){if(last!==null&&playing&&ready&&!document.hidden&&$('mode').value==='animation'){elapsed+=Math.min(now-last,200);let changed=false;let duration=()=>1000/Number($('fps').value)+(frame===asset.frameCount-1?(asset.lastHoldMs||0):0);while(elapsed>=duration()){elapsed-=duration();if(frame===asset.frameCount-1&&!asset.loop){playing=false;elapsed=0;changed=true;break;}frame=(frame+1)%asset.frameCount;changed=true;}if(changed)draw();}last=now;requestAnimationFrame(tick);}
$('summary').textContent=`${catalog.length}人 / ${catalog.filter(p=>p.assets.length).length}人の画像あり`;
selectPerson(catalog.find(p=>p.id===location.hash.slice(1))||catalog[0]);requestAnimationFrame(tick);
