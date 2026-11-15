// Pravila igre, privatnost i uvjeti korištenja. Uređuju se u admin panelu (Postavke → Tekstovi).
// Format: "## " naslov, "- " stavka popisa, prazan red odvaja odlomke.

export const PRAVILA = `## Kako se igra
Svaki dan u ponoć (po vremenu u Zagrebu) stiže deset novih sportskih pitanja. Odabereš kartu — Hrvatsku ili Bosnu i Hercegovinu — i krećeš s početka rute. Svaki točan odgovor vozi te prema cilju.

Nema ponuđenih odgovora. Odgovor upisuješ sam, a na većinu pitanja postoji mnogo točnih odgovora.

## Vrijeme
- Kad se pitanje pojavi, imaš 5 sekundi da ga pročitaš. Upis je za to vrijeme zaključan.
- Zatim imaš 30 sekundi za odgovor. Okvir polja za upis polako nestaje i pokazuje koliko je vremena ostalo.
- Ako odgovor nije prepoznat, pitanje ostaje otvoreno: pokušaj ponovno dok traje vrijeme. Neuspjeli pokušaji se ne računaju.
- Prvi točan odgovor zaključuje pitanje.
- Kad vrijeme istekne bez točnog odgovora, pitanje donosi 0 km. Sljedeće pitanje kreće tek kad pritisneš „Dalje“, pa između pitanja možeš predahnuti.

Sat teče na poslužitelju: osvježavanje stranice ga ne vraća na početak.

## Rijetkost odgovora
Što manje igrača da isti točan odgovor kao ti, to dobivaš bolji prijevoz i više kilometara. Najčešći odgovori voze najkraće, a oni kojih se gotovo nitko ne sjeti voze najdalje.

- Sedam razina prijevoza, od 12 do 220 km po pitanju.
- Bez točnog odgovora: 0 km.
- Rijetkost se računa iz početne procjene i iz odgovora stvarnih igrača. Dok je igrača malo, prevladava početna procjena, pa nekoliko slučajnih odgovora ne može poremetiti bodovanje.

## Kilometri i ruta
Kilometri u igri su udaljenost unutar igre, a ne stvarna cestovna udaljenost. Ruta namjerno ide okolo — kroz što više gradova. Do cilja (Dubrovnik, odnosno Neum) treba 1.000 km.

Tko skupi više od 1.000 km, ne staje na cilju: put se nastavlja u susjednu državu — iz Dubrovnika u Crnu Goru, iz Neuma u Hrvatsku — i kilometri se zbrajaju dalje.

## Procjene
U pitanjima s brojčanom procjenom nije važno pogoditi točno, nego biti što bliže. Procjenu možeš mijenjati dok traje vrijeme; vrijedi zadnja koju si upisao. Koliko si bio blizu vidiš tek kad je pitanje zaključeno. Uz svako takvo pitanje piše jedinica i datum na koji se brojka odnosi. Na nekim pitanjima najbliža procjena dana nakon ponoći dobiva najbolji prijevoz.

Točnu brojku i najčešće odgovore drugih igrača vidiš kad odigraš obje karte ili kad dan završi — tako prva karta ne otkriva odgovore za drugu.

## Pisanje odgovora
Ne moraš paziti na velika slova, kvačice ni interpunkciju: "Cilic" je isto što i "Čilić". Za sportaše je dovoljno prezime, osim kad isto prezime nosi više točnih odgovora — tada te igra zamoli da dopišeš ime, a to ne troši pokušaj. Sitne tipfelere igra prepoznaje.

## Što se računa
- Jedna službena partija dnevno na svakoj karti. Samo ona ulazi u ljestvice, lige, niz dana i statistiku rijetkosti.
- Ponovljene partije i partije iz arhive igraju se za zabavu i ne mijenjaju službene rezultate.
- Započetu partiju možeš dovršiti i nakon ponoći; računa se za dan kad je započeta.

## Odgovor nije prepoznat?
Ako misliš da je neki tvoj pokušaj bio točan, prijavi ga jednim dodirom na kraju partije. Kad ga uredništvo potvrdi, kilometri ti se naknadno priznaju i ljestvice se ažuriraju.

## Fer igra
Zabranjeni su botovi, skripte i višestruki računi kojima se utječe na rijetkost ili ljestvice. Uvredljivi nadimci i nazivi liga se uklanjaju. Kod kršenja pravila rezultati se mogu poništiti, a račun blokirati.`;

