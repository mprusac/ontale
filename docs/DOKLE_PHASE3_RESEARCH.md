# Dokle — istraživanje za ONTALE v2.3 (faza 3)

Datum: 14. 11. 2026. Istraživanje je napravljeno u stvarnom pregledniku (ugrađeni preglednik aplikacije Claude) na https://dokle.eu.

## Ograničenja — što NIJE pregledano

Iskreno, da se ne miješa provjereno s pretpostavljenim:

- **Postojeća kartica s Dokle u tvom Chromeu nije bila dostupna** ovoj sesiji (zakazani zadatak nema pristup tvojoj grupi kartica). Otvoren je nov, **neprijavljen** preglednik. Zato nisu viđene stranice koje traže Google prijavu: liga, utrka lige na karti, profil, putokaz u stvarnoj ligi, Dokle Više? dodaci.
- **Zvukove nisam mogao čuti.** Automatizirani preglednik nema zvučni izlaz koji bih mogao slušati. Umjesto slušanja pročitao sam javni klijentski kod (JavaScript koji preglednik ionako preuzima) i iz njega zapisao kad se koji zvuk pušta, kako se sintetizira (oscilator, frekvencije, trajanje) i kako radi isključivanje zvuka. Opisi „karaktera“ zvuka u `AUDIO_REFERENCE.md` izvedeni su iz tih parametara, ne iz slušanja.
- **Snimka zaslona s porukom iznad markera** („aj livaja dobro te je“) koju spominješ **nije bila u mapi projekta** ni u ZIP-u — u mapi `docs/dokle/` postoje samo ranije snimke (01–14). Izgled putokaza zato je izveden iz Dokleova koda (oblik znaka, boje, ograničenja) i opisa u zadatku.
- Privatne poruke, obavijesti, izazovi među prijateljima i tjedne/mjesečne nagrade **ne postoje u Dokleovom javnom kodu** (pretraženi svi učitani JavaScript paketi i rječnik prijevoda). To su nove ONTALE značajke, ne preslika.

## Dopuna 14. 11. 2026. — pregled u tvom prijavljenom Chromeu (liga „Bučići“)
- Utrka lige: vodoravna traka Vukovar → Dubrovnik, avatari članova iznad crte, tvoj ispod crte; putokaz „aj livaja dobro te je“ (žuta tabla) stoji iznad tvog markera na „motki“. Iznad trake: gumb „🪧 Promijeni putokaz“ i „završilo 9 od 15“.
- Uređivač „Putokaz za danas“: oblici **Zelena tabla, Žuta tabla, STOP, Trokut**; poruka s brojačem (21/40); prijedlozi („Dalje ne može“, „Pazi, radovi“, „Tu sam ja stao“, „Sretno, trebat će ti“, „Ovdje vas sve čekam 🍺“, „Skretanje za slavu“); pregled na traci; „Postavi na 709 km“; „Makni putokaz“; napomena: „Ostali ga vide na traci lige kad odigraju današnju partiju. Nestaje u ponoć.“ — isto ponašanje kao ONTALE (ONTALE ima vlastite oblike i prijedloge).
- Zvukove ni ovdje nije bilo moguće slušati (automatizirani pristup nema zvučni izlaz).

## Što je stvarno viđeno

### Naslovnica i igra
- Ruta Vukovar → Dubrovnik, 1200 km; 8 kategorija, jedan odgovor po kategoriji.
- Sedam razina prijevoza (Pješice +12 … Milanovićev helikopter +220), traka „češći odgovor → rjeđi odgovor“.
- Karte: Hrvatska, BiH, Srbija; „Dokle Više?“ pretplata 2,99 €/mj. (ponovna igra, arhiva, druge karte, vlastiti prijevoz, zelena tabla na profilu). Napomena na stranici: *pretplata nikad ne daje više kilometara* — isto načelo vrijedi za ONTALE izazove i nagrade.
- **Karta nije pločasta web-karta**: Dokle koristi jednu unaprijed iscrtanu sliku reljefa (`/map/hr-reljef.webp`) i SVG sloj s rutom, granicom (SVG putanja) i natpisima država („SLOVENIJA“, „BOSNA I HERCEGOVINA“, „JADRANSKO MORE“…). Projekcija je Web Mercator izrezan na Hrvatsku. Zato izgleda „bogato“ i brzo se učitava, ali se ne može zumirati u detalje. ONTALE zadržava pravu MapLibre kartu (zum, praćenje kamerom) i dodaje reljef/satelit (vidi `MAP_PROVIDERS.md`).

