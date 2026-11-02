'use strict';
/* UI: hash router, shared state, views. Calculations live in calc.js. */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (v, d = 0) => Number(v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const tl = (v, d = 0) => nf(v, d) + ' TL';
const tps = v => v > 0 ? nf(v, v < 10 ? 1 : 0) + ' tok/sn' : '—';
const dur = s => !Number.isFinite(s) ? '—' : s < 60 ? nf(s) + ' sn' : s < 3600 ? nf(s / 60, s < 600 ? 1 : 0) + ' dk' : nf(s / 3600, 1) + ' sa';
const ansTime = t => { if (!t) return '—'; const s = 1000 / t; return s < 60 ? nf(s) + ' sn' : nf(s / 60, 1) + ' dk'; };
const mTok = v => (v < 1 ? nf(v, 2) : v < 10 ? nf(v, 1) : nf(v)) + ' M';
const gb = v => v >= 1000 ? nf(v / 1000) + ' TB' : nf(v) + ' GB';

/* ---------- icons: simple line icons drawn for this site (24×24, stroke = currentColor) ---------- */
const ICONS = {
  monitor: '<rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M8 20.5h8M12 16.5v4"/>',
  bag: '<path d="M5.5 8h13l-1.1 12.5H6.6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  cloud: '<path d="M7.5 18.5h9.5a4 4 0 0 0 .4-7.98 5.5 5.5 0 0 0-10.6 1.06A3.5 3.5 0 0 0 7.5 18.5z"/>',
  scale: '<path d="M12 4v16M8 20h8M5 7.5h14M12 4l-7 3.5M12 4l7 3.5"/><path d="M5 7.5l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7.5l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/>',
  gauge: '<path d="M3.5 16a8.5 8.5 0 1 1 17 0"/><path d="M12 16l4.5-5.5"/><circle cx="12" cy="16" r="1.2"/>',
  tag: '<path d="M3 12.2V4h8.2l9.3 9.3-8.2 8.2z"/><circle cx="7.6" cy="8.6" r="1.4"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  shield: '<path d="M12 3l7.5 2.8V12c0 4.3-3.2 7.7-7.5 9-4.3-1.3-7.5-4.7-7.5-9V5.8z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.7 2.6 14.3 0 17M12 3.5c-2.6 2.7-2.6 14.3 0 17"/>',
  refresh: '<path d="M19.5 11A7.5 7.5 0 0 0 5.6 7.5M4.5 13a7.5 7.5 0 0 0 13.9 3.5"/><path d="M5 3.5v4.2h4.2M19 20.5v-4.2h-4.2"/>',
  edit: '<path d="M4 20h4.2L19.5 8.7a2.1 2.1 0 0 0-3-3L5.2 17z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  sort: '<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>', up: '<path d="M7 14.5l5-5 5 5"/>', down: '<path d="M7 9.5l5 5 5-5"/>'
};
const icon = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

/* ---------- state ---------- */
const DEFAULT_STATE = () => {
  const d = Calc.cat().defaults;
  return { monthlyTokens: d.monthlyTokens, outputSharePercent: d.outputSharePercent, cachedInputSharePercent: d.cachedInputSharePercent,
    preset: null, taskType: 'short', model: 'q27', privacy: false, budget: d.budget, horizon: d.horizon, hoursPerDay: d.hoursPerDay,
    usdTry: (Calc.live().usdTry && Calc.live().usdTry.value) || d.usdTry, usdYearly: 0, tlYearly: 0, foreignTax: 0, resale: false, depreciation: 25,
    offerSel: {}, caps: {}, cloudClass: 'all', cmpClass: 'equiv', cmpLocal: 'custom', cmpCloud: '', buyFilter: 'all', sysView: 'table', tariff: {}, tokScale: 'log', metDev: 6, metModel: 0, sorts: {}, cloudSort: 'monthly',
    build: { gpu: 'gpu5070', gpuCount: 1, cpu: 'cpu7500f', mobo: 'moboB650', ram: 'ram64', ssd: 'ssd2', psu: 'psu850', case: 'caseMid', cooler: 'cooler' },
    mine: { gpu: 'rtx3060', vram: 12, watts: 170, ram: 32, ramType: 'DDR5', ssd: 500 } };
};
let S, LIVE_STATUS = null;
const liveStatusText = () => LIVE_STATUS ? `Canlı (tarayıcından, ${LIVE_STATUS.at.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}): ${LIVE_STATUS.api} API fiyatı${LIVE_STATUS.rate ? ` · 1 $ = ${nf(LIVE_STATUS.rate, 2)} TL` : ''}` : 'Canlı veriler yükleniyor…';
const STORE_KEY = 'yerel-ai-state-v2';
function loadState() {
  S = DEFAULT_STATE();
  try { Object.assign(S, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) {}
  const q = new URLSearchParams(location.search).get('s');
  if (q) try { Object.assign(S, JSON.parse(decodeURIComponent(escape(atob(q))))); } catch (e) {}
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} }
function set(k, v) { S[k] = v; save(); }
function shareUrl() { const d = DEFAULT_STATE(), diff = {}; for (const k in S) if (JSON.stringify(S[k]) !== JSON.stringify(d[k])) diff[k] = S[k]; return location.origin + location.pathname + '?s=' + btoa(unescape(encodeURIComponent(JSON.stringify(diff)))) + location.hash; }

/* ---------- shared pieces ---------- */
const MINE_GPUS = [ // id, label, VRAM GB, watts, prefill tok/s (Qwen 125B, estimate), vendor, memory bandwidth GB/s
  ['none', 'Ekran kartı yok / bilmiyorum', 0, 0, 0, '', 0], ['rtx3060', 'RTX 3060 12 GB', 12, 170, 900, 'NVIDIA', 360], ['rtx3060ti', 'RTX 3060 Ti 8 GB', 8, 200, 1000, 'NVIDIA', 448], ['rtx3070', 'RTX 3070 8 GB', 8, 220, 1100, 'NVIDIA', 448], ['rtx3080', 'RTX 3080 10 GB', 10, 320, 1500, 'NVIDIA', 760], ['rtx3090', 'RTX 3090 24 GB', 24, 350, 2000, 'NVIDIA', 936],
  ['rtx4060', 'RTX 4060 8 GB', 8, 115, 700, 'NVIDIA', 272], ['rtx4060ti16', 'RTX 4060 Ti 16 GB', 16, 165, 700, 'NVIDIA', 288], ['rtx4070', 'RTX 4070 12 GB', 12, 200, 1600, 'NVIDIA', 504], ['rtx4070ti', 'RTX 4070 Ti 12 GB', 12, 285, 2000, 'NVIDIA', 504], ['rtx4080', 'RTX 4080 16 GB', 16, 320, 2600, 'NVIDIA', 717], ['rtx4090', 'RTX 4090 24 GB', 24, 450, 3500, 'NVIDIA', 1008],
  ['rtx5060ti', 'RTX 5060 Ti 16 GB', 16, 180, 600, 'NVIDIA', 448], ['rtx5070', 'RTX 5070 12 GB', 12, 250, 2090, 'NVIDIA', 672], ['rtx5070ti', 'RTX 5070 Ti 16 GB', 16, 300, 2400, 'NVIDIA', 896], ['rtx5080', 'RTX 5080 16 GB', 16, 360, 2700, 'NVIDIA', 960], ['rtx5090', 'RTX 5090 32 GB', 32, 575, 5000, 'NVIDIA', 1792],
  ['rx6800', 'RX 6800 16 GB', 16, 250, 600, 'AMD-RDNA2', 512], ['rx7800xt', 'RX 7800 XT 16 GB', 16, 263, 800, 'AMD-RDNA3', 624], ['rx7900xt', 'RX 7900 XT 20 GB', 20, 315, 1100, 'AMD-RDNA3', 800], ['rx7900xtx', 'RX 7900 XTX 24 GB', 24, 355, 1300, 'AMD-RDNA3', 960], ['rx9060xt', 'RX 9060 XT 16 GB', 16, 160, 700, 'AMD', 320], ['rx9070xt', 'RX 9070 XT 16 GB', 16, 304, 1110, 'AMD', 640], ['r9700', 'Radeon AI PRO R9700 32 GB', 32, 300, 1200, 'AMD', 640],
  ['mac', 'Mac (Apple Silicon)', 0, 0, 0, 'Apple', 0]];
const STATUS = { ok: ['ok', 'Rahat çalışır', 'check'], slow: ['slow', 'Yavaş', 'alert'], no: ['no', 'Çalışmaz', 'x'] };
const badge = st => `<span class="badge ${STATUS[st][0]}">${icon(STATUS[st][2], 'bi')}${STATUS[st][1]}</span>`;
function pageHead(ic, eyebrow, title, lead) {
  return `<header class="page-head"><span class="ph-ic">${icon(ic)}</span><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div></header>`;
}
const step = (n, title, sub = '', right = '') => `<div class="step"><span class="sn">${n}</span><div class="st"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>`;
const segButtons = (attr, items, cur) => `<div class="seg small" role="group">${items.map(([k, l]) => `<button type="button" data-${attr}="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;

function presetButtons() {
  return `<div class="presets">${Calc.cat().usagePresets.map(p => `<button type="button" class="preset${S.preset === p.id ? ' on' : ''}" data-preset="${p.id}"><b>${esc(p.label)}</b><small>${nf(p.calls)} çağrı × ${nf(p.tokens)} token · ${p.days} gün</small><em>${nf(p.calls * p.tokens * p.days / 1e6, 1)} M/ay</em></button>`).join('')}</div>`;
}
const FAMILIES = ['Qwen', 'Gemma', 'Llama', 'gpt-oss', 'Mistral', 'DeepSeek', 'Phi', 'GLM'];
const QUICK = ['q27', 'g:gemma3-27b', 'g:gptoss-20b', 'g:gptoss-120b', 'g:llama33-70b', 'g:mistralsmall32-24b', 'qwen', 'deepseek'];
const sizeLabel = m => m.total ? (m.moe && m.active ? `${nf(m.total)}B / ${nf(m.active, m.active % 1 ? 1 : 0)}B etkin` : `${nf(m.total)}B`) : '';
// a few models from different families, the selected one first (computer cards, builder)
const mixModels = () => [...new Set([S.model, 'q27', 'g:gemma3-27b', 'g:gptoss-20b', 'g:gptoss-120b', 'g:llama33-70b', 'g:mistralsmall32-24b', 'qwen', 'deepseek'])].filter(id => Calc.MODELS[id]).slice(0, 8);
// every model on one computer: speed, status and task time (current task type), grouped by family order
function allModelsTable(c) {
  const T = Calc.cat().taskTypes, tk = T[S.taskType] || T.short, rank = { ok: 0, slow: 1, no: 2 };
  const rows = Calc.localModels().map(m => { const sp = Calc.speed(c, m.id); return { m, sp, tt: sp.tps ? Calc.taskTime(c, m.id, S).total : Infinity }; })
    .sort((a, b) => rank[a.sp.status] - rank[b.sp.status] || b.sp.tps - a.sp.tps);
  return `<table class="mini-t"><thead><tr><th>Model</th><th class="num">Yazma</th><th class="num">${esc(tk.label)}</th></tr></thead><tbody>${rows.map(({ m, sp, tt }) => `<tr class="${sp.status === 'no' ? 'dimrow' : ''}${m.id === S.model ? ' on' : ''}"><td><span class="dot ${sp.status}"></span>${esc(m.short)} <small>${m.family}</small></td><td class="num">${tps(sp.tps)}</td><td class="num">${dur(tt)}</td></tr>`).join('')}</tbody></table>`;
}
function modelPicker() {
  const fam = {}; for (const m of Calc.localModels()) (fam[m.family] = fam[m.family] || []).push(m);
  return `<div class="model-pick">${segButtons('model', QUICK.filter(id => Calc.MODELS[id]).map(id => [id, esc(Calc.MODELS[id].short)]), S.model)}
   <label class="f"><span>Tüm modeller (${Calc.localModels().length}) · aileye göre</span><select data-modelsel>${FAMILIES.filter(f => fam[f]).map(f => `<optgroup label="${f}">${fam[f].map(m => `<option value="${m.id}"${m.id === S.model ? ' selected' : ''}>${esc(m.label)}${sizeLabel(m) ? ' · ' + sizeLabel(m) : ''}</option>`).join('')}</optgroup>`).join('')}</select></label></div>`;
}
function taskToggle() { const T = Calc.cat().taskTypes; return `<div class="seg" role="group" aria-label="Görev tipi">${Object.entries(T).map(([k, t]) => `<button type="button" data-task="${k}" aria-pressed="${S.taskType === k}"><b>${t.label}</b><small>${nf(t.out / 1000)}K yazar · ${nf(t.ctx / 1000)}K okur · ${t.desc}</small></button>`).join('')}</div>`; }
function usagePanel(opts = {}) {
  return `<section class="card usage">
  <div class="row-label first">Kullanım profili</div>${presetButtons()}
  <div class="fields">
   <label class="f"><span>Aylık çıktı tokeni (milyon)</span><input type="number" min="0.01" max="1000" step="0.5" data-k="monthlyTokens" value="${S.monthlyTokens}"></label>
   <label class="f"><span>Çıktı payı (%) <i class="hint" title="Modelin yazdığı / (okuduğu + yazdığı). Kod ajanları büyük bağlam gönderdiği için %1–10, sohbet %20–30.">?</i></span><input type="number" min="1" max="100" data-k="outputSharePercent" value="${S.outputSharePercent}"></label>
   ${opts.budget ? `<label class="f"><span>Bilgisayar bütçesi (TL)</span><input type="number" min="0" max="700000" step="5000" data-k="budget" value="${S.budget}"></label>` : ''}
   ${opts.horizon !== false ? `<label class="f"><span>Karşılaştırma süresi (ay)</span><input type="number" min="1" max="120" data-k="horizon" value="${S.horizon}"></label>` : ''}
  </div>
  <div class="row-label">Tipik bir görev <i class="hint" title="Düşünen modeller ve kodlama ajanları bir görevde 15–50 bin token harcayabilir; ajanlar işe ~30 bin tokenlik bağlamla başlar. Görev süresi = bağlamı okuma + cevabı yazma.">?</i></div>${taskToggle()}
  ${opts.model !== false ? `<div class="row-label">Bilgisayarda çalışacak model</div>${modelPicker()}` : ''}
  ${opts.privacy !== false ? `<label class="check"><input type="checkbox" data-k="privacy" ${S.privacy ? 'checked' : ''}> <span><b>Gizlilik şart</b> · kodum/verim bilgisayardan çıkamaz (bulut seçenekleri elenir)</span></label>` : ''}
  <details class="more"><summary>Önbellek ve günlük çalışma saati</summary><div class="fields">
   <label class="f"><span>API önbellekten okunan girdi (%)</span><input type="number" min="0" max="100" step="5" data-k="cachedInputSharePercent" value="${S.cachedInputSharePercent}"></label>
   <label class="f"><span>Bilgisayar günde kaç saat üretir?</span><input type="number" min="0.5" max="24" step="0.5" data-k="hoursPerDay" value="${S.hoursPerDay}"></label></div></details>
  </section>`;
}
function partsList(c) {
  if (c.kind === 'mac') return `<ul class="parts"><li><span>${esc(c.appleName)}</span><b>${tl(c.price)}</b><a href="${esc(c.url)}" target="_blank" rel="noopener">Apple Türkiye</a></li></ul>`;
  const rows = c.items.flatMap(i => i.part.cat === 'gpu' && c.gpus > 1 ? [i, i] : [i]);
  return `<ul class="parts">${rows.map(i => { const n = Calc.offers(i.key).length; return `<li><span>${esc(i.part.label)}<small>${esc(i.offer.name)}</small></span><b>${tl(i.offer.price)}</b><a href="${esc(i.offer.url)}" target="_blank" rel="noopener">${esc(i.offer.store)}</a>${n > 1 ? `<a href="#fiyatlar" class="muted" title="Diğer mağazalar">+${n - 1} mağaza</a>` : ''}</li>`; }).join('')}</ul>`;
}
function specLine(c) {
  if (c.kind === 'mac') return `${c.ram} GB birleşik bellek · Apple Türkiye fiyatı`;
  const g = c.items.find(i => i.part.cat === 'gpu'), cpu = c.items.find(i => i.part.cat === 'cpu'), ram = c.items.find(i => i.part.cat === 'ram');
  return `${c.gpus > 1 ? c.gpus + '× ' : ''}${esc(g.part.label)} · ${esc(cpu.part.label)} · ${esc(ram.part.label)}`;
}
const speedSub = sp => `${sp.measured ? 'ölçüm' : 'tahmin'}${sp.q && sp.q !== '—' ? ' · ' + sp.q : ''}`;
function computerCard(c, opts = {}) {
  const sp = Calc.speed(c, S.model), cap = Calc.capacity(c, S.model, S), el = Calc.electricity(c, S.model, S).tl, tt = Calc.taskTime(c, S.model, S);
  const short = cap < S.monthlyTokens;
  return `<article class="pc${opts.highlight ? ' hl' : ''}">
   ${opts.tag ? `<span class="tag">${opts.tag}</span>` : ''}
   <div class="pc-top"><h3>${esc(c.name)}</h3><strong>${tl(c.price)}${c.estimatedPrice ? ' ≈' : ''}</strong></div>
   <p class="muted small">${specLine(c)}</p>
   <div class="pc-stats"><div><span>${Calc.MODELS[S.model].short}</span><b>${tps(sp.tps)}</b><small>${speedSub(sp)}</small></div><div><span>Görev süresi</span><b>${dur(tt.total)}</b><small>okuma ${dur(tt.read)} + yazma ${dur(tt.write)}</small></div><div><span>Ek elektrik</span><b>${tl(el)}/ay</b><small>${nf(S.monthlyTokens, 1)} M çıktı</small></div></div>
   <div class="badges">${badge(sp.status)}${short ? ` <span class="badge no">Yetmez: en fazla ${nf(cap, 1)} M/ay</span>` : ''}</div>
   <ul class="mrow" aria-label="Modellere göre yazma hızı ve görev süresi">${mixModels().map(m => { const s2 = Calc.speed(c, m); return `<li class="${m === S.model ? 'on' : ''}"><span class="dot ${s2.status}"></span><span>${Calc.MODELS[m].short}</span><b>${tps(s2.tps)}</b><small>${s2.tps ? dur(Calc.taskTime(c, m, S).total) : '—'}</small></li>`; }).join('')}</ul>
   <p class="small muted">${esc(sp.note)}</p>
   ${opts.reason ? `<p class="small reason">${opts.reason}</p>` : ''}
   <details class="more"><summary>Tüm modeller (${Calc.localModels().length})</summary>${allModelsTable(c)}</details>
   <details class="more"><summary>Parçalar ve mağazalar</summary>${partsList(c)}</details>
   <div class="actions"><button type="button" class="btn ghost small" data-compare="${c.id}">Bulutla karşılaştır ${icon('arrow', 'bi')}</button></div>
  </article>`;
}
function mineComputer() {
  const m = S.mine, uni = m.gpu === 'mac';
  const hw = { vram: uni ? 0 : m.vram, ram: m.ram, ramType: uni ? 'unified' : m.ramType, ssd: m.ssd };
  const d14 = Calc.estimate('dense14', hw);
  const g = MINE_GPUS.find(x => x[0] === m.gpu) || [];
  return { id: 'mine', pp: g[4], vendor: g[5], bw: g[6] || undefined, gpuLabel: g[1], name: 'Elindeki bilgisayar', kind: uni ? 'mac' : 'pc', price: 0, vram: hw.vram, gpuVram: hw.vram, ram: m.ram, ramType: hw.ramType, ssd: m.ssd, watts: uni ? 60 : (m.watts || 0) + 120, tps14: d14.tps, gpus: 1, items: [], appleName: 'Kendi Mac’in', url: '#' };
}
function recModels(c) {
  const v = c.vram, r = c.ram, uni = c.ramType === 'unified', out = [];
  if (uni) {
    if (r >= 64) out.push(['Qwen3.8-Flash-Next 125B (Strata)', 'Model bellekte kalır; en güçlü seçenek.']);
    if (r >= 32) out.push(['Qwen3.8 27B · 4 bit (≈17 GB)', 'Hız bellek bant genişliğine bağlı: M5 Max (614 GB/sn) ≈30 tok/sn, M5 Pro ≈15, M6 (≈150 GB/sn) ≈10.']);
    if (r < 32) out.push(['Qwen3.6-35B veya 4–9B modeller', 'Büyük modeller SSD’den okunur ve yavaşlar.']);
    return out;
  }
  if (v >= 12 && r >= 46) out.push(['Qwen3.8-Flash-Next 125B (Strata)', `125B MoE; uzmanlar RAM’de. ${v >= 16 ? '≈60–100' : '≈80–95'} tok/sn.`]);
  if (v >= 20) out.push(['Qwen3.8 27B · 4 bit (≈16,5 GB)', v >= 24 ? 'Tamamı kartta; 24 GB kartta çoklu token tahminiyle ≈66 tok/sn.' : 'Tamamı kartta sığar; bağlam için birkaç GB kalır.']);
  else if (v >= 16) out.push(['Qwen3.8 27B · 3,5 bit (≈11,8 GB)', 'Varsayılan Q4 dosyası (16,5 GB) 16 GB karta sığmaz; masaüstü zaten 1–2 GB kullanır. 3,5 bit ile ≈45 tok/sn ve ≈110K bağlam.']);
  else if (v >= 12) out.push(['Qwen3.8 27B · 2–3 bit (≈8–10 GB)', 'Sohbet için iyi; dosyayı kimin hazırladığı çok fark eder (aynı boyutta 16/20’ye karşı 7/20 hata düzeltme).'], ['LFM 2.5 24B', 'Çok hızlı (RTX 3060’ta ≈87 tok/sn), hafif işler için.']);
  if (v >= 6 && v < 16 && r >= 32) out.push(['Qwen3.6-35B-A3B (uzmanlar RAM’de)', 'Her kelimede ~3B parametre okur; 6–8 GB kart + 32 GB RAM ile ≈23 tok/sn. 8 GB kartta 27B yoğun modelden çok daha hızlı.']);
  if (v >= 6 && v <= 8) out.push(['Gemma 4 12B · 3 bit (≈5,7 GB)', 'Tamamı kartta; sohbet ve kısa işler için.']);
  if (r < 32 && v < 12) out.push(['RAM’i 32 GB’a çıkar', '8 GB kartta asıl sınır RAM: 35B MoE modeli için 32 GB taban.']);
  return out.length ? out : [['Küçük modeller (4–9B)', 'Ekran kartı belleği sınırlı; bulut seçeneklerine de bak.']];
}
function engineTips(c) {
  const t = [];
  if (c.ramType === 'unified') t.push('<b>Mac:</b> macOS ekran kartına belleğin yaklaşık 3/4’ünü verir (128 GB’ta ≈96 GB); bir terminal ayarıyla artırılabilir.', '<b>Bağlamı büyüt:</b> bazı araçlar 24–48 GB Mac’te varsayılan bağlamı 32K tutar; ajanın ilk isteği tek başına ≈33K. Ajanlar için en az 64K ayarla.', '<b>Önbelleği bozma:</b> sohbetin başı değişirse model tüm bağlamı baştan okur; bu bir Mac’te dakikalar sürebilir.');
  else if ((c.vendor || '').startsWith('AMD-RDNA3')) t.push('<b>AMD RX 7000:</b> Strata’nın yanında llama.cpp tabanlı Avalon gibi motorları dene; aynı kartta %30–50 fark görülebiliyor.');
  else if ((c.vendor || '').startsWith('AMD')) t.push('<b>AMD:</b> Strata’nın HIP motoru RX 9060/9070 ve R9700’ü destekliyor.');
  else t.push('<b>NVIDIA:</b> Qwen 125B ve DeepSeek için Strata; yoğun modeller için llama.cpp. llama.cpp’nin yeni “uzman önbelleği” 24–32 GB kartlarda MoE modelleri %50’ye kadar hızlandırıyor (8 GB kartta yavaşlatabilir).');
  t.push('<b>Motor donanım kadar önemli:</b> aynı makinede motor değişince okuma hızı 10 kata kadar değişebiliyor.');
  return t;
}
function customComputer() {
  const b = S.build, keys = [b.gpu, b.cpu, b.mobo, b.ram, b.ssd, b.psu, b.case, b.cooler];
  return Calc.pcFromKeys('custom', 'Kendi topladığın sistem', keys, b.gpuCount || 1, S.offerSel);
}
function allLocal() { return [customComputer(), ...Calc.computers(S.offerSel)]; }

/* ---------- small visual helpers ---------- */
// 100% stacked bar per row: where does the time of a task go (reading the context vs writing the answer)?
function taskBars(rows) {
  return `<div class="tbars">${rows.map(r => { const tot = r.read + r.write, rp = Number.isFinite(tot) && tot > 0 ? r.read / tot * 100 : 0; return `<div class="tb-row"><span class="tb-l">${r.label}<small>${r.sub || ''}</small></span><span class="tb-bar"><i class="rd" style="width:${rp}%">${rp > 18 ? dur(r.read) : ''}</i><i class="wr" style="width:${100 - rp}%">${100 - rp > 18 ? dur(r.write) : ''}</i></span><b>${dur(tot)}</b></div>`; }).join('')}</div>
  <div class="legend"><span><i class="k-rd"></i>Okuma (bağlam, prefill)</span><span><i class="k-wr"></i>Yazma (cevap, decode)</span></div>`;
}
// sortable tables: header buttons carry data-sort="table:key"; non-finite values always go last
const SORT_DEF = { tps: -1, pp: -1 };
const sortState = (t, k) => (S.sorts && S.sorts[t]) || { k, d: SORT_DEF[k] || 1 };
function sortBy(rows, get, d) {
  return [...rows].sort((a, b) => { const x = get(a), y = get(b), fx = typeof x === 'string' || Number.isFinite(x), fy = typeof y === 'string' || Number.isFinite(y);
    if (!fx || !fy) return fx === fy ? 0 : fx ? -1 : 1; return (typeof x === 'string' ? x.localeCompare(y, 'tr') : x - y) * d; });
}
const th = (t, k, label, st, cls = '') => `<th class="${cls}" aria-sort="${st.k === k ? (st.d > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="th-sort${st.k === k ? ' on' : ''}" data-sort="${t}:${k}">${label}${icon(st.k === k ? (st.d > 0 ? 'up' : 'down') : 'sort', 'bi')}</button></th>`;
// bars on a common scale (to compare models), split into reading and writing time
function absTaskBars(rows) {
  const max = Math.max(...rows.map(r => r.read + r.write).filter(Number.isFinite), 1e-9);
  return `<div class="tbars">${rows.map(r => { const a = r.read / max * 100, b = r.write / max * 100; return `<div class="tb-row"><span class="tb-l">${r.label}<small>${r.sub || ''}</small></span><span class="tb-bar abs"><i class="rd" style="width:${a}%">${a > 14 ? dur(r.read) : ''}</i><i class="wr" style="width:${b}%">${b > 14 ? dur(r.write) : ''}</i></span><b>${dur(r.read + r.write)}</b></div>`; }).join('')}</div>
  <div class="legend"><span><i class="k-rd"></i>Okuma (bağlam, prefill)</span><span><i class="k-wr"></i>Yazma (cevap, decode)</span></div>`;
}
const meter = (v, max, cls) => `<span class="meter ${cls || ''}"><i style="width:${Math.max(2, Math.min(100, v / max * 100))}%"></i></span>`;

/* ---------- line chart (SVG): linear or logarithmic axes, limits drawn dashed, vertical markers ---------- */
function niceStep(raw) { const e = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 2.5, 5, 10]) if (m * e >= raw - 1e-9) return m * e; return 10 * e; }
const axTL = v => v === 0 ? '0' : v >= 1e6 ? nf(v / 1e6, v % 1e6 ? 1 : 0) + ' mn' : v >= 1e3 ? nf(v / 1e3, v % 1e3 && v < 1e4 ? 1 : 0) + ' bin' : nf(v, v < 10 && v % 1 ? 1 : 0);
function xyChart(box, o) {
  if (!box) return;
  // draw at the box's own width so that labels keep their size on phones
  const W = Math.round(Math.min(900, Math.max(320, box.clientWidth || 900))), narrow = W < 600;
  const H = narrow ? 270 : 330, L = narrow ? 50 : 64, R = narrow ? 22 : 34, T = 26, B = 34, iw = W - L - R, ih = H - T - B, X = { ...o.x };
  if (narrow && X.ticks.length > 5) X.ticks = X.ticks.filter((_, i, a) => i % 2 === 0);
  const l0 = Math.log10(X.lo || 1e-9), l1 = Math.log10(X.hi);
  const xs = X.log ? v => L + (Math.log10(Math.max(v, X.lo)) - l0) / (l1 - l0) * iw : v => L + (v - X.lo) / (X.hi - X.lo) * iw;
  const xinv = px => { const r = Math.min(1, Math.max(0, (px - L) / iw)); return X.log ? Math.pow(10, l0 + r * (l1 - l0)) : X.lo + r * (X.hi - X.lo); };
  const pts = Array.from({ length: 181 }, (_, i) => xinv(L + iw * i / 180));
  const vals = o.series.flatMap(s => pts.map(s.f)).filter(v => Number.isFinite(v) && (!o.logY || v > 0));
  let ys, yt;
  if (o.logY) {
    const mx = Math.max(1, ...vals), mn = Math.max(Math.min(...vals), mx / 1e6);
    const a = Math.floor(Math.log10(mn)), b = Math.max(a + 1, Math.ceil(Math.log10(mx)));
    ys = v => T + ih - (Math.log10(Math.max(v, 10 ** a)) - a) / (b - a) * ih; yt = Array.from({ length: b - a + 1 }, (_, i) => 10 ** (a + i));
  } else {
    const mx = Math.max(1, ...vals) * 1.04, st = niceStep(mx / 4), top = Math.ceil(mx / st) * st;
    ys = v => T + ih - v / top * ih; yt = Array.from({ length: Math.round(top / st) + 1 }, (_, i) => i * st);
  }
  let g = `<text x="${L - 10}" y="${T - 12}" class="ax unit" text-anchor="end">TL</text>`;
  for (const v of yt) g += `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" class="grid"/><text x="${L - 10}" y="${ys(v) + 4}" class="ax" text-anchor="end">${axTL(v)}</text>`;
  for (const v of X.ticks) g += (X.log ? `<line x1="${xs(v)}" x2="${xs(v)}" y1="${T}" y2="${T + ih}" class="grid"/>` : '') + `<text x="${xs(v)}" y="${H - 10}" class="ax" text-anchor="middle">${X.fmt(v)}</text>`;
  const path = arr => arr.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
  let lines = '';
  for (const s of o.series) {
    const lim = Number.isFinite(s.limit) ? s.limit : Infinity, inside = lim > X.lo && lim < X.hi;
    const P = pts.map(t => [t, s.f(t)]).filter(([, v]) => Number.isFinite(v));
    const a = P.filter(([t]) => t <= lim).map(([t, v]) => [xs(t), ys(v)]), b = P.filter(([t]) => t > lim).map(([t, v]) => [xs(t), ys(v)]);
    if (inside) { const pl = [xs(lim), ys(s.f(lim))]; a.push(pl); b.unshift(pl); }
    if (a.length > 1) lines += `<path d="${path(a)}" stroke="${s.color}" class="ln"${s.dash ? ' stroke-dasharray="8 6"' : ''}/>`;
    if (b.length > 1) lines += `<path d="${path(b)}" stroke="${s.color}" class="ln over" stroke-dasharray="2 5"/>`;
    if (inside) lines += `<circle cx="${xs(lim)}" cy="${ys(s.f(lim))}" r="4.5" class="dot" stroke="${s.color}"/>`;
  }
  let mk = '';
  for (const m of o.markers || []) if (m.x > X.lo && m.x < X.hi) { const px = xs(m.x), right = px > W - (narrow ? 150 : 200); mk += `<line x1="${px}" x2="${px}" y1="${T - 4}" y2="${T + ih}" class="mk"/><text x="${right ? px - 6 : px + 6}" y="${T - 10}" class="mkt" text-anchor="${right ? 'end' : 'start'}">${esc(m.label)}</text>`; }
  box.innerHTML = `<div class="chartbox"><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(o.label || 'Grafik')}">${g}${mk}${lines}<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ih}" visibility="hidden"/></svg><div class="ctip" hidden></div></div>
   <div class="legend">${o.series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}${o.series.some(s => Number.isFinite(s.limit)) ? '<span class="muted"><i class="k-dot"></i>noktalı: kapasite / kota aşıldı (ek bilgisayar / abonelik)</span>' : ''}</div>`;
  const svg = $('svg', box), tip = $('.ctip', box), xh = $('.xh', svg);
  svg.onpointermove = e => {
    const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W;
    if (sx < L || sx > W - R) { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); return; }
    const t = xinv(sx); xh.setAttribute('x1', sx); xh.setAttribute('x2', sx); xh.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<b>${X.tip(t)}</b>` + o.series.map(s => `<div><i style="background:${s.color}"></i>${esc(s.name)}: <b>${tl(s.f(t))}</b>${(s.note ? s.note(t) : Number.isFinite(s.limit) && t > s.limit ? 'sınır aşıldı' : '') ? `<small class="bad">${esc(s.note ? s.note(t) : 'sınır aşıldı')}</small>` : ''}</div>`).join('');
    const bx = box.getBoundingClientRect();
    tip.style.left = Math.max(0, Math.min(bx.width - tip.offsetWidth - 4, e.clientX - bx.left + 14)) + 'px'; tip.style.top = (e.clientY - bx.top + 14) + 'px';
  };
  svg.onpointerleave = () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); };
}

/* ---------- scatter chart: price vs speed of every system ---------- */
function scatterChart(box, pts, o) {
  if (!box || !pts.length) return;
  const W = Math.round(Math.min(900, Math.max(320, box.clientWidth || 900))), narrow = W < 600;
  const H = narrow ? 300 : 380, L = narrow ? 46 : 58, R = narrow ? 14 : 24, T = 26, B = 40, iw = W - L - R, ih = H - T - B;
  const xs0 = pts.map(p => p.x), lo = Math.min(...xs0, o.budget) * 0.85, hi = Math.max(...xs0, o.budget) * 1.1, l0 = Math.log10(lo), l1 = Math.log10(hi);
  const x = v => L + (Math.log10(v) - l0) / (l1 - l0) * iw;
  const ymax0 = Math.max(10, ...pts.map(p => p.y)) * 1.08, st = niceStep(ymax0 / 4), ymax = Math.ceil(ymax0 / st) * st, y = v => T + ih - v / ymax * ih;
  let g = `<text x="${L - 8}" y="${T - 12}" class="ax unit" text-anchor="end">tok/sn</text><text x="${W - R}" y="${H - 4}" class="ax" text-anchor="end">fiyat, TL (logaritmik)</text>`;
  for (let v = 0; v <= ymax + 1e-9; v += st) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 8}" y="${y(v) + 4}" class="ax" text-anchor="end">${nf(v)}</text>`;
  for (const v of [50000, 75000, 100000, 150000, 200000, 300000, 500000, 750000, 1000000]) if (v >= lo && v <= hi && (!narrow || [50000, 100000, 200000, 500000, 1000000].includes(v)))
    g += `<line x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${T + ih}" class="grid"/><text x="${x(v)}" y="${H - 20}" class="ax" text-anchor="middle">${nf(v / 1000)} bin</text>`;
  const bx = x(o.budget);
  g += `<rect x="${bx}" y="${T}" width="${W - R - bx}" height="${ih}" class="over-budget"/><line x1="${bx}" x2="${bx}" y1="${T - 6}" y2="${T + ih}" class="mk"/><text x="${bx + (bx > W - 150 ? -6 : 6)}" y="${T - 10}" class="mkt" text-anchor="${bx > W - 150 ? 'end' : 'start'}">Bütçe ${tl(o.budget)}</text>`;
  const order = [...pts].sort((a, b) => !!a.tag - !!b.tag);
  const dots = order.map(p => `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="${p.tag ? 8 : 5.5}" class="pt ${p.st}${p.x > o.budget ? ' out' : ''}${p.tag ? ' pick' : ''}"/>`).join('');
  // labels for the recommended systems: try right, left, above, below; skip spots that hit another label or a pick
  const placed = [], picks = order.filter(p => p.tag), hit = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  const labels = picks.map(p => {
    const px = x(p.x), py = y(p.y), w = p.tag.length * 6.6 + 4, cand = [[px + 12, py + 4, 'start'], [px - 12, py + 4, 'end'], [px - w / 2, py - 14, 'start'], [px - w / 2, py + 22, 'start'], [px + 12, py - 12, 'start'], [px + 12, py + 20, 'start']];
    let pick = cand[0];
    for (const c of cand) { const x1 = c[2] === 'end' ? c[0] - w : c[0], box = { x1, x2: x1 + w, y1: c[1] - 12, y2: c[1] + 3 };
      if (box.x1 < L || box.x2 > W - 2 || box.y1 < T - 4) continue;
      if (placed.some(b => hit(box, b)) || picks.some(q => q !== p && hit(box, { x1: x(q.x) - 9, x2: x(q.x) + 9, y1: y(q.y) - 9, y2: y(q.y) + 9 }))) continue;
      pick = c; placed.push(box); break; }
    return `<text x="${pick[0]}" y="${pick[1]}" class="ptl" text-anchor="${pick[2]}">${esc(p.tag)}</text>`;
  }).join('');
  box.innerHTML = `<div class="chartbox"><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Fiyat ve hız">${g}${dots}${labels}</svg><div class="ctip" hidden></div></div>
   <div class="legend"><span><i class="k-ok"></i>Rahat çalışır</span><span><i class="k-over"></i>Yavaş</span><span><i class="k-bad"></i>Çalışmaz</span><span><i class="k-ring"></i>Önerilen</span><span class="muted">gölgeli alan: bütçe üstü</span></div>`;
  const svg = $('svg', box), tip = $('.ctip', box);
  svg.onpointermove = e => {
    const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W, sy = (e.clientY - r.top) / r.height * H;
    let best = null, bd = 28; for (const p of pts) { const d = Math.hypot(x(p.x) - sx, y(p.y) - sy); if (d < bd) { bd = d; best = p; } }
    if (!best) { tip.hidden = true; return; }
    tip.hidden = false; tip.innerHTML = `<b>${esc(best.name)}</b><div>${tl(best.x)} · <b>${tps(best.y)}</b></div><div class="muted">${best.sub}</div>${best.tag ? `<div class="ok-t">${esc(best.tag)}</div>` : ''}`;
    const b = box.getBoundingClientRect(); tip.style.left = Math.max(0, Math.min(b.width - tip.offsetWidth - 4, e.clientX - b.left + 14)) + 'px'; tip.style.top = (e.clientY - b.top + 14) + 'px';
  };
  svg.onpointerleave = () => { tip.hidden = true; };
}
let BUY_CHART = null;
function drawBuyCharts() { if (BUY_CHART) scatterChart($('#buychart'), BUY_CHART.pts, { budget: S.budget }); }

