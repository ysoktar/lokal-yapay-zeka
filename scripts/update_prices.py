#!/usr/bin/env python3
"""Fetch current prices for the cost comparison page and write data/prices.json.

Sources (all public pages/APIs, standard library only):
  - Gamegaraj category listings (schema.org JSON-LD): cheapest in-stock product matching each part pattern
  - Gaming.gen.tr search results (WooCommerce): cheapest in-stock product matching each part pattern
  - Other stores (akakçe, Vatan, Hepsiburada, n11, Sinerji, İnceHesap…) block automated requests; their offers
    come from data/manual-offers.json, which the page merges with this file
  - Apple Türkiye configuration pages (JSON-LD offers): Mac prices
  - OpenRouter /api/v1/models: open-weight model API prices
  - TCMB today.xml: USD/TRY forex selling rate
A source that fails keeps its previous values, so one blocked site never wipes data.
The file is only rewritten when a value changed; meta.updated is the time of the last change.
"""
import json, re, sys, time, html, datetime, pathlib, urllib.request, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "prices.json"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"}

def get(url, timeout=40):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")

# ---------- Gamegaraj ----------
GG = "https://www.gamegaraj.com/bilgisayar-parcalari/{cat}/"
# part key -> (category, required regexes, excluded regexes)
GG_PARTS = {
    "gpu9060":  ("ekran-karti", [r"RX ?9060 ?XT", r"16 ?G"], []),
    "gpu5060ti":("ekran-karti", [r"RTX ?5060 ?Ti", r"16 ?G"], []),
    "gpu5070":  ("ekran-karti", [r"RTX ?5070", r"12 ?G"], [r"5070 ?Ti"]),
    "gpu9070xt":("ekran-karti", [r"RX ?9070 ?XT"], []),
    "gpu5070ti":("ekran-karti", [r"RTX ?5070 ?Ti"], []),
    "gpu5080":  ("ekran-karti", [r"RTX ?5080"], []),
    "gpu5090":  ("ekran-karti", [r"RTX ?5090"], [r"WB|Waterforce WB|Water ?Block"]),
    "gpuR9700": ("ekran-karti", [r"R9700"], []),
    "cpu7500f": ("islemci", [r"7500F"], []),
    "cpu9700x": ("islemci", [r"9700X\b"], []),
    "cpu5500":  ("islemci", [r"Ryzen 5 5500\b"], []),
    "moboB650": ("anakart", [r"B650", r"AM5"], []),
    "moboA520": ("anakart", [r"A520"], []),
    "ram32":    ("ram-bellek", [r"32GB ?\(2x16", r"DDR5", r"Masaüstü"], []),
    "ram64":    ("ram-bellek", [r"64GB", r"DDR5", r"Masaüstü"], []),
    "ram64ddr4":("ram-bellek", [r"64GB", r"DDR4"], []),
    "ram128":   ("ram-bellek", [r"128GB", r"DDR5", r"Masaüstü"], []),
    "ssd1":     ("ssd", [r"\b1TB\b", r"M\.?2"], []),
    "ssd2":     ("ssd", [r"\b2TB\b", r"M\.?2"], []),
    "psu750":   ("guc-kaynagi-psu", [r"\b750W\b"], []),
    "psu850":   ("guc-kaynagi-psu", [r"\b850W\b", r"Gold"], []),
    "psu1200":  ("guc-kaynagi-psu", [r"\b1200W\b"], []),
    "psu1300":  ("guc-kaynagi-psu", [r"\b1300W\b"], []),
}
PRODUCT_RE = re.compile(r'"@type":\s*"Product",\s*"url":\s*"([^"]+)",\s*"name":\s*"([^"]+)".*?"price":\s*([\d.]+),\s*"availability":\s*"([^"]+)"', re.S)

def gamegaraj():
    products = {}
    for cat in sorted({c for c, _, _ in GG_PARTS.values()}):
        for page in range(1, 6):
            url = GG.format(cat=cat) + (f"?page={page}" if page > 1 else "")
            try:
                text = get(url)
            except Exception as e:
                print(f"  gamegaraj {cat} p{page}: {e}", file=sys.stderr); break
            found = PRODUCT_RE.findall(text)
            if not found: break
            for u, name, price, avail in found:
                products[u] = dict(cat=cat, name=html.unescape(name).strip(), price=round(float(price)),
                                   url=u.replace("http://", "https://"), inStock=avail.endswith("InStock"))
            time.sleep(1)
    out = {}
    for key, (cat, req, exc) in GG_PARTS.items():
        cands = [p for p in products.values() if p["cat"] == cat and p["inStock"]
                 and all(re.search(r, p["name"], re.I) for r in req) and not any(re.search(r, p["name"], re.I) for r in exc)]
        if cands:
            best = min(cands, key=lambda p: p["price"])
            out[key] = offer("Gamegaraj", best["name"], best["price"], best["url"], "stokta")
    print(f"gamegaraj: {len(products)} ürün, {len(out)} parça eşleşti")
    if not products: raise RuntimeError("no products")
    return out

