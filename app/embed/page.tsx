export const dynamic = "force-dynamic";

import { kv } from "@vercel/kv";
import { fetchChartData } from "@/lib/notionData";

interface Props {
  searchParams: Promise<{
    id?: string;
    databaseId?: string;
    xField?: string;
    yField?: string;
    color?: string;
    debug?: string;
  }>;
}

const CSS = `
  :root { --bg: #191919; --grid: rgba(255,255,255,0.08); --label: #6b7280; }
  html[data-theme="light"] { --bg: #ffffff; --grid: rgba(0,0,0,0.1); --label: #9ca3af; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: var(--bg); transition: background 0.3s; }
  .wrap { height: 100vh; position: relative; overflow: hidden; background: var(--bg); transition: background 0.3s; }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .chart-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; animation: slideUp 0.5s cubic-bezier(0.22,1,0.36,1) both; }

  .lg-pill {
    display: flex; align-items: center; height: 38px; border-radius: 999px; padding: 3px;
    cursor: pointer; user-select: none; touch-action: none;
    background: rgba(120,120,128,0.28); backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.22);
    box-shadow: 0 4px 24px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.18) inset, 0 -1px 0 rgba(0,0,0,0.12) inset;
    transition: box-shadow 0.2s;
  }
  .lg-controls {
    position: absolute; top: 14px; left: 14px; display: flex; gap: 8px; align-items: center;
    opacity: 0; pointer-events: none; transition: opacity 0.25s;
  }
  .wrap:hover .lg-controls { opacity: 1; pointer-events: auto; }
  .lg-refresh {
    width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center;
    justify-content: center; cursor: pointer; border: 1px solid rgba(255,255,255,0.22);
    background: rgba(120,120,128,0.28); backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    box-shadow: 0 4px 24px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.18) inset;
    color: rgba(255,255,255,0.82); transition: box-shadow 0.2s; padding: 0; flex-shrink: 0;
  }
  html[data-theme="light"] .lg-refresh {
    background: rgba(255,255,255,0.45); border-color: rgba(255,255,255,0.55);
    color: rgba(0,0,0,0.58); box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset;
  }
  .lg-refresh:hover { box-shadow: 0 6px 30px rgba(0,0,0,0.34), 0 1px 0 rgba(255,255,255,0.22) inset; }
  .lg-refresh svg { display: block; }
  html[data-theme="light"] .lg-pill {
    background: rgba(255,255,255,0.45); border-color: rgba(255,255,255,0.55);
    box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset, 0 -1px 0 rgba(0,0,0,0.06) inset;
  }
  .lg-pill:hover { box-shadow: 0 6px 30px rgba(0,0,0,0.34), 0 1px 0 rgba(255,255,255,0.22) inset; }
  .lg-bubble {
    position: absolute; top: 3px; left: 3px; width: calc(50% - 3px); height: calc(100% - 6px);
    border-radius: 999px; pointer-events: none;
    background: rgba(255,255,255,0.38);
    box-shadow: 0 2px 8px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.7) inset;
    transition: transform 0.42s cubic-bezier(0.34,1.56,0.64,1);
  }
  html[data-theme="light"] .lg-bubble {
    background: rgba(255,255,255,0.72); box-shadow: 0 2px 10px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,1) inset;
  }
  html[data-theme="dark"]  .lg-bubble { transform: translateX(0); }
  html[data-theme="light"] .lg-bubble { transform: translateX(calc(100% + 0px)); }
  .lg-opt {
    position: relative; z-index: 1; width: 46px; height: 32px; display: flex;
    align-items: center; justify-content: center; border: none; background: none; padding: 0;
    cursor: pointer; border-radius: 999px; transition: opacity 0.2s;
    -webkit-tap-highlight-color: transparent; color: rgba(255,255,255,0.82);
  }
  html[data-theme="light"] .lg-opt { color: rgba(0,0,0,0.58); }
  .lg-opt:hover { opacity: 0.7; }
  .lg-opt svg { display: block; }
`;

const INIT_SCRIPT = `
(function(){
  var t = localStorage.getItem('nc_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();
`;

