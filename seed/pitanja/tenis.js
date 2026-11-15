// TENIS — 10 pitanja (pozicija 5). Liste uspoređene s izvorima 13. 11. 2026.
const W = 'https://en.wikipedia.org/wiki/';
const P = 'Lista uspoređena s izvorom 13. 11. 2026.';
const US = ' Pobjednik US Opena 2026. u muškoj konkurenciji nije bio dostupan na izvoru — provjeriti i po potrebi dopuniti.';

export default [
  {
    dan: 1, poz: 5, cat: 'tenis', kind: 'person', diff: 2, provjera: P + US,
    text: 'Navedi tenisača koji je osvojio Grand Slam turnir u Open eri.',
    hint: 'Muški pojedinačno, od Roland Garrosa 1968. do Wimbledona 2026.',
    izvori: [['Wikipedia: List of Grand Slam men\'s singles champions', W + 'List_of_Grand_Slam_men%27s_singles_champions'], ['ITF — Grand Slam', 'https://www.itftennis.com/en/itf-tours/grand-slam-tournaments/']],
    odgovori: {
      A: ['Novak Đoković|Novak Djokovic|Nole#24 naslova, rekorder', 'Rafael Nadal|Rafa Nadal#22 naslova', 'Roger Federer#20 naslova', 'Carlos Alcaraz#7 naslova', 'Jannik Sinner#5 naslova', 'Marin Čilić#US Open 2014.', 'Goran Ivanišević#Wimbledon 2001.'],
      B: ['Andy Murray#3 naslova', 'Pete Sampras#14 naslova', 'Andre Agassi#8 naslova', 'Stan Wawrinka|Stanislas Wawrinka#3 naslova', 'Daniil Medvedev|Danil Medvedev|Medvedev#US Open 2021.', 'Alexander Zverev|Sascha Zverev#Roland Garros 2026.', 'Björn Borg|Bjorn Borg#11 naslova', 'John McEnroe#7 naslova', 'Boris Becker#6 naslova', 'Juan Martín del Potro|Del Potro|Juan Martin del Potro#US Open 2009.', 'Dominic Thiem#US Open 2020.', 'Andy Roddick#US Open 2003.', 'Marat Safin#US Open 2000., Australian Open 2005.'],
      C: ['Ivan Lendl#8 naslova', 'Stefan Edberg#6 naslova', 'Jimmy Connors#8 naslova', 'Mats Wilander#7 naslova', 'Lleyton Hewitt#2 naslova', 'Gustavo Kuerten|Guga Kuerten|Guga#3 Roland Garrosa', 'Jim Courier#4 naslova', 'Rod Laver#5 naslova u Open eri', 'Juan Carlos Ferrero#Roland Garros 2003.', 'Carlos Moyá|Carlos Moya#Roland Garros 1998.', 'Thomas Muster#Roland Garros 1995.', 'Jevgenij Kafeljnikov|Yevgeny Kafelnikov|Kafelnikov#2 naslova', 'Patrick Rafter|Pat Rafter#US Open 1997. i 1998.', 'Michael Chang#Roland Garros 1989., sa 17 godina', 'Michael Stich#Wimbledon 1991.', 'Richard Krajicek#Wimbledon 1996.'],
      D: ['Arthur Ashe#3 naslova', 'Ilie Năstase|Ilie Nastase#2 naslova', 'Guillermo Vilas#4 naslova', 'Yannick Noah#Roland Garros 1983.', 'Pat Cash#Wimbledon 1987.', 'Sergi Bruguera#Roland Garros 1993. i 1994.', 'Petr Korda#Australian Open 1998.', 'Albert Costa#Roland Garros 2002.', 'Gastón Gaudio|Gaston Gaudio#Roland Garros 2004.', 'Thomas Johansson#Australian Open 2002.', 'John Newcombe#5 naslova u Open eri', 'Ken Rosewall#4 naslova u Open eri', 'Stan Smith#2 naslova'],
      E: ['Jan Kodeš|Jan Kodes#3 naslova', 'Andrés Gimeno|Andres Gimeno#Roland Garros 1972.', 'Adriano Panatta#Roland Garros 1976.', 'Andrés Gómez|Andres Gomez#Roland Garros 1990.', 'Manuel Orantes#US Open 1975.', 'Vitas Gerulaitis#Australian Open 1977.', 'Roscoe Tanner#Australian Open 1977.', 'Johan Kriek#Australian Open 1981. i 1982.'],
      F: ['Mark Edmondson#Australian Open 1976., kao 212. igrač svijeta', 'Brian Teacher#Australian Open 1980.'],
    },
  },
  {
    dan: 2, poz: 5, cat: 'tenis', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi tenisačicu koja je bila prva na WTA ljestvici.',
    hint: 'Pojedinačna ljestvica od 1975. Stanje: 29. listopada 2026.',
    izvori: [['WTA — ljestvice', 'https://www.wtatennis.com/rankings/singles'], ['Wikipedia: List of WTA number 1 ranked singles tennis players', W + 'List_of_WTA_number_1_ranked_singles_tennis_players']],
    odgovori: {
      A: ['Serena Williams|Serena#319 tjedana', 'Iga Świątek|Iga Swiatek|Iga Šviontek#125 tjedana', 'Aryna Sabalenka|Arina Sabalenka#107 tjedana', 'Steffi Graf|Štefi Graf#377 tjedana, rekorderka', 'Maria Sharapova|Marija Šarapova|Šarapova#21 tjedan'],
      B: ['Venus Williams|Venus#11 tjedana', 'Martina Navratilova|Martina Navrátilová#332 tjedna', 'Monica Seles|Monika Seleš|Seleš#178 tjedana', 'Martina Hingis#209 tjedana', 'Naomi Osaka#25 tjedana', 'Simona Halep#64 tjedna', 'Ashleigh Barty|Ash Barty#121 tjedan', 'Elena Rybakina|Jelena Ribakina|Ribakina#7 tjedana', 'Caroline Wozniacki|Karolina Vozniacki#71 tjedan', 'Ana Ivanović|Ana Ivanovic#12 tjedana', 'Jelena Janković|Jelena Jankovic#18 tjedana'],
      C: ['Chris Evert|Chris Evert-Lloyd#prva broj 1, 260 tjedana', 'Justine Henin|Justine Henin-Hardenne#117 tjedana', 'Kim Clijsters#20 tjedana', 'Victoria Azarenka|Viktorija Azarenka#51 tjedan', 'Angelique Kerber#34 tjedna', 'Lindsay Davenport#98 tjedana', 'Jennifer Capriati#17 tjedana', 'Amélie Mauresmo|Amelie Mauresmo#39 tjedana', 'Garbiñe Muguruza|Garbine Muguruza#4 tjedna', 'Karolína Plíšková|Karolina Pliskova|Karolina Pliškova#8 tjedana'],
      D: ['Dinara Safina#26 tjedana, sestra Marata Safina', 'Arantxa Sánchez Vicario|Arantxa Sanchez Vicario|Arantxa Sánchez|Sánchez Vicario#12 tjedana', 'Tracy Austin#21 tjedan'],
      E: ['Evonne Goolagong|Evonne Goolagong Cawley|Goolagong Cawley#2 tjedna, priznato naknadno'],
    },
  },
  {
    dan: 3, poz: 5, cat: 'tenis', kind: 'person', diff: 4, provjera: P + US + ' Ako je pobjednik nekog Grand Slama s ovog popisa, treba ga ukloniti.',
    text: 'Navedi tenisača koji je osvojio turnir iz serije Masters 1000, a nikada nije osvojio Grand Slam.',
    hint: 'Masters turniri od 1990. (Super 9, Masters Series, Masters 1000). Stanje nakon Šangaja 2026.',
    izvori: [['Wikipedia: ATP Masters 1000 singles records and statistics', W + 'ATP_Masters_1000_singles_records_and_statistics'], ['ATP Tour', 'https://www.atptour.com/en/tournaments']],
    odgovori: {
      A: ['Borna Ćorić|Borna Coric#Cincinnati 2022.', 'Ivan Ljubičić|Ivan Ljubicic#Indian Wells 2010.', 'Stefanos Tsitsipas#3 naslova u Monte Carlu', 'Casper Ruud#Madrid 2025.', 'Andrej Rubljov|Andrey Rublev|Rublev#2 naslova', 'Holger Rune#Pariz 2022.', 'Taylor Fritz#Indian Wells 2022.', 'Grigor Dimitrov#Cincinnati 2017.'],
      B: ['David Ferrer#Pariz 2012.', 'Jo-Wilfried Tsonga|Tsonga#2 naslova', 'Tomáš Berdych|Tomas Berdych#Pariz 2005.', 'Nikolaj Davidenko|Nikolay Davydenko|Davydenko#3 naslova', 'David Nalbandian#Madrid i Pariz 2007.', 'Hubert Hurkacz#2 naslova', 'Karen Hačanov|Karen Khachanov|Khachanov#Pariz 2018.', 'John Isner#Miami 2018.', 'Jack Draper#Indian Wells 2025.', 'Ben Shelton#2 naslova', 'Fabio Fognini#Monte Carlo 2019.', 'Robin Söderling|Robin Soderling#Pariz 2010.', 'Tim Henman#Pariz 2003.', 'Marcelo Ríos|Marcelo Rios#5 naslova, bio je broj 1 bez Grand Slama'],
      C: ['Tommy Haas#Stuttgart 2001.', 'Pablo Carreño Busta|Pablo Carreno Busta|Carreño Busta#Montreal 2022.', 'Cameron Norrie#Indian Wells 2021.', 'Jack Sock#Pariz 2017.', 'Jakub Menšík|Jakub Mensik#Miami 2025.', 'Alexei Popyrin#Montreal 2024.', 'Arthur Fils', 'Alejandro Davidovich Fokina|Davidovich Fokina|Alejandro Davidovich', 'Valentin Vacherot#Šangaj 2025.', 'Guillermo Coria#2 naslova', 'Àlex Corretja|Alex Corretja#2 naslova', 'Mark Philippoussis#Indian Wells 1999.', 'Greg Rusedski#Pariz 1998.', 'Tommy Robredo#Hamburg 2006.', 'Sébastien Grosjean|Sebastien Grosjean#Pariz 2001.', 'Magnus Norman#Rim 2000.', 'Cédric Pioline|Cedric Pioline#Monte Carlo 2000.', 'Thomas Enqvist#3 naslova'],
      D: ['Andrej Medvedev|Andrei Medvedev|Medvedev#4 naslova 1990-ih', 'Guy Forget#2 naslova 1991.', 'Wayne Ferreira#2 naslova', 'Guillermo Cañas|Guillermo Canas#Toronto 2002.', 'Félix Mantilla|Felix Mantilla#Rim 2003.', 'Andrei Pavel#Montreal 2001.', 'Emilio Sánchez|Emilio Sanchez#Rim 1991.', 'Andrej Česnokov|Andrei Chesnokov|Chesnokov#2 naslova'],
      E: ['Albert Portas#Hamburg 2001., kao kvalifikant', 'Roberto Carretero#Hamburg 1996., kao 143. igrač svijeta', 'Chris Woodruff#Montreal 1997.', 'Juan Aguilera#Hamburg 1990.', 'Karel Nováček|Karel Novacek#Hamburg 1991.', 'Mikael Pernfors#Montreal 1993.'],
    },
  },
  {
    dan: 4, poz: 5, cat: 'tenis', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi tenisača koji je bio prvi na ATP ljestvici.',
    hint: 'Pojedinačna ljestvica od 1973. do danas.',
    izvori: [['ATP — ljestvice', 'https://www.atptour.com/en/rankings/singles'], ['Wikipedia: List of ATP number 1 ranked singles tennis players', W + 'List_of_ATP_number_1_ranked_singles_tennis_players']],
    odgovori: {
      A: ['Novak Đoković|Novak Djokovic|Nole#428 tjedana, rekorder', 'Roger Federer#310 tjedana', 'Rafael Nadal|Rafa Nadal#209 tjedana', 'Carlos Alcaraz#najmlađi broj 1 u povijesti', 'Jannik Sinner'],
      B: ['Andy Murray#41 tjedan', 'Pete Sampras#286 tjedana', 'Andre Agassi#101 tjedan', 'Daniil Medvedev|Danil Medvedev#16 tjedana', 'Björn Borg|Bjorn Borg#109 tjedana', 'John McEnroe#170 tjedana', 'Boris Becker#12 tjedana', 'Ivan Lendl#270 tjedana'],
      C: ['Jimmy Connors#268 tjedana', 'Andy Roddick#13 tjedana', 'Lleyton Hewitt#80 tjedana', 'Marat Safin#9 tjedana', 'Stefan Edberg#72 tjedna', 'Gustavo Kuerten|Guga Kuerten|Guga#43 tjedna', 'Jim Courier#58 tjedana', 'Juan Carlos Ferrero#8 tjedana', 'Mats Wilander#20 tjedana'],
      D: ['Marcelo Ríos|Marcelo Rios#6 tjedana, jedini bez Grand Slama', 'Carlos Moyá|Carlos Moya#2 tjedna', 'Jevgenij Kafeljnikov|Yevgeny Kafelnikov|Kafelnikov#6 tjedana', 'Thomas Muster#6 tjedana', 'Ilie Năstase|Ilie Nastase#prvi broj 1, 40 tjedana'],
      E: ['Patrick Rafter|Pat Rafter#samo jedan tjedan', 'John Newcombe#8 tjedana'],
    },
  },
  {
    dan: 5, poz: 5, cat: 'tenis', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi tenisačicu koja je osvojila Grand Slam turnir u 21. stoljeću.',
    hint: 'Ženski pojedinačno, od Australian Opena 2000. do US Opena 2026.',
    izvori: [['Wikipedia: List of Grand Slam women\'s singles champions', W + 'List_of_Grand_Slam_women%27s_singles_champions'], ['WTA', 'https://www.wtatennis.com/']],
    odgovori: {
      A: ['Serena Williams|Serena#22 naslova u tom razdoblju', 'Iga Świątek|Iga Swiatek|Iga Šviontek#6 naslova', 'Aryna Sabalenka|Arina Sabalenka#4 naslova', 'Maria Sharapova|Marija Šarapova|Šarapova#5 naslova', 'Coco Gauff|Cori Gauff#2 naslova', 'Elena Rybakina|Jelena Ribakina|Ribakina#3 naslova, dva 2026.'],
      B: ['Venus Williams|Venus#7 naslova', 'Naomi Osaka#4 naslova', 'Simona Halep#2 naslova', 'Ashleigh Barty|Ash Barty#3 naslova', 'Justine Henin|Justine Henin-Hardenne#7 naslova', 'Kim Clijsters#4 naslova', 'Ana Ivanović|Ana Ivanovic#Roland Garros 2008.', 'Caroline Wozniacki#Australian Open 2018.', 'Petra Kvitová|Petra Kvitova#Wimbledon 2011. i 2014.', 'Victoria Azarenka|Viktorija Azarenka#2 naslova', 'Angelique Kerber#3 naslova', 'Emma Raducanu#US Open 2021., kao kvalifikantica'],
      C: ['Garbiñe Muguruza|Garbine Muguruza#2 naslova', 'Li Na|Na Li#2 naslova', 'Jennifer Capriati#3 naslova', 'Amélie Mauresmo|Amelie Mauresmo#2 naslova', 'Lindsay Davenport#Australian Open 2000.', 'Svetlana Kuznjecova|Svetlana Kuznetsova|Kuznetsova#2 naslova', 'Barbora Krejčíková|Barbora Krejcikova#2 naslova', 'Jeļena Ostapenko|Jelena Ostapenko#Roland Garros 2017.', 'Bianca Andreescu#US Open 2019.', 'Madison Keys#Australian Open 2025.', 'Markéta Vondroušová|Marketa Vondrousova#Wimbledon 2023.', 'Mirra Andreeva|Mira Andrejeva#Roland Garros 2026.', 'Linda Nosková|Linda Noskova#Wimbledon 2026.', 'Sloane Stephens#US Open 2017.', 'Sofia Kenin#Australian Open 2020.'],
      D: ['Marion Bartoli#Wimbledon 2013.', 'Flavia Pennetta#US Open 2015.', 'Francesca Schiavone#Roland Garros 2010.', 'Samantha Stosur|Sam Stosur#US Open 2011.', 'Mary Pierce#Roland Garros 2000.', 'Anastasija Myskina|Anastasia Myskina|Myskina#Roland Garros 2004.'],
    },
  },
  {
    dan: 6, poz: 5, cat: 'tenis', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi tenisača koji je igrao finale Wimbledona u Open eri.',
    hint: 'Muški pojedinačno, 1968.–2026., i pobjednici i poraženi finalisti.',
    izvori: [['Wikipedia: List of Wimbledon gentlemen\'s singles champions', W + 'List_of_Wimbledon_gentlemen%27s_singles_champions'], ['Wimbledon — povijest', 'https://www.wimbledon.com/en_GB/draws_archive/champions/gentlemenssingles.html'], ['Wikipedia: 2026 Wimbledon Championships', W + '2026_Wimbledon_Championships']],
    odgovori: {
      A: ['Roger Federer#8 naslova, rekorder', 'Novak Đoković|Novak Djokovic|Nole#7 naslova', 'Goran Ivanišević#pobjednik 2001., finalist 1992., 1994., 1998.', 'Marin Čilić#finalist 2017.', 'Carlos Alcaraz#pobjednik 2023. i 2024.', 'Jannik Sinner#pobjednik 2025. i 2026.', 'Rafael Nadal|Rafa Nadal#pobjednik 2008. i 2010.'],
      B: ['Andy Murray#pobjednik 2013. i 2016.', 'Pete Sampras#7 naslova', 'Björn Borg|Bjorn Borg#5 naslova zaredom', 'Boris Becker#pobjednik sa 17 godina', 'John McEnroe#3 naslova', 'Andre Agassi#pobjednik 1992.', 'Andy Roddick#tri izgubljena finala', 'Nick Kyrgios#finalist 2022.', 'Alexander Zverev|Sascha Zverev#finalist 2026.', 'Matteo Berrettini#finalist 2021.'],
      C: ['Stefan Edberg#pobjednik 1988. i 1990.', 'Jimmy Connors#pobjednik 1974. i 1982.', 'Ivan Lendl#finalist 1986. i 1987.', 'Lleyton Hewitt#pobjednik 2002.', 'Patrick Rafter|Pat Rafter#finalist 2000. i 2001.', 'Michael Stich#pobjednik 1991.', 'Richard Krajicek#pobjednik 1996.', 'Milos Raonic|Miloš Raonić#finalist 2016.', 'Kevin Anderson#finalist 2018.', 'Tomáš Berdych|Tomas Berdych#finalist 2010.', 'Pat Cash#pobjednik 1987.', 'Jim Courier#finalist 1993.', 'David Nalbandian#finalist 2002.', 'Mark Philippoussis#finalist 2003.'],
      D: ['Rod Laver#pobjednik 1968. i 1969.', 'Arthur Ashe#pobjednik 1975.', 'John Newcombe#pobjednik 1970. i 1971.', 'Ilie Năstase|Ilie Nastase#finalist 1972. i 1976.', 'Stan Smith#pobjednik 1972.', 'Ken Rosewall#finalist 1970. i 1974.', 'Cédric Pioline|Cedric Pioline#finalist 1997.', 'Jan Kodeš|Jan Kodes#pobjednik 1973.', 'Roscoe Tanner#finalist 1979.'],
      E: ['MaliVai Washington|Malivai Washington#finalist 1996.', 'Kevin Curren#finalist 1985.', 'Chris Lewis#finalist 1983.', 'Tony Roche#finalist 1968.', 'Alex Metreveli|Aleksandr Metreveli#finalist 1973.'],
    },
  },
  {
    dan: 7, poz: 5, cat: 'tenis', kind: 'country', diff: 2, provjera: P,
    text: 'Navedi državu koja je osvojila Davis Cup.',
    hint: 'Od 1900. do 2025. Uz državu koje više nema priznaje se i nasljednica.',
    izvori: [['Davis Cup — povijest', 'https://www.daviscup.com/en/history.aspx'], ['Wikipedia: List of Davis Cup champions', W + 'List_of_Davis_Cup_champions']],
    odgovori: {
      A: ['Hrvatska#2005. i 2018.', 'Srbija#2010.', 'Španjolska#6 naslova', 'SAD|Sjedinjene Američke Države|Amerika#32 naslova, rekorder', 'Italija#4 naslova, tri zaredom 2023.–2025.'],
      B: ['Francuska#10 naslova', 'Australija|Australazija#28 naslova', 'Švicarska#2014.', 'Velika Britanija|Britanija|Engleska|UK|Ujedinjeno Kraljevstvo|Great Britain#10 naslova', 'Argentina#2016., u finalu protiv Hrvatske', 'Švedska#7 naslova', 'Njemačka|Zapadna Njemačka|SR Njemačka#3 naslova'],
      C: ['Rusija#3 naslova', 'Češka|Čehoslovačka|Češka Republika#1980., 2012., 2013.', 'Kanada#2022.'],
      D: ['Južnoafrička Republika|Južna Afrika|JAR|South Africa#1974., bez borbe — Indija nije htjela igrati finale'],
    },
  },
  {
    dan: 8, poz: 5, cat: 'tenis', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi tenisača koji je osvojio završni turnir sezone (ATP Finals).',
    hint: 'Masters, ATP Tour World Championship i ATP Finals, 1970.–2025.',
    izvori: [['Wikipedia: ATP Finals', W + 'ATP_Finals'], ['Nitto ATP Finals — povijest', 'https://www.nittoatpfinals.com/en/heritage/results-archive']],
    odgovori: {
      A: ['Novak Đoković|Novak Djokovic|Nole#7 naslova, rekorder', 'Roger Federer#6 naslova', 'Jannik Sinner#2024. i 2025.', 'Alexander Zverev|Sascha Zverev#2018. i 2021.'],
      B: ['Pete Sampras#5 naslova', 'Andy Murray#2016.', 'Daniil Medvedev|Danil Medvedev|Medvedev#2020.', 'Stefanos Tsitsipas#2019.', 'Grigor Dimitrov#2017.', 'Boris Becker#3 naslova', 'Andre Agassi#1990.', 'John McEnroe#3 naslova', 'Björn Borg|Bjorn Borg#1979. i 1980.', 'Ivan Lendl#5 naslova'],
      C: ['Lleyton Hewitt#2001. i 2002.', 'Stefan Edberg#1989.', 'Jimmy Connors#1977.', 'Gustavo Kuerten|Guga Kuerten|Guga#2000.', 'David Nalbandian#2005.', 'Nikolaj Davidenko|Nikolay Davydenko|Davydenko#2009.', 'Michael Stich#1993.', 'Ilie Năstase|Ilie Nastase#4 naslova'],
      D: ['Àlex Corretja|Alex Corretja#1998.', 'Guillermo Vilas#1974.', 'Stan Smith#1970., prvi pobjednik', 'Manuel Orantes#1976.'],
    },
  },
  {
    dan: 9, poz: 5, cat: 'tenis', kind: 'person', diff: 4, provjera: P,
    text: 'Navedi tenisača koji je osvojio olimpijsku medalju u pojedinačnoj konkurenciji.',
    hint: 'Olimpijske igre 1988.–2024., zlato, srebro ili bronca.',
    izvori: [['Wikipedia: List of Olympic medalists in tennis', W + 'List_of_Olympic_medalists_in_tennis'], ['Olympics.com — tenis', 'https://www.olympics.com/en/sports/tennis/']],
    odgovori: {
      A: ['Novak Đoković|Novak Djokovic|Nole#zlato 2024., bronca 2008.', 'Rafael Nadal|Rafa Nadal#zlato 2008.', 'Andy Murray#zlato 2012. i 2016.', 'Goran Ivanišević#bronca 1992.', 'Carlos Alcaraz#srebro 2024.', 'Roger Federer#srebro 2012.'],
      B: ['Alexander Zverev|Sascha Zverev#zlato 2020.', 'Juan Martín del Potro|Del Potro|Juan Martin del Potro#bronca 2012., srebro 2016.', 'Andre Agassi#zlato 1996.', 'Lorenzo Musetti#bronca 2024.', 'Kei Nishikori#bronca 2016.', 'Karen Hačanov|Karen Khachanov|Khachanov#srebro 2020.', 'Pablo Carreño Busta|Pablo Carreno Busta|Carreño Busta#bronca 2020.'],
      C: ['Stefan Edberg#bronca 1988.', 'Jevgenij Kafeljnikov|Yevgeny Kafelnikov|Kafelnikov#zlato 2000.', 'Tommy Haas#srebro 2000.', 'Fernando González|Fernando Gonzalez#bronca 2004., srebro 2008.', 'Nicolás Massú|Nicolas Massu#zlato 2004.', 'Sergi Bruguera#srebro 1996.', 'Marc Rosset#zlato 1992.'],
      D: ['Miloslav Mečíř|Miloslav Mecir#zlato 1988.', 'Mardy Fish#srebro 2004.', 'Leander Paes#bronca 1996.', 'Brad Gilbert#bronca 1988.', 'Tim Mayotte#srebro 1988.'],
      E: ['Jordi Arrese#srebro 1992.', 'Arnaud Di Pasquale#bronca 2000.', 'Andrej Čerkasov|Andrei Cherkasov|Cherkasov#bronca 1992.'],
    },
  },
  {
    dan: 10, poz: 5, cat: 'tenis', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi tenisača koji je igrao finale Roland Garrosa u Open eri.',
    hint: 'Muški pojedinačno, 1968.–2026., i pobjednici i poraženi finalisti.',
    izvori: [['Wikipedia: List of French Open men\'s singles champions', W + 'List_of_French_Open_men%27s_singles_champions'], ['Roland-Garros — povijest', 'https://www.rolandgarros.com/en-us/page/past-winners-and-draws']],
    odgovori: {
      A: ['Rafael Nadal|Rafa Nadal#14 naslova, rekorder', 'Novak Đoković|Novak Djokovic|Nole#pobjednik 2016., 2021., 2023.', 'Roger Federer#pobjednik 2009.', 'Carlos Alcaraz#pobjednik 2024. i 2025.', 'Jannik Sinner#finalist 2025.', 'Alexander Zverev|Sascha Zverev#pobjednik 2026.'],
      B: ['Björn Borg|Bjorn Borg#6 naslova', 'Andy Murray#finalist 2016.', 'Stan Wawrinka|Stanislas Wawrinka#pobjednik 2015.', 'Dominic Thiem#finalist 2018. i 2019.', 'Casper Ruud#finalist 2022. i 2023.', 'Stefanos Tsitsipas#finalist 2021.', 'Gustavo Kuerten|Guga Kuerten|Guga#3 naslova', 'Andre Agassi#pobjednik 1999.', 'Ivan Lendl#3 naslova', 'Željko Franulović|Zeljko Franulovic#finalist 1970.', 'Nikola Pilić|Niki Pilić|Nikola Pilic#finalist 1973.'],
      C: ['Mats Wilander#3 naslova', 'Jim Courier#pobjednik 1991. i 1992.', 'David Ferrer#finalist 2013.', 'Robin Söderling|Robin Soderling#finalist 2009. i 2010.', 'Juan Carlos Ferrero#pobjednik 2003.', 'Carlos Moyá|Carlos Moya#pobjednik 1998.', 'Thomas Muster#pobjednik 1995.', 'Michael Chang#pobjednik 1989.', 'John McEnroe#finalist 1984.', 'Stefan Edberg#finalist 1989.', 'Yannick Noah#pobjednik 1983.', 'Flavio Cobolli#finalist 2026.', 'Guillermo Vilas#pobjednik 1977.', 'Gastón Gaudio|Gaston Gaudio#pobjednik 2004.', 'Guillermo Coria#finalist 2004.'],
      D: ['Sergi Bruguera#pobjednik 1993. i 1994.', 'Jevgenij Kafeljnikov|Yevgeny Kafelnikov|Kafelnikov#pobjednik 1996.', 'Albert Costa#pobjednik 2002.', 'Àlex Corretja|Alex Corretja#finalist 1998. i 2001.', 'Michael Stich#finalist 1996.', 'Petr Korda#finalist 1992.', 'Magnus Norman#finalist 2000.', 'Andrej Medvedev|Andrei Medvedev|Medvedev#finalist 1999.', 'Mariano Puerta#finalist 2005.', 'Henri Leconte#finalist 1988.', 'Ilie Năstase|Ilie Nastase#pobjednik 1973.', 'Adriano Panatta#pobjednik 1976.', 'Rod Laver#pobjednik 1969.', 'Ken Rosewall#pobjednik 1968.', 'Andrés Gómez|Andres Gomez#pobjednik 1990.', 'Vitas Gerulaitis#finalist 1980.'],
      E: ['Jan Kodeš|Jan Kodes#pobjednik 1970. i 1971.', 'Andrés Gimeno|Andres Gimeno#pobjednik 1972.', 'Manuel Orantes#finalist 1974.', 'Martin Verkerk#finalist 2003.', 'Alberto Berasategui#finalist 1994.', 'Mikael Pernfors#finalist 1986.', 'Víctor Pecci|Victor Pecci#finalist 1979.', 'Patrick Proisy#finalist 1972.', 'Harold Solomon#finalist 1976.', 'Brian Gottfried#finalist 1977.'],
    },
  },
];
