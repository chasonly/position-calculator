const {chromium}=require('C:/Users/Columbus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const build=fs.readdirSync(path.join(__dirname,'build')).filter(x=>x.startsWith('release-')).sort().at(-1);
  const url=pathToFileURL(path.join(__dirname,'build',build,'assets','index.html')).href;
  const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Columbus/AppData/Local/ms-playwright/chromium_headless_shell-1148/chrome-win/headless_shell.exe'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.AndroidApp={
        getInitialState:()=>localStorage.getItem('mock-native-state')||'',
        saveState:value=>{localStorage.setItem('mock-native-state',value);},
        shareText:text=>window.nativeShare=text,exportCsv:(csv,name)=>window.nativeCsv={csv,name},
        requestData:(id,kind,key)=>setTimeout(()=>{
          let text;
          if(kind==='search')text='v_hint="sz~000001~平安银行~payh~GP-A^sh~000001~上证指数~szzs~ZS";';
          if(kind==='stock'){
            const fields=Array(32).fill('');fields[1]='平安银行';fields[2]=key.slice(2);fields[3]='11.2';fields[30]='20261023150000';text='v_'+key+'="'+fields.join('~')+'";';
          }
          if(kind==='directory')text=key.endsWith('_info')?JSON.stringify({vcode:'RB',jydw:'10吨/手',bjdw:'元/吨',zcjybzj:'合约价值的5%'}):JSON.stringify([{code:'rb2701',mktid:113,name:'螺纹钢2701'}]);
          if(kind==='future')text='receive('+JSON.stringify({qt:{p:3042,dm:'rb2701',sc:113,name:'螺纹钢2701',zsjd:0,utime:1792740522}})+');';
          window.receiveAndroidData(id,text,null);
        },20)
      };
    });
    await page.goto(url);const row=page.locator('.stock-editor').first();
    assert.equal(await page.locator('.stock-editor').count(),3);
    await row.locator('.stock-code').fill('payh');await row.locator('.stock-option').first().click();
    await page.waitForFunction(()=>document.querySelector('.buy-price').value==='11.2');
    assert.equal(await row.locator('.stock-title').textContent(),'平安银行');assert.equal(await row.locator('.stop-price').inputValue(),'8.96');
    assert.equal(await page.locator('iframe').count(),0,'Android transport never executes provider scripts');
    await row.locator('.buy-price').fill('12');await row.locator('.stop-price').fill('9');await row.locator('.price-refresh').click();
    await page.waitForFunction(()=>document.querySelector('.buy-price').value==='11.2');assert.equal(await row.locator('.stop-price').inputValue(),'9');
    await page.locator('#s-balance').fill('200000');await page.locator('#s-allocation').fill('35');await page.locator('.remove').last().click();
    await page.locator('#stock-settings').evaluate(el=>el.open=true);await page.locator('#s-lot').selectOption('1');
    await page.locator('#stock-panel [data-share]').click();assert.match(await page.evaluate(()=>window.nativeShare),/平安银行/);
    await page.locator('#stock-export').click();assert.match(await page.evaluate(()=>window.nativeCsv.csv),/000001/);
    await page.locator('#futures-tab').click();await page.locator('#f-code').fill('rb27');await page.locator('#f-quote-box .stock-option').first().click();
    await page.waitForFunction(()=>document.getElementById('f-entry').value==='3042');
    assert.equal(await page.locator('#f-multiplier').inputValue(),'10');assert.equal(await page.locator('#f-margin').inputValue(),'5');
    await page.locator('[data-side=short]').click();await page.locator('#f-stop').fill('3600');await page.locator('#f-margin').fill('17');await page.locator('#f-equity').fill('800000');
    await page.locator('#futures-panel [data-share]').click();assert.match(await page.evaluate(()=>window.nativeShare),/保证金率：17.00%/);
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mock-native-state')).futures.equity==='800000');
    const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('mock-native-state')));
    assert.equal(saved.rows.length,2);assert.equal(saved.market,'futures');assert.equal(saved.futuresAutoStop,false);assert.equal(saved.marginPreferences['SHFE:RB'],17);
    await page.reload();
    assert.equal(await page.locator('#futures-tab').getAttribute('aria-selected'),'true');
    for(const [id,value] of [['f-entry','3042'],['f-stop','3600'],['f-margin','17'],['f-equity','800000']])assert.equal(await page.locator('#'+id).inputValue(),value);
    assert.equal(await page.locator('[data-side=short]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.stock-editor').count(),2);
    await page.locator('#stock-tab').click();
    assert.equal(await page.locator('#s-balance').inputValue(),'200000');assert.equal(await page.locator('#s-allocation').inputValue(),'35');
    assert.equal(await row.locator('.stock-code').inputValue(),'000001');assert.equal(await row.locator('.stop-price').inputValue(),'9');assert.equal(await page.locator('#stock-settings').getAttribute('open'),'');
    await page.locator('#futures-tab').click();await page.locator('#f-price-refresh').click();
    await page.waitForFunction(()=>!document.getElementById('f-quote-box').hasAttribute('aria-busy'));assert.equal(await page.locator('#f-stop').inputValue(),'3600');
    await page.locator('#futures-reset').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mock-native-state')).futures.entry==='');
    await page.reload();assert.equal(await page.locator('#f-entry').inputValue(),'');assert.equal(await page.locator('#s-balance').inputValue(),'200000','reset remains independent');
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    fs.mkdirSync(path.join(__dirname,'test-results'),{recursive:true});
    const result='PASS v1.4.0: native-data adapter parses stock/pinyin/futures/metadata without script frames; edits, deletion, market, direction, manual stop, margin preferences and details survive reload; independent reset persists; share/CSV and mobile layout checked. Native bridge mocked in Chromium.';
    fs.writeFileSync(path.join(__dirname,'test-results','adapter-results.txt'),result+'\n');console.log(result);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
