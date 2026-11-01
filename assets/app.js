'use strict';
/* UI: hash router, shared state, views. Calculations live in calc.js. */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (v, d = 0) => Number(v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const tl = (v, d = 0) => nf(v, d) + ' TL';
const tps = v => v >= 1 ? nf(v, v < 10 ? 1 : 0) + ' tok/sn' : '—';
const dur = s => !Number.isFinite(s) ? '—' : s < 60 ? nf(s) + ' sn' : s < 3600 ? nf(s / 60, s < 600 ? 1 : 0) + ' dk' : nf(s / 3600, 1) + ' sa';
const ansTime = t => { if (!t) return '—'; const s = 1000 / t; return s < 60 ? nf(s) + ' sn' : nf(s / 60, 1) + ' dk'; };

/* ---------- state ---------- */
const DEFAULT_STATE = () => {
  const d = Calc.cat().defaults;
  return { monthlyTokens: d.monthlyTokens, outputSharePercent: d.outputSharePercent, cachedInputSharePercent: d.cachedInputSharePercent,
    preset: null, taskType: 'short', model: 'qwen', privacy: false, budget: d.budget, horizon: d.horizon, hoursPerDay: d.hoursPerDay,
    usdTry: (Calc.live().usdTry && Calc.live().usdTry.value) || d.usdTry, usdYearly: 0, tlYearly: 0, foreignTax: 0, resale: false, depreciation: 25,
    offerSel: {}, caps: {}, cloudClass: 'all', cmpLocal: 'custom', cmpCloud: '', buyFilter: 'all', tariff: {},
    build: { gpu: 'gpu5070', gpuCount: 1, cpu: 'cpu7500f', mobo: 'moboB650', ram: 'ram64', ssd: 'ssd2', psu: 'psu850', case: 'caseMid', cooler: 'cooler' },
    mine: { gpu: 'rtx3060', vram: 12, watts: 170, ram: 32, ramType: 'DDR5', ssd: 500 } };
};
let S;
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
const MINE_GPUS = [ // id, label, VRAM GB, watts, prefill tok/s (Qwen 125B, estimate), vendor
  ['none', 'Ekran kartı yok / bilmiyorum', 0, 0, 0, ''], ['rtx3060', 'RTX 3060 12 GB', 12, 170, 900, 'NVIDIA'], ['rtx3060ti', 'RTX 3060 Ti 8 GB', 8, 200, 1000, 'NVIDIA'], ['rtx3070', 'RTX 3070 8 GB', 8, 220, 1100, 'NVIDIA'], ['rtx3080', 'RTX 3080 10 GB', 10, 320, 1500, 'NVIDIA'], ['rtx3090', 'RTX 3090 24 GB', 24, 350, 2000, 'NVIDIA'],
  ['rtx4060', 'RTX 4060 8 GB', 8, 115, 700, 'NVIDIA'], ['rtx4060ti16', 'RTX 4060 Ti 16 GB', 16, 165, 700, 'NVIDIA'], ['rtx4070', 'RTX 4070 12 GB', 12, 200, 1600, 'NVIDIA'], ['rtx4070ti', 'RTX 4070 Ti 12 GB', 12, 285, 2000, 'NVIDIA'], ['rtx4080', 'RTX 4080 16 GB', 16, 320, 2600, 'NVIDIA'], ['rtx4090', 'RTX 4090 24 GB', 24, 450, 3500, 'NVIDIA'],
  ['rtx5060ti', 'RTX 5060 Ti 16 GB', 16, 180, 600, 'NVIDIA'], ['rtx5070', 'RTX 5070 12 GB', 12, 250, 2090, 'NVIDIA'], ['rtx5070ti', 'RTX 5070 Ti 16 GB', 16, 300, 2400, 'NVIDIA'], ['rtx5080', 'RTX 5080 16 GB', 16, 360, 2700, 'NVIDIA'], ['rtx5090', 'RTX 5090 32 GB', 32, 575, 5000, 'NVIDIA'],
  ['rx6800', 'RX 6800 16 GB', 16, 250, 600, 'AMD-RDNA2'], ['rx7800xt', 'RX 7800 XT 16 GB', 16, 263, 800, 'AMD-RDNA3'], ['rx7900xt', 'RX 7900 XT 20 GB', 20, 315, 1100, 'AMD-RDNA3'], ['rx7900xtx', 'RX 7900 XTX 24 GB', 24, 355, 1300, 'AMD-RDNA3'], ['rx9060xt', 'RX 9060 XT 16 GB', 16, 160, 700, 'AMD'], ['rx9070xt', 'RX 9070 XT 16 GB', 16, 304, 1110, 'AMD'], ['r9700', 'Radeon AI PRO R9700 32 GB', 32, 300, 1200, 'AMD'],
  ['mac', 'Mac (Apple Silicon)', 0, 0, 0, 'Apple']];
const STATUS = { ok: ['ok', '✓ Rahat çalışır'], slow: ['slow', '⚠ Yavaş'], no: ['no', '✗ Çalışmaz'] };
const badge = st => `<span class="badge ${STATUS[st][0]}">${STATUS[st][1]}</span>`;
function presetButtons() {
  return `<div class="presets">${Calc.cat().usagePresets.map(p => `<button type="button" class="preset${S.preset === p.id ? ' on' : ''}" data-preset="${p.id}"><b>${esc(p.label)}</b><small>${nf(p.calls)} çağrı × ${nf(p.tokens)} token · ${p.days} gün → ${nf(p.calls * p.tokens * p.days / 1e6, 1)} M/ay</small></button>`).join('')}</div>`;
}
function modelToggle() {
  const M = [['qwen', 'Qwen3.8-Flash-Next 125B', 'Strata · hızlı, 12 GB kartta ≈80–95 tok/sn'], ['deepseek', 'DeepSeek V4.1 Flash 763B', 'Strata · dev model, 12 GB kartta 4–10 tok/sn'], ['dense14', 'Klasik 14B model', 'tamamı ekran kartında']];
  return `<div class="seg" role="group" aria-label="Bilgisayarda çalışacak model">${M.map(([k, l, s]) => `<button type="button" data-model="${k}" aria-pressed="${S.model === k}"><b>${l}</b><small>${s}</small></button>`).join('')}</div>`;
}
function taskToggle() { const T = Calc.cat().taskTypes; return `<div class="seg small" role="group" aria-label="Görev tipi">${Object.entries(T).map(([k, t]) => `<button type="button" data-task="${k}" aria-pressed="${S.taskType === k}"><b>${t.label}</b><small>${nf(t.out / 1000)}K yazar · ${nf(t.ctx / 1000)}K okur · ${t.desc}</small></button>`).join('')}</div>`; }
function usagePanel(opts = {}) {
  return `<section class="card usage">
  <div class="usage-head"><h2>${opts.title || 'Kullanımın'}</h2><span class="muted">${opts.sub || 'Sana en yakın profili seç; sonuçlar anında değişir.'}</span></div>
  ${presetButtons()}
  <div class="fields">
   <label class="f"><span>Aylık çıktı tokeni (milyon)</span><input type="number" min="0.01" max="1000" step="0.5" data-k="monthlyTokens" value="${S.monthlyTokens}"></label>
   <label class="f"><span>Çıktı payı (%) <i class="hint" title="Modelin yazdığı / (okuduğu + yazdığı). Kod ajanları büyük bağlam gönderdiği için %3–10, sohbet %20–30.">?</i></span><input type="number" min="1" max="100" data-k="outputSharePercent" value="${S.outputSharePercent}"></label>
   ${opts.budget ? `<label class="f"><span>Bilgisayar bütçesi (TL)</span><input type="number" min="0" max="700000" step="5000" data-k="budget" value="${S.budget}"></label>` : ''}
   ${opts.horizon !== false ? `<label class="f"><span>Karşılaştırma süresi (ay)</span><input type="number" min="1" max="120" data-k="horizon" value="${S.horizon}"></label>` : ''}
  </div>
  <div class="row-label">Tipik bir görev ne kadar? <i class="hint" title="Düşünen modeller ve kodlama ajanları bir görevde 15–50 bin token harcayabilir; ajanlar işe ~30 bin tokenlik bağlamla başlar. Görev süresi = bağlamı okuma + cevabı yazma.">?</i></div>${taskToggle()}
  ${opts.model !== false ? `<div class="row-label">Bilgisayarda hangi model çalışacak?</div>${modelToggle()}` : ''}
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
function computerCard(c, opts = {}) {
  const sp = Calc.speed(c, S.model), cap = Calc.capacity(c, S.model, S), el = Calc.electricity(c, S.model, S).tl, tt = Calc.taskTime(c, S.model, S);
  const short = cap < S.monthlyTokens;
  return `<article class="pc${opts.highlight ? ' hl' : ''}">
   ${opts.tag ? `<span class="tag">${opts.tag}</span>` : ''}
   <div class="pc-top"><h3>${esc(c.name)}</h3><strong>${tl(c.price)}${c.estimatedPrice ? ' ≈' : ''}</strong></div>
   <p class="muted small">${specLine(c)}</p>
   <div class="pc-stats"><div><span>${Calc.MODELS[S.model].short}</span><b>${tps(sp.tps)}</b><small>${sp.measured ? 'ölçüm' : 'tahmin'}</small></div><div><span>Görev süresi</span><b>${dur(tt.total)}</b><small>okuma ${dur(tt.read)} + yazma ${dur(tt.write)}</small></div><div><span>Ek elektrik</span><b>${tl(el)}/ay</b></div></div>
   ${badge(sp.status)}${short ? ` <span class="badge no">Kullanımına yetmez: en fazla ${nf(cap, 1)} M/ay</span>` : ''}
   <p class="small muted">${esc(sp.note)}</p>
   ${opts.reason ? `<p class="small reason">${opts.reason}</p>` : ''}
   <details class="more"><summary>Parçalar ve mağazalar</summary>${partsList(c)}</details>
   <div class="actions"><button type="button" class="btn ghost" data-compare="${c.id}">Bulutla karşılaştır →</button></div>
  </article>`;
}
function mineComputer() {
  const m = S.mine, uni = m.gpu === 'mac';
  const hw = { vram: uni ? 0 : m.vram, ram: m.ram, ramType: uni ? 'unified' : m.ramType, ssd: m.ssd };
  const d14 = Calc.estimate('dense14', hw);
  const g = MINE_GPUS.find(x => x[0] === m.gpu) || [];
  return { id: 'mine', pp: g[4], vendor: g[5], name: 'Elindeki bilgisayar', kind: uni ? 'mac' : 'pc', price: 0, vram: hw.vram, gpuVram: hw.vram, ram: m.ram, ramType: hw.ramType, ssd: m.ssd, watts: uni ? 60 : (m.watts || 0) + 120, tps14: d14.tps, gpus: 1, items: [], appleName: 'Kendi Mac’in', url: '#' };
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
  if (v >= 6 && v < 16 && r >= 32) out.push(['Qwen3.6-35B-A3B (uzmanlar RAM’de)', 'Her kelimede ~3B parametre okur; 6–8 GB kart + 32 GB RAM ile ≈23 tok/sn. 8 GB kartta 27B dense modelden çok daha hızlı.']);
  if (v >= 6 && v <= 8) out.push(['Gemma 4 12B · 3 bit (≈5,7 GB)', 'Tamamı kartta; sohbet ve kısa işler için.']);
  if (r < 32 && v < 12) out.push(['RAM’i 32 GB’a çıkar', '8 GB kartta asıl sınır RAM: 35B MoE modeli için 32 GB taban.']);
  return out.length ? out : [['Küçük modeller (4–9B)', 'Ekran kartı belleği sınırlı; bulut seçeneklerine de bak.']];
}
function engineTips(c) {
  const t = [];
  if (c.ramType === 'unified') t.push('<b>Mac:</b> macOS ekran kartına belleğin yaklaşık 3/4’ünü verir (128 GB’ta ≈96 GB); bir terminal ayarıyla artırılabilir.', '<b>Bağlamı büyüt:</b> bazı araçlar 24–48 GB Mac’te varsayılan bağlamı 32K tutar; ajanın ilk isteği tek başına ≈33K. Ajanlar için en az 64K ayarla.', '<b>Önbelleği bozma:</b> sohbetin başı değişirse model tüm bağlamı baştan okur; bu bir Mac’te dakikalar sürebilir.');
  else if ((c.vendor || '').startsWith('AMD-RDNA3')) t.push('<b>AMD RX 7000:</b> Strata’nın yanında llama.cpp tabanlı Avalon gibi motorları dene; aynı kartta %30–50 fark görülebiliyor.');
  else if ((c.vendor || '').startsWith('AMD')) t.push('<b>AMD:</b> Strata’nın HIP motoru RX 9060/9070 ve R9700’ü destekliyor.');
  else t.push('<b>NVIDIA:</b> Qwen 125B ve DeepSeek için Strata; dense modeller için llama.cpp. llama.cpp’nin yeni “uzman önbelleği” 24–32 GB kartlarda MoE modelleri %50’ye kadar hızlandırıyor (8 GB kartta yavaşlatabilir).');
  t.push('<b>Motor donanım kadar önemli:</b> aynı makinede motor değişince okuma hızı 10 kata kadar değişebiliyor.');
  return t;
}
function customComputer() {
  const b = S.build, keys = [b.gpu, b.cpu, b.mobo, b.ram, b.ssd, b.psu, b.case, b.cooler];
  return Calc.pcFromKeys('custom', 'Kendi topladığın sistem', keys, b.gpuCount || 1, S.offerSel);
}
function allLocal() { return [customComputer(), ...Calc.computers(S.offerSel)]; }
function findLocal(id) { return id === 'mine' ? mineComputer() : allLocal().find(c => c.id === id) || customComputer(); }

/* ---------- views ---------- */
const VIEWS = {};
VIEWS[''] = () => {
  const L = Calc.live(), r64 = Calc.cheapestOffer('ram64'), g12 = Calc.cheapestOffer('gpu5070');
  return `<section class="hero">
   <p class="eyebrow">Yerel yapay zekâ · Türkiye fiyatları</p>
   <h1>Pahalı ekran kartı artık giriş bileti değil.<br><span>Ama bedel RAM’e taşındı.</span></h1>
   <p class="lead"><b>Strata</b> ile 125 milyar parametrelik bir model, 12 GB ekran kartı ve 64 GB RAM’li sıradan bir bilgisayarda saniyede 80–95 token yazıyor. Bu site sana üç şeyi söyler: elindeki bilgisayar neyi çalıştırır, ne almalısın ve bulut mu daha ucuz.</p>
   <div class="facts"><div><b>12 GB</b><span>ekran kartı yeter</span></div><div><b>64 GB</b><span>RAM asıl şart</span></div><div><b>${tl(r64.price)}</b><span>64 GB DDR5 · ${esc(r64.store)}</span></div><div><b>${tl(g12.price)}</b><span>RTX 5070 12 GB · ${esc(g12.store)}</span></div></div>
  </section>
  <h2 class="q">Ne yapmak istiyorsun?</h2>
  <div class="personas">
   <a class="persona" href="#elimde"><span class="pi">💻</span><b>Bilgisayarım var</b><span>Elimdeki bilgisayar hangi modeli, ne hızda çalıştırır? Ne eklersem yeter?</span><em>Kontrol et →</em></a>
   <a class="persona" href="#al"><span class="pi">🛒</span><b>Yapay zekâ için bilgisayar alacağım</b><span>Kullanımıma ve bütçeme göre hangi bilgisayar? Hazır sistemler ve kendin topla.</span><em>Öneri al →</em></a>
   <a class="persona" href="#bulut"><span class="pi">☁️</span><b>Bilgisayar almadan kullanacağım</b><span>Abonelik mi, API mi? Kullanımıma en ucuz hangisi?</span><em>Karşılaştır →</em></a>
   <a class="persona" href="#karsilastir"><span class="pi">⚖️</span><b>Almak mı, kiralamak mı?</b><span>Bir bilgisayar kaç ayda kendini öder? Gizlilik şartsa ne olur?</span><em>Hesapla →</em></a>
  </div>
  <section class="card lessons"><h2>Almadan önce bilmen gereken altı şey</h2><ol>
   <li><b>Okuma ≠ yazma.</b> “12 GB kartta 100+ tok/sn” paylaşımları çoğu zaman okuma hızı. DeepSeek 763B aynı kartta 4–6 tok/sn yazıyor; Qwen 125B ≈94.</li>
   <li><b>Görev süresi, tok/sn’den önemli.</b> Düşünen modeller bir görevde 15–50 bin token harcayabilir; ajanlar işe 30 bin tokenlik bağlamla başlar. Hızlı ama çok konuşan model daha geç bitirebilir.</li>
   <li><b>Darboğaz kapasite.</b> Model ekran kartına sığmayınca CPU, RAM ve SSD belirleyici olur. 16 GB kartta Q4 değil 3,5 bit; 8 GB kartta 32 GB RAM asıl şart.</li>
   <li><b>Motor donanım kadar önemli.</b> Aynı makinede motor değişince hız 1,5–10 kat değişebiliyor.</li>
   <li><b>RAM pahalandı, token ucuzladı.</b> 64 GB DDR5 bir yılda ≈6 kat; aynı dönemde API fiyatları düştü. Gizlilik şart değilse kiralamak çoğu kişiye ucuz.</li>
   <li><b>Yerel her zaman gizli değil.</b> Sunucuyu dışarı açma, modeli güvendiğin yerden indir.</li></ol>
   <p class="small muted"><a href="#nasil">Yöntem ve ayrıntılar</a></p></section>
  <p class="small muted center">${L.meta ? `Fiyatlar son güncelleme: ${new Date(L.meta.updated).toLocaleString('tr-TR')}` : 'Fiyatlar: gömülü veri (otomatik güncelleme okunamadı)'} · <a href="#fiyatlar">Tüm mağaza fiyatları</a></p>`;
};

VIEWS.elimde = () => `<header class="page-head"><p class="eyebrow">Bilgisayarım var</p><h1>Elindeki bilgisayar neyi çalıştırır?</h1><p class="lead">Bir şey almadan önce bak. Videonun tavsiyesi: darboğaz RAM’ken daha hızlı kart, model zaten sığıyorken daha fazla RAM alma.</p></header>
  <section class="card"><div class="fields four">
   <label class="f"><span>Ekran kartı</span><select data-mine="gpu">${MINE_GPUS.map(g => `<option value="${g[0]}"${S.mine.gpu === g[0] ? ' selected' : ''}>${g[1]}</option>`).join('')}</select></label>
   <label class="f"><span>${S.mine.gpu === 'mac' ? 'Birleşik bellek' : 'Sistem RAM’i'}</span><select data-mine="ram">${[8, 16, 24, 32, 36, 48, 64, 96, 128, 192, 256].map(v => `<option${S.mine.ram === v ? ' selected' : ''} value="${v}">${v} GB</option>`).join('')}</select></label>
   <label class="f"><span>RAM türü</span><select data-mine="ramType" ${S.mine.gpu === 'mac' ? 'disabled' : ''}><option${S.mine.ramType === 'DDR5' ? ' selected' : ''}>DDR5</option><option${S.mine.ramType === 'DDR4' ? ' selected' : ''}>DDR4</option></select></label>
   <label class="f"><span>Boş SSD alanı</span><select data-mine="ssd">${[100, 250, 500, 1000, 2000].map(v => `<option value="${v}"${S.mine.ssd === v ? ' selected' : ''}>${v < 1000 ? v + ' GB' : v / 1000 + ' TB'}</option>`).join('')}</select></label>
  </div></section>
  <div id="results"></div>`;
function resultsElimde() {
  const c = mineComputer(), hw = { vram: c.vram, ram: c.ram, ramType: c.ramType, ssd: c.ssd };
  const ids = ['qwen', 'coder', 'q36', 'deepseek', 'dense14'];
  const cards = ids.map(id => { const e = Calc.estimate(id, hw); return `<article class="mcard ${e.status}">${badge(e.status)}<h3>${Calc.MODELS[id].label}</h3><b class="big">${tps(e.tps)}</b><span class="small">1.000 tokenlik cevap: ${ansTime(e.tps)}</span><p class="small muted">${esc(e.note)}</p></article>`; }).join('');
  const q = Calc.estimate('qwen', hw), r64 = Calc.cheapestOffer('ram64'), r4 = Calc.cheapestOffer('ram64ddr4'), r128 = Calc.cheapestOffer('ram128'), g = Calc.cheapestOffer('gpu3060used');
  let tip;
  if (c.ramType === 'unified') tip = q.status === 'ok' ? 'Mac’in Qwen 125B’yi bellekte tutabiliyor. Strata’nın Mac uygulamasıyla hemen deneyebilirsin.' : 'Mac’lerde bellek sonradan artırılamıyor; 64 GB altı Mac’te büyük modeller SSD’den okunur ve yavaşlar. Bulut seçeneklerine de bak.';
  else if (c.vram < 8) tip = `Strata için en az 8 GB (tercihen 12 GB) ekran kartı gerekir. En ucuz yol: 2. el RTX 3060 12 GB (≈${tl(g.price)}) + 64 GB RAM.`;
  else if (q.status === 'ok') tip = `<b>Hiçbir şey almana gerek yok.</b> Qwen3.8-Flash-Next 125B bu bilgisayarda ≈${tps(q.tps)} çalışır. ${c.ram < 128 ? `DeepSeek 763B’yi gerçekten kullanmak istersen 128 GB RAM gerekir (128 GB DDR5 ≈ ${tl(r128.price)}, ${esc(r128.store)}).` : ''}`;
  else tip = `<b>En etkili yükseltme RAM.</b> ${c.ramType === 'DDR4' ? `64 GB DDR4 ≈ ${tl(r4.price)} (${esc(r4.store)})` : `64 GB DDR5 ≈ ${tl(r64.price)} (${esc(r64.store)})`}. Ekran kartını değiştirmek bu modelde pek hızlandırmaz.`;
  const fits = Calc.cat().ggufModels.map(m => [m, Calc.ggufFit(m, 'Q4_K_M', hw)]).filter(([, f]) => f);
  const gpuFit = fits.filter(([, f]) => f === 'gpu').map(([m]) => m.name), off = fits.filter(([, f]) => f === 'offload').map(([m]) => m.name);
  const el = Calc.electricity(c, S.model, S).tl;
  const ppQ = Calc.prefill(c, 'qwen'), firstWord = 32000 / ppQ;
  return `<div class="mgrid">${cards}</div><div class="tip">${tip}</div>
  <section class="card"><h2>Bu bilgisayar için önerilen modeller</h2><ul class="recs">${recModels(c).map(r => `<li><b>${r[0]}</b><span>${r[1]}</span></li>`).join('')}</ul>
   <p class="small muted">Aynı bit sayısında bile quant’ı kimin hazırladığı kaliteyi değiştirir; tanınmış yapımcıların dosyalarını seç. Düşünme ayarını “orta” tutmak çoğu işte kaliteyi az, süreyi çok etkiler.</p></section>
  <section class="card"><h2>Kodlama ajanı kullanacaksan</h2><p>Ajanlar (Claude Code, Codex, OpenCode…) işe yaklaşık <b>30 bin tokenlik</b> araç tanımı ve proje bağlamıyla başlar. Bu bilgisayarda Qwen 125B bu bağlamı ≈<b>${nf(ppQ)} tok/sn</b> okur: ilk kelimeye kadar ≈<b>${dur(firstWord)}</b>. Ekranda görünen yazma hızı bu beklemeyi göstermez.</p>
   <ul class="checks">${engineTips(c).map(t => `<li>${t}</li>`).join('')}</ul></section>
  <section class="card"><h2>Yerel çalıştırmak her zaman gizli demek değil</h2><ul class="checks">
   <li><b>Sunucuyu yalnızca kendi bilgisayarına aç.</b> Ollama / llama.cpp sunucusu 127.0.0.1’i dinlemeli. İnternette tüm ağa açık on binlerce yerel AI sunucusu bulundu; çoğunda araç çağırma açık.</li>
   <li><b>Motorları güncel tut.</b> Model dosyasındaki sohbet şablonu üzerinden bilgisayarda komut çalıştırmaya izin veren açıklar yaşandı.</li>
   <li><b>Modeli tanınmış yapımcıdan indir.</b> Bir modele gizli “arka kapı” eklemek ucuz: eğitim verisinin %1’i ve birkaç saatlik kiralık GPU yetebiliyor. Bilinmeyen ince ayarlı veya “sansürsüz” sürümlere dikkat.</li>
   <li><b>Ajanlara verdiğin izinleri sınırla.</b> Dosya ve komut izni olan bir ajan, zararlı bir bağlantıyı veya komutu yerel modelle de çalıştırabilir.</li></ul></section>
  <section class="card"><h2>Klasik modeller (llama.cpp, Q4, 8K bağlam)</h2><p><b>Ekran kartına sığan (${gpuFit.length}):</b> ${gpuFit.join(', ') || '—'}</p><p><b>RAM’e taşarak, yavaş (${off.length}):</b> ${off.join(', ') || '—'}</p><p class="small muted">Bellek uygunluğu tahminidir (GGUF dosya boyutu + KV cache).</p></section>
  <section class="card"><h2>Bu bilgisayarla bulut karşılaştırması</h2><p>Bilgisayar zaten elinde olduğu için yerelde yalnızca elektrik ödersin: ayda ${nf(S.monthlyTokens, 1)} M çıktı için ≈ <b>${tl(el)}/ay</b> (${Calc.MODELS[S.model].short}).</p><a class="btn" href="#karsilastir" data-cmp-local="mine">Bulutla karşılaştır →</a></section>`;
}

VIEWS.al = () => `<header class="page-head"><p class="eyebrow">Bilgisayar alacağım</p><h1>Kullanımına göre hangi bilgisayar?</h1><p class="lead">Kullanımını, modeli ve bütçeni seç; sana üç öneri çıkaralım. İstersen parça parça kendin topla, her parçada mağaza seç.</p></header>
  ${usagePanel({ budget: true, title: 'Ne için kullanacaksın?' })}<div id="results"></div>`;
function resultsAl() {
  const all = Calc.computers(S.offerSel), M = S.model;
  const within = all.filter(c => c.price <= S.budget);
  const ok = within.filter(c => { const sp = Calc.speed(c, M); return sp.status === 'ok' && Calc.capacity(c, M, S) >= S.monthlyTokens; });
  let rec = '';
  if (!ok.length) {
    const above = all.filter(c => Calc.speed(c, M).status === 'ok' && Calc.capacity(c, M, S) >= S.monthlyTokens).sort((a, b) => a.price - b.price)[0];
    rec = `<div class="tip">Bütçendeki (${tl(S.budget)}) hiçbir bilgisayar bu kullanımı ${Calc.MODELS[M].short} ile rahat karşılamıyor.${above ? ` En ucuz uygun seçenek: <b>${esc(above.name)}</b> — ${tl(above.price)}.` : ''} Günlük çalışma saatini artırabilir, Qwen 125B’yi seçebilir veya <a href="#bulut">bulut seçeneklerine</a> bakabilirsin.</div>`;
  } else {
    const cheapest = [...ok].sort((a, b) => a.price - b.price)[0];
    const value = [...ok].sort((a, b) => Calc.speed(b, M).tps / b.price - Calc.speed(a, M).tps / a.price)[0];
    const fastest = [...ok].sort((a, b) => Calc.speed(b, M).tps - Calc.speed(a, M).tps)[0];
    const picks = [[cheapest, 'En ucuz çalışan', 'Kullanımını karşılayan en düşük fiyat.'], [value, 'Fiyat/performans', 'Lira başına en çok token/sn.'], [fastest, 'En hızlı', 'Bütçende en yüksek yazma hızı.']];
    const merged = [];
    for (const [c, t, r] of picks) { const m = merged.find(x => x.c.id === c.id); if (m) { m.t += ' · ' + t; m.r += ' ' + r; } else merged.push({ c, t, r }); }
    rec = `<h2 class="q">Sana önerilerimiz</h2><div class="pcgrid three">${merged.map(({ c, t, r }) => computerCard(c, { tag: t, reason: r, highlight: true })).join('')}</div>`;
  }
  const F = S.buyFilter, list = within.filter(c => F === 'all' || (F === 'pc' ? c.kind === 'pc' : F === 'mac' ? c.kind === 'mac' : c.ram >= 64)).sort((a, b) => a.price - b.price);
  return `${rec}
  <section class="block"><div class="block-head"><h2>Bütçendeki tüm hazır sistemler <span class="muted">(${list.length})</span></h2><div class="seg small" role="group">${[['all', 'Tümü'], ['pc', 'PC'], ['mac', 'Mac'], ['ram64', '64 GB+ RAM']].map(([k, l]) => `<button type="button" data-buyfilter="${k}" aria-pressed="${F === k}">${l}</button>`).join('')}</div></div>
  <div class="tablewrap"><table class="systable"><thead><tr><th>Sistem</th><th class="num">Fiyat</th><th class="num">${Calc.MODELS[M].short}</th><th class="num">Görev süresi</th><th class="num">Elektrik/ay</th><th>Durum</th><th></th></tr></thead><tbody>${list.map(c => { const sp = Calc.speed(c, M), short = Calc.capacity(c, M, S) < S.monthlyTokens; return `<tr><td><b>${esc(c.name)}</b><small>${specLine(c)}</small><details class="more"><summary>Parçalar</summary>${partsList(c)}</details></td><td class="num"><b>${tl(c.price)}</b></td><td class="num">${tps(sp.tps)}<small>${sp.measured ? 'ölçüm' : 'tahmin'}</small></td><td class="num">${dur(Calc.taskTime(c, M, S).total)}</td><td class="num">${tl(Calc.electricity(c, M, S).tl)}</td><td>${badge(sp.status)}${short ? '<small class="bad">kullanımına yetmez</small>' : ''}</td><td><button type="button" class="btn ghost small" data-compare="${c.id}">Karşılaştır</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Bu filtreyle sistem yok.</td></tr>'}</tbody></table></div></section>
  <details class="card more alt"><summary>Başka yollar: mini PC, ikinci el veri merkezi kartları, Mac</summary><ul class="checks">
   <li><b>128 GB birleşik bellekli mini PC’ler (Ryzen AI Max):</b> Qwen 125B’nin 4 bit sürümünü tek kutuda tutar. Windows ekran kartına en fazla ≈96 GB verir; Linux ve doğru motorla okuma hızı 10 kata kadar artabiliyor.</li>
   <li><b>İkinci el veri merkezi kartları:</b> Eski ama bant genişliği yüksek kartlar (ör. 4× V100) bazı testlerde yeni “AI kutularından” hızlı yazıyor; ama gürültü, güç tüketimi ve kurulum zahmetli, okuma hızları düşük.</li>
   <li><b>Donanım pahalanırken token ucuzladı:</b> Bir masaüstü AI kutusu bir yılda %74 pahalandı, aynı dönemde popüler bir açık modelin API fiyatı ≈%57 düştü. Amorti hesabını mutlaka yap.</li>
   <li><b>Mac:</b> Bellek bant genişliği çipe göre çok değişir (M6 ≈150, M5 Pro ≈300, M5 Max 614 GB/sn). “M5” adı tek başına hız söylemez.</li>
   <li><b>RAM’de DDR4 seçeneği:</b> GB başına yaklaşık yarı fiyat, yarı hız. Bu işte kapasite genelde hızdan önemli; aynı paraya 32 GB DDR5 yerine 64 GB DDR4 çoğu zaman daha iyi.</li></ul></details>
  <section class="block" id="builder"><h2>Kendin topla</h2><p class="muted">Parçaları ve mağazaları sen seç. Uyumsuz parçalar elenir; fiyat, hız ve güç kaynağı yeterliliği anında hesaplanır.</p><div id="builderBox">${builderHtml()}</div></section>`;
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
     <select data-slot="${slot}">${opts.map(([k, p]) => `<option value="${k}"${k === key ? ' selected' : ''}>${esc(p.label)} — ${tl(Calc.cheapestOffer(k).price)}</option>`).join('')}</select>
     ${slot === 'gpu' && P[b.mobo].multiGpu ? `<select data-gpucount aria-label="Kart sayısı"><option value="1"${b.gpuCount == 1 ? ' selected' : ''}>1 kart</option><option value="2"${b.gpuCount == 2 ? ' selected' : ''}>2 kart</option></select>` : ''}
     <select data-offer="${key}" aria-label="${label} mağazası">${offs.map((o, i) => `<option value="${esc(o.store)}"${o.store === ch.store ? ' selected' : ''}>${esc(o.store)} · ${tl(o.price)}${i === 0 ? ' (en ucuz)' : ''}${o.stock === 'tükendi' ? ' · tükendi' : o.stock === 'bilinmiyor' ? ' · stok?' : ''}</option>`).join('')}</select>
     <a href="${esc(ch.url)}" target="_blank" rel="noopener" class="small">Ürüne git ↗</a></div>`;
  }).join('');
  const psu = P[b.psu].watts, draw = c.watts + 40, warn = draw * 1.3 > psu;
  const sp = ['qwen', 'deepseek', 'dense14'].map(m => [m, Calc.speed(c, m)]);
  return `<div class="builder"><div class="brows">${rows}</div>
   <aside class="bsum"><span class="muted small">Toplam</span><b class="big">${tl(c.price)}</b>
    <ul class="small">${sp.map(([m, s]) => `<li>${Calc.MODELS[m].short}: <b>${tps(s.tps)}</b> ${badge(s.status)}<br><span class="muted">görev: ${dur(Calc.taskTime(c, m, S).total)}</span></li>`).join('')}</ul>
    <p class="small ${warn ? 'bad' : 'muted'}">${warn ? `⚠ Güç kaynağı yetersiz olabilir: tahmini çekiş ${nf(draw)} W, %30 pay ile ${nf(draw * 1.3)} W gerekir.` : `Güç: tahmini ${nf(draw)} W / ${psu} W PSU`}</p>
    <p class="small muted">${c.ram} GB ${c.ramType} · ${c.vram} GB VRAM${c.gpus > 1 ? ' (iki kart, tek havuz değil)' : ''}</p>
    <button type="button" class="btn" data-compare="custom">Bulutla karşılaştır →</button>
    <button type="button" class="btn ghost" data-copybuild>Parça listesini kopyala</button></aside></div>`;
}

VIEWS.bulut = () => `<header class="page-head"><p class="eyebrow">Satın almadan kullan</p><h1>Abonelik mi, API mi?</h1><p class="lead">Kullanımını seç; bütün abonelik ve API seçeneklerini aylık maliyete göre sıralayalım.</p></header>
  ${usagePanel({ model: false, privacy: false, horizon: false, title: 'Ne kadar kullanacaksın?' })}
  <section class="card"><div class="row-label">Hangi modeller?</div><div class="seg small" role="group">${[['all', 'Tümü'], ['open', 'Açık modeller'], ['closed', 'Kapalı modeller'], ['frontier', 'Üst düzey (Claude, GPT, Gemini)']].map(([k, l]) => `<button type="button" data-cloudclass="${k}" aria-pressed="${S.cloudClass === k}">${l}</button>`).join('')}</div></section>
  <div id="results"></div>`;
function resultsBulut() {
  const opts = Calc.cloudOptions(S).filter(o => Calc.inClass(o, S.cloudClass)).sort((a, b) => (b.fits - a.fits) || a.monthly - b.monthly);
  const max = Math.max(...opts.filter(o => o.fits).map(o => o.monthly), 1);
  const top = opts.filter(o => o.fits).slice(0, 3);
  const notes = `<div class="pcgrid two"><section class="card"><h2>Abonelikte dikkat</h2><ul class="checks">
   <li><b>Kotalar değişiyor.</b> Örneğin bir 200 $’lık planın kodlama kotası bir gecede yarıya indi; geçici “sıfırlamalar” planın parçası değildi.</li>
   <li><b>Varsayılan düşünme ayarı düşük olabilir.</b> Tanıtım tablosundaki skor genelde en yüksek ayarla ölçülür; varsayılan “orta” ayar daha az token harcar ama bazı işlerde birkaç puan düşer.</li>
   <li><b>Yeni sürüm = daha fazla token olabilir.</b> Aynı metin yeni bir tokenizer ile %0–35 daha fazla token tutabiliyor; fatura model değişmeden artabilir.</li>
   <li><b>Kodlama oturumlarında tokenlerin ≈%97’si önbellekten okunur;</b> asıl maliyeti önbellek fiyatı belirler. “Kodlama ajanı” profili bunu hesaba katar.</li></ul></section>
   <section class="card"><h2>API kullanıyorsan güvenlik</h2><ul class="checks">
   <li><b>Ön ödemeli kredi kullan, otomatik yüklemeyi kapat.</b> Çalınan bir anahtarın en fazla bakiyen kadar zararı olur; aynı saldırıda biri 16 $, biri 3.000 $ kaybetti.</li>
   <li><b>Aylık harcama limiti koy.</b> Bazı sağlayıcılarda faturalama birkaç dakika geriden gelir, limit biraz aşılabilir.</li>
   <li><b>Üçüncü taraf araçlara yapıştırdığın anahtarları yenile,</b> kullanmadıklarını sil. Bir araç sızıntısında eski anahtarlar saatler içinde boşaltıldı.</li></ul></section></div>`;
  return `<div class="pcgrid three">${top.map((o, i) => `<article class="pc hl"><span class="tag">${['En ucuz', '2.', '3.'][i]}</span><h3>${esc(o.name)}</h3><p class="small muted">${o.type === 'subscription' ? 'Abonelik · kullanım sınırlı' : o.open ? 'API · açık model' : 'API'}</p><b class="big">${tl(o.monthly)}<small>/ay</small></b><p class="small muted">${o.type === 'subscription' ? esc(o.limit) : `Girdi $${o.inputUsd} · çıktı $${o.outputUsd} / 1M`}</p><div class="actions"><a class="btn ghost" href="${esc(o.source)}" target="_blank" rel="noopener">Resmî fiyat ↗</a><button type="button" class="btn ghost" data-cmpcloud="${o.id}">Bilgisayarla karşılaştır →</button></div></article>`).join('')}</div>
  <section class="card"><h2>Tüm seçenekler <span class="muted">(${opts.length})</span></h2><div class="bars">${opts.map(o => `<div class="bar-row${o.fits ? '' : ' dim'}"><span class="bn">${esc(o.name)}<small>${o.type === 'subscription' ? 'Abonelik' : o.open ? 'API · açık' : 'API'}${o.fits ? '' : ' · kotası bu kullanıma yetmez (varsayım)'}</small></span><span class="bt"><i style="width:${Math.max(1, Math.log1p(o.monthly) / Math.log1p(max) * 100)}%"></i></span><b>${tl(o.monthly)}</b></div>`).join('')}</div>
  <p class="small muted">Çubuk uzunluğu logaritmik. Aboneliklerin aylık token kotası sağlayıcı garantisi değil, varsayımdır. API girdisi: çıktı payı %${S.outputSharePercent} → ayda ${nf(Calc.inputM(S), 1)} M girdi; önbellek %${S.cachedInputSharePercent}.</p></section>${notes}`;
}

VIEWS.karsilastir = () => `<header class="page-head"><p class="eyebrow">Almak mı, kiralamak mı?</p><h1>Bir bilgisayar kaç ayda kendini öder?</h1></header>
  ${usagePanel({ title: 'Kullanımın' })}<div id="results"></div>`;
function resultsKarsilastir() {
  const locals = allLocal(), mine = mineComputer();
  const local = S.cmpLocal === 'mine' ? mine : locals.find(c => c.id === S.cmpLocal) || locals[0];
  const owned = local.id === 'mine';
  const clouds = Calc.cloudOptions(S).filter(o => o.fits && (Calc.inClass(o, S.cloudClass) || o.id === S.cmpCloud)).sort((a, b) => a.monthly - b.monthly);
  const cloud = clouds.find(o => o.id === S.cmpCloud) || clouds[0];
  const M = S.model, H = S.horizon, sp = Calc.speed(local, M), cap = Calc.capacity(local, M, S);
  const lc = t => Calc.localCum(local, M, S, t, owned), cc = t => Calc.cloudCum(cloud, S, t);
  const be = Calc.breakEven(local, M, cloud, S, owned), diff = cc(H) - lc(H);
  let verdict;
  if (S.privacy) verdict = sp.status === 'no' || cap < S.monthlyTokens ? `<b>Gizlilik şartıyla</b> bu bilgisayar kullanımını karşılamıyor (en fazla ${nf(cap, 1)} M/ay). Daha güçlü bir sistem seç veya modeli Qwen 125B yap.` : `<b>Gizlilik şartıyla tek seçenek yerel.</b> ${esc(local.name)} ile ${H} ayda toplam ${tl(lc(H))}.`;
  else if (cap < S.monthlyTokens) verdict = `<b>${esc(local.name)}</b> bu kullanıma yetmiyor: günde ${S.hoursPerDay} saatte en fazla ${nf(cap, 1)} M/ay üretir. ${esc(cloud.name)} ayda ${tl(cloud.monthly)}.`;
  else if (diff >= 0) verdict = `Bu kullanımda <b>${owned ? 'elindeki bilgisayarı kullanmak' : 'bilgisayar almak'} daha ucuz.</b> ${H} ayda ${tl(diff)} tasarruf; ${be === 0 ? 'hemen' : nf(be, 1) + '. ayda'} kendini ${owned ? 'öder' : 'amorti eder'}.`;
  else verdict = `Bu kullanımda <b>${esc(cloud.name)} daha ucuz.</b> ${H} ayda ${tl(-diff)} daha az. ${Number.isFinite(be) ? `Bilgisayar ancak ${nf(be, 1)}. ayda amorti olur.` : 'Bilgisayar 10 yıl içinde amorti olmuyor.'}`;
  const localOpts = [['mine', 'Elindeki bilgisayar (fiyat 0 TL, sadece elektrik)'], ['custom', `Kendi topladığın · ${tl(locals[0].price)}`], ...locals.slice(1).sort((a, b) => a.price - b.price).map(c => [c.id, `${c.name} · ${tl(c.price)}`])];
  const rent = M === 'deepseek' ? (() => { const api = Calc.cat().apiModels.find(a => a.id === 'api-deepseek-flash-off'); const usd = api.outputUsd * S.usdTry; const ram = Calc.cheapestOffer('ram64').price; const mTok = ram / usd; const yrs = sp.tps ? mTok * 1e6 / (sp.tps * 3600 * 24 * 365) : Infinity; return `<div class="tip"><b>Videodaki hesap:</b> 64 GB RAM’in parasına (${tl(ram)}) DeepSeek API’den (pik dışı $${api.outputUsd}/1M) ≈${nf(mTok / 1000, 1)} milyar çıktı tokeni alınır. ${esc(local.name)} bunu ${tps(sp.tps)} ile ${Number.isFinite(yrs) ? nf(yrs, 1) + ' yılda' : 'hiç'} yazar. API ayrıca tam modeldir; yerelde 2 bit çalışır.</div>`; })() : '';
  return `<section class="card"><div class="row-label">Hangi bulut modelleriyle kıyaslansın?</div><div class="seg small" role="group">${[['all', 'En ucuz (açık modeller dahil)'], ['closed', 'Kapalı modeller'], ['frontier', 'Üst düzey (Claude, GPT, Gemini)']].map(([k, l]) => `<button type="button" data-cloudclass="${k}" aria-pressed="${S.cloudClass === k}">${l}</button>`).join('')}</div><p class="small muted">Yereldeki ${Calc.MODELS[M].short} ile bulut modellerinin kalitesi aynı değil; kendi ihtiyacına uygun sınıfı seç.</p></section>
  <section class="card cmp-pick"><label class="f"><span>Bilgisayar</span><select data-cmplocal>${localOpts.map(([k, l]) => `<option value="${k}"${k === local.id ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
   <label class="f"><span>Bulut seçeneği</span><select data-cmpcloudsel>${clouds.map(o => `<option value="${o.id}"${o.id === cloud.id ? ' selected' : ''}>${esc(o.name)} · ${tl(o.monthly)}/ay</option>`).join('')}</select></label></section>
  <section class="verdict"><p>${verdict}</p><div class="vstats"><div><span>${esc(local.name)}</span><b>${tl(lc(H))}</b><small>${owned ? 'sadece elektrik' : tl(local.price) + ' + elektrik'} · ${tps(sp.tps)} · görev ${dur(Calc.taskTime(local, M, S).total)}</small></div><div><span>${esc(cloud.name)}</span><b>${tl(cc(H))}</b><small>${tl(cloud.monthly)}/ay</small></div><div><span>Amorti</span><b>${be === 0 ? 'Hemen' : Number.isFinite(be) ? nf(be, 1) + ' ay' : '10 yıl+'}</b><small>${H}. ayda fark: ${tl(Math.abs(diff))}</small></div></div></section>
  ${rent}
  <section class="card"><h2>${H} ay boyunca toplam maliyet</h2><div id="chart"></div></section>`;
}
function drawCompareChart() {
  const box = $('#chart'); if (!box) return;
  const locals = allLocal(), local = S.cmpLocal === 'mine' ? mineComputer() : locals.find(c => c.id === S.cmpLocal) || locals[0], owned = local.id === 'mine';
  const clouds = Calc.cloudOptions(S).filter(o => o.fits && (Calc.inClass(o, S.cloudClass) || o.id === S.cmpCloud)).sort((a, b) => a.monthly - b.monthly), cloud = clouds.find(o => o.id === S.cmpCloud) || clouds[0];
  const frontier = clouds.find(o => Calc.inClass(o, 'frontier') && o.id !== cloud.id);
  const series = [{ name: local.name, color: 'var(--c1)', f: t => Calc.localCum(local, S.model, S, t, owned) }, { name: cloud.name, color: 'var(--c2)', f: t => Calc.cloudCum(cloud, S, t) }];
  if (frontier) series.push({ name: frontier.name + ' (üst düzey)', color: 'var(--c3)', dash: true, f: t => Calc.cloudCum(frontier, S, t) });
  box.innerHTML = lineChart(series, S.horizon);
  bindChart(box, series, S.horizon);
}
function lineChart(series, X) {
  const W = 900, H = 340, L = 74, R = 16, T = 16, B = 34, iw = W - L - R, ih = H - T - B;
  const pts = Array.from({ length: 121 }, (_, i) => X * i / 120);
  const max = Math.max(1, ...series.flatMap(s => pts.map(s.f))) * 1.08;
  const x = t => L + t / X * iw, y = v => T + ih - v / max * ih;
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = max * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 8}" y="${y(v) + 4}" class="ax" text-anchor="end">${nf(v / 1000)} bin</text>`; }
  for (let i = 0; i <= 6; i++) { const t = X * i / 6; g += `<text x="${x(t)}" y="${H - 10}" class="ax" text-anchor="middle">${nf(t)}. ay</text>`; }
  const paths = series.map(s => `<path d="${pts.map((t, i) => (i ? 'L' : 'M') + x(t).toFixed(1) + ',' + y(s.f(t)).toFixed(1)).join('')}" stroke="${s.color}" fill="none" stroke-width="2.6"${s.dash ? ' stroke-dasharray="7 5"' : ''}/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Toplam maliyet grafiği">${g}${paths}<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ih}" visibility="hidden"/></svg><div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div><div class="ctip" hidden></div>`;
}
function bindChart(box, series, X) {
  const svg = $('svg', box), tip = $('.ctip', box), xh = $('.xh', svg);
  svg.onpointermove = e => { const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * 900; if (sx < 74 || sx > 884) { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); return; }
    const t = (sx - 74) / 810 * X; xh.setAttribute('x1', sx); xh.setAttribute('x2', sx); xh.setAttribute('visibility', 'visible');
    tip.hidden = false; tip.innerHTML = `<b>${nf(t, 1)}. ay</b>` + series.map(s => `<div><i style="background:${s.color}"></i>${esc(s.name)}: <b>${tl(s.f(t))}</b></div>`).join('');
    tip.style.left = Math.min(r.width - 230, e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px'; };
  svg.onpointerleave = () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); };
}

VIEWS.fiyatlar = () => {
  const L = Calc.live(), P = Calc.cat().parts;
  const CATS = [['gpu', 'Ekran kartları'], ['cpu', 'İşlemciler'], ['mobo', 'Anakartlar'], ['ram', 'RAM'], ['ssd', 'SSD'], ['psu', 'Güç kaynakları'], ['case', 'Kasalar'], ['cooler', 'Soğutucular']];
  return `<header class="page-head"><p class="eyebrow">Fiyatlar</p><h1>Her parçanın mağaza fiyatları</h1><p class="lead">Varsayılan olarak stoktaki en ucuz teklif kullanılır. Başka bir mağazayı seçersen hazır sistemlerde ve topladığın bilgisayarda o fiyat kullanılır.</p>
  <p class="small muted">Otomatik (her gün): ${Object.keys(L.stores || {}).join(', ') || '—'}${L.meta ? ` · son değişiklik ${new Date(L.meta.updated).toLocaleString('tr-TR')}` : ''} · Elle: akakçe, Vatan, Hepsiburada, n11, Sinerji, İnceHesap… (tarihli) · Dolar kuru: ${nf(S.usdTry, 4)} TL${L.usdTry ? ` (TCMB ${esc(L.usdTry.date)})` : ''}</p>
  <button type="button" class="btn ghost" data-resetoffers>Mağaza seçimlerini sıfırla</button></header>
  ${CATS.map(([cat, label]) => `<section class="card"><h2>${label}</h2>${Object.entries(P).filter(([, p]) => p.cat === cat).map(([k, p]) => { const offs = Calc.offers(k), ch = Calc.chosenOffer(k, S.offerSel); return `<div class="offer-part"><h3>${esc(p.label)}</h3><table class="offers"><tbody>${offs.map((o, i) => `<tr class="${o.store === ch.store ? 'sel' : ''}"><td><label><input type="radio" name="o-${k}" data-pickoffer="${k}" value="${esc(o.store)}"${o.store === ch.store ? ' checked' : ''}> <b>${esc(o.store)}</b></label>${i === 0 ? ' <span class="badge ok">en ucuz</span>' : ''}</td><td class="num"><b>${tl(o.price)}</b></td><td><span class="badge ${o.stock === 'stokta' ? 'ok' : o.stock === 'tükendi' ? 'no' : 'slow'}">${esc(o.stock)}</span></td><td class="small muted">${esc(o.source)} · ${esc(o.date)}</td><td class="small"><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc((o.name || '').slice(0, 60))} ↗</a></td></tr>`).join('')}</tbody></table></div>`; }).join('')}</section>`).join('')}
  <section class="card"><h2>Mac fiyatları (Apple Türkiye)</h2><table class="offers"><tbody>${Calc.computers({}).filter(c => c.kind === 'mac').map(c => `<tr><td>${esc(c.appleName)}</td><td class="num"><b>${tl(c.price)}</b></td><td><a href="${esc(c.url)}" target="_blank" rel="noopener">Apple ↗</a></td></tr>`).join('')}</tbody></table></section>
  <section class="card"><h2>Fiyatları güncellemek</h2><p>Gamegaraj, Gaming.gen.tr, Apple, OpenRouter ve TCMB her gün GitHub Actions ile otomatik okunur. Otomatik erişimi engelleyen mağazalar için aşağıdaki promptu web araması açık bir yapay zekâya ver; çıkan JSON’u <code>data/manual-offers.json</code> dosyasına ekle.</p><button type="button" class="btn ghost" data-copyprompt>Promptu kopyala</button></section>`;
};

VIEWS.nasil = () => `<header class="page-head"><p class="eyebrow">Nasıl hesaplıyoruz?</p><h1>Yöntem, varsayımlar ve kaynaklar</h1></header>
  <section class="card prose"><h2>Strata nasıl çalışıyor?</h2><p>Mixture-of-Experts modellerde her kelime için uzmanların küçük bir kısmı kullanılır. Strata sık kullanılan kısmı ekran kartına, sonrakini RAM’e, nadir olanı SSD’ye koyar. Bu yüzden VRAM değil <b>RAM kapasitesi</b> belirleyici olur: Qwen3.8-Flash-Next 125B için RAM ≥ uzmanlar + ≈10 GB (IQ2_XS ≈46 GB). DeepSeek V4.1 Flash 763B en az 12 GB kart, 46 GB RAM (64 GB rahat) ve ≈265 GB disk ister.</p>
   <h2>Görev süresi</h2><p>Bir görevin süresi = bağlamı okuma (prefill) + cevabı yazma (decode). Kısa cevap ≈1K yazar, 2K okur; düşünerek cevap ≈15K yazar; kodlama ajanı görevi ≈50K yazar ve 32K bağlamla başlar. Okuma hızları ölçümlerden (ör. RTX 5070 ≈2.090, RTX 5090 ≈5.000, RX 9070 XT ≈1.110, M5 Max 128 GB ≈1.300 tok/sn) ya da tahminden gelir.</p>
   <h2>Quant ve kalite</h2><p>Bit sayısı düştükçe model asıl modelden sapar: büyük bir modelde 2 bit ≈%91, 3 bit ≈%95, 4 bit ≈%98,5 oranında aynı kelimeyi seçiyor (2 bitte yaklaşık her 11 kelimede bir farklı seçim). Aynı bit sayısında quant’ı kimin hazırladığı da sonucu belirgin biçimde değiştirir.</p>
   <h2>Motorlar</h2><p>Strata (Qwen 125B ve DeepSeek için), llama.cpp ve türevleri (Avalon, uzman önbelleği), vLLM ve Mac motorları aynı donanımda çok farklı sonuç verir. Bir motorun bir sürümden diğerine 3 kat hızlandığı görüldü; bu yüzden hızlar zamanla değişir.</p>
   <h2>NVIDIA GeForce notu</h2><p>GeForce kartlar 16 bit hesaplamayı 32 bit toplamayla yarım hızda yapar. Bu, llama.cpp’nin yazma hızını etkilemez (8 bit tamsayı), ama uzun bağlamın okunmasını, vLLM’i ve görüntü üretimini yavaşlatır.</p>
   <h2>Hızlar</h2><p>Tüm hızlar <b>yazma (decode)</b> hızıdır. Okuma (prefill) 10–20 kat daha hızlıdır; “100+ tok/sn” paylaşımlarının hangisi olduğuna dikkat. Ölçümü olan sistemler “ölçüm”, diğerleri “tahmin” olarak işaretlidir.</p>
   <h2>Maliyet</h2><p>Bilgisayar: satın alma + ek elektrik (ev faturasına eklenen tüketimin kademeli tarifedeki farkı). Abonelik: aylık ücret (USD’de kur ile). API: çıktı + çıktı payından hesaplanan girdi tokenleri, önbellek oranıyla. Aboneliklerin token kotaları varsayımdır.</p></section>
  <section class="card"><h2>Gelişmiş varsayımlar</h2><div class="fields four">
   <label class="f"><span>Dolar kuru (USD/TRY)</span><input type="number" step="0.0001" data-k="usdTry" value="${S.usdTry}"></label>
   <label class="f"><span>Yıllık kur artışı (%)</span><input type="number" data-k="usdYearly" value="${S.usdYearly}"></label>
   <label class="f"><span>Yıllık TL fiyat artışı (%)</span><input type="number" data-k="tlYearly" value="${S.tlYearly}"></label>
   <label class="f"><span>USD ek vergi (%)</span><input type="number" data-k="foreignTax" value="${S.foreignTax}"></label>
   <label class="f"><span>Günlük üretim saati</span><input type="number" step="0.5" data-k="hoursPerDay" value="${S.hoursPerDay}"></label>
   <label class="f"><span>Yıllık değer kaybı (%)</span><input type="number" data-k="depreciation" value="${S.depreciation}"></label>
  </div><label class="check"><input type="checkbox" data-k="resale" ${S.resale ? 'checked' : ''}> <span>Süre sonunda bilgisayarı ikinci elde satmayı hesaba kat (satışta ilk %15 kayıp)</span></label>
  <p class="small muted">Elektrik: alt kademe ${Calc.cat().tariff.lowRate} TL/kWh (ayda ${Calc.cat().tariff.lowKwhPerDay * 30} kWh’ye kadar), üst kademe ${Calc.cat().tariff.highRate} TL/kWh, vergi ve %${Calc.cat().tariff.vatPct} KDV; evin tüketimi ${Calc.cat().tariff.homeKwh} kWh/ay.</p>
  <button type="button" class="btn ghost" data-resetall>Tüm ayarları sıfırla</button></section>
  <section class="card"><h2>Kaynaklar</h2><ul class="links">
   <li><a href="https://github.com/Niko1221/Strata" target="_blank" rel="noopener">Strata (GitHub)</a> · <a href="https://github.com/Niko1221/Strata/blob/main/docs/MODELS.md" target="_blank" rel="noopener">Bellek ve hız tabloları</a> · <a href="https://github.com/Niko1221/Strata/blob/main/docs/DEEPSEEK41.md" target="_blank" rel="noopener">DeepSeek ölçümleri</a> · <a href="https://github.com/Niko1221/Strata/blob/main/docs/COMMUNITY_BENCHMARKS.md" target="_blank" rel="noopener">Topluluk ölçümleri</a></li>
   <li>Yerel AI topluluğu ölçümleri ve teknik incelemeler (Ekim–Kasım 2026)</li>
   <li>Fiyatlar: Gamegaraj, Gaming.gen.tr, Apple Türkiye, OpenRouter, TCMB (otomatik); akakçe, Vatan, Hepsiburada, n11, Sinerji, İnceHesap, sahibinden (elle, tarihli)</li>
   <li>Abonelik ve API fiyatları: sağlayıcıların resmî fiyat sayfaları (<a href="#bulut">Bulut</a> sayfasında her seçenekte bağlantı)</li></ul></section>`;

const PROMPT = `Türkiye'de bugün satılan bilgisayar parçalarının güncel fiyatlarını web'de araştır. Her ürün için EN AZ 3 farklı mağazaya bak (akakçe, Vatan, İtopya, İnceHesap, Hepsiburada, Trendyol, Amazon TR, Sinerji, n11, Teknosa, MediaMarkt). Fiyatı sayfada gerçekten gördüysen yaz; tahmin etme.

Parçalar (id: açıklama): gpu9060: RX 9060 XT 16 GB · gpu5060ti: RTX 5060 Ti 16 GB · gpu5070: RTX 5070 12 GB · gpu9070xt: RX 9070 XT 16 GB · gpu5070ti: RTX 5070 Ti 16 GB · gpu5080: RTX 5080 16 GB · gpu5090: RTX 5090 32 GB (hava soğutmalı) · gpuR9700: Radeon AI PRO R9700 32 GB · gpu3060used: RTX 3060 12 GB ikinci el (sahibinden/letgo ortanca) · gpu3090used: RTX 3090 24 GB ikinci el · cpu7500f: Ryzen 5 7500F · cpu9700x: Ryzen 7 9700X · cpu5500: Ryzen 5 5500 · moboB650: AM5 B650M anakart · moboA520: AM4 A520 anakart · moboX870E: x8/x8 destekli X870E · ram32: 32 GB (2x16) DDR5 · ram64: 64 GB (2x32) DDR5 · ram64ddr4: 64 GB (2x32) DDR4 · ram128: 128 GB DDR5 · ssd1: 1 TB NVMe · ssd2: 2 TB NVMe · psu750: 750 W Bronze · psu850: 850 W Gold · psu1200: 1200 W Gold · psu1300: 1300 W Platinum · caseMid: ATX mid tower kasa (PSU'suz) · cooler: AM5/AM4 kule tipi soğutucu

Çıktıyı SADECE şu JSON formatında ver: {"updated":"GG.AA.YYYY","offers":{"gpu5080":[{"store":"Mağaza","name":"ürün adı","price":88803,"url":"ürün sayfası","stock":"stokta|tükendi|bilinmiyor","date":"GG.AA.YYYY","source":"elle"}]}}`;

/* ---------- render & events ---------- */
const RESULTS = { elimde: resultsElimde, al: resultsAl, bulut: resultsBulut, karsilastir: resultsKarsilastir };
function route() { return (location.hash.replace(/^#\/?/, '').split('?')[0]) || ''; }
function render() {
  const v = VIEWS[route()] ? route() : '';
  $('#app').innerHTML = VIEWS[v]();
  $$('.nav a').forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + v)));
  updateResults();
  document.title = (v ? $('.nav a[href="#' + v + '"]')?.textContent + ' · ' : '') + 'Yerel AI maliyet';
}
function updateResults() {
  const v = route(), box = $('#results');
  if (box && RESULTS[v]) box.innerHTML = RESULTS[v]();
  if (v === 'karsilastir') drawCompareChart();
}
function rerenderControls() { const y = scrollY; render(); scrollTo(0, y); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }

document.addEventListener('input', e => {
  const k = e.target.dataset.k;
  if (k && e.target.type !== 'checkbox') { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) { set(k, v); if (k === 'monthlyTokens' || k === 'outputSharePercent') set('preset', null); updateResults(); } }
});
document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (d.k && t.type === 'checkbox') { set(d.k, t.checked); updateResults(); }
  else if (d.mine) { const m = { ...S.mine }; if (d.mine === 'gpu') { const g = MINE_GPUS.find(x => x[0] === t.value); m.gpu = t.value; m.vram = g[2]; m.watts = g[3]; m.pp = g[4]; m.vendor = g[5]; } else m[d.mine] = d.mine === 'ramType' ? t.value : Number(t.value); set('mine', m); rerenderControls(); }
  else if (d.slot) { S.build[d.slot] = t.value; save(); $('#builderBox').innerHTML = builderHtml(); }
  else if ('gpucount' in d) { S.build.gpuCount = Number(t.value); save(); $('#builderBox').innerHTML = builderHtml(); }
  else if (d.offer) { S.offerSel[d.offer] = t.value; save(); updateResults(); }
  else if (d.pickoffer) { S.offerSel[d.pickoffer] = t.value; save(); rerenderControls(); }
  else if ('cmplocal' in d) { set('cmpLocal', t.value); updateResults(); }
  else if ('cmpcloudsel' in d) { set('cmpCloud', t.value); updateResults(); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('button, a'); if (!b) return; const d = b.dataset;
  if (d.preset) { const p = Calc.cat().usagePresets.find(x => x.id === d.preset); Object.assign(S, { preset: p.id, taskType: p.task || S.taskType, monthlyTokens: Math.round(p.calls * p.tokens * p.days / 1e4) / 100, outputSharePercent: p.outputPct, cachedInputSharePercent: p.cachePct ?? S.cachedInputSharePercent }); save(); rerenderControls(); }
  else if (d.model) { set('model', d.model); rerenderControls(); }
  else if (d.task) { set('taskType', d.task); rerenderControls(); }
  else if (d.buyfilter) { set('buyFilter', d.buyfilter); updateResults(); }
  else if (d.cloudclass) { set('cloudClass', d.cloudclass); set('cmpCloud', ''); rerenderControls(); }
  else if (d.compare) { set('cmpLocal', d.compare); location.hash = '#karsilastir'; }
  else if (d.cmpLocal) { set('cmpLocal', d.cmpLocal); }
  else if (d.cmpcloud) { set('cmpCloud', d.cmpcloud); location.hash = '#karsilastir'; }
  else if ('resetoffers' in d) { set('offerSel', {}); rerenderControls(); toast('Mağaza seçimleri sıfırlandı'); }
  else if ('resetall' in d) { S = DEFAULT_STATE(); save(); rerenderControls(); toast('Ayarlar sıfırlandı'); }
  else if ('copyprompt' in d) { navigator.clipboard?.writeText(PROMPT).then(() => toast('Prompt kopyalandı')); }
  else if ('copybuild' in d) { const c = customComputer(); const txt = c.items.map(i => `${i.part.label}: ${i.offer.name} — ${i.offer.price} TL (${i.offer.store}) ${i.offer.url}`).join('\n') + `\nToplam: ${c.price} TL`; navigator.clipboard?.writeText(txt).then(() => toast('Parça listesi kopyalandı')); }
  else if (b.id === 'share') { navigator.clipboard?.writeText(shareUrl()).then(() => toast('Bağlantı kopyalandı'), () => prompt('Bağlantı:', shareUrl())); }
  else if (b.id === 'theme') { const dark = document.documentElement.dataset.theme !== 'dark' && !(document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; try { localStorage.setItem('yerel-ai-theme', dark ? 'dark' : 'light'); } catch (e) {} }
});
window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

/* ---------- boot ---------- */
(async function boot() {
  try { const th = localStorage.getItem('yerel-ai-theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
  const get = u => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  const [catalog, live, manual] = await Promise.all([get('data/catalog.json'), get('data/prices.json'), get('data/manual-offers.json')]);
  if (!catalog) { $('#app').innerHTML = '<section class="card"><h2>Veri yüklenemedi</h2><p>Sayfayı bir web sunucusu üzerinden açın (ör. GitHub Pages veya <code>python3 -m http.server</code>).</p></section>'; return; }
  Calc.init(catalog, live, manual);
  loadState();
  render();
})();
