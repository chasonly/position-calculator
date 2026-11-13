const {chromium}=require('C:/Users/Columbus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),url=pathToFileURL(path.join(root,'股票与期货仓位计算器.html')).href;
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Columbus/AppData/Local/ms-playwright/chromium_headless_shell-1148/chrome-win/headless_shell.exe'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copiedLink=text}}));
    await page.goto(url);assert.equal(await page.locator('#s-risk').inputValue(),'2');
    assert.equal(await page.locator('#s-allocation').count(),0);
    const fill=async(index,buy,stop)=>{await page.locator('.buy-price').nth(index).fill(String(buy));await page.locator('.stop-price').nth(index).fill(String(stop));};
    const shares=()=>page.locator('.buy-quantity strong').allTextContents();
    await page.locator('#s-balance').fill('100000');await fill(0,10,9);await fill(1,20,18);
    assert.deepEqual(await shares(),['1,000','500']);
    assert.equal(await page.locator('#s-planned').textContent(),'2,000.00 元');
    assert.equal(await page.locator('#s-loss').textContent(),'2,000.00 元');
    assert.equal(await page.locator('#s-position-percent').textContent(),'20.00%');
    assert.equal(await page.locator('#s-risk-total').textContent(),'2.00%');
    assert.match(await page.locator('.buy-loss').first().textContent(),/资金占比 10.00%/);
    assert.equal(await page.locator('#stock-buy-grid .buy-item').count(),2,'blank cards do not dilute risk');
    await page.locator('.stop-price').nth(1).fill('19');
    assert.deepEqual(await shares(),['1,000','1,000']);assert.equal(await page.locator('#s-position-percent').textContent(),'30.00%');
    await page.locator('#s-risk').fill('1');
    assert.deepEqual(await shares(),['500','500']);assert.equal(await page.locator('#s-position-percent').textContent(),'15.00%');
    await page.locator('#s-risk').fill('2');
    const downloadPromise=page.waitForEvent('download');await page.locator('#stock-export').click();const download=await downloadPromise;
    const exportPath=path.join(__dirname,'results','stock-risk-export.csv');await download.saveAs(exportPath);
    const csv=fs.readFileSync(exportPath,'utf8');assert.match(csv,/账户总风险比例（设定）/);assert.match(csv,/买入资金比例/);assert.doesNotMatch(csv,/计划买入资金比例/);
    await page.locator('#stock-panel [data-share]').click();const link=await page.evaluate(()=>window.copiedLink);
    const state=JSON.parse(decodeURIComponent(new URL(link).hash.slice(7)));assert.equal(state.version,6);assert.equal(state.stock.risk,'2');
    await page.goto('about:blank');await page.goto(link);assert.deepEqual(await shares(),['1,000','1,000']);
    await fill(0,10,9.99);await fill(1,20,19.98);
    assert.equal(await page.locator('#s-position-percent').textContent(),'100.00%');
    assert.equal(await page.locator('#s-risk-total').textContent(),'0.10%');assert.match(await page.locator('#stock-buy-warning').textContent(),/已等比例缩减/);
    assert.ok(Number((await page.locator('#s-actual').textContent()).replaceAll(',',''))<=100000);
    await fill(0,10,7);await fill(1,9,6);await fill(2,8,5);
    assert.deepEqual(await shares(),['200','200','200']);assert.equal(await page.locator('#s-risk-total').textContent(),'1.80%');
    await page.locator('#s-risk').fill('0');assert.deepEqual(await shares(),['0','0','0']);assert.equal(await page.locator('#s-loss').textContent(),'0.00 元');
    await page.locator('#s-risk').fill('101');assert.match(await page.locator('#stock-error').textContent(),/账户总风险比例/);
    await page.locator('#s-risk').fill('2');await page.locator('.price-clear').first().click();assert.equal(await page.locator('.stop-price').first().inputValue(),'0');
    assert.equal(await page.locator('.stock-editor.invalid').count(),0);
    await page.locator('.stop-price').first().fill('11');assert.equal(await page.locator('#s-actual').textContent(),'—');
    await page.locator('#stock-reset').click();assert.equal(await page.locator('#s-risk').inputValue(),'2');
    const legacy={...state,version:5,stock:{...state.stock,allocation:'75'}};delete legacy.stock.risk;
    await page.goto(url+'#state='+encodeURIComponent(JSON.stringify(legacy)));
    assert.equal(await page.locator('#s-risk').inputValue(),'2');assert.match(await page.locator('#toast').textContent(),/默认设为 2%/);
    for(const width of [360,390,430,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
    await page.setViewportSize({width:390,height:844});
    await page.locator('#toast').evaluate(el=>el.hidden=true);
    await page.locator('#s-balance').fill('1000000');await fill(0,2.656,2.5);await fill(1,11.2,7.05);
    assert.deepEqual(await shares(),['64,100','2,400']);
    assert.match(await page.locator('.buy-loss').first().textContent(),/止损风险 1.00%/);
    const checkQuantityLayout=async()=>{
      const layouts=await page.locator('.buy-quantity').evaluateAll(items=>items.map(item=>{
        const value=item.querySelector('strong'),unit=item.querySelector('span'),range=document.createRange();range.selectNodeContents(value);
        return {lines:range.getClientRects().length,inside:value.getBoundingClientRect().right<=unit.getBoundingClientRect().left,overflow:item.scrollWidth>item.clientWidth+1};
      }));
      for(const layout of layouts){assert.equal(layout.lines,1,'quantity stays on one line');assert.equal(layout.inside,true,'quantity does not overlap the unit');assert.equal(layout.overflow,false,'quantity fits the card');}
    };
    for(const width of [320,360,390,430,1280]){await page.setViewportSize({width,height:844});await page.waitForTimeout(80);await checkQuantityLayout();}
    await page.locator('#s-balance').fill('1000000000000');await checkQuantityLayout();
    await page.locator('#s-balance').fill('1000000');await page.setViewportSize({width:390,height:844});
    await page.locator('#futures-tab').click();await page.locator('#stock-tab').click();await checkQuantityLayout();
    await page.locator('#stock-buy-results').screenshot({path:path.join(root,'手机布局预览','股票-账户风险预算.png')});
    await page.locator('#stock-panel .card').first().screenshot({path:path.join(root,'手机布局预览','股票-风险输入.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS stock risk budget: default 2%, equal stop losses, stop-driven cash/share output, cash cap, rounding, zero/invalid inputs, CSV, schema 6 roundtrip, legacy migration and responsive layout.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
