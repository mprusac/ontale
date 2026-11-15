// KOŠARKA — 10 pitanja (pozicija 3). Liste uspoređene s izvorima 13. 11. 2026.
const W = 'https://en.wikipedia.org/wiki/';
const P = 'Lista uspoređena s izvorom 13. 11. 2026.';

export default [
  {
    dan: 1, poz: 3, cat: 'kosarka', kind: 'team', diff: 2, provjera: P,
    text: 'Navedi franšizu koja je osvojila NBA naslov.',
    hint: 'BAA i NBA, 1947.–2026. Priznaje se i ime pod kojim je franšiza tada igrala.',
    izvori: [['NBA — povijest prvaka', 'https://www.nba.com/history/nba-champions'], ['Wikipedia: List of NBA champions', W + 'List_of_NBA_champions']],
    odgovori: {
      A: ['Los Angeles Lakers|Lakers|LA Lakers|Minneapolis Lakers#17 naslova', 'Boston Celtics|Celtics|Boston#18 naslova, rekorder', 'Chicago Bulls|Bulls|Chicago#6 naslova', 'Golden State Warriors|Warriors|Golden State|Philadelphia Warriors|San Francisco Warriors#7 naslova'],
      B: ['San Antonio Spurs|Spurs|San Antonio#5 naslova', 'Miami Heat|Heat|Miami#3 naslova', 'New York Knicks|Knicks|New York#1970., 1973., 2026.', 'Oklahoma City Thunder|Thunder|Oklahoma City|OKC|Seattle SuperSonics|SuperSonics|Sonics#1979. kao Seattle i 2025.', 'Denver Nuggets|Nuggets|Denver#2023.', 'Milwaukee Bucks|Bucks|Milwaukee#1971. i 2021.', 'Dallas Mavericks|Mavericks|Mavs|Dallas#2011.', 'Cleveland Cavaliers|Cavaliers|Cavs|Cleveland#2016.'],
      C: ['Detroit Pistons|Pistons|Detroit#1989., 1990., 2004.', 'Toronto Raptors|Raptors|Toronto#2019.', 'Philadelphia 76ers|76ers|Sixers|Philadelphia|Syracuse Nationals#3 naslova', 'Houston Rockets|Rockets|Houston#1994. i 1995.'],
      D: ['Portland Trail Blazers|Trail Blazers|Blazers|Portland#1977.', 'Atlanta Hawks|Hawks|Atlanta|St. Louis Hawks|St Louis Hawks#1958. kao St. Louis', 'Washington Wizards|Wizards|Washington|Washington Bullets#1978. kao Bullets'],
      E: ['Sacramento Kings|Kings|Sacramento|Rochester Royals#1951. kao Rochester Royals'],
      F: ['Baltimore Bullets#1948., franšiza ugašena 1954.'],
    },
  },
  {
    dan: 2, poz: 3, cat: 'kosarka', kind: 'person', diff: 2, provjera: P,
    text: 'Navedi košarkaša iz Hrvatske ili Bosne i Hercegovine koji je igrao u NBA ligi.',
    hint: 'Barem jedna službena NBA utakmica; prema NBA popisu igrača po državama.',
    izvori: [['Wikipedia: List of foreign NBA players', W + 'List_of_foreign_NBA_players'], ['NBA — igrači', 'https://www.nba.com/players']],
    odgovori: {
      A: ['Dražen Petrović#Portland i New Jersey', 'Toni Kukoč#tri naslova s Chicagom', 'Ivica Zubac', 'Bojan Bogdanović', 'Jusuf Nurkić', 'Dario Šarić'],
      B: ['Dino Rađa|Dino Radja#Boston Celtics', 'Mario Hezonja', 'Mirza Teletović', 'Džanan Musa', 'Stojko Vranković', 'Gordan Giriček'],
      C: ['Žan Tabak#prvak s Houstonom 1995.', 'Dragan Bender#4. izbor drafta 2016.', 'Ante Žižić', 'Roko Ukić', 'Zoran Planinić', 'Karlo Matković', 'Luka Šamanić'],
      D: ['Mario Kasun', 'Damjan Rudež', 'Bruno Šundov', 'Dalibor Bagarić'],
      E: ['Damir Markota', 'Duje Dukan', 'Ratko Varda', 'Aleksandar Radojević'],
    },
  },
  {
    dan: 3, poz: 3, cat: 'kosarka', kind: 'person', diff: 2, provjera: P,
    text: 'Navedi košarkaša koji je bio MVP regularnog dijela NBA sezone.',
    hint: 'Nagrada se dodjeljuje od sezone 1955./56.; zaključno s 2025./26.',
    izvori: [['NBA — MVP kroz povijest', 'https://www.nba.com/news/history-mvp-award-winners'], ['Wikipedia: NBA Most Valuable Player', W + 'NBA_Most_Valuable_Player']],
    odgovori: {
      A: ['Michael Jordan|MJ#5 puta', 'LeBron James|LeBron|Lebron#4 puta', 'Nikola Jokić#3 puta', 'Stephen Curry|Steph Curry#2 puta', 'Kobe Bryant|Kobe#2007./08.'],
      B: ['Giannis Antetokounmpo|Giannis#2 puta', 'Shai Gilgeous-Alexander|SGA|Shai#2024./25. i 2025./26.', 'Kevin Durant|KD#2013./14.', 'Shaquille O\'Neal|Shaq|Shaquille ONeal#1999./2000.', 'Magic Johnson|Earvin Johnson|Magic#3 puta', 'Larry Bird#3 puta zaredom', 'Kareem Abdul-Jabbar|Kareem|Lew Alcindor#6 puta, rekorder', 'Tim Duncan#2 puta', 'Joel Embiid#2022./23.', 'James Harden#2017./18.', 'Russell Westbrook#2016./17.', 'Dirk Nowitzki#2006./07.'],
      C: ['Derrick Rose#2010./11., najmlađi MVP', 'Allen Iverson#2000./01.', 'Steve Nash#2 puta', 'Kevin Garnett#2003./04.', 'Charles Barkley#1992./93.', 'Hakeem Olajuwon#1993./94.', 'Karl Malone#2 puta', 'Wilt Chamberlain#4 puta', 'Bill Russell#5 puta'],
      D: ['David Robinson#1994./95.', 'Julius Erving|Dr. J|Dr J#1980./81.', 'Moses Malone#3 puta', 'Bill Walton#1977./78.', 'Oscar Robertson#1963./64.'],
      E: ['Bob Pettit#prvi MVP, 2 puta', 'Bob Cousy#1956./57.', 'Wes Unseld#1968./69., kao novak', 'Willis Reed#1969./70.', 'Dave Cowens#1972./73.', 'Bob McAdoo#1974./75.'],
    },
  },
  {
    dan: 4, poz: 3, cat: 'kosarka', kind: 'team', diff: 2, provjera: P,
    text: 'Navedi klub koji je bio prvak Europe u košarci.',
    hint: 'Kup europskih prvaka i Euroliga, 1958.–2026.',
    izvori: [['EuroLeague — povijest', 'https://www.euroleaguebasketball.net/euroleague/history/'], ['Wikipedia: EuroLeague', W + 'EuroLeague']],
    odgovori: {
      A: ['Real Madrid#11 naslova, rekorder', 'Barcelona#2003. i 2010.', 'Olympiacos|Olympiakos|Olimpijakos#4 naslova, zadnji 2026.', 'Panathinaikos|PAO#7 naslova', 'Cibona|Cibona Zagreb#1985. i 1986.', 'Split|Jugoplastika|POP 84|KK Split|Jugoplastika Split#tri zaredom 1989.–1991.', 'Partizan|Partizan Beograd#1992.'],
      B: ['CSKA Moskva|CSKA Moscow|CSKA#8 naslova', 'Maccabi Tel Aviv|Maccabi|Makabi Tel Aviv|Makabi#6 naslova', 'Fenerbahçe|Fenerbahce|Fener#2017. i 2025.', 'Anadolu Efes|Efes|Efes Pilsen#2021. i 2022.', 'Bosna|Bosna Sarajevo#1979.', 'Žalgiris|Žalgiris Kaunas|Zalgiris#1999.'],
      C: ['Olimpia Milano|Milano|Armani Milano|Tracer Milano|Simmenthal Milano|Olimpia#3 naslova', 'Virtus Bologna|Kinder Bologna|Virtus|Kinder#1998. i 2001.', 'Varese|Ignis Varese|Mobilgirgi Varese|Pallacanestro Varese#5 naslova 1970-ih', 'Joventut Badalona|Joventut|Badalona#1994.', 'Limoges|Limoges CSP#1993.'],
      D: ['Cantù|Cantu|Pallacanestro Cantù|Ford Cantù|Squibb Cantù#1982. i 1983.', 'Virtus Roma|Banco di Roma|Roma#1984.', 'ASK Riga|Rīgas ASK|Riga#prva tri prvaka, 1958.–1960.', 'Dinamo Tbilisi#1962.'],
    },
  },
  {
    dan: 5, poz: 3, cat: 'kosarka', kind: 'person', diff: 3, provjera: P + ' Popis se može promijeniti tijekom sezone.',
    text: 'Navedi košarkaša koji je u jednoj NBA utakmici postigao 60 ili više poena.',
    hint: 'Utakmice regularnog dijela sezone. Stanje: 19. ožujka 2026.',
    izvori: [['Wikipedia: List of NBA single-game scoring leaders', W + 'List_of_NBA_single-game_scoring_leaders'], ['NBA — statistika', 'https://www.nba.com/stats']],
    odgovori: {
      A: ['Kobe Bryant|Kobe#81 poen 2006.', 'Wilt Chamberlain#100 poena 1962.', 'Michael Jordan|MJ#69', 'Luka Dončić|Luka Doncic#73', 'LeBron James|LeBron|Lebron#61', 'Stephen Curry|Steph Curry#62'],
      B: ['Bam Adebayo#83, drugi učinak svih vremena', 'Devin Booker#70', 'Damian Lillard#71', 'James Harden#61', 'Nikola Jokić#61', 'Joel Embiid#70', 'Giannis Antetokounmpo|Giannis#64', 'Donovan Mitchell#71', 'Shaquille O\'Neal|Shaq|Shaquille ONeal#61', 'Allen Iverson#60', 'Kyrie Irving#60', 'Jayson Tatum#60', 'Klay Thompson#60 u tri četvrtine'],
      C: ['Carmelo Anthony|Melo#62', 'Tracy McGrady|T-Mac#62', 'Karl-Anthony Towns|KAT#62', 'Jalen Brunson#61', 'Larry Bird#60', 'David Robinson#71', 'Karl Malone#61', 'Gilbert Arenas#60', 'Bradley Beal#60', 'Kemba Walker#60', 'De\'Aaron Fox|DeAaron Fox#60'],
      D: ['Elgin Baylor#71', 'David Thompson#73', 'Pete Maravich|Pistol Pete#68', 'Jerry West#63', 'George Gervin|Iceman#63', 'Bernard King#60'],
      E: ['Joe Fulks#63, još 1949.', 'George Mikan#61', 'Tom Chambers#60'],
    },
  },
  {
    dan: 6, poz: 3, cat: 'kosarka', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi košarkaša koji je bio prvi izbor NBA drafta.',
    hint: 'Draftovi od 1980. do 2026.',
    izvori: [['Wikipedia: List of first overall NBA draft picks', W + 'List_of_first_overall_NBA_draft_picks'], ['NBA — povijest drafta', 'https://www.nba.com/draft/history']],
    odgovori: {
      A: ['LeBron James|LeBron|Lebron#2003.', 'Shaquille O\'Neal|Shaq|Shaquille ONeal#1992.', 'Victor Wembanyama|Wemby#2023.', 'Tim Duncan#1997.', 'Allen Iverson#1996.'],
      B: ['Zion Williamson|Zion#2019.', 'Anthony Edwards#2020.', 'Kyrie Irving#2011.', 'Derrick Rose#2008.', 'Anthony Davis#2012.', 'Dwight Howard#2004.', 'Hakeem Olajuwon#1984., ispred Jordana', 'Patrick Ewing#1985.', 'Yao Ming|Yao#2002.', 'Cooper Flagg#2025.', 'Paolo Banchero#2022.', 'Cade Cunningham#2021.', 'Karl-Anthony Towns|KAT#2015.'],
      C: ['David Robinson#1987.', 'Blake Griffin#2009.', 'John Wall#2010.', 'Ben Simmons#2016.', 'Deandre Ayton#2018.', 'Andrew Wiggins#2014.', 'Andrew Bogut#2005.', 'Andrea Bargnani#2006.', 'Chris Webber#1993.', 'James Worthy#1982.', 'AJ Dybantsa|A.J. Dybantsa#2026.', 'Zaccharie Risacher#2024.', 'Markelle Fultz#2017.'],
      D: ['Kwame Brown#2001.', 'Greg Oden#2007.', 'Anthony Bennett#2013.', 'Michael Olowokandi#1998.', 'Elton Brand#1999.', 'Kenyon Martin#2000.', 'Larry Johnson#1991.', 'Glenn Robinson#1994.', 'Joe Smith#1995.', 'Derrick Coleman#1990.', 'Danny Manning#1988.', 'Brad Daugherty#1986.', 'Ralph Sampson#1983.'],
      E: ['Pervis Ellison#1989.', 'Mark Aguirre#1981.', 'Joe Barry Carroll#1980.'],
    },
  },
  {
    dan: 7, poz: 3, cat: 'kosarka', kind: 'country', diff: 3, provjera: P,
    text: 'Navedi reprezentaciju koja je osvojila medalju na Svjetskom prvenstvu u košarci.',
    hint: 'Muška prvenstva 1950.–2023., prema službenoj tablici medalja FIBA-e.',
    izvori: [['FIBA — Basketball World Cup', 'https://www.fiba.basketball/en/history/101-fiba-basketball-world-cup'], ['Wikipedia: FIBA Basketball World Cup', W + 'FIBA_Basketball_World_Cup']],
    odgovori: {
      A: ['SAD|Sjedinjene Američke Države|Amerika#5 zlata', 'Jugoslavija|SR Jugoslavija|SFRJ#5 zlata', 'Srbija#srebro 2014. i 2023.', 'Španjolska#zlato 2006. i 2019.', 'Hrvatska#bronca 1994.', 'Njemačka#zlato 2023.'],
      B: ['Argentina#prvi svjetski prvak 1950.', 'Francuska#bronca 2014. i 2019.', 'Litva#bronca 2010.', 'Grčka#srebro 2006.', 'SSSR|Sovjetski Savez|Soviet Union#3 zlata', 'Brazil#zlato 1959. i 1963.'],
      C: ['Turska#srebro 2010.', 'Rusija#srebro 1994. i 1998.', 'Kanada#bronca 2023.'],
      D: ['Filipini#bronca 1954.', 'Čile#bronca 1950. i 1959.'],
    },
  },
  {
    dan: 8, poz: 3, cat: 'kosarka', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi košarkaša koji je bio MVP NBA finala.',
    hint: 'Nagrada se dodjeljuje od 1969.; zaključno s finalom 2026.',
    izvori: [['Wikipedia: NBA Finals Most Valuable Player', W + 'NBA_Finals_Most_Valuable_Player'], ['NBA — Finals MVP', 'https://www.nba.com/news/history-finals-mvp']],
    odgovori: {
      A: ['Michael Jordan|MJ#6 puta, rekorder', 'LeBron James|LeBron|Lebron#4 puta', 'Kobe Bryant|Kobe#2009. i 2010.', 'Stephen Curry|Steph Curry#2022.', 'Shaquille O\'Neal|Shaq|Shaquille ONeal#2000.–2002.', 'Nikola Jokić#2023.'],
      B: ['Tim Duncan#3 puta', 'Kevin Durant|KD#2017. i 2018.', 'Giannis Antetokounmpo|Giannis#2021.', 'Kawhi Leonard|Kawhi#2014. i 2019.', 'Magic Johnson|Earvin Johnson|Magic#3 puta', 'Larry Bird#1984. i 1986.', 'Dirk Nowitzki#2011.', 'Dwyane Wade#2006.', 'Shai Gilgeous-Alexander|SGA|Shai#2025.', 'Jalen Brunson#2026.', 'Jaylen Brown#2024.'],
      C: ['Hakeem Olajuwon#1994. i 1995.', 'Kareem Abdul-Jabbar|Kareem|Lew Alcindor#1971. i 1985.', 'Tony Parker#2007., prvi Europljanin', 'Paul Pierce#2008.', 'Andre Iguodala#2015.', 'Chauncey Billups#2004.', 'Isiah Thomas#1990.', 'James Worthy#1988.'],
      D: ['Wilt Chamberlain#1972.', 'Jerry West#1969., jedini iz poražene momčadi', 'Moses Malone#1983.', 'Joe Dumars#1989.', 'Bill Walton#1977.', 'Willis Reed#1970. i 1973.', 'John Havlicek#1974.', 'Rick Barry#1975.'],
      E: ['Cedric Maxwell#1981.', 'Dennis Johnson#1979.', 'Jo Jo White|JoJo White#1976.', 'Wes Unseld#1978.'],
    },
  },
  {
    dan: 9, poz: 3, cat: 'kosarka', kind: 'person', diff: 4, provjera: P,
    text: 'Navedi košarkaša koji je bio MVP završnog turnira Eurolige.',
    hint: 'Final Four od 1988. do 2026. (uključujući finalnu seriju 2001.).',
    izvori: [['Wikipedia: EuroLeague Final Four MVP', W + 'EuroLeague_Final_Four_MVP'], ['EuroLeague — nagrade', 'https://www.euroleaguebasketball.net/euroleague/history/']],
    odgovori: {
      A: ['Toni Kukoč#1990., 1991., 1993. — jedini s tri nagrade uz Spanoulisa', 'Luka Dončić|Luka Doncic#2018. s Realom', 'Dejan Bodiroga#2002. i 2003.', 'Dino Rađa|Dino Radja#1989. s Jugoplastikom', 'Vasilije Micić#2021. i 2022.'],
      B: ['Vassilis Spanoulis|Vasilis Spanoulis#2009., 2012., 2013.', 'Dimitris Diamantidis#2007. i 2011.', 'Juan Carlos Navarro#2010.', 'Manu Ginóbili|Emanuel Ginóbili#2001.', 'Arvydas Sabonis#1995.', 'Predrag Danilović|Saša Danilović|Sasha Danilović#1992. s Partizanom', 'Šarūnas Jasikevičius|Sarunas Jasikevicius|Šaras#2005.', 'Žarko Paspalj#1994.'],
      C: ['Edy Tavares|Walter Tavares#2023.', 'Kostas Sloukas#2024.', 'Theo Papaloukas|Theodoros Papaloukas#2006.', 'Nando de Colo|Nando De Colo#2016.', 'Evan Fournier#2026.', 'Nigel Hayes-Davis|Nigel Hayes#2025.', 'Željko Rebrača#2000.', 'Zoran Savić#1998.', 'Dominique Wilkins#1996.', 'Andrés Nocioni#2015.'],
      D: ['Bob McAdoo#1988., prvi dobitnik', 'Anthony Parker#2004.', 'Trajan Langdon#2008.', 'Tyrese Rice#2014.', 'Ekpe Udoh#2017.', 'Will Clyburn#2019.', 'Tyus Edney#1999.', 'David Rivers#1997.', 'Ariel McDonald#2001. (SuproLeague)'],
    },
  },
  {
    dan: 10, poz: 3, cat: 'kosarka', kind: 'person', diff: 3, provjera: P + ' Popis se mijenja tijekom sezone.',
    text: 'Navedi košarkaša s 20.000 ili više poena u NBA ligi.',
    hint: 'Samo regularni dio sezone. Stanje: 24. listopada 2026.',
    izvori: [['Wikipedia: List of NBA career scoring leaders', W + 'List_of_NBA_career_scoring_leaders'], ['Basketball Reference — career points', 'https://www.basketball-reference.com/leaders/pts_career.html']],
    odgovori: {
      A: ['LeBron James|LeBron|Lebron#najbolji strijelac svih vremena', 'Michael Jordan|MJ#32.292', 'Kobe Bryant|Kobe#33.643', 'Kevin Durant|KD#više od 32.000', 'Stephen Curry|Steph Curry', 'Kareem Abdul-Jabbar|Kareem|Lew Alcindor#38.387'],
      B: ['Dirk Nowitzki#31.560', 'Shaquille O\'Neal|Shaq|Shaquille ONeal#28.596', 'James Harden', 'Wilt Chamberlain#31.419', 'Karl Malone#36.928', 'Carmelo Anthony|Melo#28.289', 'Russell Westbrook', 'Tim Duncan#26.496', 'Giannis Antetokounmpo|Giannis', 'Dwyane Wade#23.165', 'Allen Iverson#24.368', 'Larry Bird#21.791', 'Damian Lillard'],
      C: ['Hakeem Olajuwon#26.946', 'Kevin Garnett#26.071', 'Paul Pierce#26.397', 'Vince Carter#25.728', 'Charles Barkley#23.757', 'Patrick Ewing#24.815', 'Reggie Miller#25.279', 'Ray Allen#24.505', 'DeMar DeRozan', 'Chris Paul', 'Pau Gasol#20.894', 'David Robinson#20.790', 'Oscar Robertson#26.710', 'Jerry West#25.192'],
      D: ['Moses Malone#27.409', 'Elvin Hayes#27.313', 'Dominique Wilkins#26.668', 'John Havlicek#26.395', 'Alex English#25.613', 'Robert Parish#23.334', 'Adrian Dantley#23.177', 'Elgin Baylor#23.149', 'Clyde Drexler#22.195', 'Gary Payton#21.813', 'LaMarcus Aldridge#20.558', 'George Gervin|Iceman#20.708'],
      E: ['Hal Greer#21.586', 'Walt Bellamy#20.941', 'Bob Pettit#20.880, prvi s 20.000', 'Mitch Richmond#20.497', 'Joe Johnson#20.407'],
    },
  },
];
