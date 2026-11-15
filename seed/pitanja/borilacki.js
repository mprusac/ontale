// BORILAČKI SPORTOVI — 10 pitanja (pozicija 7). Liste uspoređene s izvorima 13. 11. 2026.
const W = 'https://en.wikipedia.org/wiki/';
const P = 'Lista uspoređena s izvorom 13. 11. 2026.';
const UFC = [['Wikipedia: List of UFC champions', W + 'List_of_UFC_champions'], ['UFC — povijest naslova', 'https://www.ufc.com/athletes/all']];

export default [
  {
    dan: 1, poz: 7, cat: 'borilacki', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi borca koji je bio UFC prvak u teškoj ili poluteškoj kategoriji.',
    hint: 'Neosporni prvaci u muškoj konkurenciji; privremeni naslovi se ne računaju.',
    izvori: UFC,
    odgovori: {
      A: ['Stipe Miocic|Stipe Miočić#teška, rekord po broju obrana naslova', 'Jon Jones|Bones Jones#poluteška i teška', 'Francis Ngannou#teška', 'Brock Lesnar#teška', 'Alex Pereira|Poatan#poluteška', 'Daniel Cormier|DC#poluteška i teška'],
      B: ['Cain Velasquez#teška', 'Tom Aspinall#teška', 'Ciryl Gane#teška', 'Chuck Liddell|Iceman#poluteška', 'Randy Couture#teška i poluteška', 'Junior dos Santos|Cigano#teška', 'Fabrício Werdum|Fabricio Werdum#teška', 'Jiří Procházka|Jiri Prochazka#poluteška', 'Jan Błachowicz|Jan Blachowicz#poluteška', 'Magomed Ankalaev|Ankalajev#poluteška'],
      C: ['Tito Ortiz#poluteška', 'Quinton Jackson|Rampage Jackson|Rampage#poluteška', 'Lyoto Machida#poluteška', 'Maurício Rua|Mauricio Rua|Shogun Rua|Shogun#poluteška', 'Rashad Evans#poluteška', 'Forrest Griffin#poluteška', 'Vitor Belfort#poluteška', 'Frank Mir#teška', 'Andrei Arlovski|Andrej Arlovski#teška', 'Glover Teixeira#poluteška', 'Jamahal Hill#poluteška', 'Carlos Ulberg#poluteška'],
      D: ['Mark Coleman#prvi prvak teške kategorije', 'Bas Rutten#teška', 'Josh Barnett#teška', 'Tim Sylvia#teška', 'Frank Shamrock#prvi prvak poluteške (tada srednje) kategorije', 'Kevin Randleman#teška'],
      E: ['Maurice Smith#teška', 'Ricco Rodriguez#teška'],
    },
  },
  {
    dan: 2, poz: 7, cat: 'borilacki', kind: 'person', diff: 2, provjera: P,
    text: 'Navedi boksača koji je bio svjetski prvak u teškoj kategoriji.',
    hint: 'Linijski prvaci i prvaci glavnih organizacija (WBA, WBC, IBF, WBO), od Johna L. Sullivana do danas; bez privremenih naslova.',
    izvori: [['Wikipedia: List of world heavyweight boxing champions', W + 'List_of_world_heavyweight_boxing_champions'], ['BoxRec', 'https://boxrec.com/']],
    odgovori: {
      A: ['Muhammad Ali|Cassius Clay|Muhamed Ali', 'Mike Tyson|Majk Tajson', 'Tyson Fury', 'Oleksandr Usyk|Aleksandr Usik|Usik', 'Anthony Joshua', 'Filip Hrgović|Filip Hrgovic#aktualni IBF prvak', 'Vitalij Kličko|Vitali Klitschko|Vitali Kličko|Vitalij Klitschko', 'Vladimir Kličko|Wladimir Klitschko|Wladimir Kličko|Vladimir Klitschko'],
      B: ['Lennox Lewis', 'Evander Holyfield', 'George Foreman', 'Joe Frazier', 'Deontay Wilder', 'Rocky Marciano#neporažen, 49-0', 'Joe Louis#25 obrana naslova', 'Daniel Dubois', 'Andy Ruiz Jr.|Andy Ruiz', 'Joseph Parker', 'Jack Dempsey', 'Larry Holmes', 'Sonny Liston'],
      C: ['Riddick Bowe', 'Buster Douglas|James Douglas|James Buster Douglas#pobijedio Tysona 1990.', 'David Haye', 'Nikolaj Valujev|Nikolai Valuev|Valuev', 'Floyd Patterson', 'Jack Johnson', 'Max Schmeling', 'Roy Jones Jr.|Roy Jones', 'Aleksandr Povetkin|Alexander Povetkin', 'Kubrat Pulev', 'Murat Gassiev|Murat Gasijev', 'Agit Kabayel', 'Fabio Wardley', 'Michael Spinks', 'Leon Spinks', 'Ken Norton', 'Hasim Rahman', 'Frank Bruno', 'Primo Carnera', 'Gene Tunney'],
      D: ['Ingemar Johansson', 'Jersey Joe Walcott|Joe Walcott', 'Ezzard Charles', 'Max Baer', 'James J. Braddock|James Braddock|Jim Braddock', 'John L. Sullivan|John Sullivan', 'Michael Moorer', 'Chris Byrd', 'John Ruiz', 'Samuel Peter', 'Shannon Briggs', 'Ruslan Čagajev|Ruslan Chagaev|Chagaev', 'Oleg Maskajev|Oleg Maskaev|Maskaev', 'Corrie Sanders', 'Lamon Brewster', 'Tommy Morrison', 'Ray Mercer', 'Oliver McCall', 'Trevor Berbick', 'Tim Witherspoon', 'Bermane Stiverne', 'Charles Martin', 'Mahmoud Charr|Manuel Charr'],
      E: ['James J. Corbett|James Corbett|Jim Corbett', 'Bob Fitzsimmons', 'James J. Jeffries|James Jeffries|Jim Jeffries', 'Marvin Hart', 'Tommy Burns', 'Jess Willard', 'Jack Sharkey', 'Ernie Terrell', 'Jimmy Ellis', 'John Tate', 'Mike Weaver', 'Michael Dokes', 'Gerrie Coetzee', 'Pinklon Thomas', 'Greg Page', 'Tony Tubbs', 'James Smith|James Bonecrusher Smith|Bonecrusher Smith', 'Tony Tucker', 'Francesco Damiani', 'Michael Bentt', 'Herbie Hide', 'Bruce Seldon', 'Henry Akinwande', 'Sergej Ljahovič|Siarhei Liakhovich|Sergei Liakhovich|Liakhovich', 'Sultan Ibragimov', 'Lucas Browne', 'Trevor Bryan'],
    },
  },
  {
    dan: 3, poz: 7, cat: 'borilacki', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi borca protiv kojeg se Mirko "Cro Cop" Filipović borio u MMA-u.',
    hint: 'Profesionalne MMA borbe (Pride, UFC, Rizin i drugi); kickboxing se ne računa.',
    izvori: [['Wikipedia: Mirko Cro Cop — MMA record', W + 'Mirko_Cro_Cop'], ['Sherdog — Mirko Filipović', 'https://www.sherdog.com/fighter/Mirko-Filipovic-2326']],
    odgovori: {
      A: ['Fedor Emelianenko|Fjodor Emelianenko|Fedor Jemeljanenko|Fedor#poraz 2005.', 'Wanderlei Silva#neriješeno 2002., pobjeda nokautom 2006.', 'Gabriel Gonzaga#poraz 2007., osveta 2015.', 'Josh Barnett#tri pobjede', 'Mark Hunt#poraz 2005.', 'Antônio Rodrigo Nogueira|Antonio Rodrigo Nogueira|Minotauro Nogueira|Minotauro|Rodrigo Nogueira#poraz 2003.', 'Alistair Overeem#bez pobjednika 2008.'],
      B: ['Kevin Randleman#poraz i pobjeda 2004.', 'Kazushi Sakuraba#pobjeda', 'Mark Coleman#pobjeda', 'Junior dos Santos|Cigano#poraz', 'Frank Mir#poraz', 'Roy Nelson#poraz 2011., pobjeda 2019.', 'Cheick Kongo#poraz', 'Aleksandr Emelianenko|Alexander Emelianenko|Aleksander Emelianenko|Aleksandar Jemeljanenko#pobjeda', 'Igor Vovčančin|Igor Vovchanchyn|Vovchanchyn#pobjeda', 'Heath Herring#pobjeda', 'Choi Hong-man|Hong-man Choi|Hong Man Choi#pobjeda', 'Pat Barry#pobjeda', 'Brendan Schaub#poraz'],
      C: ['Kazuyuki Fujita#dvije pobjede', 'Hidehiko Yoshida#pobjeda', 'Satoshi Ishii#dvije pobjede', 'Muhammed Lawal|King Mo|King Mo Lawal#pobjeda', 'Aleksej Olejnik|Alexey Oleynik|Aleksei Oleinik|Oleynik#poraz', 'Ikuhisa Minowa|Minowaman#pobjeda', 'Eddie Sanchez#pobjeda, prvi nastup u UFC-u', 'Nobuhiko Takada#neriješeno', 'Ron Waterman#pobjeda', 'Anthony Perosh#pobjeda', 'Mostapha al-Turk|Mostapha Al Turk|Al-Turk#pobjeda', 'Amir Aliakbari#pobjeda', 'Roque Martinez#pobjeda'],
      D: ['Yuji Nagata#pobjeda', 'Dos Caras Jr.|Dos Caras|Alberto Del Rio#pobjeda', 'Yoshihisa Yamamoto#pobjeda', 'Shungo Oyama#pobjeda', 'Hiromitsu Kanehara#pobjeda', 'Ibragim Magomedov#pobjeda', 'Tatsuya Mizuno#pobjeda', 'Shinichi Suzukawa#pobjeda', 'Myung Hyun-man|Hyun-man Myung#pobjeda', 'Baruto Kaito|Baruto#pobjeda', 'Tsuyoshi Kohsaka|Tsuyoshi Kosaka#pobjeda'],
    },
  },
  {
    dan: 4, poz: 7, cat: 'borilacki', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi borca koji je bio UFC prvak u srednjoj, velter ili lakoj kategoriji.',
    hint: 'Neosporni prvaci u muškoj konkurenciji; privremeni naslovi se ne računaju.',
    izvori: UFC,
    odgovori: {
      A: ['Conor McGregor#laka', 'Khabib Nurmagomedov|Habib Nurmagomedov|Khabib|Habib#laka, neporažen', 'Khamzat Chimaev|Hamzat Čimajev|Chimaev#srednja', 'Islam Makhachev|Islam Mahačev|Makhachev#laka i velter', 'Georges St-Pierre|GSP|Georges St Pierre|St-Pierre#velter i srednja', 'Anderson Silva|Spider Silva#srednja, 10 obrana', 'Israel Adesanya#srednja'],
      B: ['Ilia Topuria#laka', 'Charles Oliveira#laka', 'Kamaru Usman#velter', 'Alex Pereira|Poatan#srednja', 'Dricus du Plessis|Dricus Du Plessis#srednja', 'Sean Strickland#srednja, dva puta', 'Leon Edwards#velter', 'Justin Gaethje#laka', 'Robert Whittaker#srednja', 'Michael Bisping#srednja'],
      C: ['B.J. Penn|BJ Penn#velter i laka', 'Matt Hughes#velter', 'Chris Weidman#srednja', 'Luke Rockhold#srednja', 'Robbie Lawler#velter', 'Tyron Woodley#velter', 'Belal Muhammad#velter', 'Jack Della Maddalena#velter', 'Frankie Edgar#laka', 'Rafael dos Anjos|RDA#laka', 'Eddie Alvarez#laka', 'Anthony Pettis#laka', 'Benson Henderson#laka'],
      D: ['Rich Franklin#srednja', 'Matt Serra#velter, senzacija protiv St-Pierrea', 'Johny Hendricks#velter', 'Pat Miletich#prvi velter prvak', 'Sean Sherk#laka', 'Jens Pulver#prvi prvak lake kategorije'],
      E: ['Carlos Newton#velter', 'Dave Menne#prvi prvak srednje kategorije', 'Murilo Bustamante#srednja', 'Evan Tanner#srednja'],
    },
  },
  {
    dan: 5, poz: 7, cat: 'borilacki', kind: 'person', diff: 3, provjera: P + ' Izvor ne navodi finala 2011.–2023.; finale 2012. (Zagreb, 15. 3. 2013., Filipović – Londt) dodano je prema zapisniku priredbe.',
    text: 'Navedi borca koji je nastupio u finalu K-1 World Grand Prixa.',
    hint: 'Završne borbe turnira u teškoj kategoriji: 1993.–2010., 2012. i 2024.',
    izvori: [['Wikipedia: K-1 World Grand Prix', W + 'K-1_World_Grand_Prix'], ['Wikipedia: Mirko Cro Cop', W + 'Mirko_Cro_Cop']],
    odgovori: {
      A: ['Mirko Filipović|Mirko Cro Cop|Cro Cop|Mirko Cro Cop Filipović|Crocop#finalist 1999., pobjednik 2012. u Zagrebu', 'Branko Cikatić#prvi pobjednik, 1993.', 'Peter Aerts#pobjednik 1994., 1995., 1998.', 'Ernesto Hoost#4 naslova', 'Semmy Schilt|Sem Schilt#4 naslova', 'Badr Hari#finalist 2008. i 2009.', 'Alistair Overeem#pobjednik 2010.'],
      B: ['Remy Bonjasky#pobjednik 2003., 2004., 2008.', 'Andy Hug#pobjednik 1996.', 'Mark Hunt#pobjednik 2001.', 'Jérôme Le Banner|Jerome Le Banner|Le Banner#finalist 1995. i 2002.', 'Ray Sefo#finalist 2000.'],
      C: ['Mike Bernardo#finalist 1996.', 'Musashi|Akio Mori#finalist 2003. i 2004.', 'Francisco Filho#finalist 2001.', 'Glaube Feitosa#finalist 2005.', 'Masaaki Satake#finalist 1994.'],
      D: ['Ismael Londt#finalist 2012.', 'Ariel Machado#pobjednik 2024.', 'Feng Rui|Rui Feng#finalist 2024.'],
    },
  },
  {
    dan: 6, poz: 7, cat: 'borilacki', kind: 'person', diff: 4, provjera: P,
    text: 'Navedi boksača koji je bio svjetski prvak u tri ili više težinskih kategorija.',
    hint: 'Naslovi glavnih organizacija u muškom boksu.',
    izvori: [['Wikipedia: List of boxing triple champions', W + 'List_of_boxing_triple_champions'], ['BoxRec', 'https://boxrec.com/']],
    odgovori: {
      A: ['Manny Pacquiao#jedini s naslovima u osam kategorija', 'Floyd Mayweather Jr.|Floyd Mayweather#pet kategorija', 'Canelo Álvarez|Saúl Álvarez|Saul Alvarez|Canelo|Saúl Canelo Álvarez#četiri kategorije', 'Terence Crawford', 'Naoya Inoue', 'Oscar De La Hoya#šest kategorija', 'Sugar Ray Leonard|Ray Leonard#pet kategorija', 'Roy Jones Jr.|Roy Jones#od srednje do teške'],
      B: ['Vasilij Lomačenko|Vasyl Lomachenko|Vasiliy Lomachenko|Lomachenko', 'Roberto Durán|Roberto Duran', 'Julio César Chávez|Julio Cesar Chavez', 'Thomas Hearns|Tommy Hearns#prvi s četiri, pa pet kategorija', 'Miguel Cotto', 'Shakur Stevenson', 'Devin Haney', 'Teófimo López|Teofimo Lopez', 'David Benavidez', 'Félix Trinidad|Felix Trinidad', 'Juan Manuel Márquez|Juan Manuel Marquez'],
      C: ['Érik Morales|Erik Morales', 'Marco Antonio Barrera', 'Shane Mosley', 'Pernell Whitaker', 'James Toney', 'Nonito Donaire', 'Héctor Camacho|Hector Camacho', 'Adrien Broner', 'Mikey Garcia|Mikey García', 'Alexis Argüello|Alexis Arguello', 'Henry Armstrong#tri naslova istodobno 1938.', 'Román González|Roman Gonzalez|Chocolatito', 'Jesse Rodriguez|Bam Rodriguez', 'Emanuel Navarrete', 'Badou Jack', 'Léo Santa Cruz|Leo Santa Cruz'],
      D: ['Wilfred Benítez|Wilfred Benitez', 'Wilfredo Gómez|Wilfredo Gomez', 'Emile Griffith', 'Mike McCallum', 'Iran Barkley', 'Jeff Fenech', 'Johnny Tapia', 'Jorge Arce', 'Abner Mares', 'Jorge Linares', 'Ricky Burns', 'Kazuto Ioka', 'Junto Nakatani', 'Kenshiro Teraji|Kenshiro', 'Kosei Tanaka', 'Fernando Montiel', 'John Riel Casimero', 'Donnie Nietes'],
      E: ['Bob Fitzsimmons#prvi u povijesti, još 1903.', 'Tony Canzoneri', 'Barney Ross', 'Duke McKenzie', 'Wilfredo Vázquez|Wilfredo Vazquez', 'Leo Gámez|Leo Gamez', 'Akira Yaegashi', 'Hozumi Hasegawa'],
    },
  },
  {
    dan: 7, poz: 7, cat: 'borilacki', kind: 'person', diff: 3, provjera: P,
    text: 'Navedi borca koji je bio UFC prvak u perolakoj, bantam ili muha kategoriji.',
    hint: 'Neosporni prvaci u muškoj konkurenciji; privremeni naslovi se ne računaju.',
    izvori: UFC,
    odgovori: {
      A: ['Conor McGregor#perolaka', 'Ilia Topuria#perolaka', 'Alexander Volkanovski#perolaka, dva puta', 'Max Holloway#perolaka', 'José Aldo|Jose Aldo#prvi prvak perolake kategorije', 'Sean O\'Malley|Sean OMalley|Suga Sean#bantam'],
      B: ['Merab Dvalishvili|Merab#bantam', 'Petr Yan|Pjotr Jan#bantam, dva puta', 'Henry Cejudo#muha i bantam', 'Demetrious Johnson|Mighty Mouse#muha, 11 obrana', 'Aljamain Sterling#bantam', 'Dominick Cruz#prvi bantam prvak'],
      C: ['T.J. Dillashaw|TJ Dillashaw#bantam', 'Cody Garbrandt#bantam', 'Brandon Moreno#muha', 'Deiveson Figueiredo#muha', 'Alexandre Pantoja#muha', 'Renan Barão|Renan Barao#bantam'],
      D: ['Joshua Van#muha'],
    },
  },
  {
    dan: 8, poz: 7, cat: 'borilacki', kind: 'person', diff: 4, provjera: P,
    text: 'Navedi boksača kojeg je časopis The Ring proglasio borcem godine.',
    hint: 'Izbori od 1970. do 2025.',
    izvori: [['Wikipedia: The Ring magazine Fighter of the Year', W + 'The_Ring_magazine_Fighter_of_the_Year'], ['The Ring', 'https://www.ringmagazine.com/']],
    odgovori: {
      A: ['Muhammad Ali|Cassius Clay|Muhamed Ali#1972., 1974., 1975., 1978.', 'Mike Tyson|Majk Tajson#1986. i 1988.', 'Tyson Fury#2015. i 2020.', 'Oleksandr Usyk|Aleksandr Usik|Usik#2018. i 2024.', 'Canelo Álvarez|Saúl Álvarez|Saul Alvarez|Canelo#2019. i 2021.', 'Manny Pacquiao#2006., 2008., 2009.', 'Floyd Mayweather Jr.|Floyd Mayweather#1998. i 2007.'],
      B: ['Terence Crawford#2025.', 'Naoya Inoue#2023.', 'Evander Holyfield#1987., 1996., 1997.', 'George Foreman#1973. i 1976.', 'Joe Frazier#1970. i 1971.', 'Roy Jones Jr.|Roy Jones#1994.', 'Oscar De La Hoya#1995.', 'Sugar Ray Leonard|Ray Leonard#1979. i 1981.', 'Vasilij Lomačenko|Vasyl Lomachenko|Vasiliy Lomachenko|Lomachenko#2017.', 'Dmitrij Bivol|Dmitry Bivol|Dmitrii Bivol#2022.'],
      C: ['Marvin Hagler|Marvelous Marvin Hagler#1983. i 1985.', 'Thomas Hearns|Tommy Hearns#1980. i 1984.', 'Larry Holmes#1982.', 'Julio César Chávez|Julio Cesar Chavez#1990.', 'Bernard Hopkins#2001.', 'Ricky Hatton#2005.', 'Riddick Bowe#1992.', 'Félix Trinidad|Felix Trinidad#2000.', 'Sergej Kovaljov|Sergey Kovalev|Kovalev#2014.', 'Andre Ward#2011.', 'Teófimo López|Teofimo Lopez#2020.', 'Juan Manuel Márquez|Juan Manuel Marquez#2012.', 'Pernell Whitaker#1989.', 'James Toney#1991. i 2003.'],
      D: ['Carlos Monzón|Carlos Monzon#1972.', 'Salvador Sánchez|Salvador Sanchez#1981.', 'Sergio Martínez|Sergio Martinez#2010.', 'Carl Frampton#2016.', 'Adonis Stevenson#2013.', 'Glen Johnson#2004.', 'Vernon Forrest#2002.', 'Donald Curry#1985.'],
      E: ['Carlos Zárate|Carlos Zarate#1977.', 'Michael Carbajal#1993.', 'Paulie Ayala#1999.'],
    },
  },
  {
    dan: 9, poz: 7, cat: 'borilacki', kind: 'person', diff: 4, provjera: P,
    text: 'Navedi borkinju koja je bila UFC prvakinja.',
    hint: 'Neosporne prvakinje u bilo kojoj ženskoj kategoriji; privremeni naslovi se ne računaju.',
    izvori: UFC,
    odgovori: {
      A: ['Ronda Rousey#prva UFC prvakinja, bantam', 'Amanda Nunes#bantam i perolaka', 'Valentina Ševčenko|Valentina Shevchenko|Shevchenko#muha', 'Zhang Weili|Weili Zhang#slamnata'],
      B: ['Holly Holm#bantam, nokautirala Rousey', 'Rose Namajunas#slamnata', 'Joanna Jędrzejczyk|Joanna Jedrzejczyk#slamnata', 'Cris Cyborg|Cristiane Justino|Cyborg#perolaka', 'Kayla Harrison#bantam', 'Miesha Tate#bantam'],
      C: ['Julianna Peña|Julianna Pena#bantam', 'Alexa Grasso#muha', 'Carla Esparza#prva prvakinja slamnate kategorije', 'Jéssica Andrade|Jessica Andrade#slamnata', 'Mackenzie Dern#slamnata', 'Raquel Pennington#bantam'],
      D: ['Germaine de Randamie#prva prvakinja perolake kategorije', 'Natália Silva|Natalia Silva#muha', 'Nicco Montaño|Nicco Montano#prva prvakinja muha kategorije'],
    },
  },
  {
    dan: 10, poz: 7, cat: 'borilacki', kind: 'person', diff: 4, provjera: P,
    text: 'Navedi borca ili borkinju iz UFC-ove Kuće slavnih.',
    hint: 'Samo borci primljeni u kategorijama Pioneer i Modern, zaključno s 2026.',
    izvori: [['Wikipedia: UFC Hall of Fame', W + 'UFC_Hall_of_Fame'], ['UFC Hall of Fame', 'https://www.ufc.com/hall-of-fame']],
    odgovori: {
      A: ['Khabib Nurmagomedov|Habib Nurmagomedov|Khabib|Habib#primljen 2022.', 'Georges St-Pierre|GSP|Georges St Pierre|St-Pierre#primljen 2021.', 'Anderson Silva|Spider Silva#primljen 2023.', 'Ronda Rousey#primljena 2018., prva žena', 'Daniel Cormier|DC#primljen 2022.', 'Amanda Nunes#primljena 2025.'],
      B: ['Chuck Liddell|Iceman#primljen 2009.', 'Randy Couture#primljen 2006.', 'Royce Gracie#među prva dva, 2003.', 'José Aldo|Jose Aldo#primljen 2023.', 'Wanderlei Silva#primljen 2024.', 'Michael Bisping#primljen 2019.', 'Tito Ortiz#primljen 2012.', 'B.J. Penn|BJ Penn#primljen 2015.', 'Demetrious Johnson|Mighty Mouse#primljen 2026.', 'Dominick Cruz#primljen 2026.', 'Donald Cerrone|Cowboy Cerrone|Cowboy#primljen 2023.'],
      C: ['Ken Shamrock#među prva dva, 2003.', 'Matt Hughes#primljen 2010.', 'Forrest Griffin#primljen 2013.', 'Rashad Evans#primljen 2019.', 'Maurício Rua|Mauricio Rua|Shogun Rua|Shogun#primljen 2024.', 'Vitor Belfort#primljen 2025.', 'Antônio Rodrigo Nogueira|Antonio Rodrigo Nogueira|Minotauro Nogueira|Minotauro|Rodrigo Nogueira#primljen 2016.', 'Kazushi Sakuraba#primljen 2017.', 'Frankie Edgar#primljen 2024.', 'Robbie Lawler#primljen 2025.', 'Chris Weidman#primljen 2026.', 'Urijah Faber#primljen 2017.', 'Joanna Jędrzejczyk|Joanna Jedrzejczyk#primljena 2024.', 'Mark Coleman#primljen 2008.', 'Bas Rutten#primljen 2015.'],
      D: ['Dan Severn#primljen 2005.', 'Don Frye#primljen 2016.', 'Rich Franklin#primljen 2019.', 'Matt Serra#primljen 2018.', 'Pat Miletich#primljen 2014.', 'Kevin Randleman#primljen 2021.', 'Jens Pulver#primljen 2023.', 'Maurice Smith#primljen 2017.', 'Mark Kerr#primljen 2025.'],
    },
  },
];