def offer(store, name, price, url, stock):
    return {"store": store, "name": name, "price": round(price), "url": url, "stock": stock,
            "date": datetime.date.today().strftime("%d.%m.%Y"), "source": "otomatik"}

# ---------- Gaming.gen.tr (WooCommerce search) ----------
GM_SEARCH = "https://www.gaming.gen.tr/?s={q}&post_type=product"
# part key -> (search query, required regexes, excluded regexes); 'Ekran Kartı' etc. keep laptops/prebuilts out
GM_PARTS = {
    "gpu9060":  ("rx 9060 xt 16gb", [r"9060 ?XT", r"16 ?GB", r"Ekran Kart"], []),
    "gpu5060ti":("rtx 5060 ti 16gb", [r"5060 ?Ti", r"16 ?GB", r"Ekran Kart"], []),
    "gpu5070":  ("rtx 5070 12gb", [r"RTX 5070\b", r"12 ?GB", r"Ekran Kart"], [r"5070 ?Ti"]),
    "gpu9070xt":("rx 9070 xt", [r"9070 ?XT", r"Ekran Kart"], []),
    "gpu5070ti":("rtx 5070 ti", [r"5070 ?Ti", r"Ekran Kart"], []),
    "gpu5080":  ("rtx 5080", [r"RTX 5080", r"Ekran Kart"], []),
    "gpu5090":  ("rtx 5090", [r"RTX 5090", r"Ekran Kart"], []),
    "gpuR9700": ("r9700", [r"R9700", r"Ekran Kart"], []),
    "cpu7500f": ("ryzen 5 7500f", [r"7500F", r"İşlemci"], []),
    "cpu9700x": ("ryzen 7 9700x", [r"9700X", r"İşlemci"], []),
    "ram32":    ("32gb ddr5 ram", [r"32 ?GB", r"DDR5", r"(Masaüstü|Desktop|RAM)"], [r"SO-?DIMM|Notebook|Dizüstü|Laptop|Intel Core|Ryzen"]),
    "ram64":    ("64gb ddr5 ram", [r"64 ?GB", r"DDR5", r"(Masaüstü|Desktop|RAM)"], [r"SO-?DIMM|Notebook|Dizüstü|Laptop|Intel Core|Ryzen"]),
    "ssd1":     ("1tb nvme ssd", [r"\b1 ?TB\b", r"(NVMe|M\.2)"], [r"Intel Core|Ryzen"]),
    "ssd2":     ("2tb nvme ssd", [r"\b2 ?TB\b", r"(NVMe|M\.2)"], [r"Intel Core|Ryzen"]),
    "psu850":   ("850w gold", [r"850 ?W", r"Gold"], []),
    "psu1200":  ("1200w", [r"1200 ?W"], []),
}
def gaminggentr():
    out = {}
    for key, (q, req, exc) in GM_PARTS.items():
        try:
            text = get(GM_SEARCH.format(q=urllib.parse.quote_plus(q)))
        except Exception as e:
            print(f"  gaming.gen.tr {key}: {e}", file=sys.stderr); continue
        cands = []
        for li in re.findall(r'<li class="[^"]*\bproduct type-product\b.*?</li>', text, re.S):
            cls = re.match(r'<li class="([^"]*)"', li).group(1).split()
            u = re.search(r'href="(https://www\.gaming\.gen\.tr/urun/[^"]+)"', li)
            n = re.search(r'woocommerce-loop-product__title">(.*?)</', li)
            ps = re.findall(r'<bdi>([\d.]+,\d{2})', li)
            if not (u and n and ps) or "instock" not in cls: continue
            name = html.unescape(n.group(1))
            if all(re.search(r, name, re.I) for r in req) and not any(re.search(r, name, re.I) for r in exc):
                cands.append((float(ps[-1].replace(".", "").replace(",", ".")), name, u.group(1)))
        if cands:
            price, name, url = min(cands)
            out[key] = offer("Gaming.gen.tr", name, price, url, "stokta")
        time.sleep(1)
    print(f"gaming.gen.tr: {len(out)} parça eşleşti")
    if not out: raise RuntimeError("no matches")
    return out

