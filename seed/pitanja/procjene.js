// PROCJENE — 10 pitanja (pozicija 8). Svaka brojka ima jedinicu, datum na koji se odnosi i izvor.
// Vrijednosti provjerene na navedenim izvorima 13. 11. 2026.
const W = 'https://en.wikipedia.org/wiki/';
const P = 'Vrijednost provjerena na izvoru 13. 11. 2026.';
const cilj = (value, unit, ref_date, tolerance_pct, extra = {}) => ({ value, unit, ref_date, tolerance_pct, scoring_mode: 'pragovi+najblizi', tie_rule: 'dijele', is_estimate: 0, ...extra });

export default [
  {
    dan: 1, poz: 8, cat: 'procjene', type: 'numeric', sport: 'košarka', diff: 3, provjera: P,
    text: 'Koliko je poena LeBron James postigao u regularnom dijelu NBA sezona?',
    hint: 'Samo regularni dio, bez doigravanja.',
    target: cilj(43471, 'poena', '2026-10-24', 0.5, { note: 'Regularni dio sezone, bez doigravanja; LeBron je još aktivan pa brojka raste.' }),
    izvori: [['Wikipedia: List of NBA career scoring leaders', W + 'List_of_NBA_career_scoring_leaders'], ['Basketball Reference — LeBron James', 'https://www.basketball-reference.com/players/j/jamesle01.html']],
  },
  {
    dan: 2, poz: 8, cat: 'procjene', type: 'numeric', sport: 'nogomet', diff: 3, provjera: P,
    text: 'Koliko je ukupno golova postignuto na svim muškim Svjetskim nogometnim prvenstvima?',
    hint: 'Sva 23 završna turnira, od 1930. do 2026.; jedanaesterci nakon produžetaka se ne broje.',
    target: cilj(3028, 'golova', '2026-07-19', 1, { note: '1.068 utakmica; samo 2026. palo je 308 golova u 104 utakmice.' }),
    izvori: [['Wikipedia: FIFA World Cup records and statistics', W + 'FIFA_World_Cup_records_and_statistics'], ['FIFA', 'https://www.fifa.com/en/tournaments/mens/worldcup']],
  },
  {
    dan: 3, poz: 8, cat: 'procjene', type: 'numeric', sport: 'tenis', diff: 3, provjera: 'Brojku je iznio sam Safin 2011.; nije službena statistika. Provjereno na izvoru 13. 11. 2026.',
    text: 'Koliko je reketa Marat Safin razbio tijekom karijere?',
    hint: 'Prema brojci koju je iznio sam Safin nakon završetka karijere.',
    target: cilj(1055, 'reketa', '2009-11-11', 2, { is_estimate: 1, note: 'Safinova vlastita brojka — ATP ne vodi takvu statistiku.' }),
    izvori: [['Wikipedia: Marat Safin', W + 'Marat_Safin'], ['USA Today (2005.): Safin tries to hold serve with emotions, career', 'https://www.usatoday.com/sports/tennis/2005-04-27-safin-french_x.htm']],
  },
  {
    dan: 4, poz: 8, cat: 'procjene', type: 'numeric', sport: 'Formula 1', diff: 2, provjera: P,
    text: 'Koliko je pobjeda u Formuli 1 ostvario Lewis Hamilton?',
    hint: 'Utrke Svjetskog prvenstva, bez sprint-utrka.',
    target: cilj(106, 'pobjeda', '2026-11-08', 0.5, { note: 'Uključuje i prvu pobjedu s Ferrarijem, Barcelona 2026.' }),
    izvori: [['Wikipedia: List of Formula One Grand Prix winners', W + 'List_of_Formula_One_Grand_Prix_winners'], ['Formula 1 — Lewis Hamilton', 'https://www.formula1.com/en/drivers/lewis-hamilton']],
  },
  {
    dan: 5, poz: 8, cat: 'procjene', type: 'numeric', sport: 'tenis', diff: 4, provjera: P,
    text: 'Koliko je američkih dolara Marin Čilić zaradio od nagrada na teniskim turnirima?',
    hint: 'Službeni ATP nagradni fond, pojedinačno i parovi; bez sponzorskih ugovora. Upiši iznos u dolarima, npr. 12,5 mil.',
    target: cilj(33520563, 'USD', '2026-09-13', 1.5, { note: 'Samo službene turnirske nagrade (ATP prize money), stanje nakon US Opena 2026.' }),
    izvori: [['Wikipedia: Marin Čilić', W + 'Marin_%C4%8Cili%C4%87'], ['ATP Tour — Marin Čilić', 'https://www.atptour.com/en/players/marin-cilic/c977/overview']],
  },
  {
    dan: 6, poz: 8, cat: 'procjene', type: 'numeric', sport: 'košarka', diff: 2, provjera: 'Povijesni podatak; utakmica Cibona – Olimpija odigrana 5. 10. 1985.',
    text: 'Koliko je poena Dražen Petrović postigao u jednoj prvenstvenoj utakmici protiv Olimpije 1985.?',
    hint: 'Cibona – Olimpija, prvenstvo Jugoslavije; njegov rekord karijere.',
    target: cilj(112, 'poena', '1985-10-05', 0.5, { note: 'Olimpija je zbog suspenzija nastupila s juniorima.' }),
    izvori: [['Wikipedia: Dražen Petrović', W + 'Dra%C5%BEen_Petrovi%C4%87'], ['Muzejsko-memorijalni centar Dražen Petrović', 'https://www.drazenpetrovic.net/']],
  },
  {
    dan: 7, poz: 8, cat: 'procjene', type: 'numeric', sport: 'tenis', diff: 3, provjera: P,
    text: 'Koliko je tjedana Novak Đoković ukupno proveo na prvom mjestu ATP ljestvice?',
    hint: 'Ukupan broj tjedana, rekord svih vremena.',
    target: cilj(428, 'tjedana', '2026-11-09', 0.5, { note: 'Posljednji je put bio broj 1 u lipnju 2024.' }),
    izvori: [['Wikipedia: List of ATP number 1 ranked singles tennis players', W + 'List_of_ATP_number_1_ranked_singles_tennis_players'], ['ATP Tour — ljestvice', 'https://www.atptour.com/en/rankings/former-no-1s']],
  },
  {
    dan: 8, poz: 8, cat: 'procjene', type: 'numeric', sport: 'rukomet', diff: 3, provjera: P,
    text: 'Koliko je golova Ivano Balić postigao za hrvatsku rukometnu reprezentaciju?',
    hint: 'Službene utakmice A reprezentacije, 2001.–2012.',
    target: cilj(535, 'golova', '2012-08-12', 1, { note: 'U 198 nastupa.' }),
    izvori: [['Wikipedia: Ivano Balić', W + 'Ivano_Bali%C4%87'], ['Hrvatski rukometni savez', 'https://hrs.hr/']],
  },
  {
    dan: 9, poz: 8, cat: 'procjene', type: 'numeric', sport: 'nogomet', diff: 3, provjera: 'Službeni podatak FIFA-e; povijesni izvori navode i veće procjene. Općepoznat podatak, naveden izvor za provjeru.',
    text: 'Koliko je gledatelja, prema službenom podatku, gledalo odlučujuću utakmicu SP-a 1950. Urugvaj – Brazil na Maracani?',
    hint: 'Službeno zabilježen broj gledatelja; stvaran je broj vjerojatno bio veći.',
    target: cilj(173850, 'gledatelja', '1950-07-16', 1.5, { note: 'Službeno 173.850 plaćenih ulaznica; procjene stvarnog broja idu do 200.000. Rekord svih vremena.' }),
    izvori: [['Wikipedia: Uruguay v Brazil (1950 FIFA World Cup)', W + 'Uruguay_v_Brazil_(1950_FIFA_World_Cup)'], ['FIFA — 1950 FIFA World Cup', 'https://www.fifa.com/en/tournaments/mens/worldcup/1950brazil']],
  },
  {
    dan: 10, poz: 8, cat: 'procjene', type: 'numeric', sport: 'boks', diff: 3, provjera: 'Omjer 107-6-2 prema BoxRecu; općepoznat podatak, naveden izvor za provjeru.',
    text: 'Koliko je profesionalnih borbi u karijeri odradio meksički boksač Julio César Chávez?',
    hint: 'Sve profesionalne borbe od 1980. do 2005. (Chávez stariji).',
    target: cilj(115, 'borbi', '2005-09-17', 0.5, { note: '107 pobjeda, 6 poraza i 2 neriješene borbe.' }),
    izvori: [['BoxRec — Julio César Chávez', 'https://boxrec.com/en/box-pro/8119'], ['Wikipedia: Julio César Chávez', W + 'Julio_C%C3%A9sar_Ch%C3%A1vez']],
  },
];
