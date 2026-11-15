# Karte: Reljef i Satelit — pružatelji, cijene, ključevi

Stanje i cijene provjereni 14. 11. 2026. na službenim stranicama pružatelja (vidi izvore na dnu). Cijene se mijenjaju — provjeri prije plaćanja.

## Što je ugrađeno

| Prikaz | Bez ključa (zadano) | S ključem |
|---|---|---|
| **Reljef** (zadani) | tamni ONTALE stil: OpenFreeMap vektori (šume, voda, ceste, granice, gradovi) + sjenčanje terena iz **Mapzen Terrain Tiles** (AWS Open Data, terrarium) | MapTiler: isti stil, ali DEM iz MapTiler `terrain-rgb-v2` (oštriji teren) |
| **Satelit** | **nije dostupan za komercijalnu uporabu bez ključa**. Opcija „EOX Sentinel-2 cloudless“ smije se uključiti samo za nekomercijalnu uporabu | MapTiler `satellite-v2` ili Stadia `alidade_satellite`, + ONTALE oznake gradova i granica iz OpenFreeMapa |

Oba prikaza koriste **isti pokretač rute** (`public/karta.js`): ista ruta, boje dionica, postaje, prijevoz na markeru, suparnici, putokazi, nastavak preko granice, obavijesti o dolasku. Igrač bira prikaz prekidačem ⛰️/🛰️ na karti; izbor se pamti u pregledniku i na profilu.

**Isticanje države:** država u kojoj je igrač (`countryAt` po ruti) ističe se zelenom ispunom, a ostale se lagano zatamne. Granice su iz Natural Earth 1:10m (javno dobro, `public/granice.json`, generira `npm run borders` iz `scripts/granice-raw.txt`). U Reljefu je sloj isticanja **ispod sloja vode**, pa obalu reže stvarna OSM obala (nema „zelenog mora“); obrub NE-granice izbliza blijedi. Na satelitu se koristi samo zatamnjenje ostalih država + bijele OSM granice iz vektorskih pločica (točne granice). Prelazak granice (npr. Dubrovnik → Crna Gora) mijenja istaknutu državu tijekom vožnje.

**Rezervni lanac:** pružatelj ne odgovori u 12 s → rezervna (dosadašnja) tamna OpenFreeMap karta → shematski SVG prikaz rute.

## Usporedba pružatelja

| Pružatelj | Reljef | Satelit | Cijena za komercijalnu uporabu | Napomena |
|---|---|---|---|---|
| **OpenFreeMap** | vektori (bez sjenčanja) | — | besplatno, bez ključa | koristi se kao vektorska podloga u oba prikaza |
| **Mapzen Terrain Tiles (AWS)** | DEM za sjenčanje | — | besplatno (AWS Open Data) | atribucija izvora (SRTM, EU-DEM © Copernicus …) |
| **MapTiler Cloud** | `terrain-rgb-v2`, Outdoor, Topo | `satellite-v2` (Hrvatska i BiH: visoka rezolucija) | plan **Flex 30 USD/mj.** (besplatni plan je samo za testiranje i nekomercijalno; traži logo MapTilera) | **preporuka**: jedan ključ za oba prikaza |
| **Stadia Maps** | Outdoors, Alidade Smooth Dark | Alidade Satellite | satelit tek u planu **Standard 80 USD/mj.**; Free plan ne dopušta komercijalnu uporabu | dobar izbor ako već koristiš Stadiu |
| **EOX Sentinel-2 cloudless** | — | 10 m/piksel, bez oblaka | besplatno samo **nekomercijalno** (CC BY-NC-SA); komercijalno uz EOX licencu | rezolucija dovoljna do zuma ~12; u ONTALE samo uz izričit odabir u adminu |
| Esri World Imagery | — | da | traži ArcGIS račun / licencu | nije ugrađeno |
| Google Maps | — | da | samo preko službenog Google Maps Platform API-ja (Map Tiles API) | nije ugrađeno; **nikad** ne preuzimati pločice s google.com |

**Preporuka:** MapTiler Flex (`MAPTILER_KEY`). Reljef radi i bez ključa (besplatno, komercijalno dopušteno); za Satelit u produkciji treba ključ.

