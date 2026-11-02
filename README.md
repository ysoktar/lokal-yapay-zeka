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
- **Elle:** akakçe, Vatan, Hepsiburada, n11, Sinerji, İnceHesap gibi mağazalar otomatik erişimi engelliyor. Sitedeki **Fiyatlar → Promptu kopyala** ile alınan promptu web araması açık bir yapay zekâya verin ve çıkan JSON’u `data/manual-offers.json` dosyasındaki `offers` altına ekleyin.
- Sayfa her parça için tüm teklifleri birleştirir; varsayılan olarak stoktaki en ucuz teklif kullanılır, kullanıcı başka mağaza seçebilir.

Haftayı beklemeden çalıştırmak için: GitHub → **Actions → Fiyatları güncelle → Run workflow**.
