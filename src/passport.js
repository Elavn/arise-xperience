const stops = { arrival: 'Arrival', clubhouse: 'Clubhouse', aerial: 'Sky view', walk: 'Explorer', golf: 'Golf round' };
let found = new Set();
try { const saved=JSON.parse(localStorage.getItem('arise-passport') || '[]'); if(Array.isArray(saved))found=new Set(saved.filter(x=>x in stops)); } catch { /* Storage is optional. */ }
function render() {
  document.getElementById('passport-count').textContent = `${found.size} / 5 discoveries${found.size===5?' · Resort insider':''}`;
  document.getElementById('passport-stamps').innerHTML=Object.entries(stops).map(([key,label])=>`<span class="${found.has(key)?'earned':''}" title="${label}">${found.has(key)?'✓':'○'} ${label}</span>`).join('');
}
export function discover(name) {
  // The golf stamp is awarded for finishing a round, not visiting the viewpoint.
  if(name==='golf'||!(name in stops))return;
  award(name);
}
function award(name) { if(!(name in stops))return;found.add(name);try{localStorage.setItem('arise-passport',JSON.stringify([...found]));}catch{}render(); }
window.addEventListener('arise-achievement',e=>award(e.detail));
render();
