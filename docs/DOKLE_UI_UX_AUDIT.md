# Dokle.eu — pregled sučelja i iskustva (UI/UX audit)

Pregled je napravljen 13. 11. 2026. u ugrađenom pregledniku aplikacije Claude na autorovu računalu, u već otvorenoj
kartici `dokle.eu`. Cilj: razumjeti strukturu, hijerarhiju, proporcije, tijek igre i ponašanje karte, pa po tom uzoru
preurediti ONTALE — bez preuzimanja koda, logotipa, ilustracija ili drugih zaštićenih materijala.

## 1. Što je pregledano, a što nije

| Stranica / stanje | Pregledano | Napomena |
|---|---|---|
| Početni zaslon dnevne igre (HR, BiH, RS) | da | kao gost |
| Pitanje: priprema (5 s) | da | |
| Pitanje: odgovaranje, tajmer, zadnje sekunde | da | |
| Neprepoznat odgovor / ponovni pokušaj | da | |
| „Misliš na …?“ (približan pogodak) | da | |
| Točan odgovor, putovanje po karti | da | |
| Istek vremena | da | |
| Rezultat: karta, znak dolaska, usporedba, popis odgovora, dijeljenje | da | HR partija koja je već bila odigrana u toj kartici (603 km) |
| „Biser dana“, „Glas naroda“ | da | |
| Mobilni prikaz (375 px) i računalo (1366 px) | da | emulacijom širine prozora |
| Stranica profila | djelomično | neprijavljenom gostu prikazuje samo karticu za Google prijavu |
| Lige, ljestvica lige, statistika, niz dana, arhiva | **ne** | traže Google prijavu ili Plus; kartica nije bila prijavljena |

Ograničenja koja treba imati na umu:

- Kartica **nije bila prijavljena** u Dokle račun, pa ništa iza prijave nisam mogao vidjeti. O tim dijelovima ne
  donosim nikakve zaključke.
- Da bih vidio stanja pitanja, odigrao sam dio partije na karti Srbije kao gost. Dokle drugu državu istog dana vodi
  kao partiju „iz zezanja“ koja se ne računa, pa nije promijenjen ničiji rezultat ni osobni podatak. Ta je partija
  ostala nedovršena na drugom pitanju.
- Mjere su očitane iz izračunatih stilova u pregledniku (zaokružene). Izvorni kod nije preuzet ni kopiran.

Referentne snimke zaslona su u `docs/dokle/` (14 datoteka):
`01-rezultat-mobitel`, `02-popis-odgovora`, `03-biser-glas-naroda`, `04-pocetni-zaslon`, `05-pitanje-tajmer`,
`06-zadnje-sekunde`, `07-istek-vremena`, `08-priprema`, `09-mislis-na`, `10-putovanje`, `11-pocetni-zaslon-bih`,
`12-igra-racunalo`, `13-ontale-prije` (ONTALE v1 na istom računalu), `14-profil-prijava`.

## 2. Vizualni sustav

- **Tamna tema** je jedina tema. Podloga `#161d1f` (zelenkasti ugljen), kartice `#1f282b`, linije `#2f3b3e`,
  tekst `#eef3f1`, prigušeni tekst `#9fb0ad`.
- **Semantičke boje**: zelena prometnog znaka `#0a6a3b` (logo, glavni gumb, znak dolaska, putokaz), signalna žuta
  `#f2b200` (kilometri, traka vremena, isticanje), crveno-narančasta `#e2572b` (istek, upozorenje), plava mora `#6aa8cc`.
- **Pismo**: obitelj nalik pismu Overpass (prometna signalizacija) u težinama 400/600/800/900; kilometri i meta
  podaci u jednoširinskom pismu; logo je „pločica mjesta“ sa suženim pismom.
- Nema gradijenata kao ukrasa, sjaja ni stakla. Hijerarhiju nose veličina i težina pisma te dvije boje.

## 3. Raspored i proporcije

| Element | Mjera |
|---|---|
| Najveća širina stranice (`.wrap`) | 1120 px, razmak među blokovima 16 px, rub 16 px |
| Zaglavlje | visina ≈ 53 px; logo pločica ≈ 143 × 53 px, polumjer 4 px |
| Meta u zaglavlju | jednoširinsko pismo, dva reda: „#12 · 13. 11. 2026.“ / „Subotica → Vranje · 1200 km“ |
| Gumbi-ikone u zaglavlju | 42 × 42 px, polumjer 10 px, podloga kartice |
| Karta (`.stage`), računalo | 1120 × 416–439 px, polumjer 18 px |
| Ploča pitanja | najviše 760 px, centrirana, razmak 14 px |
| Polje za odgovor | visina 64 px, podloga kartice, rub 2 px zelen, polumjer 12 px, pismo 22 px / 700 |
| Gumb za slanje | polumjer 12 px, pismo 18 px / 900, zelen |
| Red u popisu odgovora | ≈ 65 px |
| Obavijest na karti | polumjer 14 px; kilometri 22 px jednoširinski, žuti |