/* ---------- views ---------- */
const VIEWS = {};
const LESSONS = [
  ['Okuma ≠ yazma', '“12 GB kartta 100+ tok/sn” paylaşımları çoğu zaman okuma hızı. DeepSeek 763B aynı kartta 4–6 tok/sn yazıyor; Qwen 125B ≈94.'],
  ['Görev süresi, tok/sn’den önemli', 'Düşünen modeller bir görevde 15–50 bin token harcayabilir; ajanlar işe 30 bin tokenlik bağlamla başlar. Hızlı ama çok konuşan model daha geç bitirebilir.'],
  ['Darboğaz kapasite', 'Model ekran kartına sığmayınca RAM ve SSD belirleyici olur. 16 GB kartta Q4 değil 3,5 bit; 8 GB kartta 32 GB RAM asıl şart.'],
  ['Motor donanım kadar önemli', 'Aynı makinede motor değişince hız 1,5–10 kat değişebiliyor. Hızlar zamanla değişir.'],
  ['RAM pahalandı, token ucuzladı', '64 GB DDR5 bir yılda ≈6 kat; aynı dönemde API fiyatları düştü. Gizlilik şart değilse kiralamak çoğu kişiye ucuz.'],
  ['Yerel her zaman gizli değil', 'Sunucuyu dışarı açma, motorları güncel tut, modeli tanınmış yapımcıdan indir.']];
