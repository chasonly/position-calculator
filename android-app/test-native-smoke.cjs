const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const manager='D:/Softwares/MuMu Player 12/nx_main/MuMuManager.exe';
function run(args){return execFileSync(manager,args,{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024}).trim();}
function shell(cmd){return run(['sh','-v','1','-c',cmd]);}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const pkg='com.columbus.positioncalculator';
  const manifest=fs.readFileSync(path.join(__dirname,'app','src','main','AndroidManifest.xml'),'utf8');
  const version=manifest.match(/android:versionName="([^"]+)"/)[1];
  const versionCode=manifest.match(/android:versionCode="([^"]+)"/)[1];
  const apk=path.join(__dirname,'dist',`position-calculator-${version}-release.apk`);
  console.log(run(['control','-v','1','app','install','-apk',apk]));
  for(let i=0;i<30;i++) {if(shell('dumpsys package '+pkg).includes('versionName='+version))break;await pause(500);}
  assert.match(shell('pm path '+pkg),/package:/);
  const installed=shell('dumpsys package '+pkg);
  assert.ok(installed.includes('versionName='+version),'Expected updated installed version');
  assert.ok(installed.includes('versionCode='+versionCode+' '),'Expected updated version code');
  shell('am force-stop '+pkg);
  console.log(shell('am start -W -n '+pkg+'/.MainActivity'));
  await pause(1500);
  assert.ok(shell('pidof '+pkg));
  shell('uiautomator dump /sdcard/position-calculator-window.xml');
  const xml=shell('cat /sdcard/position-calculator-window.xml');
  const results=path.join(__dirname,'test-results');fs.mkdirSync(results,{recursive:true});
  fs.writeFileSync(path.join(results,'release-ui.xml'),xml);
  shell('screencap -p /sdcard/position-calculator-screen.png');
  const encoded=shell('base64 /sdcard/position-calculator-screen.png').replace(/\s/g,'');
  const screenshot=Buffer.from(encoded,'base64');assert.equal(screenshot.readUInt32BE(0),0x89504e47);
  fs.writeFileSync(path.join(results,'release-screen.png'),screenshot);
  shell('am force-stop '+pkg);
  shell('am start -W -n '+pkg+'/.MainActivity');
  await pause(1200);
  shell('screencap -p /sdcard/position-calculator-restored.png');
  const restored=Buffer.from(shell('base64 /sdcard/position-calculator-restored.png').replace(/\s/g,''),'base64');
  assert.equal(restored.readUInt32BE(0),0x89504e47);
  fs.writeFileSync(path.join(results,'release-restored.png'),restored);
  const packageInfo=shell('dumpsys package '+pkg);
  assert.doesNotMatch(packageInfo,/pkgFlags=\[[^\]]*DEBUGGABLE/);
  const result=`PASS v${version}: signed release installed and launched on Android 15; installed version code/name verified; process restart exercised; no DEBUGGABLE application flag. release-screen.png and release-restored.png require visual review. This smoke test does not exercise edits, the native share chooser or CSV save dialog.`;
  fs.writeFileSync(path.join(results,'native-results.txt'),result+'\n');console.log(result);
})().catch(error=>{console.error(error);process.exitCode=1;});
