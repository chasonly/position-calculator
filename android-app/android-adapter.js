// Inserted into the calculator closure at build time; the standalone HTML stays unchanged.
document.querySelector('.topbar .tag').remove();
document.querySelectorAll('[data-share]').forEach(button => button.textContent = '分享计算结果');
const originalSnapshot=snapshot;
snapshot=()=>({...originalSnapshot(),marginPreferences:{...marginPreferences},uiDetails:[...document.querySelectorAll('details[id]')].filter(el=>el.open).map(el=>el.id)});
window.saveAndroidState = () => {
  try { AndroidApp.saveState(JSON.stringify(snapshot())); } catch (_) {}
};
const savedState = AndroidApp.getInitialState();
try {
  const saved=JSON.parse(savedState||'null');
  if(saved?.marginPreferences&&typeof saved.marginPreferences==='object'){
    Object.entries(saved.marginPreferences).forEach(([key,value])=>{
      if(/^(SHFE|DCE|CZCE|INE|CFFEX|GFEX):[A-Z]{1,3}$/.test(key)&&typeof value==='number'&&value>0&&value<=100)marginPreferences[key]=value;
    });
  }
} catch (_) {}
const originalLoadLink=loadLink;
loadLink=()=>{
  originalLoadLink();
  try {
    const saved=JSON.parse(decodeURIComponent(location.hash.slice(7)));
    if(Array.isArray(saved.uiDetails))document.querySelectorAll('details[id]').forEach(el=>el.open=saved.uiDetails.includes(el.id));
  } catch (_) {}
  window.saveAndroidState();
};
if (savedState) location.hash = 'state=' + encodeURIComponent(savedState);
['input','change','click'].forEach(eventName => document.addEventListener(eventName, () => {
  setTimeout(window.saveAndroidState,0);
}));
document.addEventListener('visibilitychange',window.saveAndroidState);
window.addEventListener('pagehide',window.saveAndroidState);
const androidRequests=new Map();let androidRequestSequence=0;
window.receiveAndroidData=(id,text,error)=>{
  const pending=androidRequests.get(id);if(!pending)return;
  pending.finish(error?new Error(error):null,text);
};
function androidData(kind,key,signal) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
    const id='request-'+(++androidRequestSequence);
    const abort=()=>finish(new DOMException('Aborted','AbortError'));
    const timer=setTimeout(()=>finish(new Error('查询超时，请稍后重试。')),12000);
    const finish=(error,text)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);androidRequests.delete(id);error?reject(error):resolve(text);};
    androidRequests.set(id,{finish});signal?.addEventListener('abort',abort,{once:true});
    try{AndroidApp.requestData(id,kind,key);}catch(error){finish(error);}
  });
}
readQuoteResponse=async(url,signal)=>{
  const target=new URL(url);
  if(target.hostname==='qt.gtimg.cn')return androidData('stock',target.pathname.slice(3),signal);
  if(target.hostname==='futsse-static.eastmoney.com')return androidData('directory',target.searchParams.get('msgid'),signal);
  throw new Error('暂不支持此行情来源。');
};
readFuturesQuote=async(info,signal)=>{
  const text=await androidData('future',info.secid.replace('.','_'),signal);
  const match=text.match(/^\s*receive\(([\s\S]*)\);?\s*$/);
  if(!match)throw new Error('期货行情格式异常。');
  return JSON.parse(match[1]);
};
requestStockMatches=async(query,signal)=>{
  const key=query.toLowerCase(),cached=stockSearchCache.get(key);
  if(cached&&Date.now()-cached.time<300000)return cached.matches;
  const text=await androidData('search',key,signal);
  const quoted=text.match(/^\s*(?:var\s+)?v_hint\s*=\s*("(?:[^"\\]|\\.)*")\s*;?\s*$/);
  if(!quoted)throw new Error('股票检索格式异常。');
  const hint=JSON.parse(quoted[1]);
  if(hint.length>50000)throw new Error('股票检索数据异常。');
  const matches=[],seen=new Set(),numeric=/^\d{1,5}$/.test(key);
  for(const record of hint.split('^')){
    const [exchange,code,name,pinyin,kind]=record.split('~');
    if(!['sh','sz','bj'].includes(exchange)||!name||name.length>80||!(kind==='GP-A'||/(?:ETF|LOF)/.test(kind||'')))continue;
    try{
      const info=normalizeQuoteCode(exchange+code,'stock');
      if((numeric&&!info.code.includes(key))||seen.has(info.symbol))continue;
      seen.add(info.symbol);matches.push({code:info.code,name,exchange:info.exchange,pinyin});
    }catch{continue;}
    if(matches.length===10)break;
  }
  if(stockSearchCache.size>=100)stockSearchCache.delete(stockSearchCache.keys().next().value);
  stockSearchCache.set(key,{matches,time:Date.now()});return matches;
};
share = async function () {
  const panel = $(market + '-panel');
  const currentError = panel.querySelector('.error:not(:empty)');
  const resultId = market === 'stock' ? 's-actual' : 'f-lots';
  if ($(resultId).textContent === '—') {
    toast('请先补全有效参数，再分享计算结果。');
    return;
  }
  const lines = ['仓位计算器 · ' + (market === 'stock' ? 'A 股股票' : '期货合约'),'先控风险，再谈盈利。',''];
  if (market === 'stock') {
    lines.push('开仓计划时间：' + $('s-open-time').value.replace('T',' '),'账户资金：' + $('s-balance').value + ' 元','账户总风险比例（设定）：' + percent(number($('s-risk'))),'最小交易单位：' + $('s-lot').value + ' 股','分配方式：按账户风险预算均分止损风险，股数向下取整；买入资金不足时等比例缩减。');
    lines.push('实际买入金额：' + $('s-actual').textContent + ' 元');
    for (const position of stockPositions) {
      const row = position.row;
      lines.push('',row.querySelector('.stock-name').value || '未命名股票',
        '买入价 ' + row.querySelector('.buy-price').value + ' / 止损价 ' + row.querySelector('.stop-price').value,
        '可买 ' + fmt(position.shares,0) + ' ' + stockQuantityUnit(row) + ' / 买入金额 ' + money(position.actual) + ' / 资金占比 ' + percent(position.actual/number($('s-balance'))*100) + ' / 预计止损亏损 ' + money(position.loss) + ' / 止损风险 ' + percent(position.accountRisk));
    }
  } else {
    lines.push('账户权益：' + $('f-equity').value + ' 元','单笔风险比例：' + percent(number($('f-risk'))),'开仓价：' + $('f-entry').value,'止损价：' + $('f-stop').value,'合约乘数：' + $('f-multiplier').value,'保证金率：' + percent(number($('f-margin'))),'建议开仓：' + $('f-lots').textContent + ' 手');
  }
  lines.push('');
  panel.querySelectorAll('.metric').forEach(row => lines.push(row.querySelector('span').textContent + '：' + row.querySelector('strong').textContent));
  if (currentError) lines.push('',currentError.textContent);
  lines.push('','按输入止损价估算，不含手续费、滑点及跳空影响。');
  AndroidApp.shareText(lines.join('\n'));
};
// The original click listeners captured the browser share function; replace them explicitly.
document.querySelectorAll('[data-share]').forEach(button => {
  const nativeButton = button.cloneNode(true);
  button.replaceWith(nativeButton);
  nativeButton.addEventListener('click',share);
});
