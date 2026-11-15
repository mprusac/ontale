# ONTALE — druga faza razvoja (tehnička dokumentacija)

Stanje: 13. 11. 2026. Sve je ugrađeno u postojeći projekt (Node.js bez npm ovisnosti, ugrađeni SQLite, klijent bez
koraka izgradnje). Ništa nije prepisano na drugi okvir.

## 1. Tajmeri pitanja (mjerodavan je poslužitelj)

Postavke `game` (admin → Postavke → Tijek igre): `prep_seconds` 5, `answer_seconds` 30, `retries` da,
`max_attempts` 15, `grace_ms` 1500, `numeric_timeout` `spremljena`, `questions_per_day` 10.

Partija (`game_sessions`) pamti sat trenutnog pitanja: `q_started_at`, `q_prep_end`, `q_deadline` (milisekunde) i
`q_draft` (zadnja spremljena procjena).

| Zahtjev | Što radi |
|---|---|
| `POST /api/game/start` | nalazi ili stvara partiju; ako nijedno pitanje ne teče, pokreće sat |
| `POST /api/game/:id/next` | pokreće sljedeće pitanje; ako sat već teče, ne radi ništa (ne vraća ga na početak) |
| `GET /api/game/:id` | stanje + `timing {now, started_at, prep_end, deadline}`; ako je rok prošao, prvo zaključi pitanje |
| `POST /api/game/:id/answer` | `{position, answer, final}` — vidi tablicu ishoda |

Ishodi slanja odgovora:

| Situacija | Odgovor poslužitelja | Što se upisuje |
|---|---|---|
| prije kraja pripreme | HTTP 425 `too_early` | ništa |
| dvosmislen unos (dva sportaša istog prezimena) | `ambiguous`, poruka | ništa — ne troši ni pokušaj |
| neprepoznat odgovor | `retry`, „To nije taj odgovor. Pokušaj ponovno!“ | red u `answer_attempts`; pitanje ostaje otvoreno |
| prepoznat odgovor | `result` | jedini red u `player_answers` (`status = tocno`), jedan glas za rijetkost |
| procjena | `saved` (može se mijenjati) | samo `q_draft` |
| procjena s `final: true` | `result` | red u `player_answers` |
| nakon roka + tolerancije | `timeout`, `result` sa `status = isteklo`, 0 km | red u `player_answers`; procjena: vrijedi zadnja spremljena |
| ponovljeni zahtjev za zaključeno pitanje | `duplicate` + isti `result` | ništa |

Jamstva (pokrivena testovima u `test/tajmeri.test.js`): osvježavanje stranice i ponovni `start` ne produljuju
vrijeme; neprepoznati pokušaji ne ulaze ni u učestalost ni u kilometre; jedan konačni zapis po pitanju
(`UNIQUE(session_id, position)` + transakcija); istovremeni zahtjevi daju jedan zapis i jedan glas; nakon isteka igra
čeka „Dalje“ i nikad sama ne preskače pitanje; između pitanja sat ne teče.

Klijent računa razliku između svog i poslužiteljeva sata iz svakog odgovora (`timing.now`) i crta okvir polja za
upis: tijekom pripreme se okvir iscrtava, tijekom odgovaranja nestaje; na 10 s postaje narančast, na 5 s crven i
pulsira, na isteku se polje zaključava. Ishod isteka dohvaća se s poslužitelja nakon tolerancije.

## 2. Deset pitanja

`game.questions_per_day` je zadani broj (10). Aktivan dnevni izazov s drukčijim brojem pitanja admin odbija
(HTTP 409 `needs_allow_size`) dok se iznimka izričito ne potvrdi. Partija pamti vlastiti `question_count`, pa
izazovi različite veličine rade bez posebnih slučajeva (testirano s 8 i 10).

## 3. Model udaljenosti — odluka

Zadržan je **postojeći sustav virtualnih kilometara**, na izričit zahtjev: cilj je 1.000 km, sedam razina prijevoza
i ista logika dodjele (12–220 km). Ne koriste se najkraće cestovne rute ni OSRM.

- Kilometri igre nisu cestovni kilometri. Točke rute dobivaju kilometre razmjerno zračnoj duljini dionica, razvučeno
  na `routes.total_km` (do cilja) i `routes.ext_km` (iza cilja).
- Rute su namjerno široke: HR ide Vukovar → Osijek → Podravina → Varaždin → Zagreb → Rijeka → Pula → Cres → Krk →
  Senj → Lika → Dalmacija → Dubrovnik; BiH ide Bijeljina → Posavina → Krajina → Livno → srednja Bosna → Sarajevo →
  Podrinje → istočna Hercegovina → Mostar → Neum.
- Usporedba s uzorom: Dokle ima cilj na 1200 km i 8 pitanja; ONTALE 1000 km i 10 pitanja, pa je cilj dostižniji
  (prosječno 100 km po pitanju), a najbolji mogući rezultat (10 × 220 = 2200 km) stane u produženu rutu (2250 km).
- `routes.real_km` je stvarna cestovna udaljenost, samo kao informacija u adminu.
- Sve se uređuje u adminu: kilometri do cilja i iza njega (Karte), kilometri i pragovi po prijevozu (Prijevoz),
  pragovi procjena i parametri rijetkosti (Postavke).

## 4. Nastavak rute iza cilja

