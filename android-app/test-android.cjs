// Tests this app only, using the already installed local MuMu emulator.
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const adb = 'D:/Softwares/MuMu Player 12/nx_main/adb.exe';
const device = '127.0.0.1:16416';
const pkg = 'com.columbus.positioncalculator';
const artifacts = path.join(__dirname,'test-results');
fs.mkdirSync(artifacts,{recursive:true});
function command(args) { return execFileSync(adb,['-s',device,...args],{encoding:'utf8',timeout:30000}).trim(); }
const pause = ms => new Promise(r=>setTimeout(r,ms));
let socket, nextId=0;
const pending = new Map();
async function connect() {
  const pid = command(['shell','pidof',pkg]);
  assert.ok(pid,'App process missing');
  command(['forward','tcp:9223','localabstract:webview_devtools_remote_'+pid]);
  let targets=[];
  for(let i=0;i<30;i++) {
    try { targets=await (await fetch('http://127.0.0.1:9223/json')).json(); if(targets.length) break; } catch {}
    await pause(300);
  }
  assert.ok(targets[0]?.webSocketDebuggerUrl,'No WebView inspection endpoint');
  socket = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id&&pending.has(message.id)) { const cb=pending.get(message.id);pending.delete(message.id);message.error?cb.reject(new Error(JSON.stringify(message.error))):cb.resolve(message.result); }
  });
}
function cdp(method,params={}) {
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},10000);
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
    socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression) {
  const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function ready() {
  for(let i=0;i<30;i++) { if(await evaluate("document.getElementById('s-actual')?.textContent !== '—' && !!document.getElementById('s-actual')")) return; await pause(200); }
  throw Error('Calculator did not initialize');
}
async function screenshot(name) {
  const image=await cdp('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(artifacts,name+'.png'),Buffer.from(image.data,'base64'));
}
(async()=>{
  console.log(execFileSync(adb,['connect',device],{encoding:'utf8'}).trim());
  console.log(command(['install','-r',path.join(__dirname,'dist','position-calculator-1.0.0-debug.apk')]));
  console.log(command(['shell','am','start','-W','-n',pkg+'/.MainActivity']));
  await connect();await ready();
  await evaluate("document.getElementById('stock-reset').click();document.getElementById('futures-reset').click();document.getElementById('stock-tab').click()");
  assert.equal(await evaluate("document.querySelector('h1').textContent"),'先控风险，再谈盈利。');
  assert.equal(await evaluate("document.getElementById('s-actual').textContent"),'996.00');
  assert.equal(await evaluate("document.querySelector('[data-share]').textContent"),'分享计算结果');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await screenshot('android-stock');
  await evaluate("document.getElementById('futures-tab').click()");
  assert.equal(await evaluate("document.getElementById('f-lots').textContent"),'71');
  assert.equal(await evaluate("document.getElementById('f-margin-used').textContent"),'372,750.00 元');
  await evaluate("document.querySelector('[data-risk=\"1\"]').click()");
  assert.equal(await evaluate("document.getElementById('f-lots').textContent"),'142');
  await evaluate("document.getElementById('f-risk').value='100';document.getElementById('f-risk').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.getElementById('f-lots').textContent"),'952');
  await evaluate("document.getElementById('futures-reset').click();document.getElementById('f-equity').value='700000';document.getElementById('f-equity').dispatchEvent(new Event('input',{bubbles:true}));window.saveAndroidState()");
  await pause(300);
  socket.close();command(['shell','am','force-stop',pkg]);
  command(['shell','am','start','-W','-n',pkg+'/.MainActivity']);
  await connect();await ready();
  assert.equal(await evaluate("document.getElementById('f-equity').value"),'700000');
  assert.equal(await evaluate("document.getElementById('futures-tab').getAttribute('aria-selected')"),'true');
  await evaluate("document.getElementById('futures-reset').click()");
  await screenshot('android-futures');
  await evaluate("document.querySelector('#futures-panel [data-share]').click()");
  await pause(700);
  const activity=command(['shell','dumpsys','activity','activities']);
  assert.match(activity,/ChooserActivity/,'System share chooser did not open');
  command(['shell','input','keyevent','4']);
  await evaluate("document.getElementById('stock-tab').click();window.saveAndroidState()");
  await pause(300);socket.close();
  // Replace the inspected test build with the exact signed release deliverable.
  console.log(command(['install','-r',path.join(__dirname,'dist','position-calculator-1.0.0-release.apk')]));
  console.log(command(['shell','am','start','-W','-n',pkg+'/.MainActivity']));
  await pause(1200);
  assert.ok(command(['shell','pidof',pkg]));
  const packageInfo=command(['shell','dumpsys','package',pkg]);
  assert.doesNotMatch(packageInfo,/pkgFlags=\[[^\]]*DEBUGGABLE/);
  command(['shell','uiautomator','dump','/sdcard/position-calculator-window.xml']);
  const xml=command(['shell','cat','/sdcard/position-calculator-window.xml']);
  assert.ok(xml.includes('先控风险，再谈盈利。'),'Release app content not visible');
  fs.writeFileSync(path.join(artifacts,'release-ui.xml'),xml);
  fs.writeFileSync(path.join(artifacts,'release-screen.png'),execFileSync(adb,['-s',device,'exec-out','screencap','-p']));
  command(['forward','--remove','tcp:9223']);
  const result='PASS: Android 15 install/start, offline page, stock/futures calculations, risk presets, margin limits, native share chooser, process-restart persistence, release upgrade, release non-debuggable, release content visible.';
  fs.writeFileSync(path.join(artifacts,'results.txt'),result+'\n');console.log(result);
})().catch(error=>{console.error(error);process.exitCode=1;if(socket)socket.close();});
