// FORMULA 1 — 10 pitanja (pozicija 6). Liste uspoređene s izvorima 13. 11. 2026. (stanje nakon VN São Paula 2026.).
const W = 'https://en.wikipedia.org/wiki/';
const P = 'Lista uspoređena s izvorom 13. 11. 2026. (stanje nakon VN São Paula, 8. 11. 2026.).';
const F1 = ['Formula 1 — rezultati i statistika', 'https://www.formula1.com/en/results'];

// Svi pobjednici utrka Svjetskog prvenstva: [ime|aliasi, država, pobjede], po razredima početne popularnosti.
const POBJEDNICI = {
  A: [['Lewis Hamilton', 'GBR', 106], ['Michael Schumacher|Schumi', 'GER', 91], ['Max Verstappen', 'NED', 74], ['Ayrton Senna', 'BRA', 41], ['Sebastian Vettel', 'GER', 53], ['Fernando Alonso', 'ESP', 32], ['Charles Leclerc', 'MON', 9], ['Lando Norris', 'GBR', 14]],
  B: [['Alain Prost', 'FRA', 51], ['Niki Lauda', 'AUT', 25], ['Kimi Räikkönen|Kimi Raikkonen|Kimi', 'FIN', 21], ['Nico Rosberg', 'GER', 23], ['Jenson Button', 'GBR', 15], ['Mika Häkkinen|Mika Hakkinen', 'FIN', 20], ['Nigel Mansell', 'GBR', 31], ['Kimi Antonelli|Andrea Kimi Antonelli', 'ITA', 9], ['Oscar Piastri', 'AUS', 9], ['George Russell', 'GBR', 8], ['Carlos Sainz|Carlos Sainz Jr.|Carlos Sainz Jr', 'ESP', 4], ['Daniel Ricciardo', 'AUS', 8], ['Sergio Pérez|Sergio Perez|Checo Pérez|Checo', 'MEX', 6], ['Valtteri Bottas', 'FIN', 10], ['Felipe Massa', 'BRA', 11], ['Rubens Barrichello', 'BRA', 11], ['David Coulthard', 'GBR', 13], ['Mark Webber', 'AUS', 9]],
  C: [['Juan Manuel Fangio', 'ARG', 24], ['Jackie Stewart', 'GBR', 27], ['Jim Clark', 'GBR', 25], ['Nelson Piquet', 'BRA', 23], ['Damon Hill', 'GBR', 22], ['James Hunt', 'GBR', 10], ['Jacques Villeneuve', 'CAN', 11], ['Juan Pablo Montoya', 'COL', 7], ['Gerhard Berger', 'AUT', 10], ['Ralf Schumacher', 'GER', 6], ['Emerson Fittipaldi', 'BRA', 14], ['Pierre Gasly', 'FRA', 1], ['Esteban Ocon', 'FRA', 1], ['Robert Kubica', 'POL', 1], ['Jack Brabham', 'AUS', 14], ['Stirling Moss', 'GBR', 16], ['Mario Andretti', 'USA', 12], ['Gilles Villeneuve', 'CAN', 6], ['Jean Alesi', 'FRA', 1], ['Giancarlo Fisichella', 'ITA', 3], ['Jarno Trulli', 'ITA', 1], ['Pastor Maldonado', 'VEN', 1], ['Eddie Irvine', 'GBR', 4], ['Heikki Kovalainen', 'FIN', 1]],
  D: [['Graham Hill', 'GBR', 14], ['Alberto Ascari', 'ITA', 13], ['Jochen Rindt', 'AUT', 6], ['Keke Rosberg', 'FIN', 5], ['Riccardo Patrese', 'ITA', 6], ['Ronnie Peterson', 'SWE', 10], ['Jody Scheckter', 'RSA', 10], ['Alan Jones', 'AUS', 12], ['Carlos Reutemann', 'ARG', 12], ['Clay Regazzoni', 'SUI', 5], ['Jacky Ickx', 'BEL', 8], ['René Arnoux|Rene Arnoux', 'FRA', 7], ['Heinz-Harald Frentzen', 'GER', 3], ['Johnny Herbert', 'GBR', 3], ['Olivier Panis', 'FRA', 1], ['Michele Alboreto', 'ITA', 5], ['Denny Hulme', 'NZL', 8], ['John Surtees', 'GBR', 6], ['Bruce McLaren', 'NZL', 4], ['Giuseppe Farina|Nino Farina', 'ITA', 5], ['John Watson', 'GBR', 5], ['Jacques Laffite', 'FRA', 6], ['Thierry Boutsen', 'BEL', 3], ['Didier Pironi', 'FRA', 3], ['Patrick Tambay', 'FRA', 2], ['Alessandro Nannini', 'ITA', 1]],
  E: [['Tony Brooks', 'GBR', 6], ['Dan Gurney', 'USA', 4], ['Mike Hawthorn', 'GBR', 3], ['Peter Collins', 'GBR', 3], ['Phil Hill', 'USA', 3], ['Wolfgang von Trips', 'GER', 2], ['Pedro Rodríguez|Pedro Rodriguez', 'MEX', 2], ['Jo Siffert', 'SUI', 2], ['Peter Revson', 'USA', 2], ['Patrick Depailler', 'FRA', 2], ['Jean-Pierre Jabouille', 'FRA', 2], ['Elio de Angelis', 'ITA', 2], ['José Froilán González|Jose Froilan Gonzalez|Froilán González', 'ARG', 2], ['Maurice Trintignant', 'FRA', 2], ['François Cevert|Francois Cevert', 'FRA', 1], ['Jean-Pierre Beltoise', 'FRA', 1], ['José Carlos Pace|Carlos Pace|Jose Carlos Pace', 'BRA', 1], ['Jochen Mass', 'GER', 1], ['Vittorio Brambilla', 'ITA', 1], ['Gunnar Nilsson', 'SWE', 1], ['Jo Bonnier', 'SWE', 1], ['Giancarlo Baghetti', 'ITA', 1], ['Innes Ireland', 'GBR', 1], ['Lorenzo Bandini', 'ITA', 1], ['Richie Ginther', 'USA', 1], ['Ludovico Scarfiotti', 'ITA', 1], ['Peter Gethin', 'GBR', 1], ['Luigi Fagioli', 'ITA', 1], ['Piero Taruffi', 'ITA', 1], ['Luigi Musso', 'ITA', 1]],
  // Pobjednici Indianapolisa 500, koji se 1950.–1960. bodovao za Svjetsko prvenstvo
  F: [['Bill Vukovich', 'USA', 2], ['Johnnie Parsons', 'USA', 1], ['Lee Wallard', 'USA', 1], ['Troy Ruttman', 'USA', 1], ['Bob Sweikert', 'USA', 1], ['Pat Flaherty', 'USA', 1], ['Sam Hanks', 'USA', 1], ['Jimmy Bryan', 'USA', 1], ['Rodger Ward', 'USA', 1], ['Jim Rathmann', 'USA', 1]],
};
const DRZAVA = { GBR: 'Velika Britanija', GER: 'Njemačka', NED: 'Nizozemska', BRA: 'Brazil', ESP: 'Španjolska', MON: 'Monako', FRA: 'Francuska', AUT: 'Austrija', FIN: 'Finska', ITA: 'Italija', AUS: 'Australija', MEX: 'Meksiko', ARG: 'Argentina', CAN: 'Kanada', COL: 'Kolumbija', POL: 'Poljska', USA: 'SAD', VEN: 'Venezuela', SWE: 'Švedska', RSA: 'Južnoafrička Republika', SUI: 'Švicarska', BEL: 'Belgija', NZL: 'Novi Zeland' };
const EUROPA = new Set(['GBR', 'GER', 'NED', 'ESP', 'MON', 'FRA', 'AUT', 'FIN', 'ITA', 'POL', 'SWE', 'SUI', 'BEL']);
const PRVACI = new Set(['Giuseppe Farina', 'Juan Manuel Fangio', 'Alberto Ascari', 'Mike Hawthorn', 'Jack Brabham', 'Phil Hill', 'Graham Hill', 'Jim Clark', 'John Surtees', 'Denny Hulme', 'Jackie Stewart', 'Jochen Rindt', 'Emerson Fittipaldi', 'Niki Lauda', 'James Hunt', 'Mario Andretti', 'Jody Scheckter', 'Alan Jones', 'Nelson Piquet', 'Keke Rosberg', 'Alain Prost', 'Ayrton Senna', 'Nigel Mansell', 'Michael Schumacher', 'Damon Hill', 'Jacques Villeneuve', 'Mika Häkkinen', 'Fernando Alonso', 'Kimi Räikkönen', 'Lewis Hamilton', 'Jenson Button', 'Sebastian Vettel', 'Nico Rosberg', 'Max Verstappen', 'Lando Norris', 'Kimi Antonelli']);
const name = (entry) => entry[0].split('|')[0];
const pobjeda = (n) => (n === 1 ? '1 pobjeda' : n < 5 ? `${n} pobjede` : `${n} pobjeda`);
/** Izvodi popis odgovora iz tablice pobjednika uz zadani filtar. */
function izvedi(filter, note = (e) => `${DRZAVA[e[1]]}, ${pobjeda(e[2])}`) {
  const out = {};
  for (const [tier, list] of Object.entries(POBJEDNICI)) {
    const rows = list.filter(filter).map((e) => `${e[0]}#${note(e)}`);
    if (rows.length) out[tier] = rows;
  }
  return out;
}