const TOGGLE_SCRIPT = `
(function(){
  var html=document.documentElement, bubble=document.querySelector('.lg-bubble'),
      pill=document.querySelector('.lg-pill'), sunBtn=document.getElementById('sunBtn'),
      moonBtn=document.getElementById('moonBtn');
  function setTheme(t){ html.setAttribute('data-theme',t); localStorage.setItem('nc_theme',t); }
  sunBtn.addEventListener('click', function(){ setTheme('light'); });
  moonBtn.addEventListener('click', function(){ setTheme('dark'); });
  var startX=0, startTheme='dark', dragging=false;
  function pStart(e){ dragging=true; startX=e.touches?e.touches[0].clientX:e.clientX; startTheme=html.getAttribute('data-theme')||'dark'; bubble.style.transition='none'; e.preventDefault(); }
  function pMove(e){ if(!dragging) return; var cx=e.touches?e.touches[0].clientX:e.clientX, dx=cx-startX, hw=pill.offsetWidth/2, base=startTheme==='light'?hw:0, pos=Math.max(0,Math.min(hw,base+dx)); bubble.style.transform='translateX('+pos+'px)'; }
  function pEnd(e){ if(!dragging) return; dragging=false; bubble.style.transition='transform 0.42s cubic-bezier(0.34,1.56,0.64,1)'; var cx=e.changedTouches?e.changedTouches[0].clientX:e.clientX, dx=cx-startX, thr=pill.offsetWidth*0.18, next=startTheme==='dark'?(dx>thr?'light':'dark'):(dx<-thr?'dark':'light'); setTheme(next); }
  pill.addEventListener('mousedown', pStart, {passive:false});
  pill.addEventListener('touchstart', pStart, {passive:false});
  document.addEventListener('mousemove', pMove);
  document.addEventListener('touchmove', pMove, {passive:false});
  document.addEventListener('mouseup', pEnd);
  document.addEventListener('touchend', pEnd);
  var refreshBtn=document.getElementById('refreshBtn');
  if(refreshBtn) refreshBtn.addEventListener('click', function(){
    var btn=this, svgEl=document.querySelector('.chart-svg');
    btn.style.background='rgba(120,120,128,0.55)';
    var svgIcon=btn.querySelector('svg');
    if(svgIcon){ svgIcon.style.transition='transform 0.5s cubic-bezier(0.4,0,0.2,1)'; svgIcon.style.transform='rotate(360deg)'; }
    if(svgEl){ svgEl.style.animation='none'; svgEl.style.transition='opacity 0.32s ease,transform 0.32s cubic-bezier(0.4,0,1,1)'; svgEl.style.opacity='0'; svgEl.style.transform='translateY(22px)'; }
    setTimeout(function(){ window.location.reload(); }, 400);
  });
})();
`;