`route_checkpoints.is_goal` označava glavno odredište; točke iza njega su nastavak. `cities.country` je država točke,
`cities.label = 'granica'` označava granični prijelaz. `routeFor()` vraća `total_km` (cilj), `end_km` (kraj karte) i
`goal_index`; `locate()` više ne staje na cilju i vraća `beyond`, `country`, `at_end`.

- HR: Dubrovnik → Debeli Brijeg (granica) → Herceg Novi → Kotor → Budva → Bar → Ulcinj → Podgorica → Nikšić →
  Žabljak → Pljevlja → Bijelo Polje → Berane.
- BiH: Neum → Zaton Doli (granica) → Ston → Dubrovnik → Korčula → Hvar → Split → Šibenik → Zadar → Senj → Rijeka → Pula.

Nastavak nije upisan u klijentski kod: dolazi iz baze i uređuje se u adminu (država, cilj, granica, kilometri iza
cilja; popis država sa zastavama). Dodatnih pitanja nema — dalje se stiže samo boljim odgovorima.

## 5. Karta

`public/karta.js`: `createRouteMap(el, route, style)` → `setMe`, `travel`, `setMode('follow' | 'overview')`,
`setRivals`, `destroy`.

- Prava karta: MapLibre GL 4.7.1 + tamni vektorski stil OpenFreeMap (`map_style: 'tamna'`), uz atribuciju
  OpenStreetMap. Stil se nakon učitavanja utišava (podloga, more, slabije ceste, bez POI oznaka).
- Putanja se zaglađuje (Catmull-Rom) i svaka njezina točka nosi virtualni kilometar.
- `travel()`: marker s emojijem prijevoza klizi po ruti, prijeđeni dio se iscrtava, brojač kilometara raste, kamera
  prati i na duljim skokovima se odmakne pa vrati, na kraju se smiri; trajanje 1,7–5,2 s ovisno o duljini skoka.
- `prefers-reduced-motion`: bez animacije, položaj se samo postavi.
- Rezervni prikaz: SVG shema iste rute, s istom animacijom i kamerom, **uvijek označena natpisom „Shematski prikaz
  — karta u pozadini nije učitana“**.

## 6. Baza: migracija i nadogradnja podataka

- `migrations/002_tajmeri_rute.sql` — samo dodaje stupce i tablicu `answer_attempts`; stari netočni odgovori
  prepisuju se u pokušaje (da prijave i „nepoznati odgovori“ rade i za stare partije). Ništa se ne briše.
- Prije prve nove migracije na bazi s podacima sprema se kopija: `data/backups/ontale-prije-002_…db`.
- `src/upgrade.js` (pri startu poslužitelja, jednom; `settings.data_version = 2`): još jedna kopija, zatim u jednoj
  transakciji: postavke igre, slogan i pravila (samo ako ih administrator nije mijenjao), nove rute (samo ako su
  bile zadane), nova pitanja i dopuna postojećih dana na 10 pitanja (pitanja se dodaju na kraj; dovršene partije
  ostaju na 8 pitanja, nedovršene se produljuju na 10).
- Test `test/nadogradnja.test.js` radi nad bazom stvorenom kodom prve verzije (`test/fixtures/v1.db`) i uspoređuje
  korisnike, partije, odgovore, učestalosti, lige i prijave prije i poslije.

## 7. Admin

Postavke → **Tijek igre** (pitanja po danu, priprema, vrijeme, pokušaji, ponašanje procjene pri isteku, poruke) ·
**Karte i gradovi** (cilj, država, granica, kilometri do cilja i iza cilja, stvarna udaljenost, popis država) ·
**Prijevozna sredstva** (pregled: naslovnica, ishod, marker) · **Dnevni izazovi** (oznaka pogrešnog broja pitanja,
potvrda iznimke, „Složi sljedeći dan iz neraspoređenih pitanja“ — sprema neaktivan nacrt) ·
**Kvaliteta sadržaja** (dvostruka pitanja, premalo odgovora, bez aliasa, bez izvora, davno provjereno,
neraspoređeno) · **Nepoznati odgovori** sada pokazuju sve neprepoznate pokušaje.

## 8. Testovi

`npm test` — 51 test (17 logika, 17 API, 13 tajmeri/ruta/admin, 1 nadogradnja, 3 sadržaj).
`npm run test:e2e` — 22 koraka u Chromiumu (Playwright) s pravim tajmerima; snimke u `test/snimke/`.

## 9. Što nije napravljeno

1. **Prava karta nije provjerena u pregledniku s internetom** (vidi README). Provjeren je shematski prikaz.
2. **Dani 11–20 (još 100 pitanja) nisu pripremljeni.** Za dane 1–10 dodano je 20 pitanja. Novi dani se slažu u
   adminu iz neraspoređenih pitanja; uvoz ide kroz CSV/JSON.
3. Izvorni kviz ne sadrži otvorena pitanja s više točnih odgovora, pa otvorena pitanja nisu mogla biti preuzeta iz
   njega; preuzete su procjene.
4. Dokleove stranice iza prijave (lige, statistika, arhiva, profil) nisu pregledane.
5. Približan pogodak se prihvaća bez potvrde „Misliš na …?“; brzina odgovora ne utječe na kilometre.
6. Dovršene partije odigrane prije nadogradnje ostaju na 8 pitanja; taj dan na ljestvici stoje uz partije od 10.
