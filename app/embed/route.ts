export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { fetchChartData, fetchChartDataMulti, applyAggregation, fetchFieldFormat } from "@/lib/notionData";

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

const CHART_SCRIPT = `
(function(){
  var D=window.__nc_d, C=window.__nc_c;
  if(!D||!C) return;
  var wrap=document.getElementById('nc-wrap');
  if(!wrap) return;
  var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','chart-svg');
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  wrap.insertBefore(svg,wrap.firstChild);

  // Tooltip
  var tip=document.createElement('div');
  tip.style.cssText='position:fixed;pointer-events:none;opacity:0;transition:opacity 0.12s;z-index:9999;background:rgba(24,24,27,0.94);color:#e4e4e7;padding:5px 10px;border-radius:7px;font-size:11px;font-family:ui-monospace,monospace;white-space:nowrap;border:1px solid rgba(255,255,255,0.1);box-shadow:0 4px 16px rgba(0,0,0,0.4);backdrop-filter:blur(8px);';
  document.body.appendChild(tip);
  var state=null,pieActive=null;

  function smartTicks(m){
    if(!m) return [0];
    var r=m/5, mag=Math.pow(10,Math.floor(Math.log10(r))), n=r/mag;
    var s=n<1.5?mag:n<3.5?2*mag:n<7.5?5*mag:10*mag, t=[];
    for(var v=0;t.length<=20;v=Math.round((v+s)*1e9)/1e9){ t.push(v); if(v>=m) break; }
    return t;
  }
  function resolveMin(ys){
    var mn=Math.min.apply(null,ys);
    if(mn>=0) return 0;
    var r=mn*1.1,mag=Math.pow(10,Math.floor(Math.log10(Math.max(Math.abs(r),1e-10))));
    return Math.floor(r/mag)*mag;
  }
  function smartTicksFrom(mn,mx){
    if(mx<=mn) return [mn];
    var rng=mx-mn,r=rng/5,mag=Math.pow(10,Math.floor(Math.log10(Math.max(r,1e-10)))),n=r/mag;
    var s=n<1.5?mag:n<3.5?2*mag:n<7.5?5*mag:10*mag,start=Math.floor(mn/s)*s,t=[];
    for(var v=start;t.length<=20;v=Math.round((v+s)*1e9)/1e9){if(v>=mn-s*0.01)t.push(v);if(v>=mx)break;}
    return t;
  }
  function fmt(v){
    var abs=Math.abs(v),sign=v<0?'-':'';
    if(abs>=1000000) return sign+(abs/1000000).toFixed(2).replace(/\.?0+$/,'')+'M';
    if(abs>=1000) return sign+(abs/1000).toFixed(2).replace(/\.?0+$/,'')+'k';
    if(Number.isInteger(v)) return String(v);
    var r=Math.round(v*100)/100;
    return r%1===0?String(r):r.toFixed(Math.abs(r)<0.01?3:2).replace(/\.?0+$/,'');
  }
  function fmtFull(v,prefix){ var abs=Math.abs(v),neg=v<0,r=Math.round(abs*100)/100,ip=Math.floor(r),s='',t=String(ip); for(var i=0;i<t.length;i++){if(i>0&&(t.length-i)%3===0)s+=',';s+=t[i];} var dec=r.toFixed(2).split('.')[1].replace(/0+$/,''); if(dec)s+='.'+dec; return(neg?'-':'')+(prefix||'')+s; }
  function lbl(s){ var d=new Date(s); if(isNaN(d.getTime())) return s; var mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return mo[d.getMonth()]+' '+String(d.getDate()).padStart(2,'0')+','+String(d.getFullYear()).slice(2); }
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

  var F=11;

  function line(data,color,W,H){
    var s=data.slice().sort(function(a,b){return String(a.x)<String(b.x)?-1:String(a.x)>String(b.x)?1:0;});
    if(!s.length) return noData(W,H);
    var lp=56,rp=12,tp=14;
    var ls=s.map(function(d){return lbl(String(d.x));});
    var mll=Math.max.apply(null,ls.map(function(l){return l.length;}));
    var rot=mll*(F*0.6)>(W-lp-rp)/Math.max(s.length,1)-4;
    // When rotated, leftmost label extends (mll*xF*0.65+xF)/√2 to the left of its anchor.
    // Anchor of first point is at x=0 (chart-local), so that distance must be ≤ lp.
    var xF=F;
    if(rot){ var xFmax=Math.floor(lp*1.414/(mll*0.65+1)); xF=Math.max(6,Math.min(F,xFmax)); }
    var bp=rot?Math.ceil(mll*xF*0.65*0.707)+8:F+14;
    var iW=W-lp-rp, iH=H-tp-bp;
    if(iW<20||iH<20) return '';
    var ys=s.map(function(d){return +d.y;}), maxY=Math.max.apply(null,ys)||1;
    var yFloor=resolveMin(ys),ticks=smartTicksFrom(yFloor,maxY),yR=ticks[ticks.length-1]||1,ySpan=yR-yFloor||1;
    var sx=function(i){return s.length>1?i/(s.length-1)*iW:iW/2;};
    var sy=function(v){return iH-((v-yFloor)/ySpan)*iH;};
    state={type:'line',s:s,lp:lp,tp:tp,iW:iW,iH:iH,yR:yR};
    var minG=F+4,lastY=9999,yg='',yl='';
    ticks.forEach(function(v){
      var y=sy(v); if(y<-2||y>iH+2) return;
      if(Math.abs(y-lastY)<minG&&v!==ticks[0]) return;
      lastY=y;
      yg+='<line x1="0" y1="'+y.toFixed(1)+'" x2="'+iW+'" y2="'+y.toFixed(1)+'" style="stroke:var(--grid)" stroke-width="1"/>';
      yl+='<text x="-6" y="'+(y+F*0.35).toFixed(1)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="end" font-family="ui-monospace,monospace">'+fmt(v)+'</text>';
    });
    var tgt=Math.max(2,Math.floor(iW/(F*5))), eff=Math.min(tgt,s.length);
    var stp=Math.max(1,Math.floor((s.length-1)/Math.max(1,eff-1)));
    var idx={};
    for(var k=0;k<eff;k++) idx[Math.min(k*stp,s.length-1)]=1;
    idx[s.length-1]=1;
    var idxs=Object.keys(idx).map(Number).sort(function(a,b){return a-b;});
    var xg='',xl='';
    idxs.forEach(function(i,pos){
      var x=sx(i).toFixed(1);
      xg+='<line x1="'+x+'" y1="0" x2="'+x+'" y2="'+iH+'" style="stroke:var(--grid)" stroke-width="1"/>';
      if(rot) xl+='<text transform="translate('+x+','+(iH+xF)+') rotate(-45)" style="fill:var(--label)" font-size="'+xF+'" text-anchor="end" font-family="ui-monospace,monospace">'+ls[i]+'</text>';
      else{ var anc=pos===0?'start':pos===idxs.length-1?'end':'middle'; xl+='<text x="'+x+'" y="'+(iH+F+4)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="'+anc+'" font-family="ui-monospace,monospace">'+ls[i]+'</text>'; }
    });
    var pts=s.map(function(d,i){return[sx(i),sy(+d.y)];});
    var ln=smooth(pts);
    var zeroY=iH-((0-yFloor)/ySpan)*iH;
    var area=ln+' L'+sx(s.length-1).toFixed(1)+','+zeroY.toFixed(1)+' L'+sx(0).toFixed(1)+','+zeroY.toFixed(1)+' Z';
    var dots=s.length<=40?s.map(function(d,i){return'<circle cx="'+sx(i).toFixed(1)+'" cy="'+sy(+d.y).toFixed(1)+'" r="4" fill="var(--bg)" stroke="'+color+'" stroke-width="1.8"/>';}).join(''):'';
    return '<g transform="translate('+lp+','+tp+')">'+ yg+xg+'<path d="'+area+'" fill="'+color+'" fill-opacity="0.18"/><path d="'+ln+'" fill="none" stroke="'+color+'" stroke-width="2.2" stroke-linejoin="round"/>'+dots+xl+yl+'</g>';
  }

  function bar(data,colors,W,H){
    var s=data.slice().sort(function(a,b){return String(a.x)<String(b.x)?-1:String(a.x)>String(b.x)?1:0;});
    var n=s.length; if(!n) return noData(W,H);
    var lp=56,rp=12,tp=14;
    var ls=s.map(function(d){return lbl(String(d.x));});
    var mll=Math.max.apply(null,ls.map(function(l){return l.length;}));
    var rot=mll*(F*0.6)>(W-lp-rp)/n-4;
    var xF=F;
    if(rot){ var xFmax=Math.floor(lp*1.414/(mll*0.65+1)); xF=Math.max(6,Math.min(F,xFmax)); }
    var bp=rot?Math.ceil(mll*xF*0.65*0.707)+8:F+14;
    var iW=W-lp-rp, iH=H-tp-bp;
    if(iW<20||iH<20) return '';
    var ys=s.map(function(d){return+d.y;}), maxY=Math.max.apply(null,ys)||1;
    var yFloor=resolveMin(ys),ticks=smartTicksFrom(yFloor,maxY),yR=ticks[ticks.length-1]||1,ySpan=yR-yFloor||1;
    var slW=iW/n, bPad=Math.min(slW*0.2,10), bW=Math.max(1,slW-bPad*2), rx=Math.min(3,bW*0.25);
    var sy=function(v){return iH-((v-yFloor)/ySpan)*iH;};
    var zeroY=iH-((0-yFloor)/ySpan)*iH;
    var bars='';
    s.forEach(function(d,i){
      var c=colors[i%colors.length],bx=i*slW+bPad;
      var valY=iH-((+d.y-yFloor)/ySpan)*iH,by=Math.min(valY,zeroY),bh=Math.max(1,Math.abs(zeroY-valY));
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
    var barLbls=[];s.forEach(function(d,i){if(i%stp===0||i===n-1)barLbls.push(i);});
    s.forEach(function(d,i){
      var pos=barLbls.indexOf(i); if(pos===-1) return;
      var cx=(i*slW+slW/2).toFixed(1);
      if(rot) xl+='<text transform="translate('+cx+','+(iH+xF)+') rotate(-45)" style="fill:var(--label)" font-size="'+xF+'" text-anchor="end" font-family="ui-monospace,monospace">'+ls[i]+'</text>';
      else{ var anc=pos===0?'start':pos===barLbls.length-1?'end':'middle'; xl+='<text x="'+cx+'" y="'+(iH+F+4)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="'+anc+'" font-family="ui-monospace,monospace">'+ls[i]+'</text>'; }
    });
    state={type:'bar',s:s,lp:lp,tp:tp,iW:iW,iH:iH,slW:slW};
    return '<g transform="translate('+lp+','+tp+')">'+ yg+bars+xl+yl+'</g>';
  }

  function pie(data,colors,W,H){
    var agg={};
    data.forEach(function(d){var k=String(d.x);agg[k]=(agg[k]||0)+(+d.y||0);});
    var entries=Object.entries(agg),total=entries.reduce(function(s,e){return s+e[1];},0);
    if(!total) return noData(W,H);
    var LW=Math.min(Math.floor(W*0.26),220),vp=30;
    var R=Math.min((W-2*LW-60)/2,(H-vp*2)/2);
    R=Math.max(R,80);
    var cx=W/2,cy=H/2;
    var slices=[],a=-Math.PI/2;
    entries.forEach(function(e,i){
      var nm=e[0],v=e[1],sw=(v/total)*2*Math.PI;
      slices.push({idx:i,name:nm,value:v,sweep:sw,start:a,end:a+sw,mid:a+sw/2,color:colors[i%colors.length],pct:(v/total)*100});
      a+=sw;
    });
    state={type:'pie',cx:cx,cy:cy,R:R,innerR:0,slices:slices,total:total};
    // slices with id for DOM lookup (explode) and CSS transition
    var slPaths=slices.map(function(s){
      var x1=cx+R*Math.cos(s.start),y1=cy+R*Math.sin(s.start);
      var x2=cx+R*Math.cos(s.end),y2=cy+R*Math.sin(s.end);
      var lg=s.sweep>Math.PI?1:0;
      return '<path id="ps'+s.idx+'" d="M'+cx.toFixed(1)+','+cy.toFixed(1)+' L'+x1.toFixed(2)+','+y1.toFixed(2)+' A'+R.toFixed(1)+','+R.toFixed(1)+' 0 '+lg+',1 '+x2.toFixed(2)+','+y2.toFixed(2)+' Z" fill="'+s.color+'" style="cursor:pointer;transition:transform 0.15s ease;"/>';
    }).join('');
    var center='<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="2" fill="var(--bg)" style="pointer-events:none;"/>';
    // legend-swatch labels in left/right columns (no connector lines)
    var leftG=slices.filter(function(s){return Math.cos(s.mid)<0;}).sort(function(a,b){return Math.sin(a.mid)-Math.sin(b.mid);});
    var rightG=slices.filter(function(s){return Math.cos(s.mid)>=0;}).sort(function(a,b){return Math.sin(a.mid)-Math.sin(b.mid);});
    var fSz=Math.min(14,Math.max(10,H/50)),rowH=fSz+11,swW=Math.round(fSz*2),swH=Math.round(fSz*0.8);
    function placeY(grp){
      var n=grp.length,tot=n*rowH;
      var items=grp.map(function(s,i){return{s:s,y:cy-tot/2+(i+0.5)*rowH};});
      for(var it=0;it<30;it++) for(var j=0;j<items.length-1;j++){var g=items[j+1].y-items[j].y;if(g<rowH){var p=(rowH-g)/2;items[j].y-=p;items[j+1].y+=p;}}
      items.forEach(function(item){item.y=Math.max(vp+fSz,Math.min(H-vp-fSz,item.y));});
      return items;
    }
    var leftItems=placeY(leftG),rightItems=placeY(rightG),lb='';
    leftItems.forEach(function(item){
      var s=item.s,ly=item.y,sx=LW-swW;
      lb+='<rect x="'+sx+'" y="'+(ly-swH/2).toFixed(1)+'" width="'+swW+'" height="'+swH+'" rx="2" fill="'+s.color+'"/>';
      var nm=s.name.length>24?s.name.slice(0,23)+'…':s.name;
      lb+='<text x="'+(sx-7)+'" y="'+(ly+fSz*0.36).toFixed(1)+'" style="fill:var(--label)" font-size="'+fSz+'" text-anchor="end" font-family="-apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif">'+nm+'  '+s.pct.toFixed(2).replace(/\\.?0+$/,'')+'%</text>';
    });
    rightItems.forEach(function(item){
      var s=item.s,ly=item.y,rx=W-LW;
      lb+='<rect x="'+rx+'" y="'+(ly-swH/2).toFixed(1)+'" width="'+swW+'" height="'+swH+'" rx="2" fill="'+s.color+'"/>';
      var nm=s.name.length>24?s.name.slice(0,23)+'…':s.name;
      lb+='<text x="'+(rx+swW+8)+'" y="'+(ly+fSz*0.36).toFixed(1)+'" style="fill:var(--label)" font-size="'+fSz+'" text-anchor="start" font-family="-apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif">'+nm+'  '+s.pct.toFixed(2).replace(/\\.?0+$/,'')+'%</text>';
    });
    // labels rendered first (below), slices on top to receive pointer events
    return '<g style="pointer-events:none">'+lb+'</g><g>'+slPaths+center+'</g>';
  }

  function doughnut(data,colors,W,H){
    var agg={};
    data.forEach(function(d){var k=String(d.x);agg[k]=(agg[k]||0)+(+d.y||0);});
    var entries=Object.entries(agg),total=entries.reduce(function(s,e){return s+e[1];},0);
    if(!total) return noData(W,H);
    var LW=Math.min(Math.floor(W*0.26),220),vp=30;
    var R=Math.min((W-2*LW-60)/2,(H-vp*2)/2);
    R=Math.max(R,80);
    var innerR=Math.round(R*0.5);
    var cx=W/2,cy=H/2;
    var slices=[],a=-Math.PI/2;
    entries.forEach(function(e,i){
      var nm=e[0],v=e[1],sw=(v/total)*2*Math.PI;
      slices.push({idx:i,name:nm,value:v,sweep:sw,start:a,end:a+sw,mid:a+sw/2,color:colors[i%colors.length],pct:(v/total)*100});
      a+=sw;
    });
    state={type:'pie',cx:cx,cy:cy,R:R,innerR:innerR,slices:slices,total:total};
    var slPaths=slices.map(function(s){
      var x1o=cx+R*Math.cos(s.start),y1o=cy+R*Math.sin(s.start);
      var x2o=cx+R*Math.cos(s.end),y2o=cy+R*Math.sin(s.end);
      var x1i=cx+innerR*Math.cos(s.end),y1i=cy+innerR*Math.sin(s.end);
      var x2i=cx+innerR*Math.cos(s.start),y2i=cy+innerR*Math.sin(s.start);
      var lg=s.sweep>Math.PI?1:0;
      return '<path id="ps'+s.idx+'" d="M'+x1o.toFixed(2)+','+y1o.toFixed(2)+' A'+R.toFixed(1)+','+R.toFixed(1)+' 0 '+lg+',1 '+x2o.toFixed(2)+','+y2o.toFixed(2)+' L'+x1i.toFixed(2)+','+y1i.toFixed(2)+' A'+innerR.toFixed(1)+','+innerR.toFixed(1)+' 0 '+lg+',0 '+x2i.toFixed(2)+','+y2i.toFixed(2)+' Z" fill="'+s.color+'" style="cursor:pointer;transition:transform 0.15s ease;"/>';
    }).join('');
    // center total with optional currency prefix
    var prefix=C.yPrefix||'',totalStr=fmtFull(total,prefix);
    var bigF=Math.min(Math.round(R*0.28),32),smF=Math.max(Math.min(Math.round(R*0.12),12),9);
    if(totalStr.length>10) bigF=Math.round(bigF*0.75); else if(totalStr.length>7) bigF=Math.round(bigF*0.87);
    var ctr='<text x="'+cx.toFixed(1)+'" y="'+(cy+bigF*0.35).toFixed(1)+'" style="fill:var(--label);pointer-events:none" font-size="'+bigF+'" font-weight="700" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif">'+totalStr+'</text>';
    ctr+='<text x="'+cx.toFixed(1)+'" y="'+(cy+bigF*0.35+smF+4).toFixed(1)+'" style="fill:var(--label);opacity:0.55;pointer-events:none" font-size="'+smF+'" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif">Total</text>';
    // legend swatch labels (same as pie)
    var leftG=slices.filter(function(s){return Math.cos(s.mid)<0;}).sort(function(a,b){return Math.sin(a.mid)-Math.sin(b.mid);});
    var rightG=slices.filter(function(s){return Math.cos(s.mid)>=0;}).sort(function(a,b){return Math.sin(a.mid)-Math.sin(b.mid);});
    var fSz=Math.min(14,Math.max(10,H/50)),rowH=fSz+11,swW=Math.round(fSz*2),swH=Math.round(fSz*0.8);
    function placeY(grp){
      var n=grp.length,tot=n*rowH;
      var items=grp.map(function(s,i){return{s:s,y:cy-tot/2+(i+0.5)*rowH};});
      for(var it=0;it<30;it++) for(var j=0;j<items.length-1;j++){var g=items[j+1].y-items[j].y;if(g<rowH){var p=(rowH-g)/2;items[j].y-=p;items[j+1].y+=p;}}
      items.forEach(function(item){item.y=Math.max(vp+fSz,Math.min(H-vp-fSz,item.y));});
      return items;
    }
    var leftItems=placeY(leftG),rightItems=placeY(rightG),lb='';
    leftItems.forEach(function(item){
      var s=item.s,ly=item.y,sx=LW-swW;
      lb+='<rect x="'+sx+'" y="'+(ly-swH/2).toFixed(1)+'" width="'+swW+'" height="'+swH+'" rx="2" fill="'+s.color+'"/>';
      var nm=s.name.length>24?s.name.slice(0,23)+'…':s.name;
      lb+='<text x="'+(sx-7)+'" y="'+(ly+fSz*0.36).toFixed(1)+'" style="fill:var(--label)" font-size="'+fSz+'" text-anchor="end" font-family="-apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif">'+nm+'  '+s.pct.toFixed(2).replace(/\\.?0+$/,'')+'%</text>';
    });
    rightItems.forEach(function(item){
      var s=item.s,ly=item.y,rx=W-LW;
      lb+='<rect x="'+rx+'" y="'+(ly-swH/2).toFixed(1)+'" width="'+swW+'" height="'+swH+'" rx="2" fill="'+s.color+'"/>';
      var nm=s.name.length>24?s.name.slice(0,23)+'…':s.name;
      lb+='<text x="'+(rx+swW+8)+'" y="'+(ly+fSz*0.36).toFixed(1)+'" style="fill:var(--label)" font-size="'+fSz+'" text-anchor="start" font-family="-apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif">'+nm+'  '+s.pct.toFixed(2).replace(/\\.?0+$/,'')+'%</text>';
    });
    return '<g style="pointer-events:none">'+lb+'</g><g>'+slPaths+ctr+'</g>';
  }

  function kpi(data,color,W,H){
    var total=data.reduce(function(s,d){return s+(+d.y||0);},0);
    var prefix=C.yPrefix||'',valStr=fmtFull(total,prefix);
    var cnt=data.length;
    var fs=valStr.length>14?52:valStr.length>10?64:80;
    return '<text x="'+(W/2)+'" y="'+(H/2-18)+'" text-anchor="middle" style="fill:'+color+'" font-size="'+fs+'" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif">'+valStr+'</text><text x="'+(W/2)+'" y="'+(H/2+26)+'" text-anchor="middle" style="fill:var(--label)" font-size="13" font-family="ui-monospace,monospace">'+cnt+' records</text>';
  }

  // Tooltip handlers — line/bar snap by X axis (no distance check), pie by sector
  svg.addEventListener('mousemove',function(e){
    if(!state){tip.style.opacity='0';return;}
    var r=svg.getBoundingClientRect();
    var vx=e.clientX-r.left, vy=e.clientY-r.top;
    var tx=Math.min(e.clientX+14,window.innerWidth-180);
    var ty=Math.max(e.clientY-36,8);
    if(state.type==='line'){
      var n=state.s.length; if(!n){tip.style.opacity='0';return;}
      // Show tooltip anywhere in chart area, snapping to nearest point by X
      if(vx<state.lp||vx>state.lp+state.iW||vy<state.tp||vy>state.tp+state.iH){tip.style.opacity='0';return;}
      var idx=Math.max(0,Math.min(n-1,Math.round((vx-state.lp)/state.iW*(n-1))));
      var d=state.s[idx];
      var yVal=state.yFields?state.yFields.map(function(yf){return yf+': '+fmt(+d[yf]||0);}).join('  &nbsp;'):fmt(+d.y);
      tip.innerHTML='<span style="color:#9ca3af">'+lbl(String(d.x))+'</span>  '+yVal;
      tip.style.left=tx+'px';tip.style.top=ty+'px';tip.style.opacity='1';
    } else if(state.type==='bar'){
      if(vx<state.lp||vx>state.lp+state.iW||vy<state.tp||vy>state.tp+state.iH){tip.style.opacity='0';return;}
      var idx=Math.floor((vx-state.lp)/state.slW);
      if(idx<0||idx>=state.s.length){tip.style.opacity='0';return;}
      var d=state.s[idx];
      var yVal=state.yFields?state.yFields.map(function(yf){return yf+': '+fmt(+d[yf]||0);}).join('  &nbsp;'):fmt(+d.y);
      tip.innerHTML='<span style="color:#9ca3af">'+lbl(String(d.x))+'</span>  '+yVal;
      tip.style.left=tx+'px';tip.style.top=ty+'px';tip.style.opacity='1';
    } else if(state.type==='pie'){
      var dx=vx-state.cx,dy=vy-state.cy,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist>state.R||(state.innerR>0&&dist<state.innerR)){
        tip.style.opacity='0';
        if(pieActive){pieActive.el.style.transform='';pieActive=null;}
        return;
      }
      var angle=Math.atan2(dy,dx);
      if(angle<-Math.PI/2) angle+=2*Math.PI;
      var a=-Math.PI/2,found=null;
      state.slices.forEach(function(s){if(!found&&angle>=a&&angle<a+s.sweep)found=s;a+=s.sweep;});
      if(found){
        if(!pieActive||pieActive.idx!==found.idx){
          if(pieActive) pieActive.el.style.transform='';
          var el=svg.querySelector('#ps'+found.idx);
          if(el){el.style.transform='translate('+(16*Math.cos(found.mid)).toFixed(1)+'px,'+(16*Math.sin(found.mid)).toFixed(1)+'px)';pieActive={idx:found.idx,el:el};}
        }
        tip.innerHTML='<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+found.color+';margin-right:5px;vertical-align:middle"></span><b style="color:#e2e8f0">'+found.name+'</b><span style="color:#9ca3af;margin-left:10px">'+found.pct.toFixed(2).replace(/\\.?0+$/,'')+'%</span><span style="color:#6b7280;margin-left:8px">'+fmt(found.value)+'</span>';
        tip.style.left=tx+'px';tip.style.top=ty+'px';tip.style.opacity='1';
      } else {
        tip.style.opacity='0';
        if(pieActive){pieActive.el.style.transform='';pieActive=null;}
      }
    }
  });
  svg.addEventListener('mouseleave',function(){
    tip.style.opacity='0';
    if(pieActive){pieActive.el.style.transform='';pieActive=null;}
  });
  svg.addEventListener('touchmove',function(e){
    if(!state||state.type!=='pie'||!e.touches.length) return;
    e.preventDefault();
    var t=e.touches[0],r2=svg.getBoundingClientRect();
    var vx2=t.clientX-r2.left,vy2=t.clientY-r2.top;
    var tx2=Math.min(t.clientX+14,window.innerWidth-220),ty2=Math.max(t.clientY-50,8);
    var dx2=vx2-state.cx,dy2=vy2-state.cy,dist2=Math.sqrt(dx2*dx2+dy2*dy2);
    if(dist2>state.R||(state.innerR>0&&dist2<state.innerR)){
      tip.style.opacity='0';
      if(pieActive){pieActive.el.style.transform='';pieActive=null;}
      return;
    }
    var ang2=Math.atan2(dy2,dx2);
    if(ang2<-Math.PI/2) ang2+=2*Math.PI;
    var a2=-Math.PI/2,f2=null;
    state.slices.forEach(function(s){if(!f2&&ang2>=a2&&ang2<a2+s.sweep)f2=s;a2+=s.sweep;});
    if(f2){
      if(!pieActive||pieActive.idx!==f2.idx){
        if(pieActive) pieActive.el.style.transform='';
        var el2=svg.querySelector('#ps'+f2.idx);
        if(el2){el2.style.transform='translate('+(16*Math.cos(f2.mid)).toFixed(1)+'px,'+(16*Math.sin(f2.mid)).toFixed(1)+'px)';pieActive={idx:f2.idx,el:el2};}
      }
      tip.innerHTML='<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+f2.color+';margin-right:5px;vertical-align:middle"></span><b style="color:#e2e8f0">'+f2.name+'</b><span style="color:#9ca3af;margin-left:10px">'+f2.pct.toFixed(2).replace(/\\.?0+$/,'')+'%</span><span style="color:#6b7280;margin-left:8px">'+fmt(f2.value)+'</span>';
      tip.style.left=tx2+'px';tip.style.top=ty2+'px';tip.style.opacity='1';
    } else {
      tip.style.opacity='0';
      if(pieActive){pieActive.el.style.transform='';pieActive=null;}
    }
  },{passive:false});
  svg.addEventListener('touchend',function(){
    tip.style.opacity='0';
    if(pieActive){pieActive.el.style.transform='';pieActive=null;}
  });

  function dims(){
    var r=wrap.getBoundingClientRect();
    return [r.width||wrap.offsetWidth||window.innerWidth, r.height||wrap.offsetHeight||window.innerHeight];
  }

  function lineMulti(data,yFields,colors,W,H){
    var s=data.slice().sort(function(a,b){return String(a.x)<String(b.x)?-1:String(a.x)>String(b.x)?1:0;});
    if(!s.length) return noData(W,H);
    var lp=56,rp=12,tp=22,F=11;
    var ls=s.map(function(d){return lbl(String(d.x));});
    var mll=Math.max.apply(null,ls.map(function(l){return l.length;}));
    var rot=mll*(F*0.6)>(W-lp-rp)/Math.max(s.length,1)-4;
    var xF=F; if(rot){var xFmax=Math.floor(lp*1.414/(mll*0.65+1));xF=Math.max(6,Math.min(F,xFmax));}
    var bp=rot?Math.ceil(mll*xF*0.65*0.707)+8:F+14;
    var iW=W-lp-rp,iH=H-tp-bp;
    if(iW<20||iH<20) return '';
    var allY=[];s.forEach(function(d){yFields.forEach(function(yf){allY.push(+d[yf]||0);});});
    var maxY=Math.max.apply(null,allY)||1;
    var yFloor=resolveMin(allY),ticks=smartTicksFrom(yFloor,maxY),yR=ticks[ticks.length-1]||1,ySpan=yR-yFloor||1;
    var sx=function(i){return s.length>1?i/(s.length-1)*iW:iW/2;};
    var sy=function(v){return iH-((v-yFloor)/ySpan)*iH;};
    state={type:'line',s:s,lp:lp,tp:tp,iW:iW,iH:iH,yR:yR,yFields:yFields};
    var minG=F+4,lastY=9999,yg='',yl='';
    ticks.forEach(function(v){var y=sy(v);if(y<-2||y>iH+2)return;if(Math.abs(y-lastY)<minG&&v!==ticks[0])return;lastY=y;yg+='<line x1="0" y1="'+y.toFixed(1)+'" x2="'+iW+'" y2="'+y.toFixed(1)+'" style="stroke:var(--grid)" stroke-width="1"/>';yl+='<text x="-6" y="'+(y+F*0.35).toFixed(1)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="end" font-family="ui-monospace,monospace">'+fmt(v)+'</text>';});
    var tgt=Math.max(2,Math.floor(iW/(F*5))),eff=Math.min(tgt,s.length),stp=Math.max(1,Math.floor((s.length-1)/Math.max(1,eff-1))),idx={};
    for(var k=0;k<eff;k++) idx[Math.min(k*stp,s.length-1)]=1; idx[s.length-1]=1;
    var idxs=Object.keys(idx).map(Number).sort(function(a,b){return a-b;}),xg='',xl='';
    idxs.forEach(function(i,pos){var x=sx(i).toFixed(1);xg+='<line x1="'+x+'" y1="0" x2="'+x+'" y2="'+iH+'" style="stroke:var(--grid)" stroke-width="1"/>';if(rot)xl+='<text transform="translate('+x+','+(iH+xF)+') rotate(-45)" style="fill:var(--label)" font-size="'+xF+'" text-anchor="end" font-family="ui-monospace,monospace">'+ls[i]+'</text>';else{var anc=pos===0?'start':pos===idxs.length-1?'end':'middle';xl+='<text x="'+x+'" y="'+(iH+F+4)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="'+anc+'" font-family="ui-monospace,monospace">'+ls[i]+'</text>';}});
    var zeroYM=iH-((0-yFloor)/ySpan)*iH;
    var seriesSvg=yFields.map(function(yf,si){var c=colors[si%colors.length];var pts=s.map(function(d,i){return[sx(i),sy(+d[yf]||0)];});var ln=smooth(pts);var area=ln+' L'+sx(s.length-1).toFixed(1)+','+zeroYM.toFixed(1)+' L'+sx(0).toFixed(1)+','+zeroYM.toFixed(1)+' Z';var dots=s.length<=40?s.map(function(d,i){return'<circle cx="'+sx(i).toFixed(1)+'" cy="'+sy(+d[yf]||0).toFixed(1)+'" r="4" fill="var(--bg)" stroke="'+c+'" stroke-width="1.8"/>';}).join(''):'';return'<path d="'+area+'" fill="'+c+'" fill-opacity="0.08"/><path d="'+ln+'" fill="none" stroke="'+c+'" stroke-width="2.2" stroke-linejoin="round"/>'+dots;}).join('');
    var legend=yFields.map(function(yf,si){var c=colors[si%colors.length];var label=yf.length>14?yf.slice(0,13)+'…':yf;return'<g transform="translate('+(si*(iW/yFields.length))+',-10)"><circle cx="6" cy="0" r="3.5" fill="'+c+'"/><text x="13" y="3.5" style="fill:var(--label)" font-size="8" font-family="ui-monospace,monospace">'+label+'</text></g>';}).join('');
    return'<g transform="translate('+lp+','+tp+')">'+yg+xg+seriesSvg+xl+yl+legend+'</g>';
  }

  function barMulti(data,yFields,colors,W,H){
    var s=data.slice().sort(function(a,b){return String(a.x)<String(b.x)?-1:String(a.x)>String(b.x)?1:0;});
    var n=s.length; if(!n) return noData(W,H);
    var lp=56,rp=12,tp=22,F=11,nS=yFields.length;
    var ls=s.map(function(d){return lbl(String(d.x));});
    var mll=Math.max.apply(null,ls.map(function(l){return l.length;}));
    var rot=mll*(F*0.6)>(W-lp-rp)/n-4;
    var xF=F; if(rot){var xFmax=Math.floor(lp*1.414/(mll*0.65+1));xF=Math.max(6,Math.min(F,xFmax));}
    var bp=rot?Math.ceil(mll*xF*0.65*0.707)+8:F+14;
    var iW=W-lp-rp,iH=H-tp-bp;
    if(iW<20||iH<20) return '';
    var allY=[];s.forEach(function(d){yFields.forEach(function(yf){allY.push(+d[yf]||0);});});
    var maxY=Math.max.apply(null,allY)||1;
    var yFloor=resolveMin(allY),ticks=smartTicksFrom(yFloor,maxY),yR=ticks[ticks.length-1]||1,ySpan=yR-yFloor||1;
    var slW=iW/n,gPad=Math.min(slW*0.1,4),gW=slW-gPad*2,barGap=2,barW=Math.max(1,(gW-barGap*(nS-1))/nS),rx=Math.min(3,barW*0.25);
    var sy=function(v){return iH-((v-yFloor)/ySpan)*iH;};
    var zeroYB=iH-((0-yFloor)/ySpan)*iH;
    state={type:'bar',s:s,lp:lp,tp:tp,iW:iW,iH:iH,slW:slW};
    var bars=s.map(function(d,i){var gx=i*slW+gPad;return yFields.map(function(yf,si){var c=colors[si%colors.length];var bx=gx+si*(barW+barGap);var val=+d[yf]||0;var valY=iH-((val-yFloor)/ySpan)*iH,by=Math.min(valY,zeroYB),bh=Math.max(1,Math.abs(zeroYB-valY));return'<rect x="'+bx.toFixed(1)+'" y="'+by.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+c+'" fill-opacity="0.85" rx="'+rx+'"/>';}).join('');}).join('');
    var minG=F+4,lastY=9999,yg='',yl='';
    ticks.forEach(function(v){var y=sy(v);if(y<-2||y>iH+2)return;if(Math.abs(y-lastY)<minG&&v!==ticks[0])return;lastY=y;yg+='<line x1="0" y1="'+y.toFixed(1)+'" x2="'+iW+'" y2="'+y.toFixed(1)+'" style="stroke:var(--grid)" stroke-width="1"/>';yl+='<text x="-6" y="'+(y+F*0.35).toFixed(1)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="end" font-family="ui-monospace,monospace">'+fmt(v)+'</text>';});
    var maxL=Math.max(2,Math.floor(iW/55)),stp=Math.max(1,Math.ceil(n/maxL)),xl='';
    var mbLbls=[];s.forEach(function(d,i){if(i%stp===0||i===n-1)mbLbls.push(i);});
    s.forEach(function(d,i){var pos=mbLbls.indexOf(i);if(pos===-1)return;var cx=(i*slW+slW/2).toFixed(1);if(rot)xl+='<text transform="translate('+cx+','+(iH+xF)+') rotate(-45)" style="fill:var(--label)" font-size="'+xF+'" text-anchor="end" font-family="ui-monospace,monospace">'+ls[i]+'</text>';else{var anc=pos===0?'start':pos===mbLbls.length-1?'end':'middle';xl+='<text x="'+cx+'" y="'+(iH+F+4)+'" style="fill:var(--label)" font-size="'+F+'" text-anchor="'+anc+'" font-family="ui-monospace,monospace">'+ls[i]+'</text>';}});
    var legend=yFields.map(function(yf,si){var c=colors[si%colors.length];var label=yf.length>14?yf.slice(0,13)+'…':yf;return'<g transform="translate('+(si*(iW/yFields.length))+',-10)"><rect x="0" y="-5" width="9" height="9" rx="2" fill="'+c+'" fill-opacity="0.85"/><text x="13" y="3.5" style="fill:var(--label)" font-size="8" font-family="ui-monospace,monospace">'+label+'</text></g>';}).join('');
    return'<g transform="translate('+lp+','+tp+')">'+yg+bars+xl+yl+legend+'</g>';
  }

  var first=true;
  function render(){
    var d=dims(), W=d[0], H=d[1];
    if(W<10||H<10){ requestAnimationFrame(render); return; }
    var colors=(C.colorMode==='multi'&&C.colors&&C.colors.length)?C.colors:[C.color||'#6366f1'];
    var yFs=C.yFields&&C.yFields.length>1?C.yFields:null;
    var html=C.error
      ?'<text style="fill:#f87171" x="'+(W/2)+'" y="'+(H/2)+'" text-anchor="middle" font-size="13">'+C.error+'</text>'
      :C.chartType==='bar'?(yFs?barMulti(D,yFs,colors,W,H):bar(D,colors,W,H))
      :C.chartType==='pie'?pie(D,colors,W,H)
      :C.chartType==='doughnut'?doughnut(D,colors,W,H)
      :C.chartType==='kpi'?kpi(D,colors[0],W,H)
      :(yFs?lineMulti(D,yFs,colors,W,H):line(D,colors[0],W,H));
    pieActive=null;
    if(!first) svg.style.animation='none';
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.innerHTML=html;
    first=false;
  }

  if(typeof ResizeObserver!=='undefined') new ResizeObserver(render).observe(wrap);
  requestAnimationFrame(render);
})();
`;