// Client-side chart rendering — uses actual pixel dimensions so labels never scale
const CHART_SCRIPT = `
(function(){
  var D=window.__nc_d, C=window.__nc_c;
  if(!D||!C) return;
  var svg=document.querySelector('.chart-svg');
  if(!svg) return;

  function smartTicks(m){
    if(!m) return [0];
    var r=m/5, mag=Math.pow(10,Math.floor(Math.log10(r))), n=r/mag;
    var s=n<1.5?mag:n<3.5?2*mag:n<7.5?5*mag:10*mag, t=[];
    for(var v=0;t.length<=20;v=Math.round((v+s)*1e9)/1e9){ t.push(v); if(v>=m) break; }
    return t;
  }
  function fmt(v){ if(Number.isInteger(v)) return String(v); var r=Math.round(v*1000)/1000; return r%1===0?String(r):r.toFixed(r<0.1?3:r<1?2:1); }
  function lbl(s){ var d=new Date(s); if(isNaN(d.getTime())) return s; var mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return mo[d.getMonth()]+" '"+String(d.getFullYear()).slice(2); }
  function smooth(pts){
    if(!pts.length) return ''; if(pts.length===1) return 'M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1);
    if(pts.length===2) return 'M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1)+' L'+pts[1][0].toFixed(1)+','+pts[1][1].toFixed(1);
    var n=pts.length, d='M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1);
    for(var i=0;i<n-1;i++){
      var p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(n-1,i+2)];
      d+=' C'+((p1[0]+(p2[0]-p0[0])/6).toFixed(1))+','+((p1[1]+(p2[1]-p0[1])/6).toFixed(1))+' '+((p2[0]-(p3[0]-p1[0])/6).toFixed(1))+','+((p2[1]-(p3[1]-p1[1])/6).toFixed(1))+' '+p2[0].toFixed(1)+','+p2[1].toFixed(1);
    }
    return d;
  }
  function noData(W,H){ return '<text style="fill:var(--label)" x="'+(W/2)+'" y="'+(H/2)+'" text-anchor="middle" font-size="13">No data</text>'; }

  var F=11; // fixed label font-size in px — never scales with container

  function line(data,color,W,H){
    var s=data.slice().sort(function(a,b){return String(a.x)<String(b.x)?-1:String(a.x)>String(b.x)?1:0;});
    if(!s.length) return noData(W,H);
    var lp=56,rp=12,tp=14;
    var ls=s.map(function(d){return lbl(String(d.x));});
    var mll=Math.max.apply(null,ls.map(function(l){return l.length;}));
    var rot=mll*(F*0.6)>(W-lp-rp)/Math.max(s.length,1)-4;
    var bp=rot?Math.ceil(mll*F*0.6*0.707)+8:F+14;
    var iW=W-lp-rp, iH=H-tp-bp;
    if(iW<20||iH<20) return '';
    var ys=s.map(function(d){return +d.y;}), maxY=Math.max.apply(null,ys)||1;
    var ticks=smartTicks(maxY), yR=ticks[ticks.length-1]||1;
    var sx=function(i){return s.length>1?i/(s.length-1)*iW:iW/2;};
    var sy=function(v){return iH-(v/yR)*iH;};
    // Y axis
    var minG=F+4,lastY=9999,yg='',yl='';
    ticks.forEach(function(v){
      var y=sy(v); if(y<-2||y>iH+2) return;
      if(Math.abs(y-lastY)<minG&&v!==ticks[0]) return;
      lastY=y;
      yg+='<line x1="0" y1="'+y.toFixed(1)+'" x2="'+iW+'" y2="'+y.toFixed(1)+'" style="stroke:var(--grid)" stroke-width="1"/>';
      yl+='<text x="-6" y="'+(y+F*0.35).toFixed(1)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="end" font-family="ui-monospace,monospace">'+fmt(v)+'</text>';
    });
    // X axis
    var tgt=Math.max(2,Math.floor(iW/(F*5))), eff=Math.min(tgt,s.length);
    var stp=Math.max(1,Math.floor((s.length-1)/Math.max(1,eff-1)));
    var idx={};
    for(var k=0;k<eff;k++) idx[Math.min(k*stp,s.length-1)]=1;
    idx[s.length-1]=1;
    var idxs=Object.keys(idx).map(Number).sort(function(a,b){return a-b;});
    var xg='',xl='';
    idxs.forEach(function(i){
      var x=sx(i).toFixed(1);
      xg+='<line x1="'+x+'" y1="0" x2="'+x+'" y2="'+iH+'" style="stroke:var(--grid)" stroke-width="1"/>';
      if(rot) xl+='<text transform="translate('+x+','+(iH+F)+') rotate(-45)" style="fill:var(--label)" font-size="'+F+'" text-anchor="end" font-family="ui-monospace,monospace">'+ls[i]+'</text>';
      else xl+='<text x="'+x+'" y="'+(iH+F+4)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="middle" font-family="ui-monospace,monospace">'+ls[i]+'</text>';
    });
    var pts=s.map(function(d,i){return[sx(i),sy(+d.y)];});
    var ln=smooth(pts);
    var area=ln+' L'+sx(s.length-1).toFixed(1)+','+iH+' L'+sx(0).toFixed(1)+','+iH+' Z';
    var dots=s.length<=200?s.map(function(d,i){return'<circle cx="'+sx(i).toFixed(1)+'" cy="'+sy(+d.y).toFixed(1)+'" r="4" fill="var(--bg)" stroke="'+color+'" stroke-width="1.8"/>';}).join(''):'';
    return '<g transform="translate('+lp+','+tp+')">'+ yg+xg+'<path d="'+area+'" fill="'+color+'" fill-opacity="0.18"/><path d="'+ln+'" fill="none" stroke="'+color+'" stroke-width="2.2" stroke-linejoin="round"/>'+dots+xl+yl+'</g>';
  }

  function bar(data,colors,W,H){
    var s=data.slice().sort(function(a,b){return String(a.x)<String(b.x)?-1:String(a.x)>String(b.x)?1:0;});
    var n=s.length; if(!n) return noData(W,H);
    var lp=56,rp=12,tp=14;
    var ls=s.map(function(d){return lbl(String(d.x));});
    var mll=Math.max.apply(null,ls.map(function(l){return l.length;}));
    var rot=mll*(F*0.6)>(W-lp-rp)/n-4;
    var bp=rot?Math.ceil(mll*F*0.6*0.707)+8:F+14;
    var iW=W-lp-rp, iH=H-tp-bp;
    if(iW<20||iH<20) return '';
    var ys=s.map(function(d){return+d.y;}), maxY=Math.max.apply(null,ys)||1;
    var ticks=smartTicks(maxY), yR=ticks[ticks.length-1]||1;
    var slW=iW/n, bPad=Math.min(slW*0.2,10), bW=Math.max(1,slW-bPad*2), rx=Math.min(3,bW*0.25);
    var sy=function(v){return iH-(v/yR)*iH;};
    var bars='';
    s.forEach(function(d,i){
      var c=colors[i%colors.length],bx=i*slW+bPad,bh=Math.max(1,(+d.y/yR)*iH),by=iH-bh;
      bars+='<rect x="'+bx.toFixed(1)+'" y="'+by.toFixed(1)+'" width="'+bW.toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+c+'" fill-opacity="0.85" rx="'+rx+'"/>';
    });
    var minG=F+4,lastY=9999,yg='',yl='';
    ticks.forEach(function(v){
      var y=sy(v); if(y<-2||y>iH+2) return;
      if(Math.abs(y-lastY)<minG&&v!==ticks[0]) return;
      lastY=y;
      yg+='<line x1="0" y1="'+y.toFixed(1)+'" x2="'+iW+'" y2="'+y.toFixed(1)+'" style="stroke:var(--grid)" stroke-width="1"/>';
      yl+='<text x="-6" y="'+(y+F*0.35).toFixed(1)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="end" font-family="ui-monospace,monospace">'+fmt(v)+'</text>';
    });
    var maxL=Math.max(2,Math.floor(iW/55)), stp=Math.max(1,Math.ceil(n/maxL)),xl='';
    s.forEach(function(d,i){
      if(i%stp!==0&&i!==n-1) return;
      var cx=(i*slW+slW/2).toFixed(1);
      if(rot) xl+='<text transform="translate('+cx+','+(iH+F)+') rotate(-45)" style="fill:var(--label)" font-size="'+F+'" text-anchor="end" font-family="ui-monospace,monospace">'+ls[i]+'</text>';
      else xl+='<text x="'+cx+'" y="'+(iH+F+4)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="middle" font-family="ui-monospace,monospace">'+ls[i]+'</text>';
    });
    return '<g transform="translate('+lp+','+tp+')">'+ yg+bars+xl+yl+'</g>';
  }

  function pie(data,colors,W,H){
    var agg={};
    data.forEach(function(d){var k=String(d.x);agg[k]=(agg[k]||0)+(+d.y||0);});
    var entries=Object.entries(agg), total=entries.reduce(function(s,e){return s+e[1];},0);
    if(!total) return noData(W,H);
    var cx=W/2,cy=H/2,R=Math.min(cx,cy)*0.55,sl='',lb='',a=-Math.PI/2;
    entries.forEach(function(e,i){
      var nm=e[0],v=e[1],sw=(v/total)*2*Math.PI,end=a+sw,c=colors[i%colors.length];
      var x1=cx+R*Math.cos(a),y1=cy+R*Math.sin(a),x2=cx+R*Math.cos(end),y2=cy+R*Math.sin(end),lg=sw>Math.PI?1:0;
      sl+='<path d="M'+cx+','+cy+' L'+x1.toFixed(2)+','+y1.toFixed(2)+' A'+R.toFixed(1)+','+R.toFixed(1)+' 0 '+lg+',1 '+x2.toFixed(2)+','+y2.toFixed(2)+' Z" fill="'+c+'" style="stroke:var(--bg);stroke-width:2;"/>';
      if(sw>0.1){
        var mid=a+sw/2,lx=cx+(R+F*2.2)*Math.cos(mid),ly=cy+(R+F*2.2)*Math.sin(mid);
        var anc=lx>cx+8?'start':lx<cx-8?'end':'middle';
        var nm2=nm.length>18?nm.slice(0,17)+'…':nm;
        lb+='<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="'+anc+'" font-family="ui-monospace,monospace">'+nm2+' '+((v/total)*100).toFixed(0)+'%</text>';
      }
      a=end;
    });
    return '<g>'+sl+lb+'</g>';
  }

  function dims(){
    var p=svg.parentElement||svg;
    var r=p.getBoundingClientRect();
    return [r.width||p.offsetWidth||window.innerWidth, r.height||p.offsetHeight||window.innerHeight];
  }

  var first=true;
  function render(){
    var d=dims(), W=d[0], H=d[1];
    if(W<10||H<10){ requestAnimationFrame(render); return; }
    var colors=(C.colorMode==='multi'&&C.colors&&C.colors.length)?C.colors:[C.color||'#6366f1'];
    var html=C.error
      ?'<text style="fill:#f87171" x="'+(W/2)+'" y="'+(H/2)+'" text-anchor="middle" font-size="13">'+C.error+'</text>'
      :C.chartType==='bar'?bar(D,colors,W,H):C.chartType==='pie'?pie(D,colors,W,H):line(D,colors[0],W,H);
    if(!first) svg.style.animation='none';
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.innerHTML=html;
    first=false;
  }

  if(typeof ResizeObserver!=='undefined') new ResizeObserver(render).observe(svg.parentElement||svg);
  requestAnimationFrame(render);
})();
`;

