# ONTALE.eu

Dnevna sportska igra: deset sportskih pitanja dnevno (5 s pripreme + 30 s za odgovor), a što je točan odgovor rjeđi
među igračima, to igrač dalje stiže na ruti kroz Hrvatsku (Vukovar – Dubrovnik) ili Bosnu i Hercegovinu (Bijeljina – Neum).
Tko skupi više od 1.000 km, vozi dalje preko granice — u Crnu Goru, odnosno Hrvatsku.

> **Verzija 2.3 (14. 11. 2026.)** — karta s prikazima **Reljef** i **Satelit** i isticanjem države, **privatne poruke**,
> **putokazi** iznad igrača u utrci lige, **obavijesti** (🔔) i **e-mail podsjetnici** (uz privolu), **izazovi među prijateljima**,
> **tjedne i mjesečne nagrade** lige, **zvučni efekti** (🔊) i nove stranice administracije. Sve je opisano u
> [`docs/V2.3.md`](docs/V2.3.md); karte i ključevi: [`docs/MAP_PROVIDERS.md`](docs/MAP_PROVIDERS.md); zvuk:
> [`docs/AUDIO_REFERENCE.md`](docs/AUDIO_REFERENCE.md); istraživanje Doklea: [`docs/DOKLE_PHASE3_RESEARCH.md`](docs/DOKLE_PHASE3_RESEARCH.md).
> Nadogradnja s 2.2: kao dolje — kopiraj datoteke (bez `data/`), dopuni `.env` novim varijablama iz `.env.example`
> (sve su neobavezne) i pokreni `npm start`; migracija 003 dodaje samo nove tablice, uz automatsku kopiju baze.
>
> **Verzija 2 (studeni 2026.)** — tajmeri, ponovni pokušaji, deset pitanja, tamni izgled, animirana karta putovanja i
> nastavak rute iza cilja. Pojedinosti: [`docs/FAZA2.md`](docs/FAZA2.md); pregled uzora:
> [`docs/DOKLE_UI_UX_AUDIT.md`](docs/DOKLE_UI_UX_AUDIT.md).
>
> **Nadogradnja postojeće instalacije:** zaustavi poslužitelj (Ctrl+C), prekopiraj nove datoteke preko starih
> (mapu `data/` ne diraj) i pokreni `npm start`. Poslužitelj sam spremi dvije kopije baze u `data/backups/`,
> primijeni migraciju i nadogradi sadržaj; korisnici, partije, ljestvice, lige i tvoje postavke ostaju.

