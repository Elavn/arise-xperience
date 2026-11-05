// Let the building become the interface after a short arrival introduction.
export function initQuietUI() {
  const intro=document.getElementById('intro-content');
  const toggle=document.getElementById('scene-info');
  let timer, ready=false;
  function setQuiet(quiet) {
    document.body.classList.toggle('scene-quiet',quiet);
    intro.inert=quiet;
    toggle.setAttribute('aria-expanded',String(!quiet));
    toggle.setAttribute('aria-label',quiet?'Show resort introduction':'Hide resort introduction');
  }
  function schedule(delay=5500) {
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(intro.contains(document.activeElement)){schedule(2000);return;}
      setQuiet(true);
    },delay);
  }
  toggle.addEventListener('click',()=>{
    const reveal=document.body.classList.contains('scene-quiet');
    clearTimeout(timer);setQuiet(!reveal);if(reveal)schedule(9000);
  });
  window.addEventListener('arise-scene-ready',()=>{ready=true;schedule();});
  window.addEventListener('arise-view-change',()=>{if(ready&&!document.body.classList.contains('scene-quiet'))schedule(3500);});
  document.getElementById('canvas-host').addEventListener('pointerdown',()=>{if(ready){clearTimeout(timer);setQuiet(true);}});
}
