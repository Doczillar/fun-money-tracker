// Run with: node tests/regression.cjs (Node 18+; no dependencies).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
new vm.Script(script);new vm.Script(sw);
const functions=[...script.matchAll(/^  function \w+\([^\n]*\) \{[\s\S]*?^  }/gm)].map(m=>m[0]).join('\n');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function env(){
 const elements=new Map(),disk={};
 function el(id){if(!elements.has(id)){const classes=new Set();elements.set(id,{value:'',style:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,on){on?classes.add(x):classes.delete(x)}},focus(){},addEventListener(t,fn){this[t]=fn}})}return elements.get(id)}
 const c={console,Date,Math,JSON,Number,String,Array,isFinite,isNaN,parseFloat,parseInt,STORAGE_KEY:'funMoneyApp',document:{getElementById:el},localStorage:{getItem:k=>disk[k]??null,setItem:(k,v)=>disk[k]=v},window:{},setTimeout(){}};
 vm.createContext(c);vm.runInContext(functions,c);
 Object.assign(c,{render(){},closeSettings(){},closeConfirm(){},closeSubEditor(){},closeEditModal(){},closeDeleteModal(){},renderSubsModal(){},closeSubsModal(){},state:{baseBudget:400,budget:400,monthKey:'2026-10',entries:[],history:[],subscriptions:[],transitionUndo:null}});
 c.subConfirmOverlay=el('subConfirmOverlay');c.startOfToday=()=>new Date(2026,9,30);return {c,disk,el};
}
function bind(c,id){let a=script.indexOf("  document.getElementById('"+id+"').addEventListener('click', function() {");let b=script.indexOf('\n  });',a)+7;assert(a>=0,id);vm.runInContext(script.slice(a,b),c)}
const sub=()=>({id:'s1',note:'Test',amount:50,day:31,startMonthKey:'2026-10',cadenceMonths:1,canceledAt:null,lastPostedKey:null,endMonthKey:null});
function close(c,el,carry=true){c.pendingRollOver=carry;c.pendingSourceMonthKey=c.state.monthKey;bind(c,'confirmOk');el('confirmOk').click()}
test('early close settles scheduled charges once and carries correct balance',()=>{
 const {c,el}=env();c.state.subscriptions=[sub()];assert.equal(c.postDueSubscriptions(),false);assert.equal(c.reservedThisPeriod(),50);
 close(c,el);assert.equal(c.state.history[0].entries.length,1);assert.equal(c.state.history[0].endBalance,350);assert.equal(c.computeRemaining(),750);assert.equal(c.state.subscriptions[0].lastPostedKey,'2026-10');
 assert.equal(c.postDueSubscriptions(),false);assert.equal(c.state.history[0].entries.length,1);
 c.undoMonthTransition();assert.equal(c.state.monthKey,'2026-10');assert.equal(c.state.entries.length,0);assert.equal(c.reservedThisPeriod(),50);
 close(c,el,false);assert.equal(c.computeRemaining(),400);assert.equal(c.state.history[0].endBalance,350);
});
test('closing respects cancellation, cadence, and deleted posted charges',()=>{
 const {c,el}=env();c.state.subscriptions=[sub(),{...sub(),id:'c',canceledAt:1},{...sub(),id:'n',startMonthKey:'2026-9',cadenceMonths:2},{...sub(),id:'p',lastPostedKey:'2026-10'}];
 close(c,el);assert.equal(c.state.history[0].entries.length,1);assert.equal(c.state.history[0].endBalance,350);
});
function withUndo(c){c.state.transitionUndo={startedMonthKey:c.state.monthKey,previous:{monthKey:'2026-9',budget:400,baseBudget:400,entries:[],history:[],subscriptions:[]}}}
test('cancel and delete subscriptions disable destructive month undo',()=>{
 for(const action of ['cancel','delete']){const {c,el}=env();c.state.subscriptions=[sub()];withUndo(c);assert(c.canUndoTransition());c.pendingSubActionId='s1';c.pendingSubAction=action;bind(c,'subConfirmOk');el('subConfirmOk').click();assert.equal(c.canUndoTransition(),false)}
});
test('saving new or edited subscription disables destructive month undo',()=>{
 for(const editing of [false,true]){const {c,el}=env();c.state.subscriptions=editing?[sub()]:[];withUndo(c);Object.assign(c,{editingSubId:editing?'s1':null,pendingCadence:'monthly',pendingDuration:'indefinite'});el('subNote').value='New';el('subAmount').value='25';el('subDay').value='31';c.saveSubscription();assert.equal(c.canUndoTransition(),false);assert.equal(c.state.subscriptions[0].amount,25)}
});
test('transaction edits and deletes disable destructive month undo',()=>{
 for(const id of ['editSave','deleteConfirm']){const {c,el}=env();c.state.entries=[{id:'e',amount:50,note:'Test',kind:'subscription',subId:'s1',type:'spent',ts:new Date(2026,9,1).getTime()}];withUndo(c);c.editingId='e';c.deletingId='e';c.selectedMerchants=()=>[];el('editDay').value='2';el('editAmount').value='20';bind(c,id);el(id).click();assert.equal(c.canUndoTransition(),false)}
});
test('failed legacy restore preserves disk and in-memory data',()=>{
 const {c,disk}=env();c.save();const before=disk.funMoneyApp;let calls=0;c.render=()=>{if(++calls===1)throw Error('render failed')};
 assert(c.applyBackup(JSON.stringify({...c.state,budget:500})));assert.equal(disk.funMoneyApp,before);assert.equal(c.state.budget,400);assert.equal(c.state.entries.length,0);
});
test('successful legacy restore commits migrated balance',()=>{
 const {c,disk}=env();assert.equal(c.applyBackup(JSON.stringify({...c.state,budget:500})),null);assert.equal(c.computeRemaining(),500);assert.equal(JSON.parse(disk.funMoneyApp).entries[0].amount,100);
});
test('storage failure rolls back imported working state',()=>{
 const {c,disk}=env();c.save();const before=disk.funMoneyApp;c.localStorage.setItem=()=>{throw Error('quota')};c.console={error(){}};
 assert(c.applyBackup(JSON.stringify({...c.state,budget:500})));assert.equal(c.computeRemaining(),400);assert.equal(disk.funMoneyApp,before);
});
test('invalid existing JSON state triggers recovery without writes',()=>{
 for(const raw of ['','{}','null','[]','bad json']){const {c,disk}=env();disk.funMoneyApp=raw;assert.throws(()=>c.load());assert.equal(disk.funMoneyApp,raw)}
 const {c}=env();assert.equal(c.load(),null);
});
test('updates ignore closed dialog values and preserve active work',()=>{
 const {c,el}=env();let modal=false,focused=false,saveError=false;Object.assign(c,{selectedMerchants:()=>[],currentType:'spent',reloadStarted:false});c.document.visibilityState='visible';c.document.querySelector=s=>s==='.modal-overlay.show'?modal:s==='#saveErrorBanner.show'?saveError:focused;
 let a=script.indexOf('      function hasUnsavedInput()'),b=script.indexOf('      var updateRegistration',a);vm.runInContext(script.slice(a,b),c);
 el('budgetInput').value='400.00';assert.equal(c.canApplyUpdateNow(),true);modal=true;assert.equal(c.canApplyUpdateNow(),false);modal=false;el('noteInput').value='draft';assert.equal(c.canApplyUpdateNow(),false);el('noteInput').value='';focused=true;assert.equal(c.canApplyUpdateNow(),false);focused=false;saveError=true;assert.equal(c.canApplyUpdateNow(),false);
});
(async()=>{
 for(const status of [200,404,503]){
 let writes=0;const c={console,Request,Response,URL,Promise,setTimeout(){},self:{addEventListener(){},location:{origin:'https://example.com'}},fetch:async()=>({ok:status===200,status,type:'basic',clone:()=>new Response('network'),text:async()=>'network'}),caches:{open:async()=>({match:async()=>new Response('cached app'),put:async()=>writes++})}};
 vm.createContext(c);vm.runInContext(sw,c);const response=await c.networkFirstNavigation({request:new Request('https://example.com/index.html'),waitUntil(){}});
 assert.equal(response.status,200);assert.equal(await response.text(),status===200?'network':'cached app');assert.equal(writes,status===200?1:0);
 }
 console.log('PASS service worker uses cache for HTTP failures and network for success');passed++;
 console.log(passed+' regression groups passed; script syntax passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
