const {chromium}=require('C:/Users/Columbus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Columbus/AppData/Local/ms-playwright/chromium_headless_shell-1148/chrome-win/headless_shell.exe'});
  try {
    const page=await browser.newPage();
    if(process.argv.includes('--future-parameters')) {
      await page.goto(pathToFileURL(path.join(__dirname,'../股票与期货仓位计算器.html')).href);
      for(const msgid of ['220_4_info','220_6_info','220_8_info','113_5_info','113_6_info','225_4_info']) {
        console.log(JSON.stringify(await page.evaluate(async id=>{
          try {const r=await fetch('https://futsse-static.eastmoney.com/redis?msgid='+id,{signal:AbortSignal.timeout(12000)});return {id,status:r.status,data:await r.json()};}
          catch(e){return {id,error:e.message};}
        },msgid)));
      }
      return;
    }
    if(process.argv.includes('--touch-select')) {
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      const phone=await context.newPage();
      phone.on('console',m=>console.log('PHONE',m.text()));phone.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()));
      await phone.goto(pathToFileURL(path.join(__dirname,'../手机布局预览.html')).href);
      const row=phone.frameLocator('iframe').locator('.stock-editor').first();
      await row.locator('.stock-code').fill('payh');await row.locator('.stock-option').waitFor({timeout:18000});
      await row.evaluate(el=>{
        for(const type of ['pointerdown','pointerup','click','focusin','focusout','input'])el.addEventListener(type,event=>console.log(type,event.target.className));
        new MutationObserver(()=>console.log('STATUS',el.querySelector('.quote-status').textContent)).observe(el.querySelector('.quote-status'),{subtree:true,childList:true});
      });
      await row.locator('.stock-option').tap();await phone.waitForTimeout(3000);
      console.log('STATE',await row.evaluate(el=>({code:el.querySelector('.stock-code').value,price:el.querySelector('.buy-price').value,status:el.querySelector('.quote-status').textContent,busy:el.querySelector('.quote-box').getAttribute('aria-busy'),options:el.querySelectorAll('.stock-option').length})));
      await phone.screenshot({path:path.join(__dirname,'../手机布局预览/触屏诊断.png')});
      await context.close();return;
    }
    if(process.argv.includes('--future-directory')) {
      for(const market of ['113','114','115','142','220','225']) {
        const result=await page.evaluate(async id=>{
          try {
            const response=await fetch('https://futsse-static.eastmoney.com/redis?msgid='+id,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
            const data=JSON.parse(await response.text());
            return {id,status:response.status,count:data.length,sample:data.slice(0,8).map(x=>({code:x.code,vcode:x.vcode,vtype:x.vtype,name:x.name,mktid:x.mktid}))};
          }catch(e){return {id,error:e.message};}
        },market);
        console.log(JSON.stringify(result));
      }
      return;
    }
    if(process.argv.includes('--future-contracts')) {
      for(const id of ['113_7','114_4','115_4','142_1','220_2','225_2']) {
        const result=await page.evaluate(async msgid=>{
          try {
            const response=await fetch('https://futsse-static.eastmoney.com/redis?msgid='+msgid,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
            const data=JSON.parse(await response.text());
            return {msgid,status:response.status,count:data.length,sample:data.slice(0,15)};
          }catch(e){return {msgid,error:e.message};}
        },id);
        console.log(JSON.stringify(result));
      }
      return;
    }
    if(process.argv.includes('--provider')) {
      page.on('response',async response=>{
        if(/eastmoney\.com\/.*(?:qt|quote|redis|static\/|list\/|api\/)/.test(response.url())){
          const type=response.request().resourceType();
          if(['xhr','fetch','script'].includes(type))console.log('PROVIDER',response.status(),response.url());
        }
      });
      await page.goto('https://quote.eastmoney.com/qihuo/rb2701.html',{waitUntil:'domcontentloaded',timeout:25000});
      await page.waitForTimeout(4000);
      return;
    }
    page.on('console',message=>{if(message.type()==='error')console.log('BROWSER:',message.text());});
    page.on('response',async response=>{if(response.url().includes('push2.'))console.log('HEADERS',response.status(),await response.allHeaders());});
    await page.goto(pathToFileURL(path.join(__dirname,'../股票与期货仓位计算器.html')).href);
    if(process.argv.includes('--search')) {
      for(const query of ['payh','gzmt','bp500','513500','920002']) {
        console.log(JSON.stringify(await page.evaluate(async q=>{
          try {
            const response=await fetch('https://smartbox.gtimg.cn/s3/?q='+encodeURIComponent(q)+'&t=all',{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
            return {q,status:response.status,text:new TextDecoder('gbk').decode(await response.arrayBuffer())};
          }catch(e){return {q,error:e.message};}
        },query)));
      }
      return;
    }
    if(process.argv.includes('--search-json')) {
      for(const query of ['payh','gzmt','bp500','513500','920002']) {
        console.log(JSON.stringify(await page.evaluate(async q=>{
          try {
            const response=await fetch('https://searchapi.eastmoney.com/api/suggest/get?input='+encodeURIComponent(q)+'&type=14',{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
            return {q,status:response.status,text:await response.text()};
          }catch(e){return {q,error:e.message};}
        },query)));
      }
      return;
    }
    if(process.argv.includes('--search-script')) {
      for(const query of ['5135','135','0000','6005','001','payh','gzmt','bp500','pd','920002']) {
        const endpoint='https://smartbox.gtimg.cn/s3/?q='+encodeURIComponent(query)+'&t=all';
        const response=await page.request.get(endpoint,{timeout:12000});
        console.log('RAW',query,new TextDecoder('gbk').decode(await response.body()));
        const result=await page.evaluate(url=>new Promise(resolve=>{
          const frame=document.createElement('iframe');frame.hidden=true;frame.sandbox='allow-scripts';
          const timer=setTimeout(()=>{window.removeEventListener('message',handler);frame.remove();resolve({error:'timeout'});},12000);
          const handler=event=>{if(event.source===frame.contentWindow){window.removeEventListener('message',handler);clearTimeout(timer);frame.remove();resolve(event.data);}};
          window.addEventListener('message',handler);
          frame.srcdoc='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' https://smartbox.gtimg.cn/s3/; connect-src \'none\'; base-uri \'none\'; form-action \'none\'"><script src="'+url.replaceAll('&','&amp;')+'" charset="gbk" onload="parent.postMessage({hint:window.v_hint},\'*\')" onerror="parent.postMessage({error:\'load failed\'},\'*\')"><\/script>';
          document.body.appendChild(frame);
        }),endpoint);
        console.log('SANDBOX',query,JSON.stringify(result));
      }
      return;
    }
    if(process.argv.includes('--jsonp')) {
      const result=await page.evaluate(()=>new Promise(resolve=>{
        const frame=document.createElement('iframe');frame.hidden=true;frame.sandbox='allow-scripts';
        const timer=setTimeout(()=>{frame.remove();resolve({error:'timeout'});},12000);
        window.addEventListener('message',function handler(event){if(event.source===frame.contentWindow){window.removeEventListener('message',handler);clearTimeout(timer);frame.remove();resolve(event.data);}});
        frame.srcdoc='<script>function receive(value){parent.postMessage({value},"*");}<\/script><script src="https://futsseapi.eastmoney.com/static/113_rb2701_qt?callbackName=receive&amp;field=name,sc,dm,p,zsjd,utime&amp;token=1101ffec61617c99be287c1bec3085ff" onerror="parent.postMessage({error:\'load failed\'},\'*\')"><\/script>';
        document.body.appendChild(frame);
      }));
      console.log('JSONP',JSON.stringify(result));return;
    }
    const urls=process.argv.includes('--cors')?[
      'https://push2.eastmoney.com/api/qt/stock/get?secid=113.rb2701&fields=f43,f57,f58,f59,f86',
      'https://push2.eastmoney.com/api/qt/stock/get?secid=220.IF2611&fields=f43,f57,f58,f59,f86'
    ]:[
      'https://qt.gtimg.cn/q=sh600000,sz000001,bj920002',
      'https://push2.eastmoney.com/api/qt/stock/get?secid=113.rb2701&fields=f43,f57,f58,f59,f86',
      'https://push2.eastmoney.com/api/qt/stock/get?secid=220.IF2611&fields=f43,f57,f58,f59,f86',
      'https://push2.eastmoney.com/api/qt/stock/get?secid=115.SR701&fields=f43,f57,f58,f59,f86',
      'https://futsse-static.eastmoney.com/redis?msgid=115_4',
      ...['114','142','220','225'].map(x=>'https://futsse-static.eastmoney.com/redis?msgid='+x)
    ];
    const results=await page.evaluate(async urls=>Promise.all(urls.map(async url=>{
      try {
        const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(15000)});
        const body=new TextDecoder(url.includes('gtimg')?'gbk':'utf-8').decode(await response.arrayBuffer());
        let data=body;
        if(url.includes('redis'))data=JSON.parse(body).map(x=>({code:x.code,vcode:x.vcode,vtype:x.vtype,name:x.name,mktid:x.mktid}));
        return {url,status:response.status,data};
      } catch(e){return {url,error:e.message};}
    })),urls);
    for(const result of results)console.log(JSON.stringify(result));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
