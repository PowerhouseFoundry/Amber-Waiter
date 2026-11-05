'use strict';
// Educational training simulation. All data is local to this browser.
const LEVELS={
  1:['plates','clear'], 2:['plates','clear','clean'],
  3:['drinks','clear'], 4:['drinks','clear','clean'],
  5:['drinks','plates','clear'], 6:['drinks','plates','clear','clean']
};
const FIRST_DELAY=2000, ORDER_INTERVAL=10000, FOLLOW_UP_DELAY=20000, SINGLE_FOLLOW_UP_DELAY=10000;
const board=document.getElementById('board'), levelSelect=document.getElementById('level');
const clock=document.getElementById('sessionClock'), summary=document.getElementById('summary');
const oneBtn=document.getElementById('oneMode'), allBtn=document.getElementById('allMode');
let mode='one',level=1,sessionStart=0,elapsedAtStop=0,stopped=false;
let tables=[],activeOne=null,lastTable=-1,lastDispatch=0,started=false;
let totals={},clockHandle=null,dispatcher=null,renderedTicket=new Map();
function freshTotals(){return {glasses:0,plates:0,drinksTables:0,foodTables:0,cleared:0,cleaned:0,orders:0};}
function newTable(id){return {id,stage:0,drinks:0,plates:0,readyAt:0,ticket:null,completed:0};}
function stamp(t){const s=Math.max(0,Math.floor(t/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function choice(arr){return arr[Math.floor(Math.random()*arr.length)];}
function newCounts(table){table.drinks=1+Math.floor(Math.random()*3);table.plates=1+Math.floor(Math.random()*2);table.stage=0;}
function currentStage(table){return LEVELS[level][table.stage]||null;}
function imageFor(table,type){if(type==='drinks')return `assets/${table.drinks}-glass${table.drinks>1?'es':''}.png`;
 if(type==='plates')return `assets/plates-${table.plates}.png`;
 if(type==='clean')return 'assets/clean.png';
 if(level<=2)return 'assets/clear-plates.png';
 if(level<=4)return 'assets/clear-drinks.png';
 return 'assets/clear-combined.png';}
function countText(table,type){if(type==='drinks')return `${table.drinks} ${table.drinks===1?'GLASS':'GLASSES'}`;
 if(type==='plates')return `${table.plates} ${table.plates===1?'PLATE':'PLATES'}`;
 return type==='clear'?'CLEAR':'CLEAN';}
function reset(){clearInterval(clockHandle);clearInterval(dispatcher);level=Number(levelSelect.value);tables=Array.from({length:4},(_,i)=>newTable(i));
 totals=freshTotals();stopped=false;started=false;activeOne=null;lastTable=-1;sessionStart=Date.now();lastDispatch=sessionStart;renderedTicket.clear();
 summary.hidden=true;clock.textContent='00:00';board.className='board '+mode;
 updateButtons();renderBoard();
 clockHandle=setInterval(tick,250);dispatcher=setInterval(dispatch,200);
}
function updateButtons(){oneBtn.classList.toggle('selected',mode==='one');allBtn.classList.toggle('selected',mode==='all');oneBtn.setAttribute('aria-pressed',String(mode==='one'));allBtn.setAttribute('aria-pressed',String(mode==='all'));}
function makeTable(table){const el=document.createElement('section');el.className='table';el.dataset.table=table.id;
 const title=document.createElement('header');title.className='table-title';title.textContent=`TABLE ${table.id+1}`;
 const slot=document.createElement('div');slot.className='ticket-slot';el.append(title,slot);return el;}
function renderBoard(){board.replaceChildren();renderedTicket.clear();
 if(mode==='all'){tables.forEach(table=>{const el=makeTable(table);board.appendChild(el);renderSlot(table,el.querySelector('.ticket-slot'));});}
 else{const table=activeOne==null?null:tables[activeOne];if(table){const el=makeTable(table);board.appendChild(el);renderSlot(table,el.querySelector('.ticket-slot'));}
 else{const el=document.createElement('section');el.className='table';const title=document.createElement('header');title.className='table-title';title.textContent='TABLE SERVICE';const msg=document.createElement('div');msg.className='placeholder';msg.textContent='WAITING FOR ORDER';el.append(title,msg);board.appendChild(el);}}
}
function renderSlot(table,slot){slot.replaceChildren();const ticket=table.ticket;
 if(!ticket){const dash=document.createElement('div');dash.className='placeholder';dash.textContent='—';slot.appendChild(dash);return;}
 const btn=document.createElement('button');btn.className='ticket';btn.type='button';btn.dataset.table=table.id;btn.setAttribute('aria-label',`Table ${table.id+1}: ${countText(table,ticket.type)}. Tap when done`);
 const bar=document.createElement('div');bar.className='statusbar';const type=document.createElement('span');type.textContent=ticket.type.toUpperCase();const time=document.createElement('span');time.textContent='00:00';bar.append(type,time);
 const middle=document.createElement('div');middle.className='taskbody';const img=document.createElement('img');img.src=imageFor(table,ticket.type);img.alt=countText(table,ticket.type);img.draggable=false;middle.appendChild(img);
 const label=document.createElement('div');label.className='tasklabel';label.textContent=countText(table,ticket.type);btn.append(bar,middle,label);
 btn.addEventListener('click',()=>complete(table.id));slot.appendChild(btn);
 renderedTicket.set(table.id,{bar,time,ticket});updateTicketAge(table,Date.now());}
function showTicket(table,now){const type=currentStage(table);if(!type||table.ticket)return;
 table.ticket={type,at:now};table.readyAt=0;lastDispatch=now;lastTable=table.id;started=true;
 if(mode==='one'){activeOne=table.id;renderBoard();}
 else{const el=board.querySelector(`.table[data-table="${table.id}"]`);if(el)renderSlot(table,el.querySelector('.ticket-slot'));}}
function eligible(now){return tables.filter(t=>!t.ticket&&t.readyAt>0&&t.readyAt<=now);}
function dispatch(){if(stopped)return;const now=Date.now();if(now-sessionStart<FIRST_DELAY)return;
 if(mode==='one'){
  if(activeOne!=null){const t=tables[activeOne];if(!t.ticket&&t.readyAt>0&&t.readyAt<=now&&now-lastDispatch>=ORDER_INTERVAL)showTicket(t,now);return;}
  if(now-lastDispatch<ORDER_INTERVAL&&started)return;
  let picks=tables.filter(t=>t.readyAt===0||t.readyAt<=now);
  if(!picks.length)return;
  // Prefer a different table for each new service cycle.
  const other=picks.filter(t=>t.id!==lastTable);if(other.length)picks=other;
  const table=choice(picks);newCounts(table);table.readyAt=now;showTicket(table,now);return;
 }
 // All Tables: at most one ticket enters the board per 10 seconds.
 if(started&&now-lastDispatch<ORDER_INTERVAL)return;
 let picks=eligible(now);
 if(!picks.length){picks=tables.filter(t=>!t.ticket&&t.readyAt===0);
  if(!picks.length)return;
  let others=picks.filter(t=>t.id!==lastTable);if(others.length)picks=others;
  const table=choice(picks);newCounts(table);table.readyAt=now;picks=[table];
 }
 let others=picks.filter(t=>t.id!==lastTable);if(others.length)picks=others;
 showTicket(choice(picks),now);
}
function complete(id){if(stopped)return;const table=tables[id];if(!table||!table.ticket)return;
 if(mode==='one'&&activeOne!==id)return;
 const type=table.ticket.type;table.ticket=null;const now=Date.now();
 if(type==='drinks'){totals.glasses+=table.drinks;totals.drinksTables++;}
 if(type==='plates'){totals.plates+=table.plates;totals.foodTables++;}
 if(type==='clear')totals.cleared++;
 if(type==='clean')totals.cleaned++;
 table.stage++;
 if(table.stage>=LEVELS[level].length){totals.orders++;table.completed++;table.stage=0;table.readyAt=0;
  // In one-table mode, release the view only after its full sequence is finished.
  if(mode==='one')activeOne=null;
 }else{table.readyAt=now+(mode==='one'?SINGLE_FOLLOW_UP_DELAY:FOLLOW_UP_DELAY);}
 renderBoard();}
function updateTicketAge(table,now){if(!table.ticket)return;const ui=renderedTicket.get(table.id);if(!ui||ui.ticket!==table.ticket)return;
 const elapsed=now-table.ticket.at;ui.time.textContent=stamp(elapsed);const cls=elapsed>=60000?'overdue':elapsed>=40000?'red':elapsed>=20000?'amber':'';
 const target='statusbar'+(cls?' '+cls:'');if(ui.bar.className!==target)ui.bar.className=target;}
function tick(){if(stopped)return;const now=Date.now();clock.textContent=stamp(now-sessionStart);tables.forEach(t=>updateTicketAge(t,now));}
function stop(){if(stopped)return;stopped=true;elapsedAtStop=Date.now()-sessionStart;clearInterval(clockHandle);clearInterval(dispatcher);
 const statItems=[['TIME',stamp(elapsedAtStop)]];
 if(LEVELS[level].includes('drinks'))statItems.push(['GLASSES',totals.glasses],['DRINKS TABLES',totals.drinksTables]);
 if(LEVELS[level].includes('plates'))statItems.push(['PLATES',totals.plates],['FOOD TABLES',totals.foodTables]);
 statItems.push(['TABLES CLEARED',totals.cleared]);if(LEVELS[level].includes('clean'))statItems.push(['TABLES CLEANED',totals.cleaned]);
 statItems.push(['FULL ORDERS FINISHED',totals.orders]);
 const target=document.getElementById('resultDetail');target.replaceChildren();
 for(const [label,value] of statItems){const div=document.createElement('div');div.className='stat';const n=document.createElement('strong');n.textContent=value;const l=document.createElement('span');l.textContent=label;div.append(n,l);target.appendChild(div);}
 summary.hidden=false;
}
function changeMode(newMode){if(mode===newMode)return;
 if(!stopped&&started&&!confirm('Change table view? This will start a NEW session and reset the current totals.'))return;
 mode=newMode;reset();}
oneBtn.addEventListener('click',()=>changeMode('one'));
allBtn.addEventListener('click',()=>changeMode('all'));
levelSelect.addEventListener('change',()=>{if(!stopped&&started&&!confirm('Change level? This will start a NEW session and reset the current totals.')){levelSelect.value=String(level);return;}reset();});
document.getElementById('stopBtn').addEventListener('click',stop);
document.getElementById('restartBtn').addEventListener('click',reset);
reset();
