const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const manager='D:/Softwares/MuMu Player 12/nx_main/MuMuManager.exe';
const pkg='com.columbus.positioncalculator',output=path.join(__dirname,'test-results');
const run=args=>execFileSync(manager,args,{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024}).trim();
const shell=cmd=>run(['sh','-v','1','-c',cmd]);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function screenshot(name){shell('screencap -p /sdcard/position-memory.png');const data=Buffer.from(shell('base64 /sdcard/position-memory.png').replace(/\s/g,''),'base64');assert.equal(data.readUInt32BE(0),0x89504e47);fs.writeFileSync(path.join(output,name+'.png'),data);}
(async()=>{
  shell('am force-stop '+pkg);shell('am start -W -n '+pkg+'/.MainActivity');await pause(1200);
  // Coordinates follow the inspected 1440x2560 emulator screen, on the account balance input.
  shell('input tap 420 1300');await pause(250);
  shell('input keyevent 123');shell('input keyevent 67 67 67 67 67 67 67 67 67 67 67 67');shell('input text 234567');
  shell('input keyevent 4');await pause(700);screenshot('memory-edited');
  shell('am force-stop '+pkg);shell('am start -W -n '+pkg+'/.MainActivity');await pause(1200);screenshot('memory-restarted');
  console.log('Created native memory-edited.png and memory-restarted.png; compare the edited account balance after force-stop/restart.');
})().catch(e=>{console.error(e);process.exitCode=1;});
