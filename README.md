# Yerel AI maliyet

Yapay zekâyı kendi bilgisayarında mı, abonelikle mi, API ile mi kullanmak daha ucuz? Türkiye fiyatlarıyla bir karar sitesi: mağaza fiyatları haftalık, API fiyatları ve kur ziyaretçinin tarayıcısından canlı.

Site dört tip kullanıcı için tasarlandı:

| Sayfa | Kimin için | Ne yapar |
|---|---|---|
| **Bilgisayarım var** (`#elimde`) | Elinde bilgisayarı olan | Ekran kartı, RAM ve SSD’ye göre Strata modellerinin (Qwen3.8-Flash-Next 125B, DeepSeek V4.1 Flash 763B…) ve klasik modellerin çalışıp çalışmadığını, hızını ve en ucuz yükseltmeyi gösterir |
| **Bilgisayar alacağım** (`#al`) | Yeni bilgisayar düşünen | Kullanım + model + bütçeye göre üç öneri, bütçedeki tüm hazır sistemler ve parça parça “kendin topla” (her parçada mağaza seçimi) |
| **Bulut** (`#bulut`) | Bilgisayar almak istemeyen | Her sınıfın (açık, kapalı, üst düzey model, abonelik) en ucuzunu ve tüm abonelik/API seçeneklerini aylık maliyete göre gruplu gösterir |
| **Al mı, kirala mı?** (`#karsilastir`) | Kararsız olan | Bir bilgisayarı varsayılan olarak aynı sınıftaki bir bulut modeliyle karşılaştırır: zamanla toplam maliyet ve amorti ayı, aylık kullanıma göre maliyet grafiği (logaritmik/doğrusal) ve yerelin hangi kullanımda ucuzladığı |

Ayrıca **Fiyatlar** (`#fiyatlar`) her parçanın tüm mağaza tekliflerini, **Metrikler** (`#metrikler`) yazma hızı tavanı hesaplayıcısını (tüm cihazlar grafiğiyle) ve girdi/çıktı tokenleri, okuma/yazma hızı, darboğaz zinciri, MoE, quant gibi kavramları görsellerle, **Yöntem** (`#nasil`) formülleri, değiştirilebilir varsayımları (kur, elektrik tarifesi…), veri kaynaklarını içerir.


## Yapı

```
index.html                 sayfa iskeleti
assets/calc.js             hesaplar (elektrik, maliyet, Strata hız tahminleri, amorti) ve fiyat birleştirme
assets/app.js              sayfalar, durum, bilgisayar toplayıcı, grafik
assets/style.css           stil (açık/koyu tema)
data/catalog.json          elle düzenlenen katalog: parça özellikleri, hazır sistemler, abonelikler, API modelleri
data/prices.json           otomatik fiyatlar (GitHub Actions yazar)
data/manual-offers.json    otomatik okunamayan mağazaların teklifleri (elle)
scripts/update_prices.py   fiyat toplayıcı (yalnız Python standart kütüphanesi)
.github/workflows/update-prices.yml   haftalık fiyat güncelleme
.github/workflows/deploy-pages.yml    siteyi GitHub Pages’e yayınlar (main’e her push’ta ve fiyat güncellemesinden sonra)
```

Site statik dosyalardan oluşur ve GitHub Pages’te çalışır (Settings → Pages → Source: **GitHub Actions**; yayını `deploy-pages.yml` yapar); veriler tarayıcıda JSON dosyalarından okunur. Yerelde denemek için:

```bash
python3 -m http.server 8000
```

## Fiyatlar nasıl güncellenir?

- **Canlı, ziyaretçinin tarayıcısından:** API fiyatları (OpenRouter) ve dolar kuru her sayfa açılışında ziyaretçinin kendi tarayıcısından çekilir. Mağaza ve Apple siteleri tarayıcıların başka sitelerden okumasına izin vermediği (CORS) için onlar aşağıdaki iş akışıyla toplanır.
- **Haftalık (pazartesi 07:17):** `scripts/update_prices.py` Gamegaraj ve Gaming.gen.tr (stoktaki en ucuz eşleşen ürün), Apple Türkiye (Mac yapılandırmaları), OpenRouter ve TCMB’den okuyup `data/prices.json`’u günceller. Bir kaynak başarısız olursa önceki değerler korunur; dosya yalnızca bir değer değişince commit’lenir.
- **Elle:** akakçe, Vatan, Hepsiburada, n11, Sinerji, İnceHesap gibi mağazalar otomatik erişimi engelliyor. Aşağıdaki promptu web araması açık bir yapay zekâya verin ve çıkan JSON’u `data/manual-offers.json` dosyasındaki `offers` altına ekleyin.

<details><summary>Fiyat promptu</summary>

```text
Türkiye'de bugün satılan bilgisayar parçalarının güncel fiyatlarını web'de araştır. Her ürün için EN AZ 3 farklı mağazaya bak (akakçe, Vatan, İtopya, İnceHesap, Hepsiburada, Trendyol, Amazon TR, Sinerji, n11, Teknosa, MediaMarkt). Fiyatı sayfada gerçekten gördüysen yaz; tahmin etme.

Parçalar (id: açıklama): gpu9060: RX 9060 XT 16 GB · gpu5060ti: RTX 5060 Ti 16 GB · gpu5070: RTX 5070 12 GB · gpu9070xt: RX 9070 XT 16 GB · gpu5070ti: RTX 5070 Ti 16 GB · gpu5080: RTX 5080 16 GB · gpu5090: RTX 5090 32 GB (hava soğutmalı) · gpuR9700: Radeon AI PRO R9700 32 GB · gpu3060used: RTX 3060 12 GB ikinci el (sahibinden/letgo ortanca) · gpu3090used: RTX 3090 24 GB ikinci el · cpu7500f: Ryzen 5 7500F · cpu9700x: Ryzen 7 9700X · cpu5500: Ryzen 5 5500 · moboB650: AM5 B650M anakart · moboA520: AM4 A520 anakart · moboX870E: x8/x8 destekli X870E · ram32: 32 GB (2x16) DDR5 · ram64: 64 GB (2x32) DDR5 · ram64ddr4: 64 GB (2x32) DDR4 · ram128: 128 GB DDR5 · ssd1: 1 TB NVMe · ssd2: 2 TB NVMe · psu750: 750 W Bronze · psu850: 850 W Gold · psu1200: 1200 W Gold · psu1300: 1300 W Platinum · caseMid: ATX mid tower kasa (PSU'suz) · cooler: AM5/AM4 kule tipi soğutucu

Çıktıyı SADECE şu JSON formatında ver: {"updated":"GG.AA.YYYY","offers":{"gpu5080":[{"store":"Mağaza","name":"ürün adı","price":88803,"url":"ürün sayfası","stock":"stokta|tükendi|bilinmiyor","date":"GG.AA.YYYY","source":"elle"}]}}
```

</details>
- Sayfa her parça için tüm teklifleri birleştirir; varsayılan olarak stoktaki en ucuz teklif kullanılır, kullanıcı başka mağaza seçebilir.

Haftayı beklemeden çalıştırmak için: GitHub → **Actions → Fiyatları güncelle → Run workflow**.
