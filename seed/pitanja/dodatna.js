// DEVETO I DESETO PITANJE za dane 1–10 (dnevni izazov ima deset pitanja).
// Pozicija 9: dodatno otvoreno pitanje (sport se izmjenjuje iz dana u dan).
// Pozicija 10: druga procjena — sve preuzete iz autorova izvornog sportskog kviza (mapa "Sportski kviz/Baza pitanja",
//              kategorije BROJALICA i PITANJE PROCJENE); brojke su zatvoreni povijesni podaci.
// Otvorene liste su zatvorene povijesne liste (stanje zaključno s godinom navedenom u pojašnjenju pitanja).
// Na webu su 13. 11. 2026. provjereni podaci koji ovise o 2026.: prvaci liga 2025./26., najbolji strijelac SP-a 2026.
// te Karlovićevi asovi i servis. Ostalo su općepoznati podaci uz naveden izvor za provjeru.
const W = 'https://en.wikipedia.org/wiki/';
const L = 'Zatvorena povijesna lista; naveden izvor za provjeru.';
const K = 'Brojka iz autorova izvornog kviza; općepoznat povijesni podatak, naveden izvor za provjeru.';
const cilj = (value, unit, ref_date, tolerance_pct, extra = {}) => ({ value, unit, ref_date, tolerance_pct, scoring_mode: 'pragovi', tie_rule: 'dijele', is_estimate: 0, ...extra });

