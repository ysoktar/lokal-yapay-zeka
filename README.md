# Yerel AI maliyet

Yapay zekâyı kendi bilgisayarında mı, abonelikle mi, API ile mi kullanmak daha ucuz? Türkiye fiyatlarıyla, her gün güncellenen bir karar sitesi.

Site dört tip kullanıcı için tasarlandı:

| Sayfa | Kimin için | Ne yapar |
|---|---|---|
| **Bilgisayarım var** (`#elimde`) | Elinde bilgisayarı olan | Ekran kartı, RAM ve SSD’ye göre Strata modellerinin (Qwen3.8-Flash-Next 125B, DeepSeek V4.1 Flash 763B…) ve klasik modellerin çalışıp çalışmadığını, hızını ve en ucuz yükseltmeyi gösterir |
| **Bilgisayar alacağım** (`#al`) | Yeni bilgisayar düşünen | Kullanım + model + bütçeye göre üç öneri, bütçedeki tüm hazır sistemler ve parça parça “kendin topla” (her parçada mağaza seçimi) |
| **Satın almadan** (`#bulut`) | Bilgisayar almak istemeyen | Abonelik ve API seçeneklerini aylık maliyete göre sıralar |
| **Almak mı, kiralamak mı?** (`#karsilastir`) | Kararsız olan | Bir bilgisayar ile bir bulut seçeneğini zaman içinde karşılaştırır; amorti ayı, gizlilik şartı, DeepSeek için “kirala” hesabı |

Ayrıca **Fiyatlar** (`#fiyatlar`) her parçanın tüm mağaza tekliflerini, **Metrikler** (`#metrikler`) girdi/çıktı tokenleri, okuma/yazma hızı, bant genişliği ve yazma hızı tavanı hesaplayıcısını, **Nasıl?** (`#nasil`) yöntem, gelişmiş ayarlar ve kaynakları içerir.


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
.github/workflows/update-prices.yml   her gün çalışan iş akışı
```

Site statik dosyalardan oluşur ve GitHub Pages’te çalışır; veriler tarayıcıda JSON dosyalarından okunur. Yerelde denemek için:

```bash
python3 -m http.server 8000
```

## Fiyatlar nasıl güncellenir?

- **Canlı, ziyaretçinin tarayıcısından:** API fiyatları (OpenRouter) ve dolar kuru her sayfa açılışında ziyaretçinin kendi tarayıcısından çekilir. Mağaza ve Apple siteleri tarayıcıların başka sitelerden okumasına izin vermediği (CORS) için onlar aşağıdaki iş akışıyla toplanır.
- **Haftalık (pazartesi 07:17):** `scripts/update_prices.py` Gamegaraj ve Gaming.gen.tr (stoktaki en ucuz eşleşen ürün), Apple Türkiye (Mac yapılandırmaları), OpenRouter ve TCMB’den okuyup `data/prices.json`’u günceller. Bir kaynak başarısız olursa önceki değerler korunur; dosya yalnızca bir değer değişince commit’lenir.
- **Elle:** akakçe, Vatan, Hepsiburada, n11, Sinerji, İnceHesap gibi mağazalar otomatik erişimi engelliyor. Sitedeki **Fiyatlar → Promptu kopyala** ile alınan promptu web araması açık bir yapay zekâya verin ve çıkan JSON’u `data/manual-offers.json` dosyasındaki `offers` altına ekleyin.
- Sayfa her parça için tüm teklifleri birleştirir; varsayılan olarak stoktaki en ucuz teklif kullanılır, kullanıcı başka mağaza seçebilir.

Haftayı beklemeden çalıştırmak için: GitHub → **Actions → Fiyatları güncelle → Run workflow**.