export default async function EmbedPage({ searchParams }: Props) {
  const params = await searchParams;
  const { id, debug } = params;
  const isDebug = debug === "1";

  let databaseId = params.databaseId || "";
  let xField     = params.xField     || "";
  let yField     = params.yField     || "";
  let color      = params.color      || "#6366f1";
  let chartType: "line" | "bar" | "pie" = "line";
  let colorMode: "single" | "multi"     = "single";
  let colors: string[] | undefined;
  let kvStatus = "skipped";

  if (id) {
    try {
      const charts = (await kv.get<any[]>("nc_charts")) || [];
      const chart  = charts.find((c: any) => c.id === id);
      if (chart) {
        kvStatus = "ok";
        if (chart.databaseId) databaseId = chart.databaseId;
        if (chart.xField)     xField     = chart.xField;
        if (chart.yField)     yField     = chart.yField;
        if (chart.color)      color      = chart.color;
        if (chart.chartType)  chartType  = chart.chartType;
        if (chart.colorMode)  colorMode  = chart.colorMode;
        if (chart.colors && chart.colors.length > 0) colors = chart.colors;
      } else { kvStatus = "not-found"; }
    } catch (e: any) {
      kvStatus = "error: " + e.message;
    }
  }

  let data: { x: any; y: any }[] = [];
  let errorMsg = "";
  try {
    if (!databaseId || !xField || !yField) throw new Error("Missing config");
    const token = process.env.NOTION_CHARTS_TOKEN;
    if (!token) throw new Error("NOTION_CHARTS_TOKEN not set");
    data = await fetchChartData(token, databaseId, xField, yField);
  } catch (e: any) {
    errorMsg = e.message;
  }

  // Escape </script> sequences so they can't break out of inline script tags
  const safe = (v: unknown) => JSON.stringify(v).replace(/<\//g, "<\\/");

  const DATA_SCRIPT = `window.__nc_d=${safe(data)};window.__nc_c=${safe({
    chartType,
    colorMode,
    color,
    colors: colors ?? [],
    error: errorMsg || null,
  })};`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
      <div className="wrap">
        {/* SVG starts empty — client JS renders and re-renders on resize */}
        <svg className="chart-svg" xmlns="http://www.w3.org/2000/svg" />

        <div className="lg-controls">
          <div className="lg-pill">
            <div className="lg-bubble" />
            <button id="moonBtn" className="lg-opt" title="Dark mode">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </button>
            <button id="sunBtn" className="lg-opt" title="Light mode">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="4.5"/>
                <line x1="12" y1="2" x2="12" y2="4.5"/>
                <line x1="12" y1="19.5" x2="12" y2="22"/>
                <line x1="4.22" y1="4.22" x2="5.88" y2="5.88"/>
                <line x1="18.12" y1="18.12" x2="19.78" y2="19.78"/>
                <line x1="2" y1="12" x2="4.5" y2="12"/>
                <line x1="19.5" y1="12" x2="22" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.88" y2="18.12"/>
                <line x1="18.12" y1="5.88" x2="19.78" y2="4.22"/>
              </svg>
            </button>
          </div>
          <button id="refreshBtn" className="lg-refresh" title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>

        {isDebug && (
          <div style={{
            position:"fixed", top:0, left:0, right:0,
            background:"rgba(0,0,0,0.92)", color:"#0f0",
            fontFamily:"monospace", fontSize:12, padding:"8px 12px",
            lineHeight:1.8, zIndex:99999,
          }}>
            <b>id:</b> {id || "(none)"} &nbsp;|&nbsp;
            <b>kv:</b> {kvStatus} &nbsp;|&nbsp;
            <b>color:</b> {color} &nbsp;|&nbsp;
            <b>db:</b> {databaseId ? databaseId.slice(0,8)+"…" : "(none)"}
          </div>
        )}
      </div>

      <script dangerouslySetInnerHTML={{ __html: DATA_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: TOGGLE_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: CHART_SCRIPT }} />
    </>
  );
}
