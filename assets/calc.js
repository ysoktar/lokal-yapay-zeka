'use strict';
/* Pure calculations and data merging. No DOM access here.
   Prices: catalog seed offers + data/prices.json (automatic, weekly) + data/manual-offers.json (manual). */
const Calc = (() => {
  let CAT = null, LIVE = { stores: {}, apple: {}, openrouter: {} }, MANUAL = { offers: {} };

  // Open models besides the Strata ones: family, total and active parameters (billions), matching API offers.
  // File sizes come from data/catalog.json (ggufModels, Q4_K_M).
  const GEN = {
    'llama31-8b': ['Llama', 8, 8, ['api-open-llama-3.1-8b-instruct']], 'llama33-70b': ['Llama', 70, 70, ['api-open-llama-3.3-70b-instruct']],
    'gemma3-12b': ['Gemma', 12, 12, ['api-open-gemma-3-12b-it']], 'gemma3-27b': ['Gemma', 27, 27, ['api-open-gemma-3-27b-it']],
    'gptoss-20b': ['gpt-oss', 21, 3.6, ['api-open-gpt-oss-20b', 'api-groq-20']], 'gptoss-120b': ['gpt-oss', 117, 5.1, ['api-open-gpt-oss-120b', 'api-groq-120']],
    'nemo-12b': ['Mistral', 12, 12, ['api-open-mistral-nemo']], 'mistralsmall32-24b': ['Mistral', 24, 24, ['api-open-mistral-small-3.2-24b-instruct']], 'devstral-24b': ['Mistral', 24, 24, []],
    'phi4-14b': ['Phi', 14, 14, ['api-open-phi-4']], 'glm4-32b': ['GLM', 32, 32, []],
    'r1qwen-14b': ['DeepSeek', 14, 14, []], 'r1qwen-32b': ['DeepSeek', 32, 32, []],
    'qwen3-14b': ['Qwen', 14, 14, []], 'qwen3-32b': ['Qwen', 32, 32, ['api-open-qwen3-32b']], 'qwen3-30a3': ['Qwen', 30, 3.3, ['api-open-qwen3-30b-a3b-instruct-2507']], 'qwen3coder-30a3': ['Qwen', 30, 3.3, ['api-open-qwen3-coder-30b-a3b-instruct']]
  };
  function init(catalog, live, manual) {
    CAT = catalog; if (live) LIVE = { stores: {}, apple: {}, openrouter: {}, ...live }; if (manual) MANUAL = manual;
    for (const g of CAT.ggufModels || []) {
      const x = GEN[g.id], file = g.quants && g.quants.Q4_K_M; if (!x || !Number.isFinite(file)) continue;
      const name = g.name.replace(/ \((metin|MoE)\)/g, '');
      MODELS['g:' + g.id] = { label: name, short: name, family: x[0], total: x[1], active: x[2], moe: x[2] < x[1], file, disk: Math.ceil(file + 5), api: x[3], mx: /gpt-oss/.test(g.name) };
    }
    // live API prices for open models (matched by OpenRouter id in the source URL)
    for (const m of CAT.apiModels) {
      const id = (m.source.match(/openrouter\.ai\/(.+)$/) || [])[1];
      const lp = id && LIVE.openrouter[id];
      if (lp) Object.assign(m, lp, { live: true });
    }
  }
  // Prices fetched by the visitor's own browser (OpenRouter allows cross-origin requests).
  function applyBrowserOpenRouter(models) {
    const map = {}; for (const m of models || []) map[m.id] = m.pricing; let n = 0;
    for (const m of CAT.apiModels) {
      const id = (m.source.match(/openrouter\.ai\/(.+)$/) || [])[1], p = id && map[id];
      if (!p) continue;
      const f = x => Number((Number(x) * 1e6).toPrecision(4));
      const inp = f(p.prompt || 0), out = f(p.completion || 0);
      if (!(out > 0) || inp < 0) continue;
      Object.assign(m, { inputUsd: inp, outputUsd: out, live: 'tarayıcı' });
      if (p.input_cache_read && Number(p.input_cache_read) > 0) m.cachedUsd = f(p.input_cache_read);
      n++;
    }
    return n;
  }
  const cat = () => CAT;
  const live = () => LIVE;

  /* ---------- offers ---------- */
  function offers(key) {
    const list = [];
    for (const [store, map] of Object.entries(LIVE.stores || {})) if (map[key]) list.push({ ...map[key], store });
    for (const o of (MANUAL.offers || {})[key] || []) list.push(o);
    // one offer per store: the cheapest one that is not out of stock
    const byStore = {};
    for (const o of list) {
      const prev = byStore[o.store];
      const better = !prev || (prev.stock === 'tükendi' && o.stock !== 'tükendi') || (o.stock !== 'tükendi' === (prev.stock !== 'tükendi') && o.price < prev.price);
      if (better) byStore[o.store] = o;
    }
    let out = Object.values(byStore);
    if (!out.length && CAT.parts[key]) out = [CAT.parts[key].seed];
    return out.sort((a, b) => (a.stock === 'tükendi') - (b.stock === 'tükendi') || a.price - b.price);
  }
  function chosenOffer(key, sel) {
    const list = offers(key);
    return (sel && sel[key] && list.find(o => o.store === sel[key])) || list.find(o => o.stock !== 'tükendi') || list[0];
  }
  const cheapestOffer = key => chosenOffer(key, null);

  /* ---------- computers ---------- */
  function pcFromKeys(id, name, keys, gpuCount, sel, extra = {}) {
    const items = keys.map(k => ({ key: k, part: CAT.parts[k], offer: chosenOffer(k, sel) }));
    const gpuItem = items.find(i => i.part.cat === 'gpu');
    const ramItem = items.find(i => i.part.cat === 'ram');
    const cpuItem = items.find(i => i.part.cat === 'cpu');
    const priceItems = items.flatMap(i => i.part.cat === 'gpu' ? Array(gpuCount).fill(i) : [i]);
    const price = priceItems.reduce((a, i) => a + i.offer.price, 0);
    const vram = gpuItem.part.vram * gpuCount, ram = ramItem.part.size, ramType = ramItem.part.ramType;
    return {
      id, name, kind: 'pc', price, items, gpus: gpuCount, vram, ram, ramType,
      gpuVram: gpuItem.part.vram,
      watts: gpuItem.part.watts * gpuCount + (cpuItem ? cpuItem.part.watts : 65) + 60,
      tps14: gpuItem.part.tps14, used: !!gpuItem.part.used, pp: gpuItem.part.pp, vendor: gpuItem.part.vendor, bw: gpuItem.part.bw,
      estimatedPrice: items.some(i => i.offer.stock === 'bilinmiyor' && /2\. el|tahmin/.test(i.offer.name + i.offer.store)),
      ssd: (items.find(i => i.part.cat === 'ssd') || { part: { size: 1000 } }).part.size,
      ...extra
    };
  }
  function computers(sel) {
    return CAT.builds.map(b => {
      if (b.kind === 'mac') {
        const lp = LIVE.apple[b.id];
        const ssd = /256 GB/.test(b.apple.name) ? 256 : /512 GB/.test(b.apple.name) ? 512 : 1000;
        return { id: b.id, name: b.name, kind: 'mac', price: lp ? lp.price : b.apple.price, url: lp ? lp.url : b.apple.url,
          appleName: b.apple.name, vram: 0, ram: b.ram, ramType: 'unified', gpus: 1, watts: b.watts, tps14: b.tps, bw: b.bw,
          strata: b.strata, ssd, items: [] };
      }
      const keys = [b.gpu, ...CAT.platforms[b.platform]];
      return pcFromKeys(b.id, b.name, keys, b.gpus || 1, sel, { strata: b.strata, platform: b.platform });
    });
  }

  /* ---------- Strata / speed estimates (Strata docs + community benchmarks, Nov 2026) ---------- */
  const MODELS = {
    q27: { label: 'Qwen3.8 27B (yoğun model)', short: 'Qwen 27B', disk: 20, family: 'Qwen', total: 27, active: 27, file: 16.5, api: ['api-open-qwen3-32b', 'api-open-gemma-3-27b-it', 'api-open-mistral-small-3.2-24b-instruct', 'api-open-qwen3-30b-a3b-instruct-2507'] },
    qwen: { label: 'Qwen3.8-Flash-Next 125B', short: 'Qwen 125B', disk: 80, family: 'Qwen', total: 125, active: 6, file: 39, moe: true, strata: true, api: ['api-open-qwen3-235b-a22b-2507', 'api-open-gpt-oss-120b', 'api-open-glm-4.5-air', 'api-groq-120'] },
    deepseek: { label: 'DeepSeek V4.1 Flash 763B', short: 'DeepSeek 763B', disk: 265, family: 'DeepSeek', total: 763, moe: true, strata: true, api: ['api-deepseek-flash-off', 'api-deepseek-flash-peak', 'api-open-deepseek-v3.2'] },
    dense14: { label: 'Klasik 14B model', short: '14B', disk: 10 },
    coder: { label: 'Qwen3.8 Coder', short: 'Coder', disk: 70, family: 'Qwen', moe: true, strata: true },
    q36: { label: 'Qwen3.6-35B-A3B', short: 'Qwen 35B', disk: 25, family: 'Qwen', total: 35, active: 3, moe: true, strata: true }
  };
  function estimate(id, hw) {
    const v = +hw.vram || 0, r = +hw.ram || 0, uni = hw.ramType === 'unified', d4 = hw.ramType === 'DDR4' ? 0.8 : 1, ssd = +hw.ssd || 0;
    const res = (tps, status, note, q) => ({ tps: Math.round(tps * 10) / 10, status, note, q });
    const disk = MODELS[id].disk;
    if (ssd && ssd < disk) return res(0, 'no', `En az ${disk} GB boş disk gerekir`);
    if (id === 'qwen') {
      if (uni) return r >= 128 ? res(87, 'ok', 'Mac M5 Max 128 GB ölçümü: 87 tok/sn') : r >= 64 ? res(60, 'ok', 'Model bellekte kalır (çipe göre 43–87)') : r >= 46 ? res(35, 'slow', 'Sınırda sığar (46 GB gerekir)') : r >= 32 ? res(13, 'slow', 'Uzmanlar SSD’den okunur (M4 32 GB ölçümü ≈13)') : res(5, 'no', 'Bellek çok az');
      if (v < 8) return res(0, 'no', 'En az 8 GB ekran kartı gerekir (12 GB önerilir)');
      if (r >= 46 || (v >= 24 && r >= 32)) { const b = v >= 32 ? 130 : v >= 24 ? 110 : v >= 16 ? 70 : v >= 12 ? 79 : 30; return res(b * d4, 'ok', v >= 12 && v < 16 ? 'RTX 5070 + 64 GB ölçümü: IQ2_XS 79, Q2_0 94 tok/sn' : r < 46 ? 'Büyük kart + az RAM: düşük RAM modu' : 'Tüm boyutlar sığar'); }
      return r >= 32 ? res(20, 'slow', '32 GB: uzmanların bir kısmı SSD’den okunur; Coder modeli daha uygun') : res(8, 'slow', '16 GB: düşük RAM modu, SSD’den (RTX 3060 ölçümü ≈8)');
    }
    if (id === 'coder') { if (uni) return r >= 48 ? res(45, 'ok', 'Bellekte kalır') : res(10, 'slow', 'SSD’den okunur'); if (v < 8) return res(0, 'no', 'En az 8 GB ekran kartı'); return r >= 32 ? res((v >= 16 ? 60 : v >= 12 ? 55 : 35) * d4, 'ok', '≈30 GB RAM yeter; RTX 5070 ölçümü 55 tok/sn') : res(10, 'slow', 'RAM az; SSD’den okunur'); }
    if (id === 'q36') { if (uni) return res(0, 'no', 'Strata’nın Mac motoru bu modeli çalıştırmıyor'); if (v < 8) return res(0, 'no', 'En az 8 GB ekran kartı'); return r >= 32 ? res((v >= 32 ? 118 : v >= 24 ? 100 : v >= 16 ? 75 : v >= 12 ? 60 : 40) * d4, 'ok', v >= 32 ? 'R9700 ölçümü: 117,8 tok/sn' : 'RTX 3060 ölçümü: 59,7 tok/sn') : res(15, 'slow', '32 GB RAM önerilir'); }
    if (id === 'deepseek') {
      if (uni) return r >= 128 ? res(16, 'ok', 'Mac M5 Max 128 GB ölçümü: 15–18 tok/sn') : r >= 64 ? res(6, 'slow', '64 GB Mac: büyük kısmı SSD’den') : res(0, 'no', 'En az 64 GB birleşik bellek');
      if (v < 12) return res(0, 'no', 'En az 12 GB ekran kartı gerekir');
      if (r < 46) return res(2, 'no', '46 GB altı RAM test edilmedi; çok yavaş');
      const t = r >= 128 ? (v >= 48 ? 40 : v >= 24 ? 30 : v >= 16 ? 28.8 : 15) : (v >= 32 ? 12 : v >= 24 ? 10 : v >= 16 ? 7 : 5);
      return res(t * (hw.ramType === 'DDR4' ? 0.85 : 1), t >= 15 ? 'ok' : 'slow', r >= 128 ? (v >= 48 ? 'RTX 4090 48 GB + 128 GB ölçümü: 40 tok/sn' : v >= 16 ? 'RTX 5070 Ti + 128 GB ölçümü: 28,8 tok/sn' : '128 GB RAM ile çok daha hızlı') : '12 GB kart + 64 GB: ölçümler 4,7 (RTX 5070) – 10 (RTX 3060); CPU ve SSD belirleyici');
    }
    if (id === 'q27') {
      const bw = +hw.bw || (uni ? (r >= 192 ? 1200 : r >= 96 ? 614 : r >= 48 ? 307 : 170) : v >= 24 ? 900 : v >= 16 ? 450 : v >= 12 ? 360 : 300);
      if (uni) return r * 0.75 >= 19 ? res(bw / 17 * 0.8, bw / 17 * 0.8 >= 15 ? 'ok' : 'slow', `4 bit (≈17 GB); hız bant genişliğine bağlı (≈${bw} GB/sn)`, '4 bit') : res(0, 'no', 'Bellek yetmez (4 bit ≈17 GB)', '—');
      if (v >= 20) return res(bw / 16.5 * 0.8, 'ok', '4 bit (≈16,5 GB) tamamı kartta; çoklu token tahmini (MTP) açıkken ≈1,5–2 kat hızlı', '4 bit');
      if (v >= 16) return res(bw / 11.8 * 0.75, 'ok', '3,5 bit (≈11,8 GB); Q4 dosyası 16 GB karta sığmaz. MTP açıkken ≈1,5–2 kat hızlı', '3,5 bit');
      if (v >= 12) return res(bw / 8.4 * 0.7, 'ok', '2–3 bit (≈8–10 GB); kalite quant yapımcısına göre değişir', '2–3 bit');
      return v >= 6 ? res(4, 'slow', 'Kart küçük; model RAM’e taşar (8 GB kartta ölçüm ≈4 tok/sn). Qwen3.6-35B-A3B daha uygun', 'RAM’e taşar') : res(0, 'no', 'Ekran kartı gerekir');
    }
    if (id === 'dense14') { const need = 11; if (uni) return r - 5 >= need ? res(r >= 36 ? 40 : 25, 'ok', 'Birleşik bellekte') : res(0, 'no', 'Bellek yetmez'); return v >= need ? res(40, 'ok', 'Tamamı ekran kartında') : v >= 8 ? res(12, 'slow', 'RAM’e taşar, yavaş') : res(0, 'no', 'Ekran kartı belleği yetmez'); }
  }
  // Generic estimate for any open model (llama.cpp, Q4): each token reads the active weights once.
  // The part that does not fit on the card is read from system RAM (DDR5 ≈70, DDR4 ≈34 GB/s); no expert caching assumed.
  function genEstimate(id, hw) {
    const m = MODELS[id], v = +hw.vram || 0, r = +hw.ram || 0, uni = hw.ramType === 'unified', ssd = +hw.ssd || 0, q = m.mx ? 'MXFP4' : 'Q4';
    const res = (tps, status, note) => ({ tps: Math.round(tps * 10) / 10, status, note, q });
    if (ssd && ssd < m.disk) return res(0, 'no', `En az ${m.disk} GB boş disk gerekir`);
    const gbTok = m.file * m.active / m.total, k = (fits) => m.moe && fits ? 0.35 : 0.75, st = t => t >= 15 ? 'ok' : t >= 3 ? 'slow' : 'no';
    if (uni) {
      const bw = +hw.bw || (r >= 192 ? 1200 : r >= 96 ? 614 : r >= 48 ? 307 : 170);
      if (m.file > r * 0.75) return res(0, 'no', `Belleğe sığmaz (Q4 ≈${Math.round(m.file)} GB, ekran kartına ≈${Math.round(r * 0.75)} GB ayrılır)`);
      const t = bw / gbTok * k(true); return res(t, st(t), `${q} (≈${Math.round(m.file)} GB) bellekte; hız bant genişliğine bağlı (≈${bw} GB/sn)`);
    }
    const sysBw = hw.ramType === 'DDR4' ? 34 : 70, uv = Math.max(0, v - 1.5), ur = Math.max(0, r - 8);
    if (m.file > uv + ur) return res(0, 'no', `Bellek yetmez: Q4 ≈${Math.round(m.file)} GB, kart + RAM’de ≈${Math.round(uv + ur)} GB boş`);
    if (!v) { const t = sysBw / gbTok * 0.75; return res(t, st(t), 'Ekran kartı yok; tamamen sistem RAM’inden (CPU)'); }
    const bw = +hw.bw || (v >= 24 ? 900 : v >= 16 ? 450 : v >= 12 ? 360 : 300), f = Math.min(1, uv / m.file);
    const t = 1 / (gbTok * f / bw + gbTok * (1 - f) / sysBw) * k(f >= 1);
    return res(t, st(t), f >= 1 ? `${q} (≈${Math.round(m.file)} GB) tamamı kartta` : `${q} ≈${Math.round(m.file)} GB; %${Math.round(f * 100)}’i kartta, kalanı ${hw.ramType || 'DDR5'} RAM’den okunur${m.moe ? ' (MoE: uzmanlar RAM’de)' : ''}`);
  }
  // speed of a computer for the chosen model; prebuilt systems carry measured values where they exist
  function speed(c, model) {
    if (String(model).startsWith('g:')) return { ...genEstimate(model, { vram: c.vram, ram: c.ram, ramType: c.ramType, ssd: c.ssd, bw: c.bw }), measured: false };
    const hw = { vram: c.vram, ram: c.ram, ramType: c.ramType, ssd: c.ssd };
    if (model === 'q27') { const e = estimate('q27', { ...hw, bw: c.bw, vram: c.gpuVram || c.vram }); return { ...e, measured: false }; }
    if (model === 'dense14') { const e = c.tps14 ? { tps: c.tps14, status: 'ok', note: c.kind === 'mac' ? 'Birleşik bellekte' : 'Tamamı ekran kartında' } : estimate('dense14', hw); return { ...e, measured: false }; }
    if (model === 'qwen' && c.strata) return { tps: c.strata.tps, status: c.strata.tps >= 40 ? 'ok' : c.strata.tps >= 15 ? 'slow' : 'no', note: c.strata.note, measured: !!c.strata.measured };
    if (model === 'deepseek' && CAT.deepseekMeasured[c.id]) { const [t, n] = CAT.deepseekMeasured[c.id]; return { tps: t, status: t >= 15 ? 'ok' : 'slow', note: n, measured: !c.id.startsWith('r9700') }; }
    const e = estimate(model, { ...hw, vram: c.gpuVram ? Math.max(c.gpuVram, c.vram) : c.vram });
    return { ...e, measured: false };
  }

  /* ---------- reading (prefill) speed and task time ----------
     Agents start with ~30K tokens of tool definitions and files; the wait before the first word is context / prefill speed.
     Strata/community measurements: RTX 5070 ≈2,090 tok/s (32K), RTX 5090 ≈5,000, RX 9070 XT ≈1,110, M5 Max 128 GB ≈1,300,
     32 GB Mac streaming ≈94; DeepSeek 763B on 12 GB + 64 GB ≈120–230. Values without a measurement are estimates. */
  function prefill(c, model) {
    const uni = c.ramType === 'unified', d4 = c.ramType === 'DDR4' ? 0.85 : 1, base = c.pp || (c.vram >= 24 ? 2000 : c.vram >= 16 ? 900 : c.vram >= 12 ? 900 : 300);
    if (String(model).startsWith('g:')) {
      const m = MODELS[model], scale = Math.pow(27 / Math.max(2, m.active), 0.8);
      if (uni) return Math.round(Math.min(6000, (c.bw || 300) * 1.3 * scale));
      if (!c.vram) return Math.round(40 * scale);
      const f = Math.min(1, Math.max(0, c.vram - 1.5) / m.file);
      return Math.round(Math.min(20000, base * 1.2 * scale * (f >= 1 ? 1 : m.moe ? 0.6 : 0.3 + 0.7 * f) * d4));
    }
    if (model === 'deepseek') { if (uni) return c.ram >= 128 ? 450 : 100; return Math.round((c.vram >= 24 ? 300 : c.vram >= 16 ? 220 : 180) * (c.ram >= 128 ? 1.5 : 1) * d4); }
    if (model === 'dense14' || model === 'q27') return uni ? Math.round((c.bw || 300) * 1.3) : Math.round(base * 1.2);
    if (model === 'q36' || model === 'coder') return uni ? (c.ram >= 48 ? 900 : 94) : Math.round((c.ram >= 32 ? base : 150) * d4);
    if (uni) return c.ram >= 96 ? 1800 : c.ram >= 64 ? 900 : c.ram >= 46 ? 500 : 94;
    const fits = c.ram >= 46 || (c.vram >= 24 && c.ram >= 32);
    return Math.round((fits ? base : 150) * d4);
  }
  function taskTime(c, model, S) {
    const t = (CAT.taskTypes || {})[S.taskType || 'short'] || { out: 1000, ctx: 2000 }, sp = speed(c, model).tps;
    if (!sp) return { total: Infinity, read: Infinity, write: Infinity };
    const read = t.ctx / prefill(c, model), write = t.out / sp;
    return { total: read + write, read, write };
  }

  /* ---------- money ---------- */
  function bill(kwh, t) {
    const thr = t.lowKwhPerDay * 30, a = Math.max(0, kwh);
    const net = Math.min(a, thr) * t.lowRate + Math.max(0, a - thr) * t.highRate;
    const levy = a / t.levyRefKwh * t.levyTl;
    return (net + levy) * (1 + t.vatPct / 100);
  }
  function electricity(c, model, S) {
    const sp = speed(c, model); if (!sp.tps) return { tl: 0, kwh: 0 };
    const kwh = S.monthlyTokens * 1e6 / (sp.tps * 3600) * (c.watts / 1000);
    const t = { ...CAT.tariff, ...(S.tariff || {}) };
    return { tl: bill(t.homeKwh + kwh, t) - bill(t.homeKwh, t), kwh };
  }
  const capacity = (c, model, S) => speed(c, model).tps * S.hoursPerDay * 30 * 3600 / 1e6;
  const inputM = S => S.monthlyTokens * (100 - S.outputSharePercent) / Math.max(1, S.outputSharePercent);
  function cloudMonthly(o, S) {
    const fx = S.usdTry * (1 + (S.foreignTax || 0) / 100);
    if (o.type === 'subscription') return o.monthly * (o.currency === 'USD' ? fx : 1);
    const c = Math.min(1, (S.cachedInputSharePercent || 0) / 100), cached = Number.isFinite(o.cachedUsd) ? o.cachedUsd : o.inputUsd;
    return (S.monthlyTokens * o.outputUsd + inputM(S) * ((1 - c) * o.inputUsd + c * cached)) * fx;
  }
  const growth = y => Math.pow(1 + (Number(y) || 0) / 100, 1 / 12) - 1;
  const accum = (g, t) => Math.abs(g) < 1e-12 ? t : (Math.pow(1 + g, t) - 1) / g;
  // cumulative cost after t months. owned=true: hardware already bought (no purchase price)
  function localCum(c, model, S, t, owned) {
    const e = electricity(c, model, S).tl;
    let purchase = owned ? 0 : c.price;
    if (!owned && S.resale && t > 0) purchase -= c.price * 0.85 * Math.pow(1 - (S.depreciation || 25) / 100, t / 12);
    return purchase + e * accum(growth(S.tlYearly), t);
  }
  function cloudCum(o, S, t) {
    const g = o.type === 'subscription' && o.currency === 'TRY' ? growth(S.tlYearly) : growth(S.usdYearly);
    return cloudMonthly(o, S) * accum(g, t);
  }
  function breakEven(c, model, o, S, owned, max = 120) {
    const d = t => localCum(c, model, S, t, owned) - cloudCum(o, S, t);
    if (d(0.01) <= 0) return 0;
    let prev = 0.01;
    for (let t = 0.25; t <= max; t += 0.25) { if (d(t) <= 0) { let a = prev, b = t; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; d(m) <= 0 ? b = m : a = m; } return b; } prev = t; }
    return Infinity;
  }
  function cloudOptions(S) {
    return [...CAT.subscriptions.map(o => ({ ...o, type: 'subscription' })), ...CAT.apiModels].map(o => {
      const monthly = cloudMonthly(o, S);
      let split = null;
      if (o.type !== 'subscription') {
        const fx = S.usdTry * (1 + (S.foreignTax || 0) / 100), c = Math.min(1, (S.cachedInputSharePercent || 0) / 100), cached = Number.isFinite(o.cachedUsd) ? o.cachedUsd : o.inputUsd, inM = inputM(S);
        split = { out: S.monthlyTokens * o.outputUsd * fx, inFresh: inM * (1 - c) * o.inputUsd * fx, inCached: inM * c * cached * fx };
      }
      const fits = o.type !== 'subscription' || S.monthlyTokens <= (S.caps && S.caps[o.id] || o.defaultCapM);
      return { ...o, monthly, fits, split };
    });
  }
  const FRONTIER = new Set(['api-claude-sonnet', 'api-claude-opus', 'api-openai-sol', 'api-openai-astra', 'api-openai-gpt54', 'api-openai-terra', 'api-gemini-argon-dec', 'api-gemini-argon-nov', 'api-gemini-31pro', 'api-xai-grok47', 'chatgpt-plus', 'chatgpt-pro100', 'chatgpt-pro200', 'claude-pro', 'claude-max5', 'claude-max20', 'google-ai-pro', 'google-ai-ultra5', 'google-ai-ultra20']);
  const inClass = (o, cls) => cls === 'all' || (cls === 'open' ? !!o.open : cls === 'closed' ? !o.open : FRONTIER.has(o.id));

  /* ---------- GGUF memory fit (classic llama.cpp models) ---------- */
  function ggufFit(m, quant, hw, ctx = 8192) {
    const gb = m.quants[quant]; if (!Number.isFinite(gb)) return null;
    const bytes = 4 * m.kvHeads * m.headDim, tok = ctx;
    const kv = (m.slidingWindow ? (Math.ceil(m.layers / m.slidingEvery) * tok + (m.layers - Math.ceil(m.layers / m.slidingEvery)) * Math.min(tok, m.slidingWindow)) : m.layers * tok) * bytes / 1073741824;
    const need = gb / 1.073741824 + kv + (hw.ramType === 'unified' ? 5 : 2);
    if (hw.ramType === 'unified') return need <= hw.ram ? 'gpu' : 'no';
    if (need <= hw.vram) return 'gpu';
    if (need <= hw.vram + Math.max(0, hw.ram - 6)) return 'offload';
    return 'no';
  }

  const localModels = () => Object.entries(MODELS).filter(([k]) => k !== 'dense14').map(([id, m]) => ({ id, ...m }));
  return { init, localModels, genEstimate, applyBrowserOpenRouter, prefill, taskTime, cat, live, offers, chosenOffer, cheapestOffer, computers, pcFromKeys, MODELS, estimate, speed, electricity, capacity, cloudMonthly, cloudOptions, inClass, localCum, cloudCum, breakEven, ggufFit, inputM, bill };
})();
