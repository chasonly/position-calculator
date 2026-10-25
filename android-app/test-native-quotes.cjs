const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const manager='D:/Softwares/MuMu Player 12/nx_main/MuMuManager.exe';
const shell=cmd=>execFileSync(manager,['sh','-v','1','-c',cmd],{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024}).trim();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  if(process.argv.includes('--select')){
    // Candidate location is inspected from native-search.png before invoking this branch.
    shell('input tap 460 1540');await pause(6500);
  }else{
    shell('am force-stop com.columbus.positioncalculator');shell('am start -W -n com.columbus.positioncalculator/.MainActivity');await pause(1200);
    shell('input tap 450 2200');shell('input keyevent 123');shell('input keyevent 67 67 67 67 67 67 67 67 67 67 67 67');shell('input text PAYH');await pause(6500);shell('input keyevent 4');await pause(300);
  }
  shell('screencap -p /sdcard/position-quotes.png');
  fs.writeFileSync(path.join(__dirname,'test-results',process.argv.includes('--select')?'native-quote.png':'native-search.png'),Buffer.from(shell('base64 /sdcard/position-quotes.png').replace(/\s/g,''),'base64'));
  console.log('Native quote screenshot saved for visual inspection.');
  console.log(shell('logcat -d -t 100 -s PositionQuote'));
})().catch(e=>{console.error(e);process.exitCode=1;});