const CONTROLS_HTML = `
<div class="lg-controls">
  <div class="lg-pill">
    <div class="lg-bubble"></div>
    <button id="moonBtn" class="lg-opt" title="Dark mode">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </button>
    <button id="sunBtn" class="lg-opt" title="Light mode">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg">
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
  <button id="refreshBtn" class="lg-refresh" title="Refresh">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  </button>
</div>
`;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id      = searchParams.get("id")         || "";
  const isDebug = searchParams.get("debug") === "1";

  let databaseId = searchParams.get("databaseId") || "";
  let xField     = searchParams.get("xField")     || "";
  let yField     = searchParams.get("yField")     || "";
  let yFields: string[] = [];
  let yAggregations: string[] = [];
  let color      = searchParams.get("color")      || "#6366f1";
  let chartType: "line" | "bar" | "pie" | "doughnut" | "kpi" = "line";
  let colorMode: "single" | "multi"     = "single";
  let colors: string[] = [];
  let yPrefix    = "";
  let kvStatus   = "skipped";

  if (id) {
    try {
      const charts = (await kv.get<any[]>("nc_charts")) || [];
      const chart  = charts.find((c: any) => c.id === id);
      if (chart) {
        kvStatus = "ok";
        if (chart.databaseId) databaseId = chart.databaseId;
        if (chart.xField)     xField     = chart.xField;
        if (chart.yField)     yField     = chart.yField;
        if (chart.yFields?.length) yFields = chart.yFields;
        if (chart.yAggregations?.length) yAggregations = chart.yAggregations;
        if (chart.color)      color      = chart.color;
        if (chart.chartType)  chartType  = chart.chartType;
        if (chart.colorMode)  colorMode  = chart.colorMode;
        if (chart.colors && chart.colors.length > 0) colors = chart.colors;
        if (chart.yPrefix)    yPrefix    = chart.yPrefix;
      } else { kvStatus = "not-found"; }
    } catch (e: any) {
      kvStatus = "error: " + e.message;
    }
  }

  const resolvedYFields       = yFields.length ? yFields : (yField ? [yField] : []);
  const resolvedAggregations  = resolvedYFields.map((_, i) => yAggregations[i] || "sum");

  let data: any[] = [];
  let errorMsg = "";
  try {
    if (!databaseId || !xField || !resolvedYFields.length) throw new Error("Missing config");
    const token = process.env.NOTION_CHARTS_TOKEN;
    if (!token) throw new Error("NOTION_CHARTS_TOKEN not set");
    if (resolvedYFields.length > 1) {
      data = await fetchChartDataMulti(token, databaseId, xField, resolvedYFields, resolvedAggregations);
    } else {
      const raw = await fetchChartData(token, databaseId, xField, resolvedYFields[0]);
      data = applyAggregation(raw, resolvedAggregations[0]);
    }
  } catch (e: any) {
    errorMsg = e.message;
  }

  // Auto-detect currency prefix if not already stored in chart config
  if (!yPrefix && resolvedYFields.length > 0 && databaseId) {
    try {
      const fmtToken = process.env.NOTION_CHARTS_TOKEN;
      if (fmtToken) {
        const fmt = await fetchFieldFormat(fmtToken, databaseId, resolvedYFields[0]);
        yPrefix = fmt.prefix;
      }
    } catch {}
  }

  const safe = (v: unknown) => JSON.stringify(v).replace(/<\//g, "<\\/");

  const DATA_SCRIPT = `window.__nc_d=${safe(data)};window.__nc_c=${safe({
    chartType,
    colorMode,
    color,
    colors,
    yFields: resolvedYFields,
    yPrefix,
    error: errorMsg || null,
  })};`;

  const debugPanel = isDebug ? `
<div style="position:fixed;top:0;left:0;right:0;background:rgba(0,0,0,0.92);color:#0f0;font-family:monospace;font-size:12px;padding:8px 12px;line-height:1.8;z-index:99999;">
  <b>id:</b> ${id || "(none)"} &nbsp;|&nbsp;
  <b>kv:</b> ${kvStatus} &nbsp;|&nbsp;
  <b>color:</b> ${color} &nbsp;|&nbsp;
  <b>db:</b> ${databaseId ? databaseId.slice(0, 8) + "…" : "(none)"}
</div>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chart</title>
<style>${CSS}</style>
<script>${INIT_SCRIPT}</script>
</head>
<body>
<div class="wrap" id="nc-wrap">
${CONTROLS_HTML}
${debugPanel}
</div>
<script>${DATA_SCRIPT}</script>
<script>${TOGGLE_SCRIPT}</script>
<script>${CHART_SCRIPT}</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
    },
  });
}