# ---------- Apple Türkiye ----------
AB = "https://www.apple.com/tr/shop/buy-mac/"
APPLE = {
    "macm6": "mac-mini/m6-çip-12-çekirdekli-cpu-12-çekirdekli-gpu-16-gb-bellek-256gb-depolama",
    "macm6_24": "mac-mini/m6-çip-12-çekirdekli-cpu-12-çekirdekli-gpu-24-gb-bellek-256gb-depolama",
    "macm6_32": "mac-mini/m6-çip-12-çekirdekli-cpu-12-çekirdekli-gpu-32-gb-bellek-256gb-depolama",
    "mac24": "mac-mini/m5-pro-çip-15-çekirdekli-cpu-16-çekirdekli-gpu-24-gb-bellek-512gb-depolama",
    "mac48": "mac-mini/m5-pro-çip-15-çekirdekli-cpu-16-çekirdekli-gpu-48-gb-bellek-512gb-depolama",
    "macmini64": "mac-mini/m5-pro-çip-15-çekirdekli-cpu-16-çekirdekli-gpu-64-gb-bellek-512gb-depolama",
    "macstudio36": "mac-studio/m5-max-çip-18-çekirdekli-cpu-32-çekirdekli-gpu-36-gb-bellek-512gb-depolama",
    "macstudio64": "mac-studio/m5-max-çip-18-çekirdekli-cpu-40-çekirdekli-gpu-64-gb-bellek-1tb-depolama",
    "macstudio128": "mac-studio/m5-max-çip-18-çekirdekli-cpu-40-çekirdekli-gpu-128-gb-bellek-1tb-depolama",
    "macultra96": "mac-studio/m5-ultra-çip-30-çekirdekli-cpu-64-çekirdekli-gpu-96-gb-bellek-1tb-depolama",
    "macultra256": "mac-studio/m5-ultra-çip-30-çekirdekli-cpu-64-çekirdekli-gpu-256-gb-bellek-1tb-depolama",
}
def apple():
    out = {}
    for sid, slug in APPLE.items():
        url = AB + urllib.parse.quote(slug)
        try:
            text = get(url)
        except Exception as e:
            print(f"  apple {sid}: {e}", file=sys.stderr); continue
        for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
            try: d = json.loads(m.group(1))
            except Exception: continue
            if isinstance(d, dict) and d.get("@type") == "Product":
                o = d.get("offers"); o = o[0] if isinstance(o, list) else o
                if o and o.get("price"):
                    out[sid] = {"price": round(float(o["price"])), "name": d.get("name", ""), "url": url}
                break
        time.sleep(1)
    print(f"apple: {len(out)}/{len(APPLE)} yapılandırma")
    if not out: raise RuntimeError("no apple prices")
    return out

# ---------- OpenRouter ----------
OPENROUTER = ["meta-llama/llama-3.1-8b-instruct","mistralai/mistral-nemo","google/gemma-3-12b-it","microsoft/phi-4",
 "mistralai/mistral-small-3.2-24b-instruct","google/gemma-3-27b-it","qwen/qwen3-coder-30b-a3b-instruct",
 "qwen/qwen3-30b-a3b-instruct-2507","qwen/qwen3-32b","openai/gpt-oss-20b","openai/gpt-oss-120b",
 "meta-llama/llama-3.3-70b-instruct","meta-llama/llama-4-scout","meta-llama/llama-4-maverick","z-ai/glm-4.5-air",
 "qwen/qwen3-235b-a22b-2507","minimax/minimax-m2","deepseek/deepseek-v3.2","deepseek/deepseek-r1-0528",
 "qwen/qwen3-coder","z-ai/glm-4.6","moonshotai/kimi-k2-0905"]
def openrouter():
    data = {m["id"]: m for m in json.loads(get("https://openrouter.ai/api/v1/models"))["data"]}
    out = {}
    for mid in OPENROUTER:
        m = data.get(mid)
        if not m: continue
        p = m["pricing"]; f = lambda x: float(f"{float(x)*1e6:.4g}")
        inp, outp = f(p.get("prompt", 0)), f(p.get("completion", 0))
        if inp < 0 or outp <= 0: continue
        e = {"inputUsd": inp, "outputUsd": outp}
        c = p.get("input_cache_read")
        if c and float(c) > 0: e["cachedUsd"] = f(c)
        out[mid] = e
    print(f"openrouter: {len(out)}/{len(OPENROUTER)} model")
    return out

# ---------- TCMB ----------
def tcmb():
    text = get("https://www.tcmb.gov.tr/kurlar/today.xml")
    m = re.search(r'Kod="USD".*?<ForexSelling>([\d.]+)</ForexSelling>', text, re.S)
    d = re.search(r'Tarih="([\d.]+)"', text)
    return {"value": float(m.group(1)), "date": d.group(1) if d else "", "source": "TCMB döviz satış"}

def main():
    old = json.loads(OUT.read_text("utf-8")) if OUT.exists() else {}
    new = {k: v for k, v in old.items() if k != "meta"}
    new.pop("parts", None)  # older format
    stores = dict(new.get("stores", {}))
    for key, fn in [("usdTry", tcmb), ("Gamegaraj", gamegaraj), ("Gaming.gen.tr", gaminggentr), ("apple", apple), ("openrouter", openrouter)]:
        try:
            val = fn()
            if key in ("Gamegaraj", "Gaming.gen.tr"):
                old_store = stores.get(key, {})
                # keep the old date when price/product did not change, so the file only changes on real updates
                for k, o in val.items():
                    prev = old_store.get(k)
                    if prev and all(prev.get(f) == o.get(f) for f in ("price", "url", "stock")):
                        o["date"] = prev["date"]
                stores[key] = val
            else:
                new[key] = val
        except Exception as e:
            print(f"{key}: başarısız, önceki değerler korunuyor ({e})", file=sys.stderr)
    new["stores"] = stores
    if new == {k: v for k, v in old.items() if k != "meta"}:
        print("değişiklik yok"); return
    new["meta"] = {"updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")}
    OUT.write_text(json.dumps(new, ensure_ascii=False, indent=1, sort_keys=True) + "\n", "utf-8")
    print("data/prices.json güncellendi")

if __name__ == "__main__":
    main()