### Putokaz (poruka na ruti) — iz koda i prijevoda
Tekstovi sučelja (hrvatski izvornik):
- „Putokaz za danas“, „Oblik znaka“, „Poruka“, „Što poručuješ ekipi?“, „Pregled“, „Tvoja poruka“, „Postavi na {n} km“, „Postavi putokaz“, „Promijeni putokaz“, „Makni putokaz“.
- Pravilo: **„Poruka: 1 do 40 znakova, bez linkova i psovki.“** Brojač znakova `N/40`, polje dopušta upis malo preko granice pa pokaže crveno.
- Oblik znaka: barem **zeleni** (tamnozelena podloga, bijeli rub — znak autoceste) i **žuti** (žuta podloga, crni rub). Uz polje su ponuđeni gotovi prijedlozi („chips“).
- Postavlja se **na kilometar do kojeg je igrač stigao** („Postavi na {n} km“), dakle nakon partije.
- **Zaštita od spoilera:** „Odigraj današnju partiju da vidiš putokaz.“ / „{x} je ostavio putokaz. Odigraj današnju partiju da ga vidiš.“
- Drugi ga mogu **sakriti za sebe**: „Sakriti ovaj putokaz za danas?“ / „Sakrij putokaz“.
- Vidljivost: „Vide je članovi tvojih liga: u tablici, na traci i u utrci na karti.“
- U Dokleu je putokaz dio pretplate („Putokaz uz Dokle Više?“). **U ONTALE je besplatan** (zadatak ga traži kao osnovnu društvenu značajku).

**Tok koji ONTALE preuzima:** kraj službene partije → kartica „Ostavi poruku na putokazu“ → oblik znaka + poruka + gotovi prijedlozi + pregled uživo → spremi/uredi/makni → poruka stoji iznad markera u utrci lige (vodoravna traka i karta), samo za taj dan, a vidi je tek tko je i sam odigrao tu kartu.

### Lige (iz prijevoda; stranice nisu otvorene)
- Tablica za danas, tjedan, mjesec i ukupno; utrka na karti; reakcije; „Sakrij utrku“.
- „Prvi pobjednik tjedna upisuje se u ponedjeljak.“, „osvojenih tjedana“, „Mjesto u tjednoj tablici“, „falilo ti je za {n}. mjesto ovaj tjedan“.
- Nagrade dana („Nagrade dana stižu kad danas odigra još netko iz lige.“), „Dvoboj: {x}“, „Ti prema ligi“, „Mjesto u ligi kroz zadnjih 30 dana“ — ONTALE sve to već ima (Rendgen, nagrade dana, dvorana slavnih).

### Zvuk — sažetak (detalji u `AUDIO_REFERENCE.md`)
- „Zvukovi su sintetizirani u pregledniku.“ Gotovo svi efekti nastaju Web Audio oscilatorima i filtriranim šumom; samo nekoliko je snimljenih MP3 isječaka.
- Snimljeni isječci postoje za dolazak u **Zagreb (Savski most), Šibenik, Rijeku, Split i Dubrovnik**, za orijentir **Gornje Jesenje** (efekt „sudara“) i za **helikopter**.
- Gumb „Uključi zvuk / Isključi zvuk“; stanje se pamti u `localStorage` (`dokle-mute`), dakle **trajno između posjeta na istom uređaju**. Glavna glasnoća 0,7; nema klizača glasnoće.
- Zvuk se „otključava“ prvim dodirom/klikom/tipkom (zahtjev preglednika), a kad se kartica sakrije, audio kontekst se pauzira.

## Što ONTALE iz ovoga uzima (i što ne)
| Dokle | ONTALE v2.3 |
|---|---|
| statična slika reljefa | prava karta s dva načina: Reljef (sjenčanje terena) i Satelit |
| putokaz 40 znakova, premium | putokaz 60 znakova (podesivo u adminu), besplatan, moderiran |
| sintetizirani efekti | vlastiti sintetizirani efekti + vlastiti kratki MP3 jinglovi gradova (generirani, bez tuđih snimki) |
| samo uklj./isklj. | uklj./isklj. + glasnoća + odvojeno igra/obavijesti, pamti se lokalno i na profilu |
| — | privatne poruke, obavijesti, e-mail podsjetnici, izazovi, tjedne i mjesečne nagrade |

Dokleove MP3 datoteke i kod **nisu kopirani** u ONTALE. Svi ONTALE zvukovi su izvorni (vidi `AUDIO_REFERENCE.md`, odjeljak Licence).