export const PRIVATNOST = `## Tko obrađuje podatke
Voditelj obrade je vlasnik stranice ONTALE.eu. Kontakt za sva pitanja o privatnosti naveden je na dnu ove stranice.

## Koje podatke prikupljamo
- Gost: nasumično ime gosta i kolačić sesije; odgovori i rezultati partija.
- Registrirani korisnik: e-mail adresa, lozinka (spremljena isključivo kao kriptografski sažetak), nadimak i, po želji, profilna slika.
- Google prijava: Googleov identifikator računa i e-mail adresa. Lozinku Google računa nikad ne vidimo.
- Tehnički podaci: skraćeni kriptografski sažetak IP adrese uz partiju, radi sprječavanja zlouporabe. IP adresu ne spremamo u čitljivom obliku.

## Zašto ih obrađujemo
- Da bi igra radila: spremanje partija, rezultata, niza dana, liga i ljestvica (izvršenje usluge koju tražiš).
- Zaštita igre od varanja i zlouporabe (legitimni interes).

Podatke ne prodajemo i ne koristimo za oglašavanje. Stranica ne koristi oglasne ni analitičke kolačiće trećih strana.

## Što je javno
Javno su vidljivi nadimak, profilna slika, rezultati i statistika. E-mail adresa nikad nije javna. Profil možeš postaviti kao privatan u postavkama profila.

## Kolačići
Koristimo jedan nužan kolačić sesije (prijava i nastavak partije). Za njega nije potrebna privola.

## Treće strane
- Kartografske pločice učitavaju se s poslužitelja pružatelja karata (OpenStreetMap ili drugi naveden na karti), koji pritom vidi tvoju IP adresu.
- Fontovi i kartografska biblioteka učitavaju se s javnih CDN poslužitelja.
- Google, samo ako odabereš Google prijavu.

## Koliko dugo čuvamo podatke
Podatke računa čuvamo dok ne obrišeš račun. Račune gostiju bez aktivnosti dulje od 12 mjeseci brišemo. Zbirni podaci o učestalosti odgovora (bez veze s osobom) ostaju i nakon brisanja računa.

## Tvoja prava
Imaš pravo na pristup, ispravak, brisanje, ograničenje obrade, prijenos podataka i prigovor. Račun i sve povezane podatke brišeš sam u profilu ("Obriši račun"), a kopiju svojih podataka preuzimaš na istom mjestu. Pritužbu možeš podnijeti Agenciji za zaštitu osobnih podataka (AZOP) ili nadležnom tijelu u svojoj državi.

## Dob
Za registraciju trebaš imati najmanje 16 godina ili dopuštenje roditelja odnosno skrbnika.`;

export const UVJETI = `## O igri
ONTALE je besplatna dnevna sportska igra. Nema pretplate, plaćenih funkcija ni prednosti koja se može kupiti.

## Račun
Igrati možeš kao gost. Registracija ili Google prijava omogućuju ljestvice, lige, niz dana i statistiku. Odgovoran si za čuvanje svojih podataka za prijavu. Račun možeš obrisati u bilo kojem trenutku u profilu.

## Pravila ponašanja
- Nadimak, profilna slika i naziv lige ne smiju biti uvredljivi, lažno predstavljati druge osobe ni služiti oglašavanju.
- Zabranjeni su botovi, skripte, automatizirano slanje odgovora, namjerno opterećivanje poslužitelja i zaobilaženje pravila igre.
- Zabranjen je pokušaj pristupa tuđim podacima.

Kod kršenja pravila možemo promijeniti nadimak, ukloniti sliku ili ligu, poništiti rezultate ili blokirati račun.

## Sadržaj i točnost
Pitanja i baze odgovora pripremamo pažljivo i uz navođenje izvora, ali pogreške su moguće. Odgovor za koji smatraš da je točan možeš prijaviti u igri. Brojke označene kao procjena nisu službena statistika.

Igra je namijenjena zabavi i pruža se "kakva jest", bez jamstva neprekidnog rada. Igru možemo mijenjati, privremeno zaustaviti ili ugasiti.

## Prijava neprimjerenog sadržaja
Neprimjeren nadimak, sliku ili naziv lige možeš prijaviti u aplikaciji ili na kontakt adresu navedenu na dnu stranice. Ista adresa je kontaktna točka prema Aktu o digitalnim uslugama (DSA).

## Mjerodavno pravo
Primjenjuje se pravo Republike Hrvatske. Uvjeti se mogu izmijeniti; izmjene vrijede od objave na ovoj stranici.`;
