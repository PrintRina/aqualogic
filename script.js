/* AquaLogic · lógica de la aplicación (JavaScript puro + Chart.js) */
const DEF = { cap: 5000, v0: 5000, res: 1000, cons: 400, leak: 0, inp: 0 }; // valores del proyecto
let P = { ...DEF };          // parámetros válidos actuales
let cur = 'p-inicio';       // sección visible
const charts = {};
const $ = id => document.getElementById(id);
const fmt = (n, d = 1) => Number.isFinite(n) ? n.toLocaleString('es-MX', { maximumFractionDigits: d }) : '—';
const KEYS = ['cap', 'v0', 'res', 'cons', 'leak', 'inp'];

/* ---------- MODELO MATEMÁTICO ---------- */
const net = p => p.inp - p.cons - p.leak;                       // balance neto (L/h)
const volAt = (p, t) => Math.min(p.cap, Math.max(0, p.v0 + net(p) * t)); // V(t) con restricciones físicas
function timeReserve(p) {                                        // t = (V0 - Vmin)/salida neta
  if (p.v0 <= p.res) return 0;
  return net(p) < 0 ? (p.v0 - p.res) / -net(p) : null;
}
function validate(p) {
  const e = [], bad = new Set();
  KEYS.forEach(k => { if (!Number.isFinite(p[k]) || p[k] < 0) { bad.add(k); } });
  if (bad.size) e.push('Todos los parámetros deben ser números mayores o iguales a 0 (sin negativos ni campos vacíos).');
  else {
    if (p.cap <= 0) { e.push('La capacidad debe ser mayor que 0 L.'); bad.add('cap'); }
    if (p.v0 > p.cap) { e.push('El volumen inicial no puede superar la capacidad.'); bad.add('v0'); }
    if (p.res > p.v0) { e.push('La reserva mínima debe ser menor o igual al volumen inicial.'); bad.add('res'); }
  }
  return { e, bad };
}
function horizon(p, extra = []) {
  const ts = [timeReserve(p), ...extra].filter(t => t !== null && Number.isFinite(t));
  const h = ts.length ? Math.max(...ts) * 1.4 : 24;
  return Math.min(Math.max(h, 4), 1000);
}
function points(p, H, n = 80) {
  return Array.from({ length: n + 1 }, (_, i) => { const t = H * i / n; return { x: +t.toFixed(3), y: +volAt(p, t).toFixed(2) }; });
}
function status(p) {
  const t = timeReserve(p);
  if (t === 0) return ['Crítico: en la reserva', 'bad'];
  if (t === null) return ['Estable: no se agota', 'ok'];
  return t >= 8 ? ['Suministro adecuado', 'ok'] : t >= 4 ? ['Precaución', 'warn'] : ['Crítico', 'bad'];
}
const hrs = t => t === null ? 'No se alcanza' : fmt(t, 2) + ' h';

/* ---------- GRÁFICAS ---------- */
function draw(id, cfg) {
  if (typeof Chart === 'undefined') { const c = $(id); if (!c.nextElementSibling) c.insertAdjacentHTML('afterend', '<p class="msg">⚠️ No se pudo cargar Chart.js. Revisa tu conexión a internet y recarga.</p>'); return; }
  if (charts[id]) charts[id].destroy();
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 600 }, plugins: { legend: { position: 'bottom' } } }, cfg.options);
  charts[id] = new Chart($(id), cfg);
}
const axes = (x, y) => ({ scales: { x: { type: 'linear', title: { display: true, text: x } }, y: { beginAtZero: true, title: { display: true, text: y } } } });
const line = (label, data, color, extra = {}) => ({ type: 'line', label, data, borderColor: color, backgroundColor: color, pointRadius: 0, tension: 0, borderWidth: 3, ...extra });