Na računalu je karta gore preko cijele širine, a pitanje ispod u **užem središnjem stupcu** — polje za odgovor
nikad nije razvučeno preko cijelog zaslona. Na mobitelu (375 px) karta zauzima gornji dio, a ploča pitanja je tamni
„donji list“ ispod nje.

## 4. Komponente

- **Zaglavlje**: logo, redni broj dana i datum, ruta dana, odabir države, prijava.
- **Početni zaslon**: velika pločica s logom; ruta u žutom jednoširinskom pismu („Bijeljina → Neum · 1200 km“);
  rečenica „8 kategorija, za svaku jedan odgovor…“; sedam okruglih znački prijevoza s kilometrima; traka spektra
  „češći odgovor — rjeđi odgovor →“; zeleni gumb „Kreni iz Bijeljine“; sklopiva „Pravila“.
- **Karta**: vlastiti tamni reljefni prikaz s imenima gradova. Natpisi preko karte: gore lijevo bijela pilula
  (trenutačno mjesto + „N km od Vukovara“), gore desno zeleni putokaz sa sljedećih 1–3 grada i kilometrima, dolje
  desno prekidač „Kamera prati / Cijela ruta“, dolje u sredini tamna obavijest o zadnjem odgovoru.
- **Ploča pitanja**: gore kategorija i „1 / 8“; naslov pitanja 20 px podebljano; pojašnjenje sa žutim lijevim rubom;
  žuta traka vremena koja se skraćuje (u zadnjim sekundama crvena); „21 s“ jednoširinski + „Rjeđi odgovor = brži
  prijevoz“; polje i gumb; pomoćni tekst.
- **Rezultat**: karta s ponavljanjem vožnje; „KRAJ PUTA ZA DANAS“ + „Nova ruta za 10 h 52 min“; zeleni znak dolaska
  („Vukovar → 603 km“, ime mjesta 34 px / 900, „Najbliži veći grad: Gospić, 17 km“); kartica usporedbe „Stigao si
  dalje od 77 % igrača“ s histogramom „Gdje su danas stali igrači“; redovi odgovora (značka prijevoza, kategorija,
  odgovor, +km, proširivo; „Nepriznato: …“); blok teksta za dijeljenje + „Podijeli rezultat“; „Biser dana“;
  „Glas naroda“ (najčešći odgovori s postocima); okvir za prijavu.

## 5. Tijek igre

1. Početni zaslon → „Kreni iz …“.
2. **Priprema**: pitanje je vidljivo, polje je isključeno („Pročitaj pitanje…“), piše „Vrijeme kreće za 5“.
3. **Odgovaranje** (25 s po kategoriji): Enter šalje. Ako odgovora nema na popisu, tekst ostaje u polju i igrač
   pokušava ponovno dok traje vrijeme.
4. Približan pogodak: „Misliš na X?“ s gumbima „Potvrdi“ / „Ne, pošalji „…““.
5. **Točan odgovor**: marker postaje značka prijevoza, prijeđeni dio rute crta se narančasto, kamera prati; obavijest
   „Abesinska · Lasta — 0,5 % igrača +84 km“; u ploči „Prošao si: Sombor“ i gumb „Dalje“.
6. **Istek vremena**: „🚧 „X“ još nemamo na spisku. Radovi na putu +0 — Ako je točan, na kraju igre možeš ga
   prijaviti.“ + „Dalje“; marker postaje trokut upozorenja. Igra **ne preskače sama** na sljedeće pitanje.
7. Nakon zadnjeg pitanja → rezultat.

Pravila kako ih Dokle sam navodi: vrijeme kreće 5 s nakon što se pitanje pojavi; jedan odgovor po kategoriji, a ako
nije na popisu pokušava se dok traje vrijeme; brži odgovor donosi više; bez odgovora „radovi na putu“ (0 km); iste
kategorije za sve; nova ruta u ponoć. Druga država istog dana igra se „iz zezanja“ (isprekidani žuti okvir i oznaka).

## 6. Karta i udaljenosti