export default [
  {
    dan: 1, poz: 6, cat: 'formula-1', kind: 'person', diff: 2, provjera: P,
    text: 'Navedi vozača koji je pobijedio na utrci Formule 1.',
    hint: 'Utrke Svjetskog prvenstva od 1950. do VN São Paula 2026.',
    izvori: [['Wikipedia: List of Formula One Grand Prix winners', W + 'List_of_Formula_One_Grand_Prix_winners'], F1],
    odgovori: izvedi(() => true),
  },
  {
    dan: 2, poz: 6, cat: 'formula-1', kind: 'country', diff: 2, provjera: P,
    text: 'Navedi državu u kojoj se vozila utrka Formule 1.',
    hint: 'Utrke Svjetskog prvenstva 1950.–2026.',
    izvori: [['Wikipedia: List of Formula One Grands Prix', W + 'List_of_Formula_One_Grands_Prix'], F1],
    odgovori: {
      A: ['Italija#110 utrka, najviše', 'Monako#72 utrke', 'Velika Britanija|Britanija|Engleska|UK|Ujedinjeno Kraljevstvo|Great Britain#prva utrka SP-a, Silverstone 1950.', 'Njemačka|Zapadna Njemačka', 'Španjolska', 'Belgija', 'Mađarska#jedina utrka iza Željezne zavjese, od 1986.', 'Austrija'],
      B: ['SAD|Sjedinjene Američke Države|Amerika', 'Brazil', 'Japan', 'Francuska', 'Nizozemska', 'Ujedinjeni Arapski Emirati|UAE|Emirati|Abu Dhabi|Abu Dabi', 'Bahrein|Bahrain', 'Australija', 'Kanada', 'Singapur', 'Meksiko', 'Katar', 'Saudijska Arabija', 'Azerbajdžan|Azerbejdžan|Azerbaijan'],
      C: ['Kina', 'Turska', 'Rusija', 'Portugal', 'Malezija', 'Južna Koreja|Koreja'],
      D: ['Argentina', 'Južnoafrička Republika|Južna Afrika|JAR|South Africa', 'Indija#2011.–2013.', 'Švedska#1973.–1978.', 'Švicarska#1950.–1954.'],
      E: ['Maroko#jedna utrka, Casablanca 1958.'],
    },
  },
  {
    dan: 3, poz: 6, cat: 'formula-1', kind: 'person', diff: 2, provjera: P,
    text: 'Navedi svjetskog prvaka Formule 1.',
    hint: 'Vozački naslovi 1950.–2026.',
    izvori: [['Wikipedia: List of Formula One World Drivers\' Champions', W + 'List_of_Formula_One_World_Drivers%27_Champions'], ['FIA — Hall of Fame', 'https://www.fia.com/fia-hall-fame']],
    odgovori: {
      A: ['Lewis Hamilton#7 naslova', 'Michael Schumacher|Schumi#7 naslova', 'Max Verstappen#2021.–2024.', 'Ayrton Senna#1988., 1990., 1991.', 'Sebastian Vettel#2010.–2013.', 'Fernando Alonso#2005. i 2006.'],
      B: ['Lando Norris#2025.', 'Kimi Antonelli|Andrea Kimi Antonelli#2026., najmlađi prvak', 'Alain Prost#4 naslova', 'Niki Lauda#1975., 1977., 1984.', 'Kimi Räikkönen|Kimi Raikkonen|Kimi#2007.', 'Nico Rosberg#2016.', 'Jenson Button#2009.', 'Mika Häkkinen|Mika Hakkinen#1998. i 1999.', 'Nigel Mansell#1992.'],
      C: ['Juan Manuel Fangio#5 naslova', 'Jackie Stewart#1969., 1971., 1973.', 'Nelson Piquet#1981., 1983., 1987.', 'Damon Hill#1996.', 'Jacques Villeneuve#1997.', 'James Hunt#1976.', 'Jim Clark#1963. i 1965.', 'Emerson Fittipaldi#1972. i 1974.', 'Jack Brabham#1959., 1960., 1966.'],
      D: ['Mario Andretti#1978.', 'Graham Hill#1962. i 1968.', 'Alberto Ascari#1952. i 1953.', 'Jochen Rindt#1970., posmrtno', 'Keke Rosberg#1982.', 'Jody Scheckter#1979.', 'Alan Jones#1980.', 'John Surtees#1964., prvak i na dva i na četiri kotača'],
      E: ['Giuseppe Farina|Nino Farina#prvi prvak, 1950.', 'Mike Hawthorn#1958.', 'Phil Hill#1961.', 'Denny Hulme#1967.'],
    },
  },
  {
    dan: 4, poz: 6, cat: 'formula-1', kind: 'team', diff: 3, provjera: 'Lista uspoređena s izvorom 13. 11. 2026. (stanje izvora: nakon VN Austrije 2026.).',
    text: 'Navedi konstruktora čiji je bolid pobijedio na utrci Formule 1.',
    hint: 'Utrke Svjetskog prvenstva od 1950. Bez pobjednika Indianapolisa 500.',
    izvori: [['Wikipedia: List of Formula One Grand Prix winners (constructors)', W + 'List_of_Formula_One_Grand_Prix_winners_(constructors)'], F1],
    odgovori: {
      A: ['Ferrari|Scuderia Ferrari#najviše pobjeda u povijesti', 'McLaren#više od 200 pobjeda', 'Mercedes|Mercedes-AMG|Mercedes AMG', 'Red Bull|Red Bull Racing', 'Williams#114 pobjeda'],
      B: ['Renault#35 pobjeda', 'Lotus|Team Lotus#79 pobjeda', 'Benetton#27 pobjeda', 'Brawn|Brawn GP#8 pobjeda u jedinoj sezoni, 2009.', 'Alpine#Mađarska 2021.', 'AlphaTauri|Alpha Tauri#Monza 2020.', 'Toro Rosso#Monza 2008.', 'Racing Point#Sakhir 2020.', 'Alfa Romeo#10 pobjeda 1950-ih'],
      C: ['Brabham#35 pobjeda', 'Tyrrell#23 pobjede', 'Jordan#4 pobjede', 'Honda#3 pobjede', 'BMW Sauber#Kanada 2008.', 'Maserati#9 pobjeda', 'Ligier#9 pobjeda', 'Lotus F1|Lotus F1 Team#2012. i 2013., Räikkönen'],
      D: ['BRM#17 pobjeda', 'Cooper#16 pobjeda', 'Matra#9 pobjeda', 'Vanwall#9 pobjeda', 'March#3 pobjede', 'Stewart|Stewart Grand Prix#Nürburgring 1999.', 'Porsche#Francuska 1962.', 'Wolf#3 pobjede 1977.'],
      E: ['Hesketh#Zandvoort 1975., James Hunt', 'Penske#Austrija 1976.', 'Shadow#Austrija 1977.', 'Eagle#Belgija 1967., Dan Gurney'],
    },
  },
  {
    dan: 5, poz: 6, cat: 'formula-1', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi vozača koji je pobijedio na Velikoj nagradi Monaka.',
    hint: 'Utrke Svjetskog prvenstva 1950. i 1955.–2026.',
    izvori: [['Wikipedia: Monaco Grand Prix', W + 'Monaco_Grand_Prix'], F1],
    odgovori: {
      A: ['Ayrton Senna#6 pobjeda, rekorder', 'Michael Schumacher|Schumi#5 pobjeda', 'Lewis Hamilton#3 pobjede', 'Charles Leclerc#2024., na domaćim ulicama', 'Max Verstappen#2 pobjede', 'Sebastian Vettel#2 pobjede'],
      B: ['Fernando Alonso#2006. i 2007.', 'Nico Rosberg#tri zaredom 2013.–2015.', 'Lando Norris#2025.', 'Kimi Antonelli|Andrea Kimi Antonelli#2026.', 'Alain Prost#4 pobjede', 'Daniel Ricciardo#2018.', 'Sergio Pérez|Sergio Perez|Checo Pérez|Checo#2022.', 'Kimi Räikkönen|Kimi Raikkonen|Kimi#2005.', 'Jenson Button#2009.', 'Mark Webber#2010. i 2012.', 'Niki Lauda#1975. i 1976.'],
      C: ['Graham Hill#5 pobjeda, "Mr. Monaco"', 'David Coulthard#2000. i 2002.', 'Mika Häkkinen|Mika Hakkinen#1998.', 'Juan Pablo Montoya#2003.', 'Jarno Trulli#2004., jedina pobjeda u karijeri', 'Olivier Panis#1996., jedina pobjeda u karijeri', 'Jackie Stewart#3 pobjede', 'Stirling Moss#3 pobjede', 'Juan Manuel Fangio#1950. i 1957.', 'Gilles Villeneuve#1981.'],
      D: ['Keke Rosberg#1983.', 'Riccardo Patrese#1982.', 'Jody Scheckter#1977. i 1979.', 'Carlos Reutemann#1980.', 'Ronnie Peterson#1974.', 'Jochen Rindt#1970., u posljednjem zavoju', 'Jack Brabham#1959.', 'Denny Hulme#1967.', 'Bruce McLaren#1962.'],
      E: ['Maurice Trintignant#1955. i 1958.', 'Jean-Pierre Beltoise#1972., na kiši', 'Patrick Depailler#1978.'],
    },
  },
  {
    dan: 6, poz: 6, cat: 'formula-1', kind: 'other', diff: 3, provjera: P,
    text: 'Navedi stazu na kojoj se vozila utrka Formule 1.',
    hint: 'Staze koje su ugostile utrku Svjetskog prvenstva. Priznaje se uobičajeni naziv staze ili grada.',
    izvori: [['Wikipedia: List of Formula One circuits', W + 'List_of_Formula_One_circuits'], F1],
    odgovori: {
      A: ['Monza#Italija', 'Monaco|Monte Carlo|Monako#ulična staza', 'Silverstone#Velika Britanija', 'Spa-Francorchamps|Spa|Spa Francorchamps#Belgija', 'Hungaroring|Budimpešta|Mogyoród#Mađarska', 'Red Bull Ring|Spielberg|A1-Ring|Österreichring|Osterreichring#Austrija', 'Imola|Autodromo Enzo e Dino Ferrari#Italija'],
      B: ['Suzuka#Japan', 'Interlagos|São Paulo|Sao Paulo#Brazil', 'Barcelona-Catalunya|Barcelona|Catalunya|Montmeló|Montmelo#Španjolska', 'Zandvoort#Nizozemska', 'Yas Marina|Abu Dhabi|Abu Dabi#UAE', 'Marina Bay|Singapur|Singapore#noćna utrka', 'Baku#Azerbajdžan', 'Hockenheim|Hockenheimring#Njemačka', 'Nürburgring|Nurburgring#Njemačka', 'Bahrain|Bahrein|Sakhir#Bahrein', 'Jeddah|Džeda|Jeddah Corniche#Saudijska Arabija', 'Las Vegas|Las Vegas Strip#SAD', 'Miami#SAD', 'Circuit of the Americas|Austin|COTA#SAD', 'Albert Park|Melbourne#Australija', 'Gilles Villeneuve|Montreal|Circuit Gilles Villeneuve#Kanada', 'Shanghai|Šangaj#Kina', 'Lusail|Losail|Katar#Katar', 'Hermanos Rodríguez|Mexico City|Autodromo Hermanos Rodriguez|Ciudad de México#Meksiko'],
      C: ['Istanbul Park|Istanbul#Turska', 'Sepang#Malezija', 'Sochi|Soči#Rusija', 'Paul Ricard|Le Castellet#Francuska', 'Magny-Cours|Magny Cours#Francuska', 'Estoril#Portugal', 'Algarve|Portimão|Portimao#Portugal', 'Mugello#Italija, 2020.', 'Indianapolis#SAD', 'Brands Hatch#Velika Britanija', 'Kyalami#Južnoafrička Republika', 'Valencia#Španjolska, ulična staza', 'Jerez#Španjolska', 'Adelaide#Australija', 'Madring|Madrid#Španjolska, od 2026.', 'Buddh|Buddh International#Indija', 'Korea|Yeongam|Jeongam#Južna Koreja', 'Fuji#Japan'],
      D: ['Zeltweg#Austrija, 1964.', 'Zolder#Belgija', 'Jarama#Španjolska', 'Dijon-Prenois|Dijon#Francuska', 'Watkins Glen#SAD', 'Long Beach#SAD', 'Detroit#SAD', 'Phoenix#SAD', 'Donington Park|Donington#Velika Britanija, 1993.', 'Aida|TI Aida|Okayama#Japan', 'Buenos Aires|Oscar y Juan Gálvez|Oscar Galvez#Argentina', 'Jacarepaguá|Jacarepagua|Rio de Janeiro|Nelson Piquet#Brazil', 'Anderstorp|Scandinavian Raceway#Švedska', 'Reims|Reims-Gueux#Francuska', 'Aintree#Velika Britanija', 'Montjuïc|Montjuic#Španjolska', 'Mosport|Mosport Park#Kanada'],
      E: ['Caesars Palace#Las Vegas, 1981. i 1982.', 'Dallas|Dallas Fair Park#SAD, 1984.', 'AVUS#Berlin, 1959.', 'Pescara#najdulja staza u povijesti SP-a', 'Ain-Diab|Ain Diab|Casablanca#Maroko, 1958.', 'Bremgarten|Bern#Švicarska', 'Pedralbes#Španjolska', 'Rouen|Rouen-Les-Essarts#Francuska', 'Charade|Clermont-Ferrand#Francuska', 'Le Mans|Bugatti|Bugatti Circuit#Francuska, 1967.', 'Nivelles|Nivelles-Baulers#Belgija', 'Mont-Tremblant|Mont Tremblant|St. Jovite#Kanada', 'Boavista|Porto#Portugal', 'Monsanto|Lisabon#Portugal, 1959.', 'Riverside#SAD, 1960.', 'Sebring#SAD, 1959.', 'East London|Prince George#Južnoafrička Republika'],
    },
  },
  {
    dan: 7, poz: 6, cat: 'formula-1', kind: 'country', diff: 3, provjera: P + ' Izvedeno iz popisa pobjednika utrka.',
    text: 'Navedi državu iz koje dolazi barem jedan pobjednik utrke Formule 1.',
    hint: 'Prema državi pod kojom je vozač nastupao u Svjetskom prvenstvu, 1950.–2026.',
    izvori: [['Wikipedia: List of Formula One Grand Prix winners', W + 'List_of_Formula_One_Grand_Prix_winners'], F1],
    odgovori: {
      A: ['Velika Britanija|Britanija|Engleska|UK|Ujedinjeno Kraljevstvo|Great Britain|Škotska#najviše pobjednika', 'Njemačka|Zapadna Njemačka#Schumacher, Vettel, Rosberg', 'Nizozemska#Verstappen', 'Brazil#Senna, Piquet, Fittipaldi', 'Španjolska#Alonso, Sainz', 'Monako#Leclerc', 'Italija#od Farine do Antonellija'],
      B: ['Francuska#Prost i još 13 pobjednika', 'Finska#Häkkinen, Räikkönen, Rosberg, Bottas, Kovalainen', 'Austrija#Lauda, Rindt, Berger', 'Australija#Brabham, Jones, Webber, Ricciardo, Piastri', 'Meksiko#Pérez, Rodríguez', 'Argentina#Fangio, Reutemann, González'],
      C: ['SAD|Sjedinjene Američke Države|Amerika#Andretti, Gurney, Phil Hill', 'Kanada#Gilles i Jacques Villeneuve', 'Poljska#Kubica', 'Kolumbija#Montoya', 'Belgija#Ickx, Boutsen', 'Švedska#Peterson, Nilsson, Bonnier'],
      D: ['Venezuela#Maldonado, Španjolska 2012.', 'Švicarska#Regazzoni, Siffert', 'Novi Zeland#Hulme, McLaren', 'Južnoafrička Republika|Južna Afrika|JAR|South Africa#Scheckter'],
    },
  },
  {
    dan: 8, poz: 6, cat: 'formula-1', kind: 'team', diff: 3, provjera: 'Sastavljeno iz službenih popisa sudionika sezona 2000.–2026.; momčadi sezone 2026. potvrđene na izvoru 13. 11. 2026.',
    text: 'Navedi momčad koja je nastupala u Formuli 1 u 21. stoljeću.',
    hint: 'Konstruktori koji su startali barem na jednoj utrci od sezone 2000. do 2026.',
    izvori: [['Wikipedia: 2026 Formula One World Championship', W + '2026_Formula_One_World_Championship'], ['Wikipedia: List of Formula One constructors', W + 'List_of_Formula_One_constructors'], F1],
    odgovori: {
      A: ['Ferrari|Scuderia Ferrari', 'McLaren', 'Mercedes|Mercedes-AMG|Mercedes AMG#od 2010.', 'Red Bull|Red Bull Racing#od 2005.', 'Williams'],
      B: ['Aston Martin#od 2021.', 'Alpine#od 2021.', 'Haas#od 2016.', 'Renault', 'Sauber|Kick Sauber|Stake', 'Audi#od 2026.', 'Cadillac#od 2026.', 'Racing Bulls|RB|Visa Cash App RB|VCARB#od 2024.', 'Alfa Romeo#2019.–2023.', 'AlphaTauri|Alpha Tauri#2020.–2023.', 'Toro Rosso|Scuderia Toro Rosso#2006.–2019.'],
      C: ['Force India#2008.–2018.', 'Racing Point#2019. i 2020.', 'Lotus|Lotus F1|Lotus Racing|Team Lotus#2010.–2015.', 'Toyota#2002.–2009.', 'Honda#2006.–2008.', 'Brawn|Brawn GP#2009.', 'BMW Sauber#2006.–2009.', 'Jordan#do 2005.', 'Benetton#do 2001.', 'Jaguar#2000.–2004.', 'BAR|British American Racing#do 2005.', 'Minardi#do 2005.'],
      D: ['Caterham#2012.–2014.', 'Marussia#2012.–2015.', 'Manor|Manor Racing#2016.', 'Virgin|Virgin Racing#2010. i 2011.', 'HRT|Hispania|Hispania Racing#2010.–2012.', 'Arrows#do 2002.', 'Prost|Prost Grand Prix#do 2001.', 'Super Aguri#2006.–2008.'],
      E: ['Spyker#2007.', 'Midland|MF1|Midland F1#2006.'],
    },
  },
  {
    dan: 9, poz: 6, cat: 'formula-1', kind: 'person', diff: 4, provjera: P + ' Izvedeno iz popisa pobjednika i popisa prvaka.',
    text: 'Navedi vozača koji je pobijedio na utrci Formule 1, a nikada nije bio svjetski prvak.',
    hint: 'Stanje nakon VN São Paula 2026.',
    izvori: [['Wikipedia: List of Formula One Grand Prix winners', W + 'List_of_Formula_One_Grand_Prix_winners'], ['Wikipedia: List of Formula One World Drivers\' Champions', W + 'List_of_Formula_One_World_Drivers%27_Champions']],
    odgovori: izvedi((e) => !PRVACI.has(name(e))),
  },
  {
    dan: 10, poz: 6, cat: 'formula-1', kind: 'person', diff: 4, provjera: P + ' Izvedeno iz popisa pobjednika utrka.',
    text: 'Navedi pobjednika utrke Formule 1 koji nije iz Europe.',
    hint: 'Vozači iz obiju Amerika, Australije, Novog Zelanda i Afrike; stanje nakon VN São Paula 2026.',
    izvori: [['Wikipedia: List of Formula One Grand Prix winners', W + 'List_of_Formula_One_Grand_Prix_winners'], F1],
    odgovori: izvedi((e) => !EUROPA.has(e[1])),
  },
];