/* ---------- DASHBOARD ---------- */
function renderDashboard() {
  const t = timeReserve(P), pct = P.v0 / P.cap * 100, [st, cl] = status(P);
  const k = [['Capacidad total', fmt(P.cap) + ' L'], ['Volumen disponible', fmt(P.v0) + ' L'], ['Porcentaje de llenado', fmt(pct) + ' %'],
    ['Reserva mínima', fmt(P.res) + ' L'], ['Consumo total por hora', fmt(P.cons + P.leak) + ' L/h'], ['Entrada de agua', fmt(P.inp) + ' L/h'],
    ['Tiempo hasta la reserva', hrs(t)], ['Estado del suministro', st]];
  $('kpis').innerHTML = k.map(([a, b]) => `<div class="kpi"><span>${a}</span><b>${b}</b></div>`).join('');
  $('water').style.height = pct + '%'; $('resline').style.bottom = (P.res / P.cap * 100) + '%';
  $('pct').textContent = fmt(pct, 0) + '%';
  $('status').className = 'badge ' + cl; $('status').textContent = st;
  $('tankTitle').textContent = S.mode === 'fam' ? '🏠 Cisterna familiar' : 'Cisterna escolar';
}


/* ---------- ESCUELA Y FAMILIA ---------- */
const AREAS = [['Sanitarios', 35], ['Reserva mínima', 30], ['Cooperativa escolar', 20], ['Riego de plantas', 10], ['Aseo general', 5]];
const resPct = () => AREAS.find(a => a[0] === 'Reserva mínima')[1];   // % de reserva mínima (editable)
const NORMA = 25;                                   // L por alumno al día recomendados (25 a 30 L)
let S = { mode: 'esc', al: 400, dias: 5, lpa: NORMA, hd: 12.5 }, leakInfo = null;   // hd = horas de uso por día
function schoolCalc(mode = 'esc') {
  const fam = mode === 'fam', cap = parseFloat($(fam ? 'fCap' : 'scCap').value), al = parseFloat($(fam ? 'fMem' : 'scAl').value), dias = parseFloat($(fam ? 'fDias' : 'scDias').value), m = $(fam ? 'fMsg' : 'scMsg'), ws = fam ? 'miembros' : 'alumnos';
  if (![cap, al, dias].every(n => Number.isFinite(n) && n > 0) || !Number.isInteger(al) || dias > 7) {
    m.textContent = `⚠️ Usa números mayores que 0 (${ws} entero, máximo 7 días).`; showAlerts([{ i: '⚠️', t: 'Dato inválido', d: `Capacidad y ${ws} deben ser mayores que 0 (${ws} entero) y los días entre 1 y 7.` }]); return false;
  }
  m.textContent = ''; S = { mode: fam ? 'fam' : 'esc', al: fam ? al : al * 2, dias, lpa: NORMA, hd: 12.5 };   // escuela: 2 turnos; familia: sin turnos
  P = { cap, v0: cap, res: resPct() / 100 * cap, cons: S.al * NORMA / S.hd, leak: 0, inp: 0 }; leakInfo = null; render(); return true;
}
/* Alertas: solo aparecen cuando se viola un parámetro */
function collectAlerts() {
  const usable = P.cap - P.res, perDay = (P.cons + P.leak - P.inp) * S.hd, need = perDay * S.dias, out = [], who = S.mode === 'fam' ? 'personas' : 'alumnos';
  if (need > usable) {
    const t = timeReserve(P), maxA = Math.floor(usable / (S.lpa * S.dias));
    out.push({ i: '🛢️', t: 'Capacidad insuficiente', d: `El consumo de ${fmt(need)} L en ${S.dias} día(s) supera los ${fmt(usable)} L utilizables (capacidad menos reserva). La reserva se alcanza a los ${t === null ? '—' : fmt(t / S.hd, 2)} días. Recomendado: máximo ${fmt(maxA, 0)} ${who} con ${fmt(S.lpa)} L por persona al día.` });
  }
  if (need >= P.cap) out.push({ i: '⚠️', t: 'Reserva mínima agotada', d: `El consumo (${fmt(need)} L) iguala o supera la capacidad total (${fmt(P.cap)} L): la reserva mínima de ${fmt(P.res)} L también se agotaría.` });
  return out;
}
function showAlerts(list) {
  if (!list.length) return;
  $('modalBox').innerHTML = list.map(a => `<div class="acard on"><div class="ico">${a.i}</div><h4>¡ALERTA DE SISTEMA!</h4><b>${a.t}</b><span>${a.d}</span></div>`).join('') + '<button class="btn" id="mOk">Aceptar / Ver detalles</button>';
  $('modal').classList.remove('hide'); $('mOk').onclick = closeModal;
}
function showContact() {
  $('modalBox').innerHTML = `<div class="contact"><h3>Contacto</h3><p><b>Atención a Cliente:</b><br><a href="mailto:resquivel25@alu.uabcs.mx">resquivel25@alu.uabcs.mx</a></p><p><b>Teléfono:</b> <a href="tel:6243168023">6243168023</a></p><p><b>Horario:</b> Lunes a Viernes de 7:00 am a 1:00 pm, hora BCS.</p></div><button class="btn" id="mOk">Cerrar</button>`;
  $('modal').classList.remove('hide'); $('mOk').onclick = closeModal;
}
function showEdit() {
  $('modalBox').innerHTML = `<div class="contact"><h3>Editar porcentajes</h3><p>Los porcentajes deben sumar 100 %.</p></div>
  <div class="formcard editbox">${AREAS.map(([n, p], i) => `<label>${n}<span class="inp"><input class="pin" data-i="${i}" type="number" min="0" max="100" step="any" value="${p}"><em>%</em></span></label>`).join('')}</div>
  <div class="note" id="eTot"></div><div class="msg" id="eMsg"></div>
  <div class="editbtns"><button class="btn ghost" id="eCancel">Cancelar</button><button class="btn" id="eSave">Guardar</button></div>`;
  const vals = () => [...document.querySelectorAll('.pin')].map(i => parseFloat(i.value));
  const upd = () => { const v = vals(), ok = v.every(n => Number.isFinite(n) && n >= 0), s = v.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0), good = ok && Math.abs(s - 100) < 0.005;
    $('eTot').className = 'note ' + (good ? 'good' : 'bad'); $('eTot').textContent = `Total: ${fmt(s, 2)} %` + (good ? ' ✔' : ` (faltan ${fmt(100 - s, 2)} %)`); return good; };
  document.querySelectorAll('.pin').forEach(i => i.addEventListener('input', upd)); upd();
  $('modal').classList.remove('hide'); $('eCancel').onclick = closeModal;
  $('eSave').onclick = () => {
    if (!upd()) { $('eMsg').textContent = '⚠️ Los porcentajes deben ser números ≥ 0 y sumar exactamente 100 %.'; return; }
    vals().forEach((v, i) => AREAS[i][1] = v);
    P.res = resPct() / 100 * P.cap; closeModal(); render();
  };
}
function closeModal() { $('modal').classList.add('hide'); }
/* Páginas que dependen de los datos */
function renderCalc() {
  $('resPct').textContent = fmt(resPct(), 2);
  const a = S.al, dias = S.dias, usable = P.cap - P.res, w = S.mode === 'fam' ? 'persona' : 'alumno', ws = S.mode === 'fam' ? 'miembros' : 'alumnos';
  $('calcTable').innerHTML = `<tr><th>Área destino</th><th>Porcentaje (%)</th><th>Volumen semanal</th><th>Litros / ${w} / día</th></tr>` + AREAS.map(([n, p]) => `<tr><td>${n}</td><td>${p} %</td><td>${fmt(P.cap * p / 100, 0)} L</td><td>${fmt(P.cap * p / 100 / (a * dias), 2)} L</td></tr>`).join('') + `<tr><th>TOTAL</th><th>100 %</th><th>${fmt(P.cap, 0)} L</th><th>${fmt(P.cap / (a * dias), 2)} L</th></tr>`;
  const ok = usable / (a * dias) >= NORMA;
  $('calcInfo').innerHTML = `<p><b>Cada ${w} dispone de ${fmt(P.cap / (a * dias), 2)} L al día</b> (${fmt(usable / (a * dias), 2)} L sin tocar la reserva). Se recomiendan 25 a 30 L.</p><p>${ok ? '✔ El agua utilizable alcanza para todo el periodo.' : `⚠️ El agua utilizable no alcanza; la reserva también se agotaría. Reduce ${ws} o aumenta la capacidad.`}</p>`;
}
function renderGraphs() {
  const rate = P.cons + P.leak - P.inp, perDay = rate * S.hd, t = timeReserve(P), tdays = t === null || t === 0 ? null : t / S.hd;
  const days = S.dias;
  $('tW').textContent = `Gráfica semanal: V(t) = ${fmt(P.v0, 0)} − ${fmt(perDay, 0)}t`; $('tD').textContent = 'Gráfica diaria: consumo y volumen por día de la semana';
  const wk = Array.from({ length: 51 }, (_, i) => ({ x: +(days * i / 50).toFixed(3), y: +volAt(P, days * i / 50 * S.hd).toFixed(1) }));
  const rl = x => line('Reserva mínima', [{ x: 0, y: P.res }, { x, y: P.res }], '#38c6e8', { borderDash: [6, 6], borderWidth: 2 });
  const ds = [line('Volumen (L)', wk, '#003e8e', { fill: true, backgroundColor: 'rgba(0,62,142,.1)' }), rl(days)];
  if (tdays !== null && tdays <= days) ds.push({ type: 'scatter', label: `Reserva a los ${fmt(tdays, 2)} días`, data: [{ x: tdays, y: P.res }], backgroundColor: '#38c6e8', borderColor: '#003e8e', borderWidth: 2, pointRadius: 8 });
  draw('chW', { data: { datasets: ds }, options: axes('Tiempo (días)', 'Volumen (L)') });
  const n = Math.min(days, 14), WD = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const labels = Array.from({ length: n }, (_, k) => WD[k]);
  const endV = labels.map((_, k) => +volAt(P, (k + 1) * S.hd).toFixed(1)), used = labels.map((_, k) => +(volAt(P, k * S.hd) - volAt(P, (k + 1) * S.hd)).toFixed(1));
  draw('chD', { data: { labels, datasets: [{ type: 'bar', label: 'Consumo del día (L)', data: used, backgroundColor: '#38c6e8' }, line('Volumen al final del día (L)', endV, '#003e8e', { pointRadius: 4 }), line('Reserva mínima', labels.map(() => P.res), '#d9453d', { borderDash: [6, 6], borderWidth: 2 })] }, options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Litros (L)' } } } } });
}
/* ---------- PÁGINAS Y NAVEGACIÓN ---------- */
const FLOWS = { main: ['p-inicio', 'p-calculo', 'p-resumen', 'p-graficas'], info: ['p-mision', 'p-sensores', 'analisis'] };   // dos recorridos con flechas
const flowOf = id => FLOWS.info.includes(id) ? 'info' : 'main';
const order = (id = cur) => FLOWS[flowOf(id)];
function render() {
  renderDashboard();
  ({ 'p-calculo': renderCalc, 'p-graficas': renderGraphs }[cur] || (() => {}))();
}
function goPage(id) {
  if (!order(id).includes(id)) id = 'p-resumen';
  cur = id; document.querySelectorAll('.page').forEach(x => x.classList.toggle('show', x.id === id));
  const o = order(id), i = o.indexOf(id); $('pgInfo').textContent = `${i + 1} / ${o.length} · ${$(id).dataset.title}`;
  $('prev').disabled = i === 0; $('next').disabled = i === o.length - 1;
  $('nbHome').classList.toggle('on', flowOf(id) === 'main'); $('nbInfo').classList.toggle('on', flowOf(id) === 'info');
  render(); window.scrollTo({ top: 0 });
}
const step = d => { const o = order(), i = o.indexOf(cur) + d; if (i >= 0 && i < o.length) goPage(o[i]); };
document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => goPage(b.dataset.page));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || !$('modal').classList.contains('hide')) return;
  if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1);
});
$('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };
$('prev').onclick = () => step(-1); $('next').onclick = () => step(1);
$('bContact').onclick = showContact;
$('bEdit').onclick = showEdit;
$('scBtn').onclick = () => { if (schoolCalc()) { goPage('p-calculo'); setTimeout(() => showAlerts(collectAlerts()), 400); } };
$('mEsc').onclick = $('mEsc2').onclick = () => { $('famBox').classList.add('hide'); $('schoolCard').classList.remove('hide'); };
$('mFam').onclick = () => { $('famBox').classList.remove('hide'); $('schoolCard').classList.add('hide'); };
$('fBtn').onclick = () => { if (schoolCalc('fam')) { goPage('p-calculo'); setTimeout(() => showAlerts(collectAlerts()), 400); } };
schoolCalc(); goPage('p-inicio');
