# Zvuk — referenca (Dokle) i ONTALE inventar

## 1. Dokle: inventar zvukova

Izvor: javni klijentski JavaScript na dokle.eu, pregledan 14. 11. 2026. **Zvukovi nisu slušani** (automatizirani preglednik nema zvučni izlaz); karakter je opisan prema parametrima sinteze.

| Događaj | Okidač | Vrsta | Približno trajanje | Karakter |
|---|---|---|---|---|
| `count(false)` | svaka sekunda odbrojavanja pripreme | trokutasti ton 660 Hz | 0,2 s | kratak „bip“ |
| `count(true)` | kraj pripreme, polje se otvara | trokutasti ton 1320 Hz | 0,45 s | viši, dulji „kreni“ |
| `tick` | zadnjih 5 sekundi odgovora, svaka sekunda | kvadratni 1250 Hz | 0,05 s | oštar klik sata |
| `type` | tipkanje u polje | filtrirani šum (visokopropusni) | 0,03 s | tihi klik tipke |
| `wrong` | odgovor nije prepoznat | dva kvadratna tona 180→110 i 140→90 Hz | 0,4 s | „bzz-bzz“ |
| `correct` | točan odgovor | arpeggio 784–988–1319 Hz (trokutasti) | 0,45 s | vedri uzlazni zvončić |
| `miss` | 0 km / isteklo | silazna pila 392→311 Hz | 1,2 s | „wah-wah“ |
| `vehicle(tip)` | početak animacije putovanja, trajanje = trajanje animacije | ovisi o prijevozu | 1,7–5 s | pješice: koraci (niskopropusni šum); bicikl: zvonce + zujanje lanca; vlak: sirena + „tuk-tuk“ tračnica; bus/auto: motor koji ubrzava (pila+kvadrat kroz filtar); avion: šum mlaza koji raste; helikopter: MP3 + ubrzani rotor |
| `station` | prolazak kroz postaju (grad) | dva sinusa 1568 i 2093 Hz | 1 s | „ding-dong“ kolodvorskog razglasa |
| `clip(grad)` | dolazak u Zagreb, Šibenik, Rijeku, Split, Dubrovnik | MP3 isječak, 0,2 s nakon `station` | nepoznato (nije slušano) | posebni zvuk grada; nizaju se, ne preklapaju |
| `crash` + `clip` | orijentir Gornje Jesenje | pila + šum + MP3 | ~1 s | šaljivi „sudar“, uz trešnju karte |
| `finish` | kraj partije / kraj ponovljene vožnje | fanfara 523–659–784–1047–784–1047 Hz | ~1,4 s | pobjednička fanfara |
| `scream` | Noć vještica (jednom) | — | — | sezonska šala |

**Različiti gradovi imaju različite zvukove?** Djelomično: pet gradova ima vlastiti MP3, svi ostali dobivaju zajednički `station`.
**Može li se isključiti?** Da, gumb „Uključi/Isključi zvuk“.
**Pamti li se?** Da, `localStorage['dokle-mute']`, po uređaju. Glasnoća je fiksna (0,7), nema klizača.
**Autoplay:** audio se otključava prvim `pointerdown/touchend/click/keydown`; skrivanjem kartice kontekst se pauzira.

## 2. ONTALE: inventar zvukova (v2.3)

Svi ONTALE zvukovi su **izvorni**: ili ih preglednik sintetizira u trenutku (`public/zvuk.js`, Web Audio — nema preuzimanja),
ili su kratki MP3 isječci generirani matematičkom sintezom skriptom `scripts/zvukovi.py` (numpy/scipy + ffmpeg). Nijedan zvuk
nije snimljen, preuzet ni prerađen iz Doklea ili s drugih stranica.