## Što je stvarno provjereno u pregledniku

U pravom pregledniku (ugrađeni preglednik aplikacije Claude, s internetom) iscrtani su točno ovi ugrađeni stilovi s pravim pločicama, nad cijelom HR rutom:

- Reljef, pregled cijele rute (Hrvatska istaknuta, susjedi zatamnjeni) — `docs/snimke/v23-karta-reljef-pregled.jpg`
- Reljef, zum 8,4 (kamera prati) oko Šibenika/Splita — `docs/snimke/v23-karta-reljef-zum.jpg`
- Satelit (EOX Sentinel-2 2023 — nekomercijalna podloga, jedina dostupna bez ključa), pregled — `v23-karta-satelit-pregled.jpg`
- Satelit, Crna Gora kao aktivna država (nastavak rute) — `v23-karta-satelit-crna-gora.jpg`

Svi slojevi učitani bez greške. **Nije provjereno:** MapTiler i Stadia satelit (nema ključeva u ovom okruženju; MapTiler bez ključa vraća 403). Konfiguracija za njih slijedi službene URL predloške, ali prvi pregled s pravim ključem treba napraviti ručno (Admin → Karta i podloge, pa otvori bilo koju rutu i prebaci na 🛰️). Automatski e2e testovi rade bez interneta i vide samo shematski prikaz — oni provjeravaju sučelje (prekidač, pamćenje izbora), ne pločice.

## Ključevi — korak po korak

### MapTiler (preporuka)
1. Otvori račun na https://cloud.maptiler.com/ → Account → **API keys** → *Create key*.
2. U postavkama ključa pod **Allowed HTTP origins** upiši `https://ontale.eu` (i `http://localhost:3000` za razvoj). Ključ za pločice uvijek stiže do preglednika — ograničenje na domenu je ono što ga štiti.
3. Za komercijalnu stranicu prebaci se na plan **Flex** (Billing).
4. U `.env`: `MAPTILER_KEY=…`, restartaj aplikaciju. U adminu (Karta i podloge) pružatelj „Automatski“ ili „MapTiler“.

### Stadia Maps
1. https://client.stadiamaps.com/ → *Create property* → dodaj domenu `ontale.eu` (domenska autentikacija).
2. Kopiraj API ključ; satelit traži plan **Standard** ili viši.
3. U `.env`: `STADIA_API_KEY=…`. U adminu pružatelj „Stadia Maps“.

### Prilagođeno
Admin → Karta i podloge → „Prilagođeno“: vlastiti predložak satelitskih pločica `https://…/{z}/{x}/{y}.jpg` ili URL MapLibre stila. Ključ se **ne smije** upisati u adresu (poslužitelj to odbija) — koristi pružatelje s domenskom autentikacijom ili dodaj podršku u `src/mapcfg.js`.

Domene pločica automatski se dodaju u Content-Security-Policy (`mapCspHosts`); za dodatne poslužitelje postoji `EXTRA_CSP_HOSTS`.

## Atribucija

Atribucija se prikazuje u donjem lijevom kutu karte (sklopiva ikona ⓘ). Obavezni tekstovi po pružatelju složeni su u `src/mapcfg.js`: OpenFreeMap / OpenMapTiles / © OpenStreetMap; Mapzen Terrain Tiles; Natural Earth; © MapTiler; © Stadia Maps + CNES/Airbus/PlanetObserver; EOX „Sentinel-2 cloudless – s2maps.eu … (Contains modified Copernicus Sentinel data 2023)“. Admin može dodati vlastitu atribuciju.

## Izvori
- MapTiler cijene: https://www.maptiler.com/cloud/pricing/
- Stadia Maps cijene: https://stadiamaps.com/pricing/
- EOX licenca: https://cloudless.eox.at/documentation/license
- Mapzen Terrain Tiles: https://registry.opendata.aws/terrain-tiles/ i https://github.com/tilezen/joerd/blob/master/docs/attribution.md
- Natural Earth: https://www.naturalearthdata.com/
- OpenFreeMap: https://openfreemap.org