VIEWS[''] = () => {
  const L = Calc.live(), g = k => Calc.cheapestOffer(k);
  const rows = [['64 GB DDR5 RAM', g('ram64')], ['RTX 5060 Ti 16 GB', g('gpu5060ti')], ['RTX 5070 12 GB', g('gpu5070')], ['RTX 3090 24 GB (2. el)', g('gpu3090used')], ['Radeon AI PRO R9700 32 GB', g('gpuR9700')]];
  return `<section class="hero"><div class="hero-text">
   <p class="eyebrow">Türkiye fiyatlarıyla</p>
   <h1>Yapay zekâyı kendi bilgisayarında çalıştırmak ne kadar tutar?</h1>
   <p class="lead">Elindeki bilgisayarın hangi modeli ne hızda çalıştırdığını, yeni bir bilgisayar için ne alman gerektiğini ve bunun abonelik ya da API ile karşılaştırmasını gösterir.</p>
   <div class="hero-cta"><a class="btn" href="#elimde">Bilgisayarımı kontrol et</a><a class="btn ghost" href="#al">Bilgisayar önerisi al</a></div>
   <ul class="hero-points"><li>${icon('check', 'bi')}Mağaza fiyatları her hafta, API fiyatları ve kur her ziyarette güncel</li><li>${icon('check', 'bi')}Okuma ve yazma hızı ayrı, görev süresi gerçekçi</li><li>${icon('check', 'bi')}Hesap yöntemi ve tüm varsayımlar açık</li></ul></div>
   <aside class="price-panel"><div class="pp-head"><b>Güncel parça fiyatları</b><a href="#fiyatlar">Tümü ${icon('arrow', 'bi')}</a></div>
   <table><tbody>${rows.map(([l, o]) => `<tr><td>${l}<small>${esc(o.store)}</small></td><td class="num">${tl(o.price)}</td></tr>`).join('')}</tbody></table>
   <p class="pp-foot"><span class="live-dot"></span><span id="liveStatus">${liveStatusText()}</span></p></aside>
  </section>
  <div class="sec-head"><h2>Ne yapmak istiyorsun?</h2></div>
  <div class="personas">
   <a class="persona" href="#elimde"><span class="pi">${icon('monitor')}</span><b>Bilgisayarım var</b><span>Elimdeki bilgisayar hangi modeli, ne hızda çalıştırır? Ne eklersem yeter?</span><em>Kontrol et ${icon('arrow', 'bi')}</em></a>
   <a class="persona" href="#al"><span class="pi">${icon('bag')}</span><b>Bilgisayar alacağım</b><span>Kullanımıma ve bütçeme göre hangi bilgisayar? Hazır sistemler ve kendin topla.</span><em>Öneri al ${icon('arrow', 'bi')}</em></a>
   <a class="persona" href="#bulut"><span class="pi">${icon('cloud')}</span><b>Bilgisayar almadan kullanacağım</b><span>Abonelik mi, API mi? Kullanımıma en ucuz hangisi?</span><em>Karşılaştır ${icon('arrow', 'bi')}</em></a>
   <a class="persona" href="#karsilastir"><span class="pi">${icon('scale')}</span><b>Almak mı, kiralamak mı?</b><span>Bir bilgisayar kaç ayda kendini öder? Hangi kullanımda yerel ucuzlar?</span><em>Hesapla ${icon('arrow', 'bi')}</em></a>
  </div>
  <div class="sec-head"><h2>Almadan önce bilmen gereken altı şey</h2><a href="#metrikler">Metrikler ve ayrıntılar ${icon('arrow', 'bi')}</a></div>
  <div class="lgrid">${LESSONS.map(([h, p], i) => `<article class="lesson"><span class="ln">${String(i + 1).padStart(2, '0')}</span><h3>${h}</h3><p>${p}</p></article>`).join('')}</div>
  <p class="small muted center data-note">${L.meta ? `Mağaza fiyatları (haftalık): ${new Date(L.meta.updated).toLocaleString('tr-TR')}` : 'Fiyatlar: gömülü veri (otomatik güncelleme okunamadı)'} · <a href="#fiyatlar">Tüm mağaza fiyatları</a> · <a href="#nasil">Yöntem</a></p>`;
};

/* --- I have a computer --- */
VIEWS.elimde = () => `${pageHead('monitor', 'Bilgisayarım var', 'Elindeki bilgisayar neyi çalıştırır?', 'Donanımını seç; hangi modelin ne hızda çalıştığını, bir görevin ne kadar sürdüğünü ve neyi yükseltmenin işe yarayacağını görelim.')}
  ${step(1, 'Donanımın', 'Bilmiyorsan Windows’ta Görev Yöneticisi → Performans sekmesine bak.')}
  <section class="card"><div class="fields four">
   <label class="f"><span>Ekran kartı</span><select data-mine="gpu">${MINE_GPUS.map(g => `<option value="${g[0]}"${S.mine.gpu === g[0] ? ' selected' : ''}>${g[1]}</option>`).join('')}</select></label>
   <label class="f"><span>${S.mine.gpu === 'mac' ? 'Birleşik bellek' : 'Sistem RAM’i'}</span><select data-mine="ram">${[8, 16, 24, 32, 36, 48, 64, 96, 128, 192, 256].map(v => `<option${S.mine.ram === v ? ' selected' : ''} value="${v}">${v} GB</option>`).join('')}</select></label>
   <label class="f"><span>RAM türü</span><select data-mine="ramType" ${S.mine.gpu === 'mac' ? 'disabled' : ''}><option${S.mine.ramType === 'DDR5' ? ' selected' : ''}>DDR5</option><option${S.mine.ramType === 'DDR4' ? ' selected' : ''}>DDR4</option></select></label>
   <label class="f"><span>Boş SSD alanı</span><select data-mine="ssd">${[100, 250, 500, 1000, 2000].map(v => `<option value="${v}"${S.mine.ssd === v ? ' selected' : ''}>${gb(v)}</option>`).join('')}</select></label>
  </div><div id="hwsum"></div></section>
  <div id="results"></div>`;