Sadržaj ovog dokumenta: [pokretanje](#brzo-pokretanje) · [što je unutra](#što-je-u-paketu) · [bodovanje](#kako-radi-bodovanje) ·
[sadržaj i uvoz pitanja](#sadržaj-pitanja-i-baze-odgovora) · [testovi](#testovi) · [produkcija](#produkcijsko-postavljanje) ·
[što treba znati prije objave](#što-treba-znati-prije-objave)

## Brzo pokretanje

Treba samo **Node.js 22.13 ili noviji** (preporuka: 24 LTS). Nema `npm install` — aplikacija nema vanjskih paketa.

```bash
cp .env.example .env          # za lokalni rad dovoljno je obrisati NODE_ENV=production i ostaviti ostalo prazno
npm run seed                  # baza, karte, prijevoz i 10 dnevnih izazova (prvi dan = danas po Zagrebu)
npm run admin -- ti@primjer.hr --lozinka=TvojaLozinka123 --nadimak=Urednik
npm start                     # http://localhost:3000   ·   admin panel: http://localhost:3000/admin
```

Korisne naredbe:

| Naredba | Što radi |
|---|---|
| `npm run seed -- --start=2026-12-01` | Prvi dnevni izazov na zadani datum |
| `npm run seed -- --reset` | Briše bazu i puni je iznova |
| `npm run admin -- e-mail [--lozinka=…]` | Daje administratorske ovlasti (i stvara račun ako ne postoji) |
| `npm run backup` | Dosljedna kopija baze u `data/backups/` (čuva zadnjih 14) |
| `npm test` | Jedinični, integracijski i testovi sadržaja |
| `npm run test:e2e` | Prolaz kroz cijelu igru i admin u pravom pregledniku (treba Playwright) |
| `npm run test:e2e:v23` | Prolaz kroz značajke v2.3 (poruke, putokazi, obavijesti, izazovi, nagrade, zvuk, admin, mobitel) |
| `npm run jobs` | Jedan prolaz zakazanih poslova (za cron kad je `JOBS=off`) |
| `npm run sounds` | Ponovno generira izvorne MP3 zvukove (`public/zvukovi/`, treba Python + ffmpeg) |
| `npm run borders` | Ponovno generira `public/granice.json` (granice država za isticanje na karti) |

## Što je u paketu

```
server.js              ulazna točka
src/app.js             HTTP poslužitelj, rute, sigurnosna zaglavlja, ograničenje učestalosti
src/game.js            dnevni izazovi, partije, odgovaranje, naknadni obračuni, zaključivanje dana
src/scoring.js         čista logika: prepoznavanje odgovora, rijetkost, procjene, niz dana
src/auth.js            gosti, registracija, prijava, Google OAuth, profil, brisanje računa
src/social.js          ljestvice, statistika, lige, reakcije
src/admin.js           sve administratorske radnje + audit log
src/admin2.js          administracija v2.3: moderacija, obavijesti/e-mail, izazovi, karta
src/obavijesti.js      obavijesti, postavke korisnika, događaji lige (pretjecanje, vodstvo, svi odigrali)
src/poruke.js          privatne poruke, blokiranje, prijave
src/putokazi.js        putokazi na ruti
src/izazovi.js         izazovi među prijateljima
src/nagrade.js         dnevne, tjedne i mjesečne nagrade lige
src/poslovi.js         zakazani poslovi (podsjetnici, sažeci, zaključivanja) · src/mailer.js SMTP i predlošci e-maila
src/zvuk.js, mapcfg.js zvučni zapisi i dodjele; pružatelji karte · src/tekst.js filtar psovki i poveznica
src/db.js, util.js     baza (node:sqlite), normalizacija teksta, vrijeme po Europe/Zagreb
migrations/            SQL shema (primjenjuje se automatski pri pokretanju)
seed/                  početni podaci: osnova.js (karte, prijevoz, postavke), tekstovi.js, aliasi.js, pitanja/*.js
public/                klijent bez build koraka: app.js, karta.js (MapLibre), zvuk.js, style.css, admin.js, granice.json, zvukovi/*.mp3
test/                  unit.test.js, integration.test.js, sadrzaj.test.js, e2e.mjs
deploy/                Caddyfile, systemd servis, cron za kopije, docker-compose
```

**Funkcije:** dvije karte s vlastitim ljestvicama · jedna službena partija po danu i karti · gost → račun bez gubitka rezultata ·
e-mail i Google prijava · profili, statistika po sportovima, niz dana, mjesečni pregled · privatne lige s pozivnim kodom i
poveznicom, napredak članova na karti, reakcije · arhiva i ponovljene partije (neslužbene) · prijava neprepoznatog odgovora i
naknadno priznavanje kilometara · admin panel za pitanja, baze odgovora, izazove, procjene, karte, gradove, prijevoz,
korisnike, lige i postavke · audit log · izvoz i brisanje vlastitih podataka (GDPR).

### Tehnologija i zašto je takva

Preporuka iz zadatka bila je Next.js + PostgreSQL/Supabase. Okruženje u kojem je aplikacija građena nije dopuštalo
instalaciju paketa, pa bi takav kod ostao **nepokrenut i netestiran**. Zato je odabrano rješenje koje se moglo u cijelosti
pokrenuti i testirati: Node.js bez ijednog vanjskog paketa, ugrađena baza **SQLite** (`node:sqlite`, WAL način rada) i klijent
u čistim ES modulima.

- Prednosti: instalacija je kopiranje mape; nema lanca ovisnosti ni build koraka; cijela baza je jedna datoteka.
- Kapacitet: sve bodovanje je jedan kratki upis po odgovoru. Jedan poslužitelj s SQLiteom bez teškoća nosi tisuće igrača dnevno;
  ljestvice se predmemoriraju 15 sekundi.
- Granice: jedan proces, jedan poslužitelj. Ako igra preraste to, `src/db.js` je jedino mjesto koje govori s bazom (shema je
  standardni SQL), pa je prelazak na PostgreSQL izvediv, ali traži prepravak poziva u asinkrone.
- `node:sqlite` je u Node.js 22 označen kao eksperimentalan modul (u Node.js 24 je kandidat za stabilno izdanje). Radi
  pouzdano, ali drži se LTS izdanja i radi kopije baze.

## Kako radi bodovanje

Sve se računa na poslužitelju; klijent šalje samo tekst odgovora i nikad ne dobiva bazu točnih odgovora.

### Prepoznavanje odgovora (`src/scoring.js`)

1. **Normalizacija:** mala slova, bez dijakritike i interpunkcije (`Čilić` = `cilic`, `Đoković` = `Djokovic`,
   `Man. United` = `man united`), bez klupskih prefiksa (`FC`, `NK`, `RK`…).
2. **Strogi ključevi:** kanonski naziv, aliasi, isti tokeni drugim redom (`Safin Marat`).
3. **Izvedeni ključevi za osobe:** prezime, završni dio imena (`van Nistelrooy`), inicijal + prezime, ime bez `Jr.`
4. **Dvosmislenost:** ako ključ vodi na više točnih odgovora (`Schumacher`, `Ronaldo`, `Klitschko`), igra traži da igrač
   dopiše ime — pitanje se ne troši.
5. **Tipfeleri:** Damerau–Levenshtein uz strog prag koji ovisi o kraćem nizu (do 4 znaka: 0; 5–8: 1; 9–14: 2; dulje: 3),
   znamenke se moraju poklapati i najbliži odgovor mora biti jedinstven. Zato `Australija` ne postaje `Austrija`,
   a `Slovačka` ne postaje `Slovenija`.

### Rijetkost

Za svaki točan odgovor *a* na pitanje:

```
p0(a) = početna procjena udjela         = popularnost(a) / Σ popularnost
s(a)  = (K · p0(a) + n(a)) / (K + N)    n = različiti igrači s tim odgovorom, N = svi točni odgovori
P(a)  = udio igrača s popularnijim odgovorom + ½ udjela ostalih jednako popularnih
B(a)  = 1 − min(1, s(a) · M / 2)        M = 1/Σ s² (efektivni broj odgovora — širina pitanja)
rijetkost(a) = 100 · (0,7 · P + 0,3 · B)
```

- **K** („virtualni igrači” početne procjene) zadano je 200 i podesivo globalno i po pitanju. Dok je igrača malo, vrijedi
  praktički početna procjena, pa prvi ili slučajni odgovori ne mogu poremetiti bodovanje; s tisućama igrača prevladaju stvarni podaci.
- Rijetkost se računa **prije** nego što se ubroji igračev vlastiti glas.
- Jedan igrač = jedan glas po pitanju (i kad igra obje karte); najviše 3 glasa po IP adresi i pitanju.
- Razina prijevoza = najviša čiji je prag rijetkosti dosegnut (zadano 0 / 30 / 48 / 63 / 76 / 87 / 95 → 12 / 30 / 54 / 84 / 120 / 150 / 220 km).
- Ruta ima 1.000 km: samim najčešćim odgovorima stiže se oko 100–150 km, a do cilja treba pet do šest stvarno rijetkih.
- Administrator može svakom odgovoru upisati ručnu rijetkost, promijeniti K, pragove i kilometre.

### Procjene

Postotna pogreška → razina (zadano: unutar tolerancije pitanja = razina 7; ≤ 2,5 % → 6; ≤ 6 % → 5; ≤ 12 % → 4; ≤ 22 % → 3;
≤ 40 % → 2; ≤ 70 % → 1; dalje 0 km). Pitanja s načinom „pragovi + najbliži” nakon ponoći najbližoj procjeni dana daju najvišu
razinu; jednako bliske procjene dijele bonus ili ga dobiva ranija (podesivo po pitanju). Svaka procjena ima jedinicu, datum na
koji se brojka odnosi, izvor i oznaku ako nije službena statistika.

### Spoileri između karata

Obje karte dijele dnevni set pitanja. Zato točnu brojku procjene i najčešće odgovore drugih igrača igrač vidi tek kad odigra
obje karte ili kad dan završi. Ako želiš potpuno odvojene setove, u adminu napravi izazov s opsegom „samo karta …” — taj ima
prednost pred zajedničkim.

## Sadržaj: pitanja i baze odgovora

Početni sadržaj: **10 dana × 10 pitanja = 100 pitanja, 2.912 kanonskih odgovora**. Svaki dan: 2 nogomet, košarka,
rukomet, tenis, Formula 1, borilački sportovi, procjena, dodatno otvoreno pitanje (sport se izmjenjuje) i druga procjena.
Deveto i deseto pitanje su u `seed/pitanja/dodatna.js`; svih deset „drugih procjena” preuzeto je iz autorova
izvornog kviza (kategorije Brojalica i Pitanje procjene).

- Liste odgovora uspoređene su s navedenim izvorima **13. 11. 2026.** i uključuju događaje iz 2026. (SP 2026., Zlatna lopta,
  NBA i Euroliga 2026., Grand Slamovi, F1 do VN São Paula). Svako pitanje u adminu ima izvore i napomenu o provjeri.
- Svaki odgovor ima kanonski naziv, aliase, kratko obrazloženje, datum provjere i početnu popularnost (razredi A–F u seed datotekama).
- Seed datoteke su čitljive: `seed/pitanja/*.js`, zapis odgovora `"Kanonski naziv|alias|alias#obrazloženje"`.
  Zajednički aliasi (države, veliki klubovi) su u `seed/aliasi.js`.

**Uvoz vlastitih pitanja** (Admin → Pitanja → „Uvezi CSV ili JSON”). CSV odvojen točkom-zarezom, prvi red su nazivi stupaca:

```
kategorija;vrsta;tekst;pojasnjenje;vrsta_odgovora;tezina;odgovori;vrijednost;jedinica;datum;tolerancija;izvor_naziv;izvor_url
Tenis;open;Navedi hrvatskog tenisača iz top 20.;ATP ljestvica;person;3;Marin Čilić=Cilic|Goran Ivanišević|Borna Ćorić;;;;;ATP;https://www.atptour.com
Procjene;numeric;Koliko je asova…?;;;3;;13728;asova;2021-01-01;1;ATP;https://www.atptour.com
```

`vrsta_odgovora`: `person` (dovoljno je prezime), `team`, `country`, `other`. Uvezena pitanja su neaktivna dok ih ne pregledaš.

## Testovi

```bash
npm test            # 55 testova: logika, API, tajmeri, nadogradnja baze, statistika lige, početni sadržaj
npm i -D playwright && npx playwright install chromium && npm run test:e2e   # 23 koraka u pregledniku (uključujući širine 375–1440 px)
```

Pokriveno, među ostalim: odabir karte · deset pitanja · priprema i tajmer na poslužitelju · ponovni pokušaji · istek vremena ·
procjene s izmjenom · osvježavanje stranice usred pitanja · dvostruki klik i istovremeni zahtjevi · nastavak rute iza cilja ·
nadogradnja stvarne baze prve verzije · aliasi i dijakritika · dvosmislenost · rijetkost i mali broj igrača ·
dva igrača s istim odgovorom i istim aliasom · procjene i jednake udaljenosti · ponovljena službena partija · arhiva ·
prelazak na novi dan usred partije · prekid internetske veze · gost → račun · lige i reakcije · prijava i naknadno odobravanje
odgovora · admin zaštita · uređivanje pitanja, prijevoza i gradova · CSV/JSON uvoz · 40 istovremenih igrača · CSRF, SQL injection,
pokušaj upisa vlastitih kilometara.

## Produkcijsko postavljanje

Bilo koji VPS s 1 GB RAM-a (npr. Hetzner CX22, oko 4–5 € mjesečno) dovoljan je za početak.

1. **DNS:** A (i AAAA) zapis za `ontale.eu` i `www.ontale.eu` na IP poslužitelja.
2. **Poslužitelj:** instaliraj Node.js 24 LTS i Caddy. Kopiraj projekt u `/opt/ontale`, stvori korisnika `ontale`
   i daj mu mapu `/opt/ontale/data`.
3. **Konfiguracija:** `cp .env.example .env` pa upiši `SECRET` (`openssl rand -hex 32`), `BASE_URL=https://ontale.eu`,
   `TRUST_PROXY=1`, `ADMIN_EMAILS=tvoj@e-mail`.
4. **Baza:** `npm run seed -- --start=GGGG-MM-DD` (datum prvog izazova), zatim se registriraj na stranici e-mailom iz
   `ADMIN_EMAILS` ili pokreni `npm run admin`.
5. **Servis:** `deploy/ontale.service` → `/etc/systemd/system/`, pa `systemctl enable --now ontale`.
6. **HTTPS:** `deploy/Caddyfile` → `/etc/caddy/Caddyfile`, `systemctl reload caddy`. Certifikat stiže sam.
7. **Kopije:** `deploy/ontale-backup.cron` → `/etc/cron.d/`. Kopije povremeno prebaci i izvan poslužitelja.

Alternativa: `docker compose -f deploy/docker-compose.yml up -d --build` (baza je u volumenu `ontale-data`).

**Google prijava:** Google Cloud Console → Credentials → OAuth client ID (Web application); Authorized redirect URI
`https://ontale.eu/api/auth/google/callback`; upiši `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET` u `.env` i ponovno pokreni
servis. Bez tih vrijednosti gumb se ne prikazuje.

**Karta (v2.3):** Admin → *Karta i podloge*. Reljef radi bez ključa (OpenFreeMap + Mapzen Terrain Tiles). Za Satelit u
produkciji upiši `MAPTILER_KEY` ili `STADIA_API_KEY` u `.env` i ograniči ključ na domenu u sučelju pružatelja — upute i cijene u
[`docs/MAP_PROVIDERS.md`](docs/MAP_PROVIDERS.md). Domene pločica automatski ulaze u Content-Security-Policy.

**E-mail (v2.3):** upiši SMTP podatke u `.env` (vidi `.env.example`), postavi SPF/DKIM za domenu pošiljatelja i pošalji probni
e-mail iz *Admin → Obavijesti i e-mail*. Bez SMTP-a sve obavijesti rade u aplikaciji, a e-mail se ne šalje.

**Zakazani poslovi (v2.3):** poslužitelj ih sam pokreće svakih 5 minuta (stanje je u bazi, restart ništa ne šalje dvaput).
Ako više instanci dijeli bazu ili želiš cron: `JOBS=off` u `.env` i `deploy/ontale-jobs.cron` → `/etc/cron.d/`. U Dockeru
nije potrebno ništa dodatno.

## Što treba znati prije objave

Deployment **nije** obavljen — za njega trebaju tvoj poslužitelj, domena i ključevi. Uz to:

1. **Karta (v2.3):** stilovi Reljef i Satelit (EOX) iscrtani su s pravim pločicama u pravom pregledniku (snimke u
   `docs/snimke/v23-karta-*.jpg`). MapTiler i Stadia satelit nisu provjereni jer nema ključeva — provjeri nakon upisa ključa.
   Ako u kutu karte piše „Shematski prikaz”, karta se nije učitala (vidi konzolu preglednika).
2. **Izvorni kviz (19 Word dokumenata, oko 800 pitanja)** je pregledan. To su pitanja s jednim točnim odgovorom, pa
   ne odgovaraju otvorenim pitanjima s mnogo odgovora; iskoristive su brojčane kategorije (Brojalica, Pitanje
   procjene). Iz njih je deset novih procjena (pozicija 10) i četiri iz prve verzije. Ostatak sadržaja je nov.
   **Dani 11–20 nisu pripremljeni** — vidi `docs/FAZA2.md`, odjeljak „Što nije napravljeno”.
3. **Točke za ručnu provjeru sadržaja:** pobjednik US Opena 2026. u muškoj konkurenciji nije bio dostupan na izvoru (tiče se
   pitanja o Grand Slam pobjednicima i o Masters pobjednicima bez Grand Slama); stariji igrači u pitanju Real/Barcelona
   preuzeti su s jednog izvora; sastavi olimpijskih pobjednika u rukometu potvrđeni su za većinu, ne za svako ime.
   Sve je to zapisano uz pitanje u polju „Napomena o provjeri”. Liste koje se mijenjaju (golovi, bodovi, ljestvice) imaju
   u tekstu pitanja datum stanja.
4. **Zaboravljena lozinka:** aplikacija od v2.3 zna slati e-mail (podsjetnici), ali reset lozinke i dalje ide ručno. Administrator u kartici korisnika stvara poveznicu za novu lozinku
   (vrijedi 48 sati) i šalje je korisniku. Slanje e-pošte traži SMTP uslugu i može se dodati naknadno.
5. **Pravni tekstovi** (pravila, privatnost, uvjeti) su napisani i uređuju se u adminu, ali nisu pravni savjet: prije objave
   upiši tko je voditelj obrade i daj ih na pregled. Kontakt adresa `kontakt@ontale.eu` je zadana vrijednost — promijeni je.
6. **Fontovi i MapLibre** učitavaju se s CDN-a (Bunny Fonts, unpkg). Za potpunu neovisnost preuzmi ih u `public/` i promijeni
   dvije poveznice u `public/index.html`, `public/admin.html` i `public/karta.js`.
7. **Nakon desetog dana** nema novih izazova dok ih ne dodaš — nadzorna ploča upozorava kad ostane manje od tri pripremljena dana.
