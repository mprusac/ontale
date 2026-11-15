# Ontale 2.1 — završne dorade i napredne lige

Ništa u pravilima, bodovanju ni kilometrima nije mijenjano. Shema baze je ista (nema nove migracije); vrijeme
odgovora (`player_answers.answer_ms`) bilježi se od verzije 2.

- **Logotip** „Ontale“ (postavka `logo_text`; nadogradnja je mijenja samo ako je bila zadana).
- **Karta**: aktivna država je zeleno istaknuta i mijenja se pri prelasku granice (`countryAt`); poligoni država su
  Natural Earth 1:50m, učitavaju se s jsDelivr CDN-a (na vrlo velikom uvećanju granica odstupa od podloge do
  kilometar-dva). Dionice između postaja imaju vlastite boje (`segmentsOf`, i MapLibre i SVG). Atribucija
  OpenStreetMapa je skupljena u malu oznaku.
- **Dolazak u grad**: obavijest iznad karte (udaljenost, grad, poruka, zastava na granici); više postaja u jednom
  skoku ide redom; ne prikazuje se pri osvježavanju.
- **BiH ruta**: Novi Travnik, Vitez, Busovača, Široki Brijeg, Ljubuški (cilj 1.000 km i nastavak 1.250 km isti).
  `src/upgrade.js` (verzija podataka 3) mijenja rutu samo ako nije ručno uređivana, uz kopiju baze.
- **Naslovnica**: 📍 grad dolaska; kategorije u jednom nizu bez brojača.
- **Poziv u ligu**: prozor s kodom i poveznicom, Web Share / kopiranje; `/liga/KOD` vraća Open Graph podatke
  (naslov s nazivom lige, opis, `og-liga.png`).
- **Liga** (`GET /api/leagues/:id/stats?period=danas|tjedan|mjesec|ukupno|rendgen&map=&date=&month=`, sve na
  poslužitelju u `src/ligastat.js`): utrka na vodoravnoj ruti, tjedni/mjesečni/ukupni poredak i grafovi, Rendgen
  (meta, metrike, dvoboji — ista karta i dan, „ti prema ligi“, mjesto po danima), nagrade dana, odgovori ekipe,
  legende (30 dana, najmanje 3 odgovora), dvorana slavnih (dovršeni tjedni, ponedjeljak–nedjelja).
- **Spoileri**: tuđe odgovore i nagrade za kartu vidiš tek kad je sam odigraš ili kad dan završi.

Testovi: `npm test` 55, `npm run test:e2e` 23 koraka (uključuje provjeru prelijevanja na 375, 390, 430, 768, 1024
i 1440 px).

## 2.2 — dorade nakon povratnih informacija
- **Kartica dolaska** ne ponavlja naziv grada u rečenici (naziv je samo u naslovu).
- **Karta**: uklonjeno zeleno isticanje države (poligon nije točno pratio granicu). Ostaje tamna vektorska podloga
  (OpenFreeMap „dark“) i obojene dionice rute.
- **Kategorije** na naslovnici: jedan red bez trake za pomicanje; „Borilački“ umjesto „Borilački sportovi“; na
  mobitelu se prikazuju samo emojiji (puni nazivi na širem zaslonu).
- **Procjene** se predaju jednim pritiskom, kao svaki odgovor; točan broj se otkriva odmah nakon predaje (i na
  rezultatu). Uklonjen je korak „spremi pa zaključi“. Istek bez upisane procjene i dalje daje 0 km.