| Događaj (admin ključ) | Zadani zapis | Kad svira | Trajanje | Karakter |
|---|---|---|---|---|
| start | synth:start | klik „Kreni“ | 0,7 s | paljenje motora + dva tona |
| count | synth:count | svaka sekunda pripreme | 0,09 s | tihi „bip“ 740 Hz |
| go | synth:go | kraj pripreme, polje se otvara | 0,4 s | dva uzlazna tona |
| tick | synth:tick | zadnjih 5 sekundi | 0,03 s | otkucaj sata |
| accept | synth:accept | točan odgovor | 0,4 s | uzlazni trozvuk |
| wrong | synth:wrong | neprepoznat pokušaj | 0,35 s | dvostruko „bzz“ |
| zero | synth:zero | 0 km / isteklo vrijeme | 0,65 s | silazni klizni ton |
| transport | synth:transport | dodijeljen prijevoz | 0,2–0,5 s | arpeggio, viša razina = više i više nota; razine 6–7 + iskrice |
| vehicle | synth:vehicle | dok marker putuje (trajanje = trajanje animacije) | 1,7–5 s | po razini: koraci, biciklističko zvonce, vlak, autobus (dizel), električni auto, avion (mlaz), helikopter (rotor koji ubrzava) |
| arrive | synth:station | dolazak u grad bez vlastitog zvuka | 1 s | dvotonski gong |
| border | file:granica | prelazak granice | 1,1 s | pečat u putovnici + dva tona |
| goal | file:cilj | prolazak cilja (1000 km) | 1,9 s | limena fanfara |
| beyond | synth:beyond | nastavak u drugu državu iza cilja | 1,3 s | uzlazni klizni ton + zvonce |
| finish | file:kraj | kraj partije (i kraj ponovljene vožnje) | 1,7 s | vedra kadenca |
| rare | synth:rare | rijedak odgovor (razina 6–7) | 0,4 s | iskrice |
| award | synth:award | stigla obavijest o osvojenoj nagradi | 1 s | jingle medalje |
| win | synth:win | stigla obavijest o pobjedi u izazovu | 1 s | pobjednička fanfara |
| message | synth:message | nova privatna poruka (prozivanjem ili u otvorenom razgovoru) | 0,3 s | mekani „pop“ |
| notify | synth:notify | nova obavijest | 0,7 s | dvotonsko zvonce |

### Zvukovi gradova (MP3, 9–20 kB svaki, ukupno ~150 kB)

| Datoteka | Karakter | Zadani gradovi |
|---|---|---|
| tramvaj.mp3 (1,6 s) | dvostruko tramvajsko zvonce, klik tračnica | Zagreb, Osijek, Sarajevo |
| brod.mp3 (1,5 s) | brodska sirena | Rijeka, Zadar, Ploče, Bar, Senj |
| zvona.mp3 (2,4 s) | tri udarca zvona | Dubrovnik, Šibenik, Kotor, Varaždin, Korčula |
| more.mp3 (2,2 s) | valovi i galeb (sintetizirani) | Makarska, Neum, Budva, Pula, Hvar, Ulcinj, Cres, Krk, Herceg Novi |
| planina.mp3 (2,6 s) | rog s jekom | Gospić, Žabljak, Bihać, Livno, Foča, Drvar |
| mandolina.mp3 (1,4 s) | trzani akord (Karplus–Strong) | Split, Mostar, Trebinje, Stolac |
| granica.mp3, cilj.mp3, kraj.mp3 | vidi gore | — |

Dodjela gradova mijenja se u administraciji (Zvuk → Gradovi), bez izmjene koda. Gradovi bez dodjele koriste „Dolazak u grad“.

## 3. Ponašanje i pravila

- **Isključivanje i glasnoća:** gumb 🔊/🔇 u zaglavlju; u profilu glasnoća te odvojeno „zvukovi igre“ i „zvukovi obavijesti“. Pamti se u `localStorage` (`ontale-zvuk`) i na računu (`user_prefs.sound_*`), pa vrijedi i na drugim uređajima. Isključen zvuk ne svira nikad; isključivanje odmah prekida sve što svira.
- **Autoplay:** audio kontekst nastaje i otključava se tek na prvi `pointerdown`/`keydown`/`touchend`. Do tada se ništa ne pušta (bez upozorenja preglednika).
- **Dolasci u grad** sviraju samo tijekom stvarne vožnje (animacija ili „Ponovi vožnju“). Otvaranje ili osvježavanje rezultata ne pušta zvukove (provjereno u e2e testu).
- **Bez preklapanja:** svaki događaj ima najmanji razmak ponavljanja; MP3 isječci se nižu jedan za drugim i u redu čekaju najviše dva (brz niz gradova ne postaje kakofonija).
- **Skrivena kartica** pauzira audio kontekst; odlazak sa stranice ne ostavlja zvukove koji sviraju.
- **Pristupačnost:** svaki zvuk prati vizualna obavijest (natpis dolaska, poruka, brojač, oznaka) — igra je potpuno razumljiva bez zvuka.
- **Performanse:** sintetizirani efekti ne preuzimaju ništa; unaprijed se (nakon otključavanja) učitavaju samo granica, cilj i kraj; zvukovi gradova učitavaju se kad zatrebaju.

## 4. Licence

| Zapis | Izvor | Licenca |
|---|---|---|
| svi `synth:*` | izvorni kod `public/zvuk.js` (ONTALE) | dio koda ONTALE |
| `public/zvukovi/*.mp3` | generirano `scripts/zvukovi.py` (ONTALE), bez ulaznih snimki | CC0 1.0 |
| zapisi koje doda administrator | upisuje se pri prijenosu (obavezno polje „licenca“) | prema upisu |

Dokleovi MP3 isječci (Savski most, Šibenik, Rijeka, Split, Dubrovnik, helikopter, Gornje Jesenje) **nisu** preuzeti ni korišteni — za njih nema dozvole za ponovnu uporabu.