- Ruta HR: Vukovar → Dubrovnik, **cilj na 1200 km**; BiH i Srbija također 1200 km.
- Kilometri su **kilometri igre, ne cestovni**: Osijek je prikazan 60 km od Vukovara (cestom je ≈ 35 km), a ruta
  namjerno obilazi (na histogramu: Zagreb ≈ 290, Pula ≈ 530, Split ≈ 870, Dubrovnik 1200).
- Istih sedam vrijednosti kilometara po prijevozu kao u ONTALE-u (12, 30, 54, 84, 120, 150, 220).
- **Dokle već vozi dalje od cilja**: histogram ide do ≈ 2300 km, s oznakom Budve na ≈ 1700 km i natpisom „najdalje
  2288 km (Budva)“.
- Prijelazi: marker klizi po ruti, prijeđeni dio se iscrtava, kamera prati i na kraju se smiri; na rezultatu se
  vožnja ponavlja u petlji.

Uočeni mrežni pozivi (samo nazivi, radi razumijevanja tijeka): `/api/me`, `/api/game?all=1`, `/api/game/start`,
`/api/game/answer`, `/api/game/preview`, `/api/game/compare`, `/api/game/glas`, `/api/game/biseri`.

## 7. Dokle i ONTALE (prije i poslije)

| Tema | Dokle | ONTALE v1 (prije) | ONTALE sada |
|---|---|---|---|
| Tema | tamna | svijetla, „znakovi“ s debelim crnim rubovima | tamna, vlastita paleta (asfalt `#0f141a`, zeleni putokaz `#0c7a55`, žuta `#ffc928`) |
| Raspored igre | karta gore, uža ploča pitanja | karta + pitanje u jednom stupcu, polje preko cijele širine | karta gore (do 1120 px), ploča 760 px, polje za odgovor ≤ 620 px |
| Početni zaslon partije | da | ne (sat bi krenuo odmah) | da — sat kreće tek na gumb |
| Priprema | 5 s | nema | 5 s (podesivo), provjerava poslužitelj |
| Vrijeme za odgovor | 25 s, traka | nema ograničenja | 30 s (podesivo); **okvir polja za upis** nestaje, boja se mijenja na 10 s i 5 s |
| Netočan odgovor | pokušaj ponovno | odmah 0 km i sljedeće pitanje | „To nije taj odgovor. Pokušaj ponovno!“, pitanje ostaje |
| Istek | 0 km + „Dalje“ | — | 0 km, jasno stanje, „Dalje“ |
| Broj pitanja | 8 | 8 | **10** |
| Cilj | 1200 km | 1000 km | 1000 km (zadržano na izričit zahtjev) |
| Vožnja iza cilja | da (do Budve) | ne — položaj je stajao na cilju | da: HR → Crna Gora, BiH → Hrvatska, do 2250 km |
| Natpisi na karti | mjesto, putokaz, kamera, obavijest | nema | mjesto + km, putokaz sa sljedeće 3 postaje, kamera, obavijest |
| Rezultat | znak dolaska, histogram, popis, dijeljenje | brojka, popis | znak dolaska, histogram, popis s proširenjem, kartica rezultata, ponavljanje vožnje |
| Zastave | — | emoji; na Windowsima ispisano „HR“/„BA“ | nacrtane (SVG) |

Što je namjerno **drukčije** od Doklea: vlastita paleta i logo; tajmer je okvir polja, a ne traka; približan pogodak
se prihvaća bez pitanja „Misliš na …?“, a dvosmislen unos (dva sportaša istog prezimena) traži da se dopiše ime;
brzina odgovora ne utječe na kilometre (broji se samo rijetkost); karta je prava kartografska podloga (OpenStreetMap
podaci preko OpenFreeMap pločica) umjesto vlastite ilustracije.

## 8. Što u ONTALE v1 nije valjalo (viđeno na autorovu računalu)

1. Zastave su se na Windowsima ispisivale kao slova „HR“ i „BA“ (Windows nema emoji zastave).
2. Pismo se nije učitavalo: pravilo CSP-a dopuštalo je `fonts.bunny.net`, a datoteke pisma stižu s
   `cdn.jsdelivr.net`.
3. Svijetla tema s debelim crnim rubovima djelovala je zastarjelo i pretrpano u odnosu na uzor.
4. Polje za odgovor bilo je razvučeno preko cijele širine stupca.
5. Nije bilo ni pripreme ni vremenskog ograničenja, a netočan odgovor je odmah zaključivao pitanje.
6. Položaj na karti bio je ograničen na cilj; karta nije pratila igrača niti je prikazivala putovanje.