export default [
  // ---------------- Pozicija 9: otvorena pitanja ----------------
  {
    dan: 1, poz: 9, cat: 'nogomet', kind: 'team', diff: 2, provjera: 'Lista klubova prvaka do sezone 2025./26. (prvak Inter — provjereno na webu 13. 11. 2026.).',
    text: 'Navedi klub koji je bio prvak Italije u nogometu.',
    hint: 'Sva prvenstva od 1898. do sezone 2025./26. Počasni naslov Spezije iz 1944. se ne računa.',
    izvori: [['Wikipedia: List of Italian football champions', W + 'List_of_Italian_football_champions'], ['Lega Serie A — Albo d\'oro', 'https://www.legaseriea.it/it/serie-a/albo-d-oro']],
    odgovori: {
      A: ['Juventus#rekorder po broju naslova', 'Inter#prvak i 2025./26.', 'Milan'],
      B: ['Napoli#Maradonini naslovi 1987. i 1990., zatim 2023. i 2025.', 'Roma|AS Roma#1942., 1983. i 2001.', 'Lazio|SS Lazio#1974. i 2000.'],
      C: ['Torino|Grande Torino#Grande Torino četrdesetih', 'Fiorentina|ACF Fiorentina#1956. i 1969.', 'Sampdoria#1991., Vialli i Mancini', 'Genoa|Genoa CFC#prvi prvak, devet naslova do 1924.'],
      D: ['Bologna|Bologna FC#sedam naslova, zadnji 1964.', 'Hellas Verona|Verona#senzacija 1985.', 'Cagliari#1970., Gigi Riva'],
      E: ['Pro Vercelli#sedam naslova do 1922.'],
      F: ['Casale#1914.', 'Novese#1922., prvenstvo saveza FIGC'],
    },
  },
  {
    dan: 2, poz: 9, cat: 'kosarka', kind: 'team', diff: 3, provjera: L,
    text: 'Navedi klub koji je bio prvak Jugoslavije u košarci.',
    hint: 'Muška prvenstva od 1945. do 1991./92. Naslov oduzet Šibenki 1983. se ne računa.',
    izvori: [['Wikipedia: Yugoslav First Basketball League', W + 'Yugoslav_First_Basketball_League']],
    odgovori: {
      A: ['Cibona|Cibona Zagreb#1982., 1984. i 1985.', 'Jugoplastika|Split|KK Split|POP 84#šest naslova, četiri zaredom 1988.–1991.', 'Partizan|KK Partizan#pet naslova, zadnji 1992.', 'Crvena zvezda|KK Crvena zvezda#deset zaredom 1946.–1955.'],
      B: ['Zadar|KK Zadar#šest naslova', 'Bosna|KK Bosna|Bosna Sarajevo#1978., 1980. i 1983.', 'Olimpija|Olimpija Ljubljana|Union Olimpija|AŠK Olimpija#šest naslova'],
      D: ['OKK Beograd|Beograd#četiri naslova, Korać', 'Radnički Beograd|Radnički#1973.'],
      E: ['Proleter Zrenjanin|Proleter#1956.'],
      F: ['Jugoslavenska armija|JNA|Jugoslovenska armija|Reprezentacija JA#prvo prvenstvo 1945.'],
    },
  },
  {
    dan: 3, poz: 9, cat: 'tenis', kind: 'person', diff: 3, provjera: 'Finala 1968.–2025.; općepoznati podaci, naveden izvor za provjeru.',
    text: 'Navedi tenisača koji je igrao finale US Opena u Open eri.',
    hint: 'Muški pojedinačno, 1968.–2025., i pobjednici i poraženi.',
    izvori: [['Wikipedia: List of US Open men\'s singles champions', W + 'List_of_US_Open_men%27s_singles_champions'], ['US Open — povijest', 'https://www.usopen.org/en_US/visit/history/mschamps.html']],
    odgovori: {
      A: ['Novak Đoković#rekordnih deset finala', 'Roger Federer#pet naslova zaredom 2004.–2008.', 'Rafael Nadal#četiri naslova', 'Carlos Alcaraz#prvak 2022. i 2025.', 'Jannik Sinner#prvak 2024.', 'Marin Čilić#prvak 2014.'],
      B: ['Pete Sampras#pet naslova', 'Andre Agassi#prvak 1994. i 1999.', 'Andy Murray#prvak 2012.', 'Daniil Medvedev|Medvedev#prvak 2021.', 'John McEnroe#četiri naslova', 'Jimmy Connors#pet naslova na tri podloge', 'Ivan Lendl#osam finala zaredom', 'Juan Martín del Potro|Del Potro|Delpo#prvak 2009.', 'Stan Wawrinka|Stanislas Wawrinka#prvak 2016.', 'Björn Borg|Bjorn Borg#četiri finala, nijedan naslov'],
      C: ['Andy Roddick#prvak 2003.', 'Dominic Thiem#prvak 2020.', 'Alexander Zverev|Sascha Zverev#finale 2020.', 'Lleyton Hewitt#prvak 2001.', 'Marat Safin#prvak 2000.', 'Boris Becker#prvak 1989.', 'Stefan Edberg#prvak 1991. i 1992.', 'Mats Wilander#prvak 1988.', 'Kei Nishikori#finale 2014. protiv Čilića', 'Casper Ruud#finale 2022.', 'Taylor Fritz#finale 2024.', 'Patrick Rafter|Pat Rafter#prvak 1997. i 1998.', 'Jim Courier#finale 1991.'],
      D: ['Kevin Anderson#finale 2017.', 'Juan Carlos Ferrero#finale 2003.', 'Michael Chang#finale 1996.', 'Arthur Ashe#prvi prvak Open ere, 1968.', 'Rod Laver#prvak 1969.', 'Guillermo Vilas#prvak 1977.', 'Ilie Năstase|Nastase#prvak 1972.', 'John Newcombe#prvak 1973.', 'Ken Rosewall#prvak 1970.', 'Stan Smith#prvak 1971.', 'Michael Stich#finale 1994.', 'Mark Philippoussis#finale 1998.', 'Greg Rusedski#finale 1997.', 'Todd Martin#finale 1999.'],
      E: ['Manuel Orantes#prvak 1975.', 'Vitas Gerulaitis#finale 1979.', 'Miloslav Mečíř|Mecir#finale 1986.', 'Cédric Pioline|Pioline#finale 1993.', 'Tony Roche#finale 1969. i 1970.', 'Jan Kodeš|Kodes#finale 1971. i 1973.'],
      F: ['Tom Okker#finale 1968.'],
    },
  },
  {
    dan: 4, poz: 9, cat: 'formula-1', kind: 'team', diff: 3, provjera: 'Naslovi 1958.–2025.; sezona 2026. još traje. Općepoznati podaci, naveden izvor za provjeru.',
    text: 'Navedi konstruktora koji je osvojio naslov svjetskog prvaka Formule 1.',
    hint: 'Konstruktorsko prvenstvo, 1958.–2025.',
    izvori: [['Wikipedia: List of Formula One World Constructors\' Champions', W + 'List_of_Formula_One_World_Constructors%27_Champions'], ['Formula1.com — Hall of Fame', 'https://www.formula1.com/en/results.html']],
    odgovori: {
      A: ['Ferrari|Scuderia Ferrari#rekordnih 16 naslova', 'Mercedes|Mercedes AMG#osam zaredom 2014.–2021.', 'Red Bull|Red Bull Racing|RBR#šest naslova', 'McLaren#prvak 2024. i 2025.'],
      B: ['Williams#devet naslova', 'Renault#2005. i 2006.', 'Lotus|Team Lotus#sedam naslova'],
      C: ['Benetton#1995.', 'Brawn|Brawn GP#jedina sezona, 2009.', 'Brabham#1966. i 1967.'],
      D: ['Tyrrell#1971.', 'Cooper#1959. i 1960.'],
      E: ['BRM|British Racing Motors#1962.', 'Matra#1969.'],
      F: ['Vanwall#prvi konstruktorski prvak, 1958.'],
    },
  },
  {
    dan: 5, poz: 9, cat: 'nogomet', kind: 'team', diff: 3, provjera: L,
    text: 'Navedi klub koji je bio prvak Jugoslavije u nogometu.',
    hint: 'Prvenstva od 1923. do 1991./92. (Kraljevina i SFRJ).',
    izvori: [['Wikipedia: Yugoslav First League', W + 'Yugoslav_First_League'], ['RSSSF — Yugoslavia, List of Champions', 'https://www.rsssf.org/tablesj/joeghist.html']],
    odgovori: {
      A: ['Crvena zvezda#19 naslova u SFRJ', 'Partizan#11 naslova', 'Dinamo Zagreb|Dinamo|GNK Dinamo#1948., 1954., 1958. i 1982.', 'Hajduk Split|Hajduk#devet naslova, dva prije rata'],
      B: ['Sarajevo|FK Sarajevo#1967. i 1985.', 'Željezničar|Željo|Zeljeznicar Sarajevo#1972.', 'Vojvodina|Vojvodina Novi Sad#1966. i 1989.'],
      D: ['Građanski|Građanski Zagreb|HŠK Građanski#pet naslova prije rata', 'BSK|BSK Beograd|OFK Beograd#pet naslova tridesetih'],
      E: ['Jugoslavija|SK Jugoslavija|Jugoslavija Beograd#1924. i 1925.', 'Concordia|Concordia Zagreb#1930. i 1932.', 'HAŠK|HAŠK Zagreb|HASK#1938.'],
    },
  },
  {
    dan: 6, poz: 9, cat: 'kosarka', kind: 'team', diff: 1, provjera: 'Trideset franšiza u sezoni 2026./27.; sastav lige nije se mijenjao od 2004.',
    text: 'Navedi momčad koja igra u NBA ligi.',
    hint: 'Trideset franšiza u sezoni 2026./27. Dovoljan je nadimak ili grad.',
    izvori: [['NBA — momčadi', 'https://www.nba.com/teams'], ['Wikipedia: National Basketball Association', W + 'National_Basketball_Association']],
    odgovori: {
      A: ['Los Angeles Lakers|Lakers|LA Lakers', 'Boston Celtics|Celtics|Boston', 'Chicago Bulls|Bulls|Chicago', 'Golden State Warriors|Warriors|Golden State', 'Miami Heat|Heat|Miami', 'Dallas Mavericks|Mavericks|Mavs|Dallas', 'Denver Nuggets|Nuggets|Denver#Jokićev klub'],
      B: ['New York Knicks|Knicks|New York', 'San Antonio Spurs|Spurs|San Antonio', 'Milwaukee Bucks|Bucks|Milwaukee', 'Brooklyn Nets|Nets|Brooklyn', 'Philadelphia 76ers|76ers|Sixers|Philadelphia', 'Phoenix Suns|Suns|Phoenix', 'Los Angeles Clippers|Clippers|LA Clippers', 'Oklahoma City Thunder|Thunder|OKC|Oklahoma City|Oklahoma', 'Cleveland Cavaliers|Cavaliers|Cavs|Cleveland', 'Houston Rockets|Rockets|Houston'],
      C: ['Toronto Raptors|Raptors|Toronto#jedini kanadski klub', 'Detroit Pistons|Pistons|Detroit', 'Minnesota Timberwolves|Timberwolves|Wolves|Minnesota', 'Atlanta Hawks|Hawks|Atlanta', 'Portland Trail Blazers|Trail Blazers|Blazers|Portland', 'Utah Jazz|Jazz|Utah', 'Orlando Magic|Magic|Orlando', 'Sacramento Kings|Kings|Sacramento', 'Indiana Pacers|Pacers|Indiana'],
      D: ['Memphis Grizzlies|Grizzlies|Memphis', 'New Orleans Pelicans|Pelicans|New Orleans', 'Washington Wizards|Wizards|Washington', 'Charlotte Hornets|Hornets|Charlotte'],
    },
  },
  {
    dan: 7, poz: 9, cat: 'nogomet', kind: 'team', diff: 3, provjera: 'Bundesliga 1963./64.–2025./26. (prvak Bayern — provjereno na webu 13. 11. 2026.).',
    text: 'Navedi klub koji je bio prvak Njemačke u Bundesligi.',
    hint: 'Samo Bundesliga, od sezone 1963./64. do 2025./26.',
    izvori: [['Wikipedia: List of German football champions', W + 'List_of_German_football_champions'], ['Bundesliga — povijest', 'https://www.bundesliga.com/en/bundesliga/history']],
    odgovori: {
      A: ['Bayern München#prvak i 2025./26.', 'Borussia Dortmund#pet naslova u Bundesligi', 'Bayer Leverkusen#prvi naslov 2024., bez poraza'],
      B: ['Werder Bremen|Werder#četiri naslova', 'Hamburger SV#tri naslova', 'Borussia Mönchengladbach#pet naslova sedamdesetih', 'VfB Stuttgart|Stuttgart#1984., 1992. i 2007.', 'Wolfsburg|VfL Wolfsburg#2009., Džeko i Grafite'],
      C: ['Köln|1. FC Köln|FC Koeln|Koln#prvi prvak Bundeslige, 1964.', 'Kaiserslautern|1. FC Kaiserslautern#1998. kao novi prvoligaš'],
      D: ['Nürnberg|1. FC Nürnberg|Nurnberg|Nuernberg#1968.', '1860 München|TSV 1860 München|1860 Munchen|TSV 1860|Minhen 1860#1966.'],
      E: ['Eintracht Braunschweig|Braunschweig#1967.'],
    },
  },
  {
    dan: 8, poz: 9, cat: 'borilacki', kind: 'person', diff: 4, provjera: 'Svih 61 profesionalnih borbi (50 različitih protivnika); općepoznat podatak, naveden izvor za provjeru.',
    text: 'Navedi boksača protiv kojeg se Muhammad Ali borio kao profesionalac.',
    hint: 'Svi protivnici od 1960. do 1981., uključujući borbe pod imenom Cassius Clay.',
    izvori: [['BoxRec — Muhammad Ali', 'https://boxrec.com/en/box-pro/180'], ['Wikipedia: Boxing career of Muhammad Ali', W + 'Boxing_career_of_Muhammad_Ali']],
    odgovori: {
      A: ['Joe Frazier#tri borbe, „Thrilla in Manila“', 'George Foreman#„Rumble in the Jungle“, 1974.', 'Sonny Liston#1964. i 1965.'],
      B: ['Ken Norton#tri borbe, slomio Aliju čeljust', 'Larry Holmes#1980.', 'Leon Spinks#1978., dvije borbe', 'Floyd Patterson#1965. i 1972.', 'Henry Cooper#1963. i 1966.'],
      C: ['Chuck Wepner#nadahnuo film Rocky', 'Earnie Shavers#1977.', 'Trevor Berbick#posljednja borba, 1981.', 'Joe Bugner#1973. i 1975.', 'Archie Moore#1962.', 'Jerry Quarry#povratak 1970.', 'Oscar Bonavena#1970.', 'George Chuvalo#1966. i 1972.', 'Ron Lyle#1975.', 'Ernie Terrell#„Kako mi je ime?“, 1967.'],
      D: ['Jimmy Ellis#1971.', 'Bob Foster#1972.', 'Jimmy Young#1976.', 'Karl Mildenberger#1966. u Frankfurtu', 'Brian London#1966.', 'Cleveland Williams#1966.', 'Zora Folley#1967.', 'Doug Jones#1963.', 'Buster Mathis#1971.', 'Richard Dunn#1976.', 'Alfredo Evangelista#1977.', 'Jean-Pierre Coopman|Coopman#1976.', 'Jürgen Blin|Jurgen Blin#1971.'],
      E: ['Tunney Hunsaker#prva profesionalna borba, 1960.', 'Mac Foster#1972. u Tokiju', 'Rudi Lubbers#1973. u Jakarti', 'Al Lewis|Al Blue Lewis|Blue Lewis#1972. u Dublinu', 'Alejandro Lavorante#1962.', 'Charlie Powell#1963.', 'Sonny Banks#prvi koji je srušio Claya', 'Willi Besmanoff#1961.', 'Alex Miteff#1961.'],
      F: ['Herb Siler', 'Tony Esperti', 'Jim Robinson|Jimmy Robinson', 'Donnie Fleeman', 'LaMar Clark', 'Duke Sabedong', 'Alonzo Johnson', 'Don Warner', 'George Logan', 'Billy Daniels'],
    },
  },
  {
    dan: 9, poz: 9, cat: 'nogomet', kind: 'person', diff: 3, provjera: 'SP 1930.–2026. (2026.: Mbappé, 10 golova — provjereno na webu 13. 11. 2026.).',
    text: 'Navedi najboljeg strijelca nekog Svjetskog prvenstva u nogometu.',
    hint: 'Od 1930. do 2026. Za godine kad je više igrača imalo isti broj golova priznaju se svi (1962. njih šest, 1994. dvojica, 2010. četvorica).',
    izvori: [['Wikipedia: FIFA World Cup top goalscorers', W + 'FIFA_World_Cup_top_goalscorers'], ['FIFA — nagrade Svjetskog prvenstva', 'https://www.fifa.com/en/tournaments/mens/worldcup']],
    odgovori: {
      A: ['Kylian Mbappé|Mbappe#2022. (8) i 2026. (10 golova)', 'Davor Šuker#1998., šest golova', 'Ronaldo|Ronaldo Nazário|Ronaldo Luís Nazário de Lima|R9#2002., osam golova', 'Harry Kane#2018.', 'Miroslav Klose#2006.'],
      B: ['Thomas Müller|Thomas Mueller#2010.', 'James Rodríguez|James|James Rodriguez#2014.', 'Gerd Müller|Gerd Mueller#1970., deset golova', 'Just Fontaine#1958., rekordnih 13 golova', 'Gary Lineker#1986.', 'Paolo Rossi#1982.', 'Eusébio|Eusebio#1966., devet golova', 'Hristo Stoičkov|Stoichkov|Stoickov#1994.', 'Mario Kempes#1978.'],
      C: ['Salvatore Schillaci|Toto Schillaci|Totò Schillaci#1990.', 'David Villa#2010., pet golova', 'Wesley Sneijder#2010., pet golova', 'Diego Forlán|Forlan#2010., pet golova', 'Garrincha#1962.', 'Oleg Salenko#1994., pet golova u jednoj utakmici', 'Grzegorz Lato#1974.', 'Sándor Kocsis|Sandor Kocsis#1954., 11 golova'],
      D: ['Dražan Jerković|Drazan Jerkovic#1962., četiri gola za Jugoslaviju', 'Vavá|Vava#1962.', 'Leônidas|Leonidas|Leônidas da Silva#1938.', 'Ademir|Ademir de Menezes#1950.', 'Guillermo Stábile|Stabile#1930., osam golova'],
      E: ['Leonel Sánchez|Leonel Sanchez#1962.', 'Flórián Albert|Florian Albert#1962.', 'Valentin Ivanov#1962.', 'Oldřich Nejedlý|Nejedly#1934.'],
    },
  },
  {
    dan: 10, poz: 9, cat: 'kosarka', kind: 'person', diff: 3, provjera: L,
    text: 'Navedi košarkaša koji je s Hrvatskom osvojio olimpijsko srebro u Barceloni 1992.',
    hint: 'Dvanaest igrača koji su igrali finale protiv američkog Dream Teama.',
    izvori: [['Wikipedia: Croatia at the 1992 Summer Olympics', W + 'Croatia_at_the_1992_Summer_Olympics'], ['Hrvatski olimpijski odbor — Barcelona 1992.', 'https://www.hoo.hr/']],
    odgovori: {
      A: ['Dražen Petrović|Dražen|Drazen#kapetan, 24 poena u finalu', 'Toni Kukoč|Kukoc', 'Dino Rađa|Radja|Rada'],
      B: ['Stojko Vranković|Vrankovic', 'Velimir Perasović|Perasovic|Peras'],
      C: ['Arijan Komazec', 'Žan Tabak|Zan Tabak', 'Danko Cvjetićanin|Cvjeticanin'],
      D: ['Franjo Arapović|Arapovic#zakucao preko Dream Teama za vodstvo Hrvatske 25:23'],
      E: ['Vladan Alanović|Alanovic', 'Aramis Naglić|Naglic'],
      F: ['Alan Gregov'],
    },
  },

  // ---------------- Pozicija 10: procjene iz autorova izvornog kviza ----------------
  {
    dan: 1, poz: 10, cat: 'procjene', type: 'numeric', sport: 'tenis', diff: 3, provjera: 'Provjereno na webu 13. 11. 2026. (Wikipedia, ATP).',
    text: 'Koliko je asova Ivo Karlović zabio u karijeri na ATP Touru?',
    hint: 'Službena ATP statistika (vodi se od 1991.), bez Davis Cupa.',
    target: cilj(13728, 'asova', '2021-12-31', 1, { note: 'Rekord do 2022., kad ga je prestigao John Isner (14.470).' }),
    izvori: [['Wikipedia: Ivo Karlović', W + 'Ivo_Karlovi%C4%87'], ['ATP Tour — Ivo Karlović', 'https://www.atptour.com/en/players/ivo-karlovic/k336/overview']],
  },
  {
    dan: 2, poz: 10, cat: 'procjene', type: 'numeric', sport: 'košarka', diff: 3, provjera: K,
    text: 'Koliko je poena po utakmici u prosjeku postizao Wilt Chamberlain u NBA sezoni 1961./62.?',
    hint: 'Regularni dio sezone; možeš upisati i decimalni broj.',
    target: cilj(50.4, 'poena po utakmici', '1962-03-14', 1, { note: 'Rekord svih vremena; u toj je sezoni postigao i 100 poena u jednoj utakmici.' }),
    izvori: [['Basketball Reference — Wilt Chamberlain', 'https://www.basketball-reference.com/players/c/chambwi01.html'], ['Wikipedia: Wilt Chamberlain', W + 'Wilt_Chamberlain']],
  },
  {
    dan: 3, poz: 10, cat: 'procjene', type: 'numeric', sport: 'nogomet', diff: 3, provjera: K,
    text: 'Koliko je prvenstvenih utakmica zaredom Steaua iz Bukurešta odigrala bez poraza između 1986. i 1989.?',
    hint: 'Europski rekord u nacionalnim prvenstvima.',
    target: cilj(104, 'utakmice', '1989-09-09', 1, { note: 'Niz je trajao od lipnja 1986. do rujna 1989.' }),
    izvori: [['Wikipedia: FCSB', W + 'FCSB'], ['UEFA — najdulji nizovi bez poraza', 'https://www.uefa.com/']],
  },
  {
    dan: 4, poz: 10, cat: 'procjene', type: 'numeric', sport: 'nogomet', diff: 3, provjera: K,
    text: 'Na koliko je utakmica Premier lige vratar Petr Čech sačuvao mrežu netaknutom?',
    hint: 'Chelsea i Arsenal, 2004.–2019.; rekord lige.',
    target: cilj(202, 'utakmice', '2019-05-12', 1, { note: 'Rekord Premier lige; 162 puta s Chelseajem i 40 s Arsenalom.' }),
    izvori: [['Premier League — Petr Čech', 'https://www.premierleague.com/players/2850/Petr-Cech/stats'], ['Wikipedia: Petr Čech', W + 'Petr_%C4%8Cech']],
  },
  {
    dan: 5, poz: 10, cat: 'procjene', type: 'numeric', sport: 'nogomet', diff: 2, provjera: K,
    text: 'Kolika je bila kvota kladionica (X prema 1) da će Leicester City osvojiti Premier ligu 2015./16.?',
    hint: 'Kvota ponuđena prije početka sezone; upiši samo X.',
    target: cilj(5000, 'prema 1', '2015-08-08', 1, { note: 'Leicester je naslov osvojio s deset bodova prednosti.' }),
    izvori: [['Wikipedia: 2015–16 Leicester City F.C. season', W + '2015%E2%80%9316_Leicester_City_F.C._season'], ['BBC Sport — Leicester City win Premier League title', 'https://www.bbc.com/sport/football/35988673']],
  },
  {
    dan: 6, poz: 10, cat: 'procjene', type: 'numeric', sport: 'tenis', diff: 3, provjera: 'Provjereno na webu 13. 11. 2026. (Wikipedia).',
    text: 'Kolikom je brzinom Ivo Karlović 2011. odservirao svoj najbrži servis?',
    hint: 'Davis Cup u Zagrebu, tadašnji službeni svjetski rekord.',
    target: cilj(251, 'km/h', '2011-03-05', 0.5, { note: 'Rekord je odservirao u paru s Dodigom protiv Njemačke.' }),
    izvori: [['Wikipedia: Fastest recorded tennis serves', W + 'Fastest_recorded_tennis_serves'], ['Wikipedia: Ivo Karlović', W + 'Ivo_Karlovi%C4%87']],
  },
  {
    dan: 7, poz: 10, cat: 'procjene', type: 'numeric', sport: 'boks', diff: 3, provjera: K,
    text: 'Koliko je od svojih 49 pobjeda Rocky Marciano ostvario nokautom?',
    hint: 'Jedini svjetski prvak teške kategorije koji se povukao neporažen (49-0).',
    target: cilj(43, 'pobjede', '1955-09-21', 1, { note: 'Omjer 49-0, od toga 43 nokauta.' }),
    izvori: [['BoxRec — Rocky Marciano', 'https://boxrec.com/en/box-pro/9032'], ['Wikipedia: Rocky Marciano', W + 'Rocky_Marciano']],
  },
  {
    dan: 8, poz: 10, cat: 'procjene', type: 'numeric', sport: 'tenis', diff: 2, provjera: K,
    text: 'Koliko su međusobnih mečeva odigrali Novak Đoković i Roger Federer?',
    hint: 'Službeni mečevi na ATP Touru i Grand Slamovima, 2006.–2020.',
    target: cilj(50, 'mečeva', '2020-01-30', 1, { note: 'Đoković vodi 27-23.' }),
    izvori: [['Wikipedia: Djokovic–Federer rivalry', W + 'Djokovic%E2%80%93Federer_rivalry'], ['ATP Tour — Head2Head', 'https://www.atptour.com/en/players/atp-head-2-head/novak-djokovic-vs-roger-federer/d643/f324']],
  },
  {
    dan: 9, poz: 10, cat: 'procjene', type: 'numeric', sport: 'tenis', diff: 3, provjera: K,
    text: 'Koliko su međusobnih mečeva u karijeri odigrale sestre Serena i Venus Williams?',
    hint: 'Službeni mečevi na WTA Touru i Grand Slamovima, 1998.–2020.',
    target: cilj(31, 'mečeva', '2020-08-13', 1, { note: 'Serena vodi 19-12.' }),
    izvori: [['Wikipedia: Williams sisters rivalry', W + 'Williams_sisters_rivalry'], ['WTA — Head to Head', 'https://www.wtatennis.com/head-to-head/230234/230220']],
  },
  {
    dan: 10, poz: 10, cat: 'procjene', type: 'numeric', sport: 'nogomet', diff: 2, provjera: K,
    text: 'Koliko je golova Jamie Vardy postigao u Premier ligi u Leicesterovoj šampionskoj sezoni 2015./16.?',
    hint: 'Samo prvenstvene utakmice te sezone.',
    target: cilj(24, 'golova', '2016-05-15', 1, { note: 'U toj je sezoni zabijao u rekordnih 11 uzastopnih kola.' }),
    izvori: [['Premier League — Jamie Vardy', 'https://www.premierleague.com/players/8979/Jamie-Vardy/stats'], ['Wikipedia: Jamie Vardy', W + 'Jamie_Vardy']],
  },
];
