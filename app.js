'use strict';
// Offline classroom simulation: a single 10-second order queue, based on the original waiter app.
const KEY='nandos-service-training-v6';
const $=id=>document.getElementById(id);
const sequence={1:['food','clear'],2:['food','clear','clean'],3:['drinks','clear'],4:['drinks','clear','clean'],5:['drinks','food','clear'],6:['drinks','food','clear','clean']};
const random=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;
const clock=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const images={drinks:n=>`assets/${n}-glass${n===1?'':'es'}.png`,food:n=>`assets/plates-${n}.png`,clear:()=> 'assets/clear.png',clean:()=> 'assets/clean.png'};
const labels={drinks:'GLASSES',food:'PLATES',clear:'CLEAR',clean:'CLEAN'};
const SPAWN_GAP_MS=10000; // Original waiter app: one new ticket every 10 seconds.
const FIRST_TICKET_MS=2000; // Show empty tables briefly at the beginning.
const NEXT_STAGE_MIN_MS=12500; // Each table gets a short realistic pause before its next task. The shared queue keeps all appearances staggered.
function newTable(id,ready=Date.now()){return {id,stage:0,glasses:random(1,3),plates:random(1,2),showAt:ready,startedAt:null,order:1};}
function newState(level){const now=Date.now();return {version:6,level,stopped:false,start:now,end:null,nextSpawnAt:now+FIRST_TICKET_MS,lastTable:0,stats:{glasses:0,drinksTables:0,plates:0,foodTables:0,cleared:0,cleaned:0},tables:[1,2,3,4].map(id=>newTable(id,now))};}
function saved(){try{const s=JSON.parse(localStorage.getItem(KEY));return s&&s.version===6&&[1,2,3,4,5,6].includes(s.level)&&s.stats&&Number.isFinite(s.nextSpawnAt)&&Array.isArray(s.tables)&&s.tables.length===4&&s.tables.every((t,i)=>t.id===i+1&&Number.isInteger(t.stage)&&t.stage>=0&&t.stage<sequence[s.level].length&&t.glasses>=1&&t.glasses<=3&&t.plates>=1&&t.plates<=2)?s:null;}catch(_){return null;}}
let state=saved()||newState(1);
let proposed=null;
let lastFingerprint='';
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}}
function stepFor(t){return sequence[state.level][t.stage];}
function imageFor(t){
 const step=stepFor(t);
 if(step==='clear'){
  if(state.level===1||state.level===2)return 'assets/clear-plates.png';
  if(state.level===5||state.level===6)return 'assets/clear-combined.png';
  return 'assets/clear.png'; // Levels 3 and 4: drinks-only tray symbol.
 }
 return images[step](step==='drinks'?t.glasses:step==='food'?t.plates:0);
}
function amount(t){const step=stepFor(t);return step==='drinks'?t.glasses:step==='food'?t.plates:null;}
function stateColour(age){return age>=60?'flashing':age>=40?'red':age>=20?'orange':'green';}
function isLive(t){return t.startedAt!==null&&t.startedAt!==undefined;}
// Dispatch only ONE eligible task per slot. No two tables get tasks at the same moment.
// Choose randomly among ready tables, with a preference for tasks that have waited longer.
// Avoid dispatching the same table in consecutive slots when other tables are ready.
function dispatch(now){
 if(state.stopped||now<state.nextSpawnAt)return false;
 const ready=state.tables.filter(t=>!isLive(t)&&t.showAt<=now);
 if(!ready.length)return false;
 const alternatives=ready.filter(t=>t.id!==state.lastTable);
 const pool=alternatives.length?alternatives:ready;
 // Randomised selection, gently favouring tasks that have been ready longest.
 const weights=pool.map(t=>1+Math.min(5,Math.floor((now-t.showAt)/10000)));
 let pick=Math.random()*weights.reduce((sum,w)=>sum+w,0);
 let chosen=pool[pool.length-1];
 for(let i=0;i<pool.length;i++){pick-=weights[i];if(pick<0){chosen=pool[i];break;}}
 chosen.startedAt=now;state.lastTable=chosen.id;
 state.nextSpawnAt=now+SPAWN_GAP_MS;
 persist();return true;
}
function ticketHtml(t,now){
 if(!isLive(t))return '<div class="waiting" aria-label="Waiting">—</div>';
 const step=stepFor(t);const age=Math.max(0,Math.floor((now-t.startedAt)/1000));const n=amount(t);
 const text=step==='drinks'&&n===1?'GLASS':step==='food'&&n===1?'PLATE':labels[step];
 return `<button class="ticket ${stateColour(age)}" data-id="${t.id}" aria-label="Table ${t.id}, ${n??''} ${text}, tap to complete"><div class="ticket-top"><span>${step==='drinks'?'DRINKS':step==='food'?'FOOD':step==='clear'?'CLEAR':'CLEAN'}</span><span class="elapsed">${clock(age)}</span></div><div class="picture"><img draggable="false" alt="" src="${imageFor(t)}"></div><div class="caption">${n!==null?`<span class="count">${n}</span>`:''}<span>${text}</span></div></button>`;
}
function render(force=false){
 const now=Date.now();dispatch(now);$('level').value=state.level;
 $('runtime').textContent=clock(Math.floor(((state.stopped?state.end:now)-state.start)/1000));
 $('stop').disabled=state.stopped;
 // Rebuild symbols ONLY when tasks enter/leave; updating the timer never reloads pictures.
 const fp=state.stopped?'stopped':state.tables.map(t=>`${t.id}:${t.order}:${t.stage}:${isLive(t)?'live':'wait'}`).join('|');
 if(force||fp!==lastFingerprint){lastFingerprint=fp;const focused=document.activeElement?.dataset?.id;
 $('board').innerHTML=state.tables.map(t=>`<section class="table-col"><div class="table-title">TABLE ${t.id}</div><div class="table-area">${ticketHtml(t,now)}</div></section>`).join('');
 if(focused){const el=$('board').querySelector(`[data-id="${focused}"]`);if(el)el.focus({preventScroll:true});}}
 for(const t of state.tables){if(!isLive(t))continue;
 const ticket=$('board').querySelector(`button.ticket[data-id="${t.id}"]`);if(!ticket)continue;
 const age=Math.max(0,Math.floor((now-t.startedAt)/1000));
 ticket.classList.remove('green','orange','red','flashing');ticket.classList.add(stateColour(age));
 const elapsed=ticket.querySelector('.elapsed');if(elapsed)elapsed.textContent=clock(age);
 }
 $('summary').classList.toggle('hidden',!state.stopped);
 if(state.stopped){$('sessionLevel').textContent=`LEVEL ${state.level} · ${clock(Math.floor((state.end-state.start)/1000))}`;
 const stages=sequence[state.level];const entries=[];
 if(stages.includes('drinks'))entries.push(['GLASSES SERVED',state.stats.glasses],['DRINKS TABLES',state.stats.drinksTables]);
 if(stages.includes('food'))entries.push(['PLATES SERVED',state.stats.plates],['FOOD TABLES',state.stats.foodTables]);
 entries.push(['TABLES CLEARED',state.stats.cleared]);
 if(stages.includes('clean'))entries.push(['TABLES CLEANED',state.stats.cleaned]);
 $('metrics').innerHTML=entries.map(([label,value])=>`<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join('');
 }
}
function completed(id){
 if(state.stopped)return;const t=state.tables[id-1];if(!t||!isLive(t))return;
 const step=stepFor(t);
 if(step==='drinks'){state.stats.glasses+=t.glasses;state.stats.drinksTables++;}
 if(step==='food'){state.stats.plates+=t.plates;state.stats.foodTables++;}
 if(step==='clear')state.stats.cleared++;
 if(step==='clean')state.stats.cleaned++;
 t.stage++;
 const ready=Date.now()+NEXT_STAGE_MIN_MS;
 if(t.stage>=sequence[state.level].length){const fresh=newTable(id,ready);fresh.order=t.order+1;state.tables[id-1]=fresh;}
 else{t.showAt=ready;t.startedAt=null;}
 persist();render(true);
}
$('board').addEventListener('click',e=>{const ticket=e.target.closest('button.ticket');if(ticket)completed(Number(ticket.dataset.id));});
$('stop').addEventListener('click',()=>{state.stopped=true;state.end=Date.now();persist();render(true);});
function restart(level){state=newState(level);lastFingerprint='';persist();render(true);}
$('again').addEventListener('click',()=>restart(state.level));
$('changeLevel').addEventListener('click',()=>{$('summary').classList.add('hidden');$('level').focus();});
$('level').addEventListener('change',e=>{const n=Number(e.target.value);if(n===state.level)return;if(state.stopped){restart(n);return;}proposed=n;$('confirm').classList.remove('hidden');$('level').value=state.level;});
$('cancel').addEventListener('click',()=>{proposed=null;$('confirm').classList.add('hidden');});
$('confirmYes').addEventListener('click',()=>{const level=proposed;proposed=null;$('confirm').classList.add('hidden');if(level)restart(level);});
setInterval(()=>render(),1000);persist();render(true);