function resultsElimde() {
  const c = mineComputer(), hw = { vram: c.vram, ram: c.ram, ramType: c.ramType, ssd: c.ssd }, uni = c.ramType === 'unified';
  const all = Calc.localModels(), ids = all.map(m => m.id), est = Object.fromEntries(ids.map(id => [id, Calc.speed(c, id)]));
  const hs = $('#hwsum'); if (hs) hs.innerHTML = `<div class="chips">${uni ? `<span>${icon('chip', 'bi')}<b>Apple Silicon</b> birleşik bellek</span>` : `<span>${icon('chip', 'bi')}<b>${c.vram || 0} GB</b> ekran kartı belleği</span><span><b>${c.bw ? nf(c.bw) + ' GB/sn' : '—'}</b> bellek bant genişliği</span>`}<span><b>${c.ram} GB</b> ${uni ? 'bellek' : c.ramType + ' RAM'}</span><span><b>${gb(c.ssd)}</b> boş disk</span></div>`;
  // per family: the largest model that runs comfortably, otherwise the fastest one that runs at all
  const rank = { ok: 0, slow: 1, no: 2 };
  const best = FAMILIES.map(f => all.filter(m => m.family === f).sort((a, b) => rank[est[a.id].status] - rank[est[b.id].status] || (est[a.id].status === 'ok' ? (b.total || 0) - (a.total || 0) : est[b.id].tps - est[a.id].tps))[0]).filter(Boolean);
  const cards = best.map(m => m.id).map(id => { const e = est[id]; return `<article class="mcard ${e.status}"><div class="mc-top">${badge(e.status)}<span class="fam">${Calc.MODELS[id].family}</span></div><h3>${Calc.MODELS[id].label}<small>${sizeLabel(Calc.MODELS[id])}</small></h3><b class="big">${tps(e.tps)}</b>${meter(e.tps, 100, e.status)}<span class="small">1.000 tokenlik cevap: <b>${ansTime(e.tps)}</b></span><p class="small muted">${esc(e.note)}</p></article>`; }).join('');
  const q = est.qwen, r64 = Calc.cheapestOffer('ram64'), r4 = Calc.cheapestOffer('ram64ddr4'), r128 = Calc.cheapestOffer('ram128'), g3 = Calc.cheapestOffer('gpu3060used');
  let tip;
  if (uni) tip = q.status === 'ok' ? 'Mac’in Qwen 125B’yi bellekte tutabiliyor. Strata’nın Mac uygulamasıyla hemen deneyebilirsin.' : '<b>Mac’lerde bellek sonradan artırılamıyor.</b> 64 GB altı Mac’te büyük modeller SSD’den okunur ve yavaşlar; 27B gibi orta boy modeller ve bulut seçenekleri daha uygun.';
  else if (c.vram < 8) tip = `<b>Önce ekran kartı.</b> Strata için en az 8 GB (tercihen 12 GB) ekran kartı gerekir. En ucuz yol: 2. el RTX 3060 12 GB (≈${tl(g3.price)}) + 64 GB RAM.`;
  else if (q.status === 'ok') tip = `<b>Hiçbir şey almana gerek yok.</b> Qwen3.8-Flash-Next 125B bu bilgisayarda ≈${tps(q.tps)} çalışır. ${c.ram < 128 ? `DeepSeek 763B’yi gerçekten kullanmak istersen 128 GB RAM gerekir (128 GB DDR5 ≈ ${tl(r128.price)}, ${esc(r128.store)}).` : ''}`;
  else tip = `<b>En etkili yükseltme RAM.</b> ${c.ramType === 'DDR4' ? `64 GB DDR4 ≈ ${tl(r4.price)} (${esc(r4.store)})` : `64 GB DDR5 ≈ ${tl(r64.price)} (${esc(r64.store)})`} ile Qwen 125B rahat çalışır. Ekran kartını değiştirmek bu modelde pek hızlandırmaz.`;
  // task time for every model that runs: bars for the chosen task type, table for all task types
  const T = Calc.cat().taskTypes, tk = T[S.taskType] || T.short;
  const rows = ids.map(id => { const m = Calc.MODELS[id], w = est[id].tps, pp = w ? Calc.prefill(c, id) : NaN, t = x => w ? x.ctx / pp + x.out / w : NaN;
    return { id, label: m.label, family: m.family, size: m.total || NaN, st: est[id].status, rk: rank[est[id].status], tps: w || NaN, pp, short: t(T.short), think: t(T.think), agent: t(T.agent), first: w ? 32000 / pp + 1000 / w : NaN }; });
  const runs = rows.filter(r => r.tps > 0);
  let task = '<p class="muted">Bu donanımda çalışan bir model yok; önce yükseltme önerisine bak.</p>';
  if (runs.length) {
    const st = sortState('task', 'rk'), shown = runs.filter(r => r.st !== 'no');
    task = `<div class="row-label first">Görev tipi</div>${segButtons('task', Object.entries(T).map(([k, t]) => [k, t.label]), S.taskType)}
    <p class="small muted">${tk.label}: ${nf(tk.ctx / 1000)}K token okur, ${nf(tk.out / 1000)}K token yazar. Ekranda görünen hız yalnızca yazma hızıdır; uzun bağlamda asıl bekleme okumadadır.</p>
    ${absTaskBars(sortBy((shown.length ? shown : runs).map(r => ({ label: r.label, sub: `okuma ${nf(r.pp)} · yazma ${tps(r.tps)}`, read: tk.ctx / r.pp, write: tk.out / r.tps })), r => r.read + r.write, 1))}
    <div class="card-head" style="margin-top:22px"><h2>Tüm modeller <span class="muted">(${rows.length})</span></h2><span class="muted small">Başlıklara tıklayarak sırala</span></div>
    <div class="tablewrap flat"><table class="systable compact"><thead><tr>${th('task', 'label', 'Model', st)}${th('task', 'family', 'Aile', st)}${th('task', 'size', 'Boyut', st, 'num')}${th('task', 'rk', 'Durum', st)}${th('task', 'tps', 'Yazma', st, 'num')}${th('task', 'pp', 'Okuma', st, 'num')}${Object.entries(T).map(([k, t]) => th('task', k, t.label, st, 'num')).join('')}${th('task', 'first', 'Ajanın ilk cevabı', st, 'num')}</tr></thead>
    <tbody>${sortBy(rows, r => r[st.k], st.d).map(r => `<tr class="${r.st === 'no' ? 'dimrow' : ''}"><td><b>${r.label}</b></td><td>${r.family}</td><td class="num">${sizeLabel(Calc.MODELS[r.id]) || '—'}</td><td>${badge(r.st)}</td><td class="num">${tps(r.tps)}</td><td class="num">${r.pp ? nf(r.pp) + ' tok/sn' : '—'}</td><td class="num">${dur(r.short)}</td><td class="num">${dur(r.think)}</td><td class="num">${dur(r.agent)}</td><td class="num">${dur(r.first)}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">Ajanın ilk cevabı: 32K bağlam okur, 1K yazar. Qwen 125B, DeepSeek, Qwen 35B ve Coder Strata ölçümlerinden; diğerleri llama.cpp ve Q4 dosya boyutuyla, bant genişliğinden tahmin (sığmayan kısım sistem RAM’inden okunur).</p>
    <ul class="checks">${engineTips(c).map(t => `<li>${t}</li>`).join('')}</ul>`;
  }
  const el = Calc.electricity(c, S.model, S).tl;
  return `${step(2, 'Hangi model ne hızda?', `Her model ailesinden bu bilgisayarda rahat çalışan en büyük model. Yazma hızı; çubuk 100 tok/sn’ye göre. Tüm ${ids.length} model 4. adımdaki tabloda.`)}
  <div class="mgrid">${cards}</div>
  ${step(3, 'Ne çalıştırmalı, ne yükseltmeli?')}
  <div class="tip">${tip}</div>
  <section class="card"><h2>Bu bilgisayar için önerilen modeller</h2><ul class="recs">${recModels(c).map(r => `<li><b>${r[0]}</b><span>${r[1]}</span></li>`).join('')}</ul>
   <p class="small muted">Aynı bit sayısında bile quant’ı kimin hazırladığı kaliteyi değiştirir; tanınmış yapımcıların dosyalarını seç. Düşünme ayarını “orta” tutmak çoğu işte kaliteyi az, süreyi çok etkiler.</p></section>
  ${step(4, 'Bir görev ne kadar sürer?', 'Görev süresi = bağlamı okuma + cevabı yazma. Bu bilgisayarda çalışan tüm modeller, tüm aileler.')}
  <section class="card">${task}</section>
  <div class="pcgrid two">
   <section class="card"><h2>${icon('shield', 'ic h-ic')}Yerel her zaman gizli demek değil</h2><ul class="checks">
    <li><b>Sunucuyu yalnızca kendi bilgisayarına aç.</b> Ollama / llama.cpp sunucusu 127.0.0.1’i dinlemeli. İnternette tüm ağa açık on binlerce yerel AI sunucusu bulundu; çoğunda araç çağırma açık.</li>
    <li><b>Motorları güncel tut.</b> Model dosyasındaki sohbet şablonu üzerinden bilgisayarda komut çalıştırmaya izin veren açıklar yaşandı.</li>
    <li><b>Modeli tanınmış yapımcıdan indir.</b> Bir modele gizli “arka kapı” eklemek ucuz: eğitim verisinin %1’i ve birkaç saatlik kiralık GPU yetebiliyor.</li>
    <li><b>Ajanlara verdiğin izinleri sınırla.</b> Dosya ve komut izni olan bir ajan, zararlı bir komutu yerel modelle de çalıştırabilir.</li></ul></section>
   <section class="card cta"><h2>${icon('scale', 'ic h-ic')}Bulutla karşılaştır</h2><p>Bilgisayar zaten elinde olduğu için yerelde yalnızca elektrik ödersin: ayda ${nf(S.monthlyTokens, 1)} M çıktı için ≈ <b>${tl(el)}/ay</b> (${Calc.MODELS[S.model].short}).</p><p class="muted small">Karşılaştırma sayfasında aynı sınıftaki bulut modelleriyle aylık ve toplam maliyeti görebilirsin.</p><div class="actions"><a class="btn" href="#karsilastir" data-cmp-local="mine">Karşılaştır ${icon('arrow', 'bi')}</a></div></section>
  </div>`;
}

/* --- I will buy a computer --- */
VIEWS.al = () => `${pageHead('bag', 'Bilgisayar alacağım', 'Kullanımına göre hangi bilgisayar?', 'Kullanımını ve bütçeni gir; hazır sistemler arasından üç öneri çıkaralım. İstersen parça parça kendin topla, her parçada mağazayı sen seç.')}
  ${step(1, 'Ne için kullanacaksın?', 'Sana en yakın profili seç; sonuçlar anında değişir.')}
  ${usagePanel({ budget: true })}<div id="results"></div>`;
function resultsAl() {
  const all = Calc.computers(S.offerSel), M = S.model;
  const within = all.filter(c => c.price <= S.budget);
  const good = c => Calc.speed(c, M).status === 'ok' && Calc.capacity(c, M, S) >= S.monthlyTokens;
  const ok = within.filter(good);
  let rec = '';
  if (!ok.length) {
    const above = all.filter(good).sort((a, b) => a.price - b.price)[0];
    rec = `<div class="tip">Bütçendeki (${tl(S.budget)}) hiçbir bilgisayar bu kullanımı ${Calc.MODELS[M].short} ile rahat karşılamıyor.${above ? ` En ucuz uygun seçenek: <b>${esc(above.name)}</b> — ${tl(above.price)}.` : ''} Günlük çalışma saatini artırabilir, başka bir model seçebilir veya <a href="#bulut">bulut seçeneklerine</a> bakabilirsin.</div>`;
  } else {
    const cheapest = [...ok].sort((a, b) => a.price - b.price)[0];
    const value = [...ok].sort((a, b) => Calc.speed(b, M).tps / b.price - Calc.speed(a, M).tps / a.price)[0];
    const fastest = [...ok].sort((a, b) => Calc.speed(b, M).tps - Calc.speed(a, M).tps)[0];
    // with the dense 27B model a 16 GB card runs a better quant (3.5 bit instead of 2–3 bit) and leaves more context
    const vpp = c => Calc.speed(c, M).tps / c.price;
    const MM = Calc.MODELS[M], needs16 = M === 'q27' || (MM.file > 10.5 && MM.file <= 14.5);
    const balanced = needs16 ? [...ok].filter(c => c.kind === 'pc' && c.gpuVram >= 16).sort((a, b) => vpp(b) - vpp(a))[0] : null;
    const picks = [[cheapest, 'En ucuz çalışan', 'Kullanımını karşılayan en düşük fiyat.'], [value, 'Fiyat/performans', 'Lira başına en çok token/sn.'],
      ...(balanced ? [[balanced, 'Dengeli: 16 GB kart', M === 'q27' ? '16 GB kartlar arasında lira başına en hızlısı: Qwen 27B’yi 2–3 bit yerine 3,5 bit çalıştırır (daha az kalite kaybı) ve ≈110K bağlam bırakır.' : `16 GB kartlar arasında lira başına en hızlısı: ${esc(MM.short)} (≈${nf(MM.file)} GB) 12 GB karta sığmaz, 16 GB kartta tamamı kartta çalışır.`]] : []),
      [fastest, 'En hızlı', 'Bütçende en yüksek yazma hızı.']];
    const merged = [];
    for (const [c, t, r] of picks) { const m = merged.find(x => x.c.id === c.id); if (m) { m.t += ' · ' + t; m.r += ' ' + r; } else merged.push({ c, t, r }); }
    rec = `<div class="pcgrid ${merged.length === 4 ? 'two' : 'three'}">${merged.map(({ c, t, r }) => computerCard(c, { tag: t, reason: r, highlight: true })).join('')}</div>`;
    var mergedPicks = merged;
  }
  const pickTag = id => { const m = (mergedPicks || []).find(x => x.c.id === id); return m ? m.t : ''; };
  BUY_CHART = { pts: all.map(c => { const sp = Calc.speed(c, M); return { x: c.price, y: sp.tps || 0, st: sp.status, name: c.name, tag: pickTag(c.id), sub: `${specLine(c)} · görev ${dur(Calc.taskTime(c, M, S).total)}` }; }) };
  // total cost over the comparison period: purchase + electricity, against the matching cloud model
  const H = S.horizon, eqApi = Calc.cloudOptions(S).filter(o => o.fits && ((Calc.MODELS[M] || {}).api || []).includes(o.id)).sort((a, b) => a.monthly - b.monthly)[0];
  const tco = (mergedPicks || []).map(({ c, t }) => { const tot = Calc.localCum(c, M, S, H, false); return { label: c.name, sub: t, a: Math.min(tot, c.price), b: Math.max(0, tot - c.price), tot }; });
  if (eqApi) tco.push({ label: eqApi.name, sub: `bulutta dengi model · ${tl(eqApi.monthly)}/ay`, c: Calc.cloudCum(eqApi, S, H), tot: Calc.cloudCum(eqApi, S, H) });
  const tmax = Math.max(1, ...tco.map(r => r.tot));
  const tcoHtml = tco.length ? `<div class="tbars money">${tco.map(r => `<div class="tb-row"><span class="tb-l">${esc(r.label)}<small>${esc(r.sub)}</small></span><span class="tb-bar abs">${r.c != null ? `<i class="cl" style="width:${r.c / tmax * 100}%"></i>` : `<i class="pu" style="width:${r.a / tmax * 100}%">${r.a / tmax > 0.18 ? tl(r.a) : ''}</i><i class="el" style="width:${r.b / tmax * 100}%"></i>`}</span><b>${tl(r.tot)}</b></div>`).join('')}</div>
   <div class="legend"><span><i class="k-pu"></i>Satın alma</span><span><i class="k-el"></i>Elektrik (${H} ay)</span><span><i class="k-cl"></i>Bulut (${H} ay)</span></div>` : '';
  const F = S.buyFilter, list = within.filter(c => F === 'all' || (F === 'pc' ? c.kind === 'pc' : F === 'mac' ? c.kind === 'mac' : c.ram >= 64));
  const ss = sortState('sys', 'price'), rows = list.map(c => { const sp = Calc.speed(c, M), short = Calc.capacity(c, M, S) < S.monthlyTokens;
    return { c, sp, short, name: c.name, price: c.price, tps: sp.tps || NaN, tt: Calc.taskTime(c, M, S).total, el: sp.tps ? Calc.electricity(c, M, S).tl : NaN, st: { ok: 0, slow: 1, no: 2 }[sp.status] + (short ? 0.5 : 0) }; });
  return `${step(2, 'Sana önerilerimiz', `Bütçe ${tl(S.budget)} · ${Calc.MODELS[M].label} · ayda ${nf(S.monthlyTokens, 1)} M çıktı`)}
  ${rec}
  ${step(3, 'Fiyat ve hız', `Her nokta bir hazır sistem: sağa gittikçe pahalı, yukarı çıktıkça hızlı (${Calc.MODELS[M].label}). Üzerine gelince ayrıntı görünür.`)}
  <section class="card"><div id="buychart" class="chart-wrap"></div></section>
  ${tcoHtml ? `<section class="card"><div class="card-head"><div><h2>${H} ayda toplam maliyet</h2><span class="muted small">Önerilen sistemler: satın alma + ayda ${nf(S.monthlyTokens, 1)} M çıktının elektriği${eqApi ? ', bulutta aynı modelin API maliyetiyle' : ''}.</span></div><a class="small" href="#karsilastir">Ayrıntılı karşılaştırma ${icon('arrow', 'bi')}</a></div>${tcoHtml}</section>` : ''}
  ${step(4, 'Bütçendeki tüm hazır sistemler', `${list.length} sistem. Sıralamak için başlıklara tıkla. “Tüm modeller” görünümü her sistemi ${Calc.localModels().length} modelle karşılaştırır.`, `<div class="step-tools">${segButtons('sysview', [['table', 'Seçili model'], ['matrix', `Tüm modeller (${Calc.localModels().length})`]], S.sysView)}${segButtons('buyfilter', [['all', 'Tümü'], ['pc', 'PC'], ['mac', 'Mac'], ['ram64', '64 GB+ RAM']], F)}</div>`)}
  ${S.sysView === 'matrix' ? matrixTable(list) : `<div class="tablewrap"><table class="systable"><thead><tr>${th('sys', 'name', 'Sistem', ss)}${th('sys', 'price', 'Fiyat', ss, 'num')}${th('sys', 'tps', Calc.MODELS[M].short, ss, 'num')}${th('sys', 'tt', 'Görev süresi', ss, 'num')}${th('sys', 'el', 'Elektrik/ay', ss, 'num')}${th('sys', 'st', 'Durum', ss)}<th></th></tr></thead><tbody>${sortBy(rows, r => r[ss.k], ss.d).map(({ c, sp, tt, el, short }) => `<tr><td><b>${esc(c.name)}</b><small>${specLine(c)}</small><details class="more"><summary>Parçalar</summary>${partsList(c)}</details></td><td class="num"><b>${tl(c.price)}</b></td><td class="num">${tps(sp.tps)}<small>${sp.tps ? speedSub(sp) : ''}</small></td><td class="num">${dur(tt)}</td><td class="num">${sp.tps ? tl(el) : '—'}</td><td>${badge(sp.status)}${short && sp.tps ? '<small class="bad">kullanımına yetmez</small>' : ''}</td><td><button type="button" class="btn ghost small" data-compare="${c.id}">Karşılaştır</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Bu filtreyle sistem yok.</td></tr>'}</tbody></table></div>`}
  ${step(5, 'Kendin topla', 'Parçaları ve mağazaları sen seç. Uyumsuz parçalar elenir; fiyat, hız ve güç kaynağı yeterliliği anında hesaplanır.')}
  <div id="builderBox">${builderHtml()}</div>
  <details class="card more alt"><summary>Başka yollar: mini PC, ikinci el veri merkezi kartları, Mac</summary><ul class="checks">
   <li><b>128 GB birleşik bellekli mini PC’ler (Ryzen AI Max):</b> Qwen 125B’nin 4 bit sürümünü tek kutuda tutar. Windows ekran kartına en fazla ≈96 GB verir; Linux ve doğru motorla okuma hızı 10 kata kadar artabiliyor.</li>
   <li><b>İkinci el veri merkezi kartları:</b> Eski ama bant genişliği yüksek kartlar (ör. 4× V100) bazı testlerde yeni “AI kutularından” hızlı yazıyor; ama gürültü, güç tüketimi ve kurulum zahmetli, okuma hızları düşük.</li>
   <li><b>Donanım pahalanırken token ucuzladı:</b> Bir masaüstü AI kutusu bir yılda %74 pahalandı, aynı dönemde popüler bir açık modelin API fiyatı ≈%57 düştü. Amorti hesabını mutlaka yap.</li>
   <li><b>Mac:</b> Bellek bant genişliği çipe göre çok değişir (M6 ≈150, M5 Pro ≈300, M5 Max 614 GB/sn). “M5” adı tek başına hız söylemez.</li>
   <li><b>RAM’de DDR4 seçeneği:</b> GB başına yaklaşık yarı fiyat, yarı hız. Bu işte kapasite genelde hızdan önemli; aynı paraya 32 GB DDR5 yerine 64 GB DDR4 çoğu zaman daha iyi.</li></ul></details>`;
}
// systems × models: writing speed, coloured by status; sortable by price, name or any model
function matrixTable(list) {
  const ms = Calc.localModels(), st = sortState('mx', 'price');
  const rows = list.map(c => { const r = { c, name: c.name, price: c.price }; for (const m of ms) { const sp = Calc.speed(c, m.id); r[m.id] = sp.tps || NaN; r['_' + m.id] = sp.status; } return r; });
  return `<div class="tablewrap matrix"><table class="systable mx"><thead><tr>${th('mx', 'name', 'Sistem', st, 'stick')}${th('mx', 'price', 'Fiyat', st, 'num')}${ms.map(m => th('mx', m.id, `<span class="mxh">${esc(m.short)}<small>${m.family}</small></span>`, st, 'num' + (m.id === S.model ? ' sel' : ''))).join('')}</tr></thead>
   <tbody>${sortBy(rows, r => r[st.k], st.d).map(r => `<tr><td class="stick"><b>${esc(r.name)}</b></td><td class="num">${tl(r.price)}</td>${ms.map(m => `<td class="num cell ${r['_' + m.id]}${m.id === S.model ? ' sel' : ''}">${r[m.id] ? nf(r[m.id], r[m.id] < 10 ? 1 : 0) : '—'}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${ms.length + 2}" class="muted">Bu filtreyle sistem yok.</td></tr>`}</tbody></table></div>
   <p class="small muted">Hücreler yazma hızı (tok/sn): yeşil rahat, turuncu yavaş, kırmızı çalışmaz. Sütun başlığına tıklayınca o modelde en hızlı sistemler üste gelir.</p>`;
}
const SLOTS = [['gpu', 'Ekran kartı'], ['cpu', 'İşlemci'], ['mobo', 'Anakart'], ['ram', 'RAM'], ['ssd', 'SSD'], ['psu', 'Güç kaynağı'], ['case', 'Kasa'], ['cooler', 'CPU soğutucu']];
function partsOf(cat) { return Object.entries(Calc.cat().parts).filter(([, p]) => p.cat === cat); }
function fixBuild() {
  const P = Calc.cat().parts, b = S.build;
  const cpu = P[b.cpu], mobo = P[b.mobo];
  if (mobo.socket !== cpu.socket) b.mobo = partsOf('mobo').find(([, p]) => p.socket === cpu.socket)[0];
  const m = P[b.mobo];
  if (P[b.ram].ramType !== m.ramType) b.ram = partsOf('ram').filter(([, p]) => p.ramType === m.ramType).sort((x, y) => y[1].size - x[1].size)[0][0];
  if (!m.multiGpu) b.gpuCount = 1;
}
function builderHtml() {
  fixBuild();
  const P = Calc.cat().parts, b = S.build, c = customComputer();
  const rows = SLOTS.map(([slot, label]) => {
    let opts = partsOf(slot);
    if (slot === 'mobo') opts = opts.filter(([, p]) => p.socket === P[b.cpu].socket);
    if (slot === 'ram') opts = opts.filter(([, p]) => p.ramType === P[b.mobo].ramType);
    const key = b[slot], offs = Calc.offers(key), ch = Calc.chosenOffer(key, S.offerSel);
    return `<div class="brow"><span class="blabel">${label}</span>
     <select data-slot="${slot}" aria-label="${label}">${opts.map(([k, p]) => `<option value="${k}"${k === key ? ' selected' : ''}>${esc(p.label)} — ${tl(Calc.cheapestOffer(k).price)}</option>`).join('')}</select>
     ${slot === 'gpu' && P[b.mobo].multiGpu ? `<select data-gpucount aria-label="Kart sayısı"><option value="1"${b.gpuCount == 1 ? ' selected' : ''}>1 kart</option><option value="2"${b.gpuCount == 2 ? ' selected' : ''}>2 kart</option></select>` : '<span></span>'}
     <select data-offer="${key}" aria-label="${label} mağazası">${offs.map((o, i) => `<option value="${esc(o.store)}"${o.store === ch.store ? ' selected' : ''}>${esc(o.store)} · ${tl(o.price)}${i === 0 ? ' (en ucuz)' : ''}${o.stock === 'tükendi' ? ' · tükendi' : o.stock === 'bilinmiyor' ? ' · stok?' : ''}</option>`).join('')}</select>
     <a href="${esc(ch.url)}" target="_blank" rel="noopener" class="small ext" title="Ürün sayfası">${icon('ext', 'bi')}</a></div>`;
  }).join('');
  const psu = P[b.psu].watts, draw = c.watts + 40, warn = draw * 1.3 > psu;
  const sp = mixModels().map(m => [m, Calc.speed(c, m)]);
  return `<div class="builder"><div class="brows">${rows}</div>
   <aside class="bsum"><span class="muted small">Toplam</span><b class="big">${tl(c.price)}</b>
    <p class="small muted">${c.ram} GB ${c.ramType} · ${c.vram} GB VRAM${c.gpus > 1 ? ' (iki kart, tek havuz değil)' : ''}</p>
    <details class="more"><summary>Tüm modeller (${Calc.localModels().length})</summary>${allModelsTable(c)}</details>
    <ul class="bspeeds">${sp.map(([m, s]) => `<li><span>${Calc.MODELS[m].short}</span><b>${tps(s.tps)}</b>${badge(s.status)}<small>görev: ${dur(Calc.taskTime(c, m, S).total)}</small></li>`).join('')}</ul>
    <p class="small ${warn ? 'bad' : 'muted'}">${warn ? `${icon('alert', 'bi')} Güç kaynağı yetersiz olabilir: tahmini çekiş ${nf(draw)} W, %30 pay ile ${nf(draw * 1.3)} W gerekir.` : `Güç: tahmini ${nf(draw)} W / ${psu} W güç kaynağı`}</p>
    <button type="button" class="btn" data-compare="custom">Bulutla karşılaştır ${icon('arrow', 'bi')}</button>
    <button type="button" class="btn ghost" data-copybuild>Parça listesini kopyala</button></aside></div>`;
}

/* --- cloud --- */
const CLOUD_GROUPS = [
  ['open', 'Açık model', 'API', o => o.type !== 'subscription' && !!o.open],
  ['closed', 'Kapalı model', 'API', o => o.type !== 'subscription' && !o.open && !Calc.inClass(o, 'frontier')],
  ['frontier', 'Üst düzey model', 'Claude, GPT, Gemini API', o => o.type !== 'subscription' && Calc.inClass(o, 'frontier')],
  ['sub', 'Abonelik', 'sabit aylık ücret', o => o.type === 'subscription']];
VIEWS.bulut = () => `${pageHead('cloud', 'Satın almadan kullan', 'Abonelik mi, API mi?', 'Kullanımını gir; tüm abonelik ve API seçeneklerini aylık maliyete göre sıralayalım. Modellerin kalitesi aynı olmadığı için her sınıfın en ucuzunu ayrı gösteriyoruz.')}
  ${step(1, 'Ne kadar kullanacaksın?', 'API maliyeti çıktı ve girdi tokenlerinden hesaplanır; abonelikte aylık kota varsayımdır.')}
  ${usagePanel({ model: false, privacy: false, horizon: false })}
  <div id="results"></div>`;
function cloudSub(o, withType) {
  if (o.type === 'subscription') return `${withType ? 'Abonelik · ' : ''}${esc(o.limit)}`;
  return `${withType ? (o.open ? 'API · açık model · ' : 'API · ') : ''}1M token: girdi $${o.inputUsd} · çıktı $${o.outputUsd}${o.live ? ' · canlı fiyat' : ''}`;
}
const CSORT = { monthly: o => o.monthly, out: o => o.type === 'subscription' ? NaN : o.outputUsd, in: o => o.type === 'subscription' ? NaN : o.inputUsd, name: o => o.name.replace(/^Açık · /, '') };
function resultsBulut() {
  const all = Calc.cloudOptions(S);
  const cards = CLOUD_GROUPS.map(([k, l, s, f]) => [l, s, all.filter(o => o.fits && f(o)).sort((a, b) => a.monthly - b.monthly)[0]]).filter(x => x[2]);
  const opts = all.filter(o => Calc.inClass(o, S.cloudClass));
  const max = Math.max(...opts.filter(o => o.fits).map(o => o.monthly), 1);
  const bar = o => `<div class="bar-row${o.fits ? '' : ' dim'}"><span class="bn">${esc(o.name.replace(/^Açık · /, ''))}${Calc.inClass(o, 'frontier') && o.type !== 'subscription' ? ' <span class="mini">üst düzey</span>' : ''}<small>${o.split ? `bu ay: çıktı ${tl(o.split.out)} · girdi ${tl(o.split.inFresh)} · önbellek ${tl(o.split.inCached)}` : esc(o.limit)}</small></span><span class="bt"><i style="width:${Math.max(1, Math.log1p(o.monthly) / Math.log1p(max) * 100)}%"></i></span><b>${tl(o.monthly)}</b></div>`;
  const groups = [['API · açık modeller', o => o.type !== 'subscription' && o.open], ['API · kapalı modeller', o => o.type !== 'subscription' && !o.open], ['Abonelikler', o => o.type === 'subscription' && o.fits]]
    .map(([t, f]) => [t, sortBy(opts.filter(f), CSORT[S.cloudSort] || CSORT.monthly, 1)]).filter(([, l]) => l.length);
  const over = opts.filter(o => !o.fits).sort((a, b) => a.monthly - b.monthly);
  return `${step(2, 'Her sınıfın en ucuzu', `Ayda ${nf(S.monthlyTokens, 1)} M çıktı + ${nf(Calc.inputM(S), 1)} M girdi tokeni için.`)}
  <div class="pcgrid four">${cards.map(([l, s, o]) => `<article class="pc hl cloudcard"><span class="tag">${l}</span><h3>${esc(o.name.replace(/^Açık · /, ''))}</h3><p class="small muted">${s}</p><b class="big">${tl(o.monthly)}<small>/ay</small></b><p class="small muted">${cloudSub(o)}</p><div class="actions"><a class="btn ghost small" href="${esc(o.source)}" target="_blank" rel="noopener">Resmî fiyat ${icon('ext', 'bi')}</a><button type="button" class="btn ghost small" data-cmpcloud="${o.id}">Bilgisayarla karşılaştır</button></div></article>`).join('')}</div>
  ${step(3, 'Tüm seçenekler', `${opts.length} seçenek, gruplar halinde. Çubuk uzunluğu aylık maliyeti gösterir (logaritmik).`, segButtons('cloudclass', [['all', 'Tümü'], ['open', 'Açık'], ['closed', 'Kapalı'], ['frontier', 'Üst düzey']], S.cloudClass))}
  <section class="card"><div class="card-head sortbar"><span class="muted small">Sırala</span>${segButtons('cloudsort', [['monthly', 'Aylık maliyet'], ['out', 'Çıktı fiyatı'], ['in', 'Girdi fiyatı'], ['name', 'Ad']], S.cloudSort)}</div>${groups.map(([t, l]) => `<div class="bar-group"><h3>${t} <span class="muted">(${l.length})</span></h3><div class="bars">${l.map(bar).join('')}</div></div>`).join('')}
   ${over.length ? `<details class="more"><summary>Kotası bu kullanıma yetmeyen abonelikler (${over.length})</summary><div class="bars">${over.map(bar).join('')}</div></details>` : ''}
   <p class="small muted note">API girdisi: çıktı payı %${S.outputSharePercent} → ayda ${nf(Calc.inputM(S), 1)} M girdi; önbellekten okunan %${S.cachedInputSharePercent}. Aboneliklerin aylık token kotası sağlayıcı garantisi değil, varsayımdır.</p></section>
  <div class="pcgrid two"><section class="card"><h2>${icon('alert', 'ic h-ic')}Abonelikte dikkat</h2><ul class="checks">
   <li><b>Kotalar değişiyor.</b> Örneğin bir 200 $’lık planın kodlama kotası bir gecede yarıya indi; geçici “sıfırlamalar” planın parçası değildi.</li>
   <li><b>Varsayılan düşünme ayarı düşük olabilir.</b> Tanıtım tablosundaki skor genelde en yüksek ayarla ölçülür; varsayılan “orta” ayar daha az token harcar ama bazı işlerde birkaç puan düşer.</li>
   <li><b>Yeni sürüm = daha fazla token olabilir.</b> Aynı metin yeni bir tokenizer ile %0–35 daha fazla token tutabiliyor; fatura model değişmeden artabilir.</li>
   <li><b>Kodlama oturumlarında tokenlerin ≈%97’si önbellekten okunur;</b> asıl maliyeti önbellek fiyatı belirler. “Kodlama ajanı” profili bunu hesaba katar.</li></ul></section>
   <section class="card"><h2>${icon('lock', 'ic h-ic')}API kullanıyorsan güvenlik</h2><ul class="checks">
   <li><b>Ön ödemeli kredi kullan, otomatik yüklemeyi kapat.</b> Çalınan bir anahtarın en fazla bakiyen kadar zararı olur; aynı saldırıda biri 16 $, biri 3.000 $ kaybetti.</li>
   <li><b>Aylık harcama limiti koy.</b> Bazı sağlayıcılarda faturalama birkaç dakika geriden gelir, limit biraz aşılabilir.</li>
   <li><b>Üçüncü taraf araçlara yapıştırdığın anahtarları yenile,</b> kullanmadıklarını sil. Bir araç sızıntısında eski anahtarlar saatler içinde boşaltıldı.</li></ul></section></div>`;
}

/* --- buy vs rent --- */
VIEWS.karsilastir = () => `${pageHead('scale', 'Almak mı, kiralamak mı?', 'Bir bilgisayar kaç ayda kendini öder?', 'Bir bilgisayarı aynı sınıftaki bir bulut seçeneğiyle karşılaştır: toplam maliyet, amorti süresi ve hangi kullanım düzeyinde yerelin ucuzladığı.')}
  ${step(1, 'Kullanımın')}
  ${usagePanel({})}<div id="results"></div>`;
function cmpContext() {
  const locals = allLocal(), local = S.cmpLocal === 'mine' ? mineComputer() : locals.find(c => c.id === S.cmpLocal) || locals[0], owned = local.id === 'mine';
  const fitsAll = Calc.cloudOptions(S).filter(o => o.fits).sort((a, b) => a.monthly - b.monthly);
  const inCls = o => S.cmpClass === 'equiv' ? ((Calc.MODELS[S.model] || {}).api || []).includes(o.id) : Calc.inClass(o, S.cmpClass);
  let clouds = fitsAll.filter(o => inCls(o) || o.id === S.cmpCloud); if (!clouds.length) clouds = fitsAll;
  const cloud = clouds.find(o => o.id === S.cmpCloud) || clouds[0];
  const frontier = fitsAll.find(o => Calc.inClass(o, 'frontier') && o.id !== cloud.id);
  const M = S.model, H = S.horizon;
  const hwMonthly = owned ? 0 : Calc.localCum(local, M, { ...S, monthlyTokens: 0 }, H, false) / H;
  const localM = x => hwMonthly + Calc.electricity(local, M, { ...S, monthlyTokens: x }).tl;
  const cloudM = o => x => Calc.cloudMonthly(o, { ...S, monthlyTokens: x });
  return { locals, local, owned, clouds, cloud, frontier, M, H, hwMonthly, localM, cloudM, cap: Calc.capacity(local, M, S), sp: Calc.speed(local, M) };
}
function crossover(fa, fb, lo, hi) { for (let i = 0; i <= 400; i++) { const x = lo * Math.pow(hi / lo, i / 400); if (fa(x) <= fb(x)) return x; } return Infinity; }
function resultsKarsilastir() {
  const X = cmpContext(), { local, owned, cloud, clouds, M, H, sp, cap } = X;
  const lc = t => Calc.localCum(local, M, S, t, owned), cc = t => Calc.cloudCum(cloud, S, t);
  const be = Calc.breakEven(local, M, cloud, S, owned), diff = cc(H) - lc(H);
  let verdict;
  if (S.privacy) verdict = sp.status === 'no' || cap < S.monthlyTokens ? `<b>Gizlilik şartıyla</b> bu bilgisayar kullanımını karşılamıyor (en fazla ${nf(cap, 1)} M/ay). Daha güçlü bir sistem veya daha hafif bir model seç.` : `<b>Gizlilik şartıyla tek seçenek yerel.</b> ${esc(local.name)} ile ${H} ayda toplam ${tl(lc(H))}.`;
  else if (!sp.tps) verdict = `<b>${esc(local.name)}</b> ${Calc.MODELS[M].short} modelini çalıştıramıyor. Başka bir model veya bilgisayar seç; ${esc(cloud.name)} ayda ${tl(cloud.monthly)}.`;
  else if (cap < S.monthlyTokens) verdict = `<b>${esc(local.name)}</b> bu kullanıma yetmiyor: günde ${S.hoursPerDay} saatte en fazla ${nf(cap, 1)} M/ay üretir. ${esc(cloud.name)} ayda ${tl(cloud.monthly)}.`;
  else if (diff >= 0) verdict = `Bu kullanımda <b>${owned ? 'elindeki bilgisayarı kullanmak' : 'bilgisayar almak'} daha ucuz.</b> ${H} ayda ${tl(diff)} tasarruf; ${be === 0 ? 'hemen' : nf(be, 1) + '. ayda'} kendini ${owned ? 'öder' : 'amorti eder'}.`;
  else verdict = `Bu kullanımda <b>${esc(cloud.name)} daha ucuz.</b> ${H} ayda ${tl(-diff)} daha az. ${Number.isFinite(be) ? `Bilgisayar ancak ${nf(be, 1)}. ayda amorti olur.` : 'Bilgisayar 10 yıl içinde amorti olmuyor.'}`;
  // at which monthly usage does the computer become cheaper?
  let usageLine = '';
  if (sp.tps && !S.privacy) {
    if (cloud.type === 'subscription') usageLine = `${esc(cloud.name)} sabit ${tl(cloud.monthly)}/ay (varsayılan kota ≈${nf(S.caps[cloud.id] || cloud.defaultCapM)} M/ay). Bilgisayarın aylık maliyeti ${owned ? 'yalnızca elektrik' : `donanım payı ${tl(X.hwMonthly)} + elektrik`}.`;
    else {
      const x0 = crossover(X.localM, X.cloudM(cloud), 0.01, 1e5);
      usageLine = x0 <= 0.0101 ? `Her kullanım düzeyinde bilgisayar daha ucuz (yalnızca elektrik ödüyorsun).`
        : x0 > cap ? `Bu bilgisayarın kapasitesi (≈${mTok(cap)}/ay) içinde ${esc(cloud.name)} her zaman daha ucuz${Number.isFinite(x0) ? `; başa baş ancak ayda ≈${mTok(x0)} çıktıda olurdu` : ''}.`
        : `Ayda <b>≈${mTok(x0)} çıktı tokeninin üstünde</b> bilgisayar daha ucuz (donanım bedeli ${H} aya bölünmüş). Senin kullanımın ${mTok(S.monthlyTokens)}, kapasite ≈${mTok(cap)}/ay.`;
    }
  }
  const localOpts = [['mine', 'Elindeki bilgisayar (fiyat 0 TL, sadece elektrik)'], ['custom', `Kendi topladığın · ${tl(X.locals[0].price)}`], ...X.locals.slice(1).sort((a, b) => a.price - b.price).map(c => [c.id, `${c.name} · ${tl(c.price)}`])];
  const rent = M === 'deepseek' ? (() => { const api = Calc.cat().apiModels.find(a => a.id === 'api-deepseek-flash-off'); const usd = api.outputUsd * S.usdTry; const ram = Calc.cheapestOffer('ram64').price; const mt = ram / usd; const yrs = sp.tps ? mt * 1e6 / (sp.tps * 3600 * 24 * 365) : Infinity; return `<div class="tip"><b>Kiralama hesabı:</b> 64 GB RAM’in parasına (${tl(ram)}) DeepSeek API’den (pik dışı $${api.outputUsd}/1M) ≈${nf(mt / 1000, 1)} milyar çıktı tokeni alınır. ${esc(local.name)} bunu ${tps(sp.tps)} ile ${Number.isFinite(yrs) ? nf(yrs, 1) + ' yılda' : 'hiç'} yazar. API ayrıca tam modeldir; yerelde 2 bit çalışır.</div>`; })() : '';
  return `${step(2, 'Neyi neyle karşılaştıralım?', `Yereldeki ${Calc.MODELS[M].label} ile bulut modellerinin kalitesi aynı değil; varsayılan olarak aynı sınıftaki modellerle kıyaslanır.`)}
  <section class="card"><div class="row-label first">Bulut modeli sınıfı</div>${segButtons('cmpclass', [['equiv', 'Yereldeki modelin dengi'], ['all', 'En ucuz (tümü)'], ['closed', 'Kapalı modeller'], ['frontier', 'Üst düzey (Claude, GPT, Gemini)']], S.cmpClass)}
   <div class="cmp-pick"><label class="f"><span>Bilgisayar</span><select data-cmplocal>${localOpts.map(([k, l]) => `<option value="${k}"${k === local.id ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
   <label class="f"><span>Bulut seçeneği</span><select data-cmpcloudsel>${clouds.map(o => `<option value="${o.id}"${o.id === cloud.id ? ' selected' : ''}>${esc(o.name)} · ${tl(o.monthly)}/ay</option>`).join('')}</select></label></div></section>
  ${step(3, 'Sonuç')}
  <section class="verdict"><p>${verdict}</p><div class="vstats"><div><span>${esc(local.name)} · ${H} ay</span><b>${tl(lc(H))}</b><small>${owned ? 'sadece elektrik' : tl(local.price) + ' + elektrik'} · ${tps(sp.tps)} · görev ${dur(Calc.taskTime(local, M, S).total)}</small></div><div><span>${esc(cloud.name)} · ${H} ay</span><b>${tl(cc(H))}</b><small>${tl(cloud.monthly)}/ay</small></div><div><span>Amorti</span><b>${be === 0 ? 'Hemen' : Number.isFinite(be) ? nf(be, 1) + ' ay' : '10 yıl+'}</b><small>${H}. ayda fark: ${tl(Math.abs(diff))}</small></div></div>${usageLine ? `<p class="vline">${usageLine}</p>` : ''}</section>
  ${rent}
  <details class="card more alt"><summary>${esc(local.name)}: tüm modellerde hız ve görev süresi (${Calc.localModels().length})</summary>${allModelsTable(local)}</details>
  ${step(4, 'Grafikler')}
  <section class="card"><div class="card-head"><h2>Zamanla toplam maliyet</h2><span class="muted small">${H} ay · satın alma + elektrik, bulutta aylık ücret</span></div><div id="chart" class="chart-wrap"></div></section>
  <section class="card"><div class="card-head"><div><h2>Aylık kullanıma göre bir ayın maliyeti</h2><span class="muted small">Kullanım arttıkça API maliyeti doğrusal artar; bilgisayarda yalnızca elektrik artar (donanım bedeli ${owned ? 'yok' : H + ' aya bölünmüş'}). Kapasite veya kota aşılınca ek bilgisayar ya da abonelik eklenir.</span></div>${segButtons('tokscale', [['log', 'Logaritmik'], ['lin', 'Doğrusal']], S.tokScale)}</div><div id="tchart" class="chart-wrap"></div>
   <p class="small muted">${S.tokScale === 'log' ? 'İki eksen de logaritmik: her ızgara çizgisi 10 kat. API’ler paralel çizgilerdir; aralarındaki boşluk fiyat oranıdır.' : 'Doğrusal ölçek; yatay eksen kullanımının 2,5 katına kadar.'}</p></section>`;
}
function drawCompareCharts() {
  const X = cmpContext(), { local, owned, cloud, frontier, M, H } = X;
  const ser = [{ name: local.name, color: 'var(--c1)', f: t => Calc.localCum(local, M, S, t, owned) }, { name: cloud.name, color: 'var(--c2)', f: t => Calc.cloudCum(cloud, S, t) }];
  if (frontier) ser.push({ name: frontier.name + ' (üst düzey)', color: 'var(--c3)', dash: true, f: t => Calc.cloudCum(frontier, S, t) });
  const be = Calc.breakEven(local, M, cloud, S, owned), stp = H <= 12 ? 2 : H <= 36 ? 6 : H <= 72 ? 12 : 24;
  xyChart($('#chart'), { label: 'Zamanla toplam maliyet', series: ser, markers: Number.isFinite(be) && be > 0 && be < H ? [{ x: be, label: `Amorti: ${nf(be, 1)}. ay` }] : [],
    x: { lo: 0, hi: H, ticks: Array.from({ length: Math.floor(H / stp) + 1 }, (_, i) => i * stp), fmt: v => v ? nf(v) + '. ay' : '0', tip: t => nf(t, 1) + '. ay' } });
  const log = S.tokScale !== 'log' ? false : true, cap = X.sp.tps ? X.cap : 0;
  const lo = log ? 0.1 : 0, hi = log ? 1000 : niceStep(Math.max(10, S.monthlyTokens * 2.5) / 5) * 5;
  const tser = [];
  // beyond a limit the cost is what it would really take: more computers (capacity) or more subscriptions (quota)
  const units = (x, lim) => Math.max(1, Math.ceil(x / lim - 1e-9));
  if (X.sp.tps) tser.push(owned
    ? { name: local.name, color: 'var(--c1)', f: X.localM, limit: cap, note: x => x > cap ? 'kapasite aşıldı: bu bilgisayar yetmez' : '' }
    : { name: local.name, color: 'var(--c1)', limit: cap, f: x => units(x, cap) * X.hwMonthly + Calc.electricity(local, M, { ...S, monthlyTokens: x }).tl, note: x => x > cap ? `${units(x, cap)} bilgisayar gerekir` : '' });
  const cs = (o, color, dash) => { if (o.type !== 'subscription') return { name: o.name, color, dash, f: X.cloudM(o) };
    const q = S.caps[o.id] || o.defaultCapM, m = X.cloudM(o)(1); return { name: o.name, color, dash, limit: q, f: x => units(x, q) * m, note: x => x > q ? `kota aşıldı: ${units(x, q)} abonelik gerekir` : '' }; };
  tser.push(cs(cloud, 'var(--c2)'));
  if (frontier) tser.push(cs(frontier, 'var(--c3)', true));
  const lt = [0.1, 1, 10, 100, 1000], ls = niceStep(hi / 5);
  xyChart($('#tchart'), { label: 'Aylık kullanıma göre maliyet', series: tser, logY: log, markers: [{ x: S.monthlyTokens, label: `Senin kullanımın: ${mTok(S.monthlyTokens)}` }],
    x: { lo, hi, log, ticks: log ? lt : Array.from({ length: Math.round(hi / ls) + 1 }, (_, i) => i * ls), fmt: v => v === 0 ? '0' : mTok(v), tip: t => `Ayda ${mTok(t)} çıktı` } });
}

/* --- prices --- */
const PCATS = [['gpu', 'Ekran kartları'], ['cpu', 'İşlemciler'], ['mobo', 'Anakartlar'], ['ram', 'RAM'], ['ssd', 'SSD'], ['psu', 'Güç kaynakları'], ['case', 'Kasalar'], ['cooler', 'Soğutucular']];
function opartHtml(k, open) {
  const p = Calc.cat().parts[k], offs = Calc.offers(k), ch = Calc.chosenOffer(k, S.offerSel), mine = !!S.offerSel[k] && S.offerSel[k] === ch.store;
  return `<details class="opart" data-part="${k}"${open ? ' open' : ''}><summary><span class="op-n">${esc(p.label)}</span><span class="op-s">${esc(ch.store)}${ch.stock === 'tükendi' ? ' <span class="mini bad">tükendi</span>' : mine ? ' <span class="mini">seçimin</span>' : offs.length > 1 ? ' <span class="mini ok">en ucuz</span>' : ''}</span><b class="num">${tl(ch.price)}</b><span class="op-c">${offs.length} mağaza</span>${icon('chev', 'bi chev')}</summary>
   <div class="op-body"><table class="offers"><tbody>${offs.map((o, i) => `<tr class="${o.store === ch.store ? 'sel' : ''}"><td><label><input type="radio" name="o-${k}" data-pickoffer="${k}" value="${esc(o.store)}"${o.store === ch.store ? ' checked' : ''}> <b>${esc(o.store)}</b></label>${i === 0 ? ' <span class="badge ok">en ucuz</span>' : ''}</td><td class="num"><b>${tl(o.price)}</b></td><td><span class="badge ${o.stock === 'stokta' ? 'ok' : o.stock === 'tükendi' ? 'no' : 'slow'}">${esc(o.stock)}</span></td><td class="small muted">${esc(o.source)} · ${esc(o.date)}</td><td class="small"><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc((o.name || '').slice(0, 60))} ${icon('ext', 'bi')}</a></td></tr>`).join('')}</tbody></table></div></details>`;
}
VIEWS.fiyatlar = () => {
  const L = Calc.live(), P = Calc.cat().parts;
  return `${pageHead('tag', 'Fiyatlar', 'Her parçanın mağaza fiyatları', 'Varsayılan olarak stoktaki en ucuz teklif kullanılır. Bir parçayı açıp başka mağaza seçersen, hazır sistemlerde ve topladığın bilgisayarda o fiyat kullanılır.')}
  <div class="sources">
   <div class="src">${icon('globe')}<div><b>Canlı · tarayıcın</b><span id="liveStatus">${liveStatusText()}</span></div></div>
   <div class="src">${icon('refresh')}<div><b>Haftalık · GitHub Actions</b><span>${Object.keys(L.stores || {}).join(', ') || '—'}, Apple Türkiye${L.meta ? ` · ${new Date(L.meta.updated).toLocaleDateString('tr-TR')}` : ''}</span></div></div>
   <div class="src">${icon('edit')}<div><b>Elle · tarihli</b><span>akakçe, Vatan, Hepsiburada, n11, Sinerji, İnceHesap…</span></div></div></div>
  <div class="jump"><span class="muted small">Kategoriler:</span>${PCATS.map(([c, l]) => `<button type="button" data-jump="cat-${c}">${l}</button>`).join('')}<button type="button" data-jump="cat-mac">Mac</button><button type="button" class="btn ghost small" data-resetoffers>Mağaza seçimlerini sıfırla</button></div>
  ${PCATS.map(([cat, label]) => `<section class="card" id="cat-${cat}"><div class="card-head"><h2>${label}</h2><span class="muted small">Seçili mağaza · fiyat</span></div><div class="oparts">${Object.keys(P).filter(k => P[k].cat === cat).map(k => opartHtml(k)).join('')}</div></section>`).join('')}
  <section class="card" id="cat-mac"><h2>Mac fiyatları (Apple Türkiye)</h2><table class="offers"><tbody>${Calc.computers({}).filter(c => c.kind === 'mac').map(c => `<tr><td>${esc(c.appleName)}</td><td class="num"><b>${tl(c.price)}</b></td><td><a href="${esc(c.url)}" target="_blank" rel="noopener">Apple ${icon('ext', 'bi')}</a></td></tr>`).join('')}</tbody></table></section>`;
};

/* --- method --- */
const FORMULAS = [
  ['Yazma hızı', 'bant genişliği ÷ token başına okunan GB × verim', 'Ölçümü olan sistemlerde ölçüm kullanılır (“ölçüm” etiketi). Verim: yoğun modelde ≈%70–80, MoE’de daha düşük.'],
  ['Görev süresi', 'bağlam ÷ okuma hızı + çıktı ÷ yazma hızı', 'Kısa cevap 2K okur / 1K yazar; düşünerek cevap 5K / 15K; kodlama ajanı görevi 32K / 50K.'],
  ['Aylık kapasite', 'yazma hızı × günlük saat × 30 × 3.600', 'Bilgisayarın ayda üretebileceği çıktı tokeni; kullanımın bunu aşarsa “yetmez” uyarısı çıkar.'],
  ['Ek elektrik', 'tarife(ev + ek kWh) − tarife(ev)', 'Ek kWh = token ÷ (hız × 3.600) × watt ÷ 1.000. Kademeli tarife: ayda 240 kWh’ye kadar alt kademe, üstü üst kademe; vergi ve KDV dahil.'],
  ['API maliyeti', 'çıktı × çıktı fiyatı + girdi × [(1 − ö) × girdi fiyatı + ö × önbellek fiyatı]', 'Girdi = çıktı × (100 − çıktı payı) ÷ çıktı payı; ö = önbellekten okunan pay. USD fiyatlar güncel kurla TL’ye çevrilir.'],
  ['Amorti', 'fiyat − ikinci el değeri + elektrik × ay = bulut × ay', 'Eşitliği sağlayan ay; kur ve TL fiyat artışı varsayımları dahil. Abonelik kotası kullanımına yetmiyorsa o seçenek elenir.']];
VIEWS.nasil = () => {
  const T = { ...Calc.cat().tariff, ...(S.tariff || {}) };
  return `${pageHead('sliders', 'Yöntem', 'Nasıl hesaplıyoruz?', 'Sitedeki her sayının nereden geldiği: formüller, varsayımlar ve veri kaynakları. Varsayımları buradan değiştirebilirsin; tüm sayfalar buna göre hesaplanır.')}
  <section class="card"><h2>Formüller</h2><div class="formulas">${FORMULAS.map(([n, f, d]) => `<div class="fx"><span class="fx-n">${n}</span><code class="fx-f">${f}</code><p>${d}</p></div>`).join('')}</div>
   <p class="small muted">Tüm hızlar aksi belirtilmedikçe <b>yazma (decode)</b> hızıdır. Okuma (prefill) çoğu zaman 10–30 kat daha hızlıdır. Kavramların ayrıntısı <a href="#metrikler">Metrikler</a> sayfasında.</p></section>
  <section class="card"><h2>Varsayımlar</h2><div class="fields four">
   <label class="f"><span>Dolar kuru (USD/TRY)</span><input type="number" step="0.0001" data-k="usdTry" value="${S.usdTry}"></label>
   <label class="f"><span>Yıllık kur artışı (%)</span><input type="number" data-k="usdYearly" value="${S.usdYearly}"></label>
   <label class="f"><span>Yıllık TL fiyat artışı (%)</span><input type="number" data-k="tlYearly" value="${S.tlYearly}"></label>
   <label class="f"><span>USD ek vergi (%)</span><input type="number" data-k="foreignTax" value="${S.foreignTax}"></label>
   <label class="f"><span>Günlük üretim saati</span><input type="number" step="0.5" data-k="hoursPerDay" value="${S.hoursPerDay}"></label>
   <label class="f"><span>Yıllık değer kaybı (%)</span><input type="number" data-k="depreciation" value="${S.depreciation}"></label>
   <label class="f"><span>Elektrik alt kademe (TL/kWh)</span><input type="number" step="0.01" data-tariff="lowRate" value="${nf(T.lowRate, 2).replace(',', '.')}"></label>
   <label class="f"><span>Elektrik üst kademe (TL/kWh)</span><input type="number" step="0.01" data-tariff="highRate" value="${nf(T.highRate, 2).replace(',', '.')}"></label>
   <label class="f"><span>Evin aylık tüketimi (kWh)</span><input type="number" step="10" data-tariff="homeKwh" value="${Math.round(T.homeKwh)}"></label>
  </div><label class="check"><input type="checkbox" data-k="resale" ${S.resale ? 'checked' : ''}> <span>Süre sonunda bilgisayarı ikinci elde satmayı hesaba kat (satışta ilk %15 kayıp)</span></label>
  <p class="small muted">Alt kademe ayda ${T.lowKwhPerDay * 30} kWh’ye kadar; vergi ve %${T.vatPct} KDV eklenir. Varsayılan tarife: ${esc(T.source || 'örnek ev faturası')}.</p>
  <button type="button" class="btn ghost" data-resetall>Tüm ayarları sıfırla</button></section>
  <section class="card"><h2>Veri nereden geliyor?</h2><div class="sources flow">
   <div class="src">${icon('globe')}<div><b>Tarayıcın, her ziyarette</b><span>OpenRouter API fiyatları ve dolar kuru doğrudan senin tarayıcından çekilir.</span></div></div>
   <div class="src">${icon('refresh')}<div><b>GitHub Actions, her hafta</b><span>Gamegaraj, Gaming.gen.tr, Apple Türkiye ve TCMB; değişiklik varsa <code>data/prices.json</code> güncellenir.</span></div></div>
   <div class="src">${icon('edit')}<div><b>Elle, tarihli</b><span>Otomatik erişimi engelleyen mağazaların teklifleri, tarihleriyle birlikte <code>data/manual-offers.json</code> dosyasında tutulur.</span></div></div></div></section>
  <section class="card"><h2>Kaynaklar</h2><ul class="links">
   <li><a href="https://github.com/Niko1221/Strata" target="_blank" rel="noopener">Strata (GitHub)</a> · <a href="https://github.com/Niko1221/Strata/blob/main/docs/MODELS.md" target="_blank" rel="noopener">Bellek ve hız tabloları</a> · <a href="https://github.com/Niko1221/Strata/blob/main/docs/DEEPSEEK41.md" target="_blank" rel="noopener">DeepSeek ölçümleri</a> · <a href="https://github.com/Niko1221/Strata/blob/main/docs/COMMUNITY_BENCHMARKS.md" target="_blank" rel="noopener">Topluluk ölçümleri</a></li>
   <li>Yerel AI topluluğu ölçümleri ve teknik incelemeler (Ekim–Kasım 2026)</li>
   <li>Fiyatlar: Gamegaraj, Gaming.gen.tr, Apple Türkiye, OpenRouter, TCMB (otomatik); akakçe, Vatan, Hepsiburada, n11, Sinerji, İnceHesap, sahibinden (elle, tarihli)</li>
   <li>Abonelik ve API fiyatları: sağlayıcıların resmî fiyat sayfaları (<a href="#bulut">Bulut</a> sayfasında her seçenekte bağlantı)</li></ul></section>`;
};

/* --- metrics --- */
const MET_DEVICES = [ // label, memory bandwidth GB/s, memory GB
  ['RTX 3060 12 GB', 360, 12], ['RTX 4060 8 GB', 272, 8], ['RTX 5060 Ti 16 GB', 448, 16], ['RTX 5070 12 GB', 672, 12], ['RTX 5070 Ti 16 GB', 896, 16], ['RTX 5080 16 GB', 960, 16],
  ['RTX 3090 24 GB', 936, 24], ['RTX 4090 24 GB', 1008, 24], ['RTX 5090 32 GB', 1792, 32], ['RX 9060 XT 16 GB', 320, 16], ['RX 9070 XT 16 GB', 640, 16], ['RX 7900 XT 20 GB', 800, 20], ['Radeon AI PRO R9700 32 GB', 640, 32],
  ['Mac mini M6', 170, 32], ['Mac M5 Pro', 307, 64], ['Mac M5 Max (40 çekirdek)', 614, 128], ['Mac M5 Ultra', 1200, 256], ['Ryzen AI Max mini PC (128 GB)', 256, 128], ['DGX Spark (128 GB)', 273, 128], ['PlayStation 5 (16 GB)', 448, 16],
  ['Sistem RAM · DDR5 çift kanal (gerçek)', 70, 64], ['Sistem RAM · DDR4 çift kanal (gerçek)', 34, 64]];
const MET_BASE = [ // label, GB read per generated token, total file GB
  ['Qwen3.8 27B · 4 bit (yoğun)', 16.5, 16.5], ['Qwen3.8 27B · 3,5 bit (yoğun)', 11.8, 11.8], ['Qwen3.8 27B · 2 bit (yoğun)', 6.8, 6.8], ['Qwen3.6-35B-A3B · 4 bit (MoE, ~3B etkin)', 2, 22],
  ['Qwen3.8-Flash-Next 125B · IQ2_XS (MoE, ~6B etkin)', 1.8, 39], ['gpt-oss 120B (MoE, ~5B etkin)', 3, 63], ['Llama 3.3 70B · 4 bit (yoğun)', 42.5, 42.5]];
const MET_MODELS_LIST = () => [...MET_BASE, ...Calc.localModels().filter(m => m.id.startsWith('g:') && !['g:gptoss-120b', 'g:llama33-70b'].includes(m.id)).map(m => [`${m.label} · ${m.mx ? 'MXFP4' : 'Q4'}${m.moe ? ` (MoE, ~${nf(m.active, 1)}B etkin)` : ' (yoğun)'}`, Math.round(m.file * m.active / m.total * 100) / 100, m.file])];
// Decode ceiling: every token reads the active weights once. The part that does not fit in fast memory comes from
// system RAM (PC, ≈70 GB/s) or the SSD (unified memory, ≈5 GB/s). For MoE, frequently used experts stay in fast memory.
function metCalc(d, m) {
  const [name, bw, mem] = d, [, gbTok, file] = m, uni = /^(Mac|Ryzen|DGX)/.test(name), sys = /^Sistem RAM/.test(name);
  const usable = uni ? mem * 0.75 : sys ? mem - 8 : mem - 1.5, moe = gbTok < file * 0.5;
  const f = Math.min(1, usable / file), fits = f >= 1, slow = uni || sys ? 5 : 70;
  const hit = moe ? f + (1 - f) * 0.6 : f;
  const ceil = 1 / (gbTok * hit / bw + gbTok * (1 - hit) / slow), k = moe && fits ? 0.3 : 0.75;
  return { fits, f, hit, ceil, real: ceil * k, k, moe, slow, usable };
}
const MET_SECTIONS = [
  ['hesap', 'Yazma hızı hesaplayıcı'], ['token', 'Girdi ve çıktı tokenleri'], ['okuma', 'Okuma ve yazma hızı'], ['gpu', 'GPU verimi'], ['zincir', 'Darboğaz zinciri'],
  ['moe', 'MoE ve Strata: neden RAM?'], ['kv', 'Bağlam (KV cache) belleği'], ['dusunme', 'Düşünme tokenleri'], ['quant', 'Quant ve kalite'], ['tokenizer', 'Tokenizer ve dil'], ['motor', 'Motorlar'], ['api', 'Neden API ucuz?']];
function tokenBillViz() {
  const P = [0.1, 1, 5], K = ['Önbellekten girdi', 'Yeni girdi', 'Çıktı'], C = ['seg-c', 'seg-i', 'seg-o'];
  const sc = [['Sohbet', [0, 75, 25]], ['Kodlama ajanı', [96.6, 3.1, 0.3]]];
  const row = (l, arr) => { const t = arr.reduce((a, b) => a + b, 0); return `<div class="sb-row"><span>${l}</span><span class="sbar">${arr.map((v, i) => v / t * 100 >= 0.4 ? `<i class="${C[i]}" style="width:${v / t * 100}%" title="${K[i]}: %${nf(v / t * 100, 1)}">${v / t * 100 >= 9 ? '%' + nf(v / t * 100) : ''}</i>` : '').join('')}</span></div>`; };
  return `<div class="viz"><div class="viz-h">Token payı ve fatura payı <span class="muted">(fiyat oranı: önbellek 0,1 · girdi 1 · çıktı 5)</span></div>${sc.map(([n, a]) => `<div class="sb-group"><b>${n}</b>${row('Tokenler', a)}${row('Fatura', a.map((v, i) => v * P[i]))}</div>`).join('')}
   <div class="legend">${K.map((k, i) => `<span><i class="${C[i]}"></i>${k}</span>`).join('')}</div></div>`;
}
function chainViz() {
  const R = [['Ekran kartı belleği', 450, 1800], ['Mac birleşik bellek', 170, 1200], ['DDR5 çift kanal (gerçek)', 60, 80], ['PCIe 5 x16', 56, 56], ['DDR4 çift kanal (gerçek)', 33, 35], ['PCIe 4 x16', 28, 28], ['PCIe 3 x16', 14, 14], ['NVMe SSD', 3.5, 7]];
  const pos = v => Math.log10(v) / Math.log10(3000) * 100;
  return `<div class="viz"><div class="viz-h">Bellek ve veri yolu hızları <span class="muted">(GB/sn, logaritmik)</span></div><div class="rbars">${R.map(([l, a, b]) => `<div class="rb-row"><span>${l}</span><span class="rb"><i style="left:${pos(a)}%;width:${Math.max(1.2, pos(b) - pos(a))}%"></i></span><b>${a === b ? nf(a) : nf(a, a < 10 ? 1 : 0) + '–' + nf(b)}</b></div>`).join('')}
   <div class="rb-row axis"><span></span><span class="rb-ax">${[1, 10, 100, 1000].map(v => `<em style="left:${pos(v)}%">${nf(v)}</em>`).join('')}</span><b></b></div></div></div>`;
}
function quantViz() {
  const Q = [['2 bit', 91.2], ['3 bit', 95.1], ['4 bit', 98.5]];
  return `<div class="viz"><div class="viz-h">Asıl modelden farklı kelime seçme oranı</div><div class="hbars">${Q.map(([l, p]) => `<div class="hb-row"><span>${l}</span><span class="hb"><i style="width:${(100 - p) / 10 * 100}%"></i></span><b>%${nf(100 - p, 1)} <small>≈ her ${nf(100 / (100 - p))} kelimede bir</small></b></div>`).join('')}</div></div>`;
}
VIEWS.metrikler = () => `${pageHead('gauge', 'Metrikler', 'Hızı ve maliyeti belirleyen sayılar', 'Girdi ve çıktı tokenleri, okuma ve yazma hızı, bellek bant genişliği… Bir bilgisayarın ya da bir API’nin sana ne kadara ve ne hızda hizmet edeceğini bu sayılar belirler.')}
  <div class="doc"><nav class="toc" aria-label="Bölümler">${MET_SECTIONS.map(([id, t], i) => `<button type="button" data-jump="m-${id}"><span>${i}</span>${t}</button>`).join('')}</nav><div class="doc-main">
  <section class="card" id="m-hesap"><h2><span class="secn">0</span>Yazma hızı hesaplayıcı</h2><p class="muted">Model her yeni token için “etkin” ağırlıklarının tamamını bellekten okur. Bu yüzden yazma hızının üst sınırı ≈ <b>bellek bant genişliği ÷ token başına okunan GB</b>. Modelin sığmayan kısmı sistem RAM’inden (≈70 GB/sn) veya SSD’den okunur ve hızı o belirler.</p>
   <div class="fields two"><label class="f"><span>Donanım</span><select data-met="dev">${MET_DEVICES.map((d, i) => `<option value="${i}"${i === S.metDev ? ' selected' : ''}>${d[0]} · ${d[1]} GB/sn</option>`).join('')}</select></label>
   <label class="f"><span>Model</span><select data-met="model">${MET_MODELS_LIST().map((m, i) => `<option value="${i}"${i === S.metModel ? ' selected' : ''}>${m[0]}</option>`).join('')}</select></label></div>
   <div id="results"></div></section>
  <section class="card prose" id="m-token"><h2><span class="secn">1</span>Girdi ve çıktı tokenleri</h2>
   <p><b>Girdi (input)</b> modelin okuduğu her şey: sistem talimatı, sohbet geçmişi, dosyalar, araç tanımları. <b>Çıktı (output)</b> modelin yazdığı her şey, düşünme tokenleri dahil.</p>
   ${tokenBillViz()}
   <ul><li><b>Fiyat farkı:</b> API’lerde çıktı tokeni genelde girdiden 4–8 kat pahalı (ör. 1 $ girdi / 5 $ çıktı). Önbellekten okunan girdi ise normal girdinin yaklaşık 1/10’u.</li>
   <li><b>Örnek:</b> pik dışı saatlerde 1M tokenlik önbellek isabeti ≈0,3 sent, önbellek ıskası ≈15 sent, 1M çıktı ≈60 sent: çıktı, önbellek isabetinden ≈200 kat pahalı.</li>
   <li><b>Kodlama oturumlarında</b> tokenlerin ≈%96,6’sı önbellekten okunur, yazılan kod tokenlerin yalnızca ≈%0,3’ü. Faturayı çoğu zaman önbellek belirler; uzun bir ajan oturumunda 40. turda 80 bin girdi tokenine karşılık 800 çıktı tokeni olabilir.</li>
   <li><b>Sohbet</b> genelde %20–30 çıktı, <b>yazı üretimi</b> %40–60 çıktıdır. Sitede bu oran “çıktı payı” ayarıyla hesaba katılır.</li></ul></section>
  <section class="card prose" id="m-okuma"><h2><span class="secn">2</span>Okuma (prefill) ve yazma (decode) hızı</h2>
   <p>Okuma binlerce tokeni aynı anda işler; hesap gücüne (tensor çekirdekleri) bağlıdır. Yazma tokenleri tek tek üretir; bellek bant genişliğine bağlıdır. İkisi arasında çoğu zaman 10–30 kat fark vardır.</p>
   <div class="viz"><div class="viz-h">Bağlamı okuma ve cevabı yazma süresi <span class="muted">(Qwen 125B · PC: okuma 2.090, yazma 87 tok/sn · Mac: okuma 94, yazma 13 tok/sn)</span></div>${taskBars([{ label: '12 GB kart + 64 GB RAM', sub: '32K okur · 1K yazar', read: 32000 / 2090, write: 1000 / 87 }, { label: '32 GB Mac, uzmanlar SSD’den', sub: '32K okur · 1K yazar', read: 32000 / 94, write: 1000 / 13 }, { label: 'Aynı PC, kısa soru', sub: '2K okur · 1K yazar', read: 2000 / 2090, write: 1000 / 87 }])}</div>
   <ul><li>12 GB kart + 64 GB RAM, DeepSeek 763B: okuma ≈110 tok/sn, yazma 4–6 tok/sn.</li><li>RTX 5060 Ti’de Qwen 27B: 96 bin tokenlik metni ≈618 tok/sn okuyor; aynı bant genişliğine sahip PS5 yalnızca 35–50 tok/sn okuyor (matris donanımı yok).</li>
   <li><b>İlk kelimeye kadar bekleme = bağlam ÷ okuma hızı.</b> Ajanların ilk isteği ≈30–33 bin token: 600 tok/sn’de ≈55 sn, 2.000 tok/sn’de ≈16 sn. Bir Mac’te sayaç 57 tok/sn gösterirken 8,5K bağlamla gerçek hız 3 tok/sn ölçüldü; beklemenin %94’ü okumaydı.</li></ul></section>
  <section class="card prose" id="m-gpu"><h2><span class="secn">3</span>GPU verimi: bant genişliği ve hesap gücü</h2>
   <ul><li><b>Yazma tavanı</b> = bant genişliği ÷ token başına okunan GB. Yoğun 27B 4 bit ≈16,5 GB okur: RTX 3090 (936 GB/sn) için tavan ≈57 tok/sn; Mac M5 Max (614) ≈37; M6 (170) ≈10. Hesaplayıcının altındaki grafik bunu tüm cihazlar için gösterir.</li>
   <li><b>MoE modeller</b> her tokende ağırlıkların küçük bir kısmını okur (Qwen 35B-A3B ≈2 GB, Qwen 125B IQ2_XS ≈1,8 GB, gpt-oss 120B ≈3 GB). Bu yüzden kısmen sistem RAM’indeyken bile hızlı çalışabilirler.</li>
   <li><b>Çoklu token tahmini (MTP) / spekülatif çözme:</b> küçük bir taslak model birkaç tokeni tahmin eder, büyük model tek okumada doğrular. Gerçekte 1,5–3 kat hızlanma; “200 tok/sn” gibi başlıklar çoğu zaman en iyi senaryodur (bir testte tahminlerin ≈1/3’ü tuttu: 30 → 80 tok/sn).</li>
   <li><b>GeForce sınırı:</b> GeForce kartlar 16 bit hesabı 32 bit toplamayla yarım hızda yapar. llama.cpp’nin yazma hızını etkilemez; uzun bağlam okumayı (100K’da ≈%17), vLLM ve görüntü üretimini yavaşlatır.</li></ul></section>
  <section class="card prose" id="m-zincir"><h2><span class="secn">4</span>Darboğaz zinciri</h2>
   <p>Modelin bir kısmı RAM’deyse her token en yavaş katmanı bekler. Ekran kartı belleği ile sistem RAM’i arasında 10–25 kat fark var.</p>
   ${chainViz()}
   <p class="small muted">Örnek: token başına 1 GB uzman verisi DDR4’ten (34 GB/sn) okunursa tavan ≈34 tok/sn; PCIe 3 üzerinden taşınırsa ≈14 tok/sn. Bu yüzden ekran kartında tutulan “uzman önbelleği” ve motor ayarları kritik.</p></section>
  <section class="card prose" id="m-moe"><h2><span class="secn">5</span>MoE ve Strata: neden RAM?</h2>
   <p>Mixture-of-Experts modellerde her kelime için uzmanların küçük bir kısmı kullanılır. Strata sık kullanılan kısmı ekran kartına, sonrakini RAM’e, nadir olanı SSD’ye koyar. Bu yüzden VRAM değil <b>RAM kapasitesi</b> belirleyici olur.</p>
   <ul><li><b>Qwen3.8-Flash-Next 125B:</b> RAM ≥ uzmanlar + ≈10 GB (IQ2_XS ≈46 GB). 12 GB kart + 64 GB RAM ile 79–94 tok/sn ölçüldü.</li>
   <li><b>DeepSeek V4.1 Flash 763B:</b> en az 12 GB kart, 46 GB RAM (64 GB rahat) ve ≈265 GB disk. 64 GB’ta 4–10, 128 GB’ta ≈29 tok/sn.</li>
   <li>RAM yetmezse uzmanlar SSD’den okunur: çalışır ama çok yavaşlar (32 GB Mac’te Qwen 125B ≈13 tok/sn).</li></ul></section>
  <section class="card prose" id="m-kv"><h2><span class="secn">6</span>Bağlam (KV cache) belleği</h2>
   <ul><li>Bağlam, model ağırlıklarının üstüne bellek ister. Token başına: DeepSeek V4.1 ≈890 bayt (1 milyon token &lt;1 GB), bazı büyük modeller 64–88 KB (1 milyon token 69–94 GB). Aynı bağlam için 100 kat fark.</li>
   <li>16 GB kartta 3,5 bit 27B ile ≈110K token bağlam (8 bit önbellek) kalır; liderlik tablosu skorları 250–500K bağlamla ölçülür.</li>
   <li>Yalnızca indirme boyutuna bakma: “512 GB gerekir” denen model, büyük tablosu SSD’de durunca ≈300 GB ile çalışabiliyor.</li></ul></section>
  <section class="card prose" id="m-dusunme"><h2><span class="secn">7</span>Düşünme tokenleri ve görev başına token</h2>
   <ul><li>Düşünme ayarı “çok yüksek” iken bir model, zor bir soruda ≈15 bin düşünme tokeni harcıyor; 45 tok/sn’de ≈5,5 dakika. “Orta” ayar birkaç bin token.</li>
   <li>Bir ajan görevinde ortalama ≈52 bin token yazılabiliyor. Bir testte bir model görev başına 45 bin, diğeri 2,7 bin token harcadı: tok/sn’si %11 yüksek olan, 8 kat geç bitirdi.</li>
   <li>Sağlayıcıların varsayılan düşünme ayarı genelde “orta”; tanıtım skorları en yüksek ayarla ölçülür (bir örnekte 57,8’e karşı 52,5).</li></ul></section>
  <section class="card prose" id="m-quant"><h2><span class="secn">8</span>Quant (sıkıştırma) ve kalite</h2>
   <p>Bit sayısı düştükçe model asıl modelden sapar. Aynı bit sayısında farklı yapımcıların dosyaları belirgin fark gösterebiliyor (bir testte 20 hatanın 16’sına karşı 7’si düzeltildi).</p>
   ${quantViz()}</section>
  <section class="card prose" id="m-tokenizer"><h2><span class="secn">9</span>Tokenizer ve dil</h2>
   <ul><li>Aynı metin yeni bir model sürümünde 1–1,35 kat daha fazla token tutabilir; model aynıyken fatura ≈%20 artabilir.</li><li>Aynı metin bazı dillerde İngilizceye göre 15 kata kadar fazla token tutar; Türkçe metinler İngilizceden genelde daha fazla token harcar.</li></ul></section>
  <section class="card prose" id="m-motor"><h2><span class="secn">10</span>Motorlar</h2>
   <p>Strata (Qwen 125B ve DeepSeek için), llama.cpp ve türevleri (Avalon, uzman önbelleği), vLLM ve Mac motorları aynı donanımda çok farklı sonuç verir. Bir motorun bir sürümden diğerine 3 kat hızlandığı görüldü; aynı makinede motor değişince okuma hızı 10 kata kadar değişebiliyor. Bu yüzden hızlar zamanla değişir.</p></section>
  <section class="card prose" id="m-api"><h2><span class="secn">11</span>Neden API ucuz? Veri merkezi verimi</h2>
   <ul><li>Evdeki bilgisayar bellekten her okumada tek bir kişiye token üretir. Veri merkezi aynı okumayla yüzlerce kullanıcıya üretir: bir GPU 256 eş zamanlı konuşmayla ≈26.300 tok/sn; bir H100 toplamda ≈2.800 tok/sn, kullanıcı başına ≈112 tok/sn.</li>
   <li>Üstüne önbellek: bir sağlayıcıda girdi tokenlerinin ≈%96’sı diskteki önbellekten geliyor. Aynı yılda donanım pahalanırken token fiyatları düştü.</li></ul></section>
  </div></div>`;
function resultsMetrikler() {
  const d = MET_DEVICES[S.metDev] || MET_DEVICES[6], ML = MET_MODELS_LIST(), m = ML[S.metModel] || ML[0], r = metCalc(d, m);
  const rows = MET_DEVICES.map((dv, i) => [i, dv, metCalc(dv, m)]).sort((a, b) => b[2].real - a[2].real), max = rows[0][2].real;
  const where = r.fits ? `${d[1]} GB/sn ÷ ${nf(m[1], 1)} GB/token` : `%${nf(r.hit * 100)} hızlı bellekten, %${nf((1 - r.hit) * 100)} ${r.slow === 5 ? 'SSD’den' : 'sistem RAM’inden'}`;
  return `<div class="vstats m-stats"><div><span>Teorik tavan</span><b>${nf(r.ceil)} tok/sn</b><small>${where}</small></div><div><span>Gerçekçi (≈%${Math.round(r.k * 100)})</span><b>${nf(r.real)} tok/sn</b><small>1.000 token ≈ ${dur(1000 / r.real)}${r.moe && r.fits ? ' · MoE’de yönlendirme ek yük getirir (M5 Max 128 GB’ta Qwen 125B ölçümü 87)' : ''}</small></div><div class="${r.fits ? 'okc' : 'warnc'}"><span>Model belleğe sığıyor mu?</span><b>${r.fits ? 'Evet' : 'Hayır'}</b><small>dosya ≈${nf(m[2], 1)} GB · kullanılabilir ≈${nf(r.usable)} GB${r.fits ? '' : r.moe ? ' · sık kullanılan uzmanlar hızlı bellekte tutulur' : ' · her token yavaş katmanı bekler'}</small></div></div>
  <div class="viz"><div class="viz-h">Bu model tüm cihazlarda <span class="muted">(gerçekçi yazma hızı, tok/sn)</span></div><div class="hbars dev">${rows.map(([i, dv, x]) => `<div class="hb-row${i === S.metDev ? ' sel' : ''}${x.fits ? '' : ' over'}"><span>${esc(dv[0])}</span><span class="hb"><i style="width:${Math.max(0.8, x.real / max * 100)}%"></i></span><b>${nf(x.real)}${x.fits ? '' : ' <small>taşar</small>'}</b></div>`).join('')}</div>
   <div class="legend"><span><i class="k-ok"></i>Model hızlı belleğe sığıyor</span><span><i class="k-over"></i>Sığmıyor: kalanı RAM’den / SSD’den</span></div></div>`;
}

/* ---------- render & events ---------- */
const RESULTS = { metrikler: resultsMetrikler, elimde: resultsElimde, al: resultsAl, bulut: resultsBulut, karsilastir: resultsKarsilastir };
const TITLES = { elimde: 'Bilgisayarım var', al: 'Bilgisayar al', bulut: 'Bulut', karsilastir: 'Al mı, kirala mı?', fiyatlar: 'Fiyatlar', metrikler: 'Metrikler', nasil: 'Yöntem' };
function route() { return (location.hash.replace(/^#\/?/, '').split('?')[0]) || ''; }
function render() {
  const v = VIEWS[route()] ? route() : '';
  $('#app').innerHTML = VIEWS[v]();
  $$('.nav a').forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + v)));
  updateResults();
  document.title = (v ? TITLES[v] + ' · ' : '') + 'Yerel AI maliyet';
}
function updateResults() {
  const v = route(), box = $('#results');
  if (box && RESULTS[v]) box.innerHTML = RESULTS[v]();
  if (v === 'karsilastir') drawCompareCharts();
  if (v === 'al') drawBuyCharts();
}
function rerenderControls() { const y = scrollY; render(); scrollTo(0, y); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }

document.addEventListener('input', e => {
  const t = e.target, k = t.dataset.k, v = Number(t.value), ok = t.value !== '' && Number.isFinite(v);
  if (k && t.type !== 'checkbox' && ok) { set(k, v); if (k === 'usdTry') set('usdTryManual', true); if (k === 'monthlyTokens' || k === 'outputSharePercent') { set('preset', null); $$('.preset.on').forEach(b => b.classList.remove('on')); } updateResults(); }
  else if (t.dataset.tariff && ok) { set('tariff', { ...S.tariff, [t.dataset.tariff]: v }); }
});
document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (d.k && t.type === 'checkbox') { set(d.k, t.checked); updateResults(); }
  else if (d.mine) { const m = { ...S.mine }; if (d.mine === 'gpu') { const g = MINE_GPUS.find(x => x[0] === t.value); m.gpu = t.value; m.vram = g[2]; m.watts = g[3]; } else m[d.mine] = d.mine === 'ramType' ? t.value : Number(t.value); set('mine', m); rerenderControls(); }
  else if (d.slot) { S.build[d.slot] = t.value; save(); $('#builderBox').innerHTML = builderHtml(); }
  else if ('gpucount' in d) { S.build.gpuCount = Number(t.value); save(); $('#builderBox').innerHTML = builderHtml(); }
  else if (d.offer) { S.offerSel[d.offer] = t.value; save(); updateResults(); }
  else if (d.pickoffer) { S.offerSel[d.pickoffer] = t.value; save(); const det = t.closest('details'); det.outerHTML = opartHtml(d.pickoffer, true); }
  else if ('modelsel' in d) { set('model', t.value); set('cmpCloud', ''); rerenderControls(); }
  else if (d.met) { set(d.met === 'dev' ? 'metDev' : 'metModel', Number(t.value)); updateResults(); }
  else if ('cmplocal' in d) { set('cmpLocal', t.value); updateResults(); }
  else if ('cmpcloudsel' in d) { set('cmpCloud', t.value); updateResults(); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('button, a'); if (!b) return; const d = b.dataset;
  if (d.preset) { const p = Calc.cat().usagePresets.find(x => x.id === d.preset); Object.assign(S, { preset: p.id, taskType: p.task || S.taskType, monthlyTokens: Math.round(p.calls * p.tokens * p.days / 1e4) / 100, outputSharePercent: p.outputPct, cachedInputSharePercent: p.cachePct ?? S.cachedInputSharePercent }); save(); rerenderControls(); }
  else if (d.model) { set('model', d.model); set('cmpCloud', ''); rerenderControls(); }
  else if (d.task) { set('taskType', d.task); rerenderControls(); }
  else if (d.buyfilter) { set('buyFilter', d.buyfilter); updateResults(); }
  else if (d.sysview) { set('sysView', d.sysview); updateResults(); }
  else if (d.cloudclass) { set('cloudClass', d.cloudclass); updateResults(); }
  else if (d.cmpclass) { set('cmpClass', d.cmpclass); set('cmpCloud', ''); updateResults(); }
  else if (d.tokscale) { set('tokScale', d.tokscale); updateResults(); }
  else if (d.cloudsort) { set('cloudSort', d.cloudsort); updateResults(); }
  else if (d.sort) { const i = d.sort.indexOf(':'), t = d.sort.slice(0, i), k = d.sort.slice(i + 1), cur = (S.sorts || {})[t]; set('sorts', { ...S.sorts, [t]: { k, d: cur && cur.k === k ? -cur.d : SORT_DEF[k] || (Calc.MODELS[k] ? -1 : 1) } }); updateResults(); }
  else if (d.jump) { const el = document.getElementById(d.jump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else if (d.compare) { set('cmpLocal', d.compare); location.hash = '#karsilastir'; }
  else if (d.cmpLocal) { set('cmpLocal', d.cmpLocal); }
  else if (d.cmpcloud) { set('cmpCloud', d.cmpcloud); set('cmpClass', 'all'); location.hash = '#karsilastir'; }
  else if ('resetoffers' in d) { set('offerSel', {}); rerenderControls(); toast('Mağaza seçimleri sıfırlandı'); }
  else if ('resetall' in d) { S = DEFAULT_STATE(); save(); rerenderControls(); toast('Ayarlar sıfırlandı'); }
  else if ('copybuild' in d) { const c = customComputer(); const txt = c.items.map(i => `${i.part.label}: ${i.offer.name} — ${i.offer.price} TL (${i.offer.store}) ${i.offer.url}`).join('\n') + `\nToplam: ${c.price} TL`; navigator.clipboard?.writeText(txt).then(() => toast('Parça listesi kopyalandı')); }
  else if (b.id === 'share') { navigator.clipboard?.writeText(shareUrl()).then(() => toast('Bağlantı kopyalandı'), () => prompt('Bağlantı:', shareUrl())); }
  else if (b.id === 'theme') { const dark = document.documentElement.dataset.theme !== 'dark' && !(document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; try { localStorage.setItem('yerel-ai-theme', dark ? 'dark' : 'light'); } catch (e) {} }
});
window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
let resizeT; window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (route() === 'karsilastir') drawCompareCharts(); if (route() === 'al') drawBuyCharts(); }, 200); });

/* ---------- boot ---------- */
(async function boot() {
  try { const th = localStorage.getItem('yerel-ai-theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
  const get = u => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  const [catalog, live, manual] = await Promise.all([get('data/catalog.json'), get('data/prices.json'), get('data/manual-offers.json')]);
  if (!catalog) { $('#app').innerHTML = '<section class="card"><h2>Veri yüklenemedi</h2><p>Sayfayı bir web sunucusu üzerinden açın (ör. GitHub Pages veya <code>python3 -m http.server</code>).</p></section>'; return; }
  Calc.init(catalog, live, manual);
  loadState();
  render();
  // Live data straight from the visitor's browser: OpenRouter API prices and the USD/TRY rate.
  const [or, fx] = await Promise.all([get('https://openrouter.ai/api/v1/models'), get('https://open.er-api.com/v6/latest/USD')]);
  const n = or ? Calc.applyBrowserOpenRouter(or.data) : 0;
  const rate = fx && fx.rates && fx.rates.TRY;
  if (rate && !S.usdTryManual) S.usdTry = Math.round(rate * 10000) / 10000;
  LIVE_STATUS = { at: new Date(), api: n, rate: rate || null };
  updateResults(); const st = $('#liveStatus'); if (st) st.innerHTML = liveStatusText();
})();
