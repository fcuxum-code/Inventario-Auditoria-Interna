(function(){
  function sheetOpen(){
    var o=document.getElementById('overlay'), s=document.getElementById('sheet');
    return (o&&o.classList.contains('show'))||(s&&s.classList.contains('show'));
  }
  function onHome(){ var view=document.getElementById('view'); if(!view) return false; return view.querySelector('.prow')!==null; }
  function apply(){
    var btn=document.getElementById('__herrBtn'); if(!btn) return;
    var show = onHome() && !sheetOpen();
    btn.style.display = show?'block':'none';
    if(!show){ var p=document.getElementById('__herrPanel'); if(p&&!sheetOpen()) p.style.display='none'; }
  }
  window.__applyHerrVisibility=apply;
  function attach(){
    var view=document.getElementById('view'); if(!view){ setTimeout(attach,300); return; }
    if(!window.__herrMO){ var mo=new MutationObserver(apply); mo.observe(view,{childList:true,subtree:false}); window.__herrMO=mo; }
    var o=document.getElementById('overlay'); if(o&&!o.__mo){ var mo2=new MutationObserver(apply); mo2.observe(o,{attributes:true,attributeFilter:['class']}); o.__mo=mo2; }
    var s=document.getElementById('sheet'); if(s&&!s.__mo){ var mo3=new MutationObserver(apply); mo3.observe(s,{attributes:true,attributeFilter:['class']}); s.__mo=mo3; }
    apply();
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',attach); } else { attach(); }
  setTimeout(attach,1200);
})();
