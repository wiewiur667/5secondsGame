# Generates server/games/riposta/prompts.json from the lists below.
# Edit the lists, then run: python3 scripts/build-riposta-prompts.py
# All prompts are original (written for this project) — see LICENSE-CONTENT.
# Style rules: blank goes at the END after a colon (no mid-sentence blanks that
# force a case/gender), no "zrobiłeś/-aś" forms, no yes/no questions.
import json, os

FAMILY = """
Najgorsza rzecz, jaką można znaleźć w pierogu:
Prezent od babci, którego nikt nie chce:
Prawdziwy powód, dla którego pociąg się spóźnia:
Co naprawdę oznacza „zaraz będę”:
Nowy smak chipsów, którego nikt nie kupi:
Najgorsze imię dla psa:
Napis na koszulce, którą nosi każdy wujek na grillu:
Tytuł najnudniejszego filmu świata:
Co krzyczy kibic, który nie wie, co się dzieje na boisku:
Najgorszy pomysł na pracę z plastyki:
Hasło reklamowe dla działki pod miastem:
Rzecz, którą znajdziesz w każdej kuchennej szufladzie:
Co mówi nawigacja, kiedy ma dość kierowcy:
Nowa dyscyplina olimpijska dla emerytów:
Najgorsza rzecz, jaką może powiedzieć pilot samolotu:
Co robią koty, kiedy nikogo nie ma w domu:
Nazwa zespołu disco polo z twojej okolicy:
Najmniej przydatna supermoc:
Historia, którą dziadek opowiada przy każdym obiedzie:
Tytuł książki napisanej przez kota:
Wymówka za spóźnienie do szkoły, która nigdy nie działa:
Najdziwniejsze danie na wigilijnym stole:
Co jest napisane drobnym drukiem w umowie na telefon:
Najgorsza rzecz do powiedzenia na wywiadówce:
Nowa aplikacja, której nikt nie potrzebuje:
Co mówi lodówka, gdy otwierasz ją piąty raz w ciągu godziny:
Nazwa nowego święta państwowego:
Najgorszy tekst na kartce urodzinowej:
Rzecz, którą słychać w każdej kolejce w urzędzie:
Hasło, które powinno wisieć nad każdym okienkiem w urzędzie:
Najgorsza nazwa dla nowego batonika:
Prawdziwy powód, dla którego skarpetki znikają w pralce:
Co nauczyciel naprawdę myśli, kiedy mówi „ciekawa odpowiedź”:
Najgorszy pomysł na atrakcję w aquaparku:
Co powiedziałby gołąb, gdyby umiał mówić:
Najdziwniejszy produkt w sklepie „wszystko po 5 zł”:
Najgorsza rzecz, jaką można usłyszeć od fryzjera:
Tytuł nowego hitu na sylwestrowym koncercie:
Rzecz, której nie powinno się robić w windzie:
Najgorsze imię dla smoka:
Co znaleźli archeolodzy pod Pałacem Kultury:
Najgorszy temat wypracowania na maturze:
Nowa zasada w szkole, która zdenerwowałaby wszystkich:
Tajny składnik pasty do zębów:
Pierwsze słowa robota, który właśnie się obudził:
Najgorsza rzecz do zabrania na kemping:
Hasło reklamowe najgorszego hotelu nad morzem:
Temat, o który zawsze kłóci się rodzina przy stole:
Nowy program w telewizji śniadaniowej:
Co mówi sąsiad z wiertarką w niedzielę o 8 rano:
Najgorszy prezent na Dzień Matki:
Najdziwniejsza rzecz w plecaku ucznia:
Tytuł piosenki, którą śpiewa twoja pralka:
Co mówią krowy, kiedy nikt nie słucha:
Najgorsza nazwa dla budki z kebabem:
Prawdziwy powód, dla którego ludzie noszą skarpety do sandałów:
Najgorsza rzecz do napisania w wiadomości do szefa:
Nowy znak drogowy, którego naprawdę potrzebujemy:
Co Mikołaj robi przez resztę roku:
Najgorszy smak lodów:
Najgorsze miejsce na pierwszą randkę:
Co kryje się na dnie torebki mamy:
Najkrótsza bajka świata:
Tytuł reality show o emerytach na działkach:
Najgorsza rzecz do powiedzenia po obiedzie u teściowej:
Hasło wyborcze kandydata na sołtysa:
Nowa nazwa dla poniedziałku:
Co szepcze choinka w połowie stycznia:
Najdziwniejszy powód, żeby zadzwonić na infolinię:
Pierwsze, co robi kosmita po wylądowaniu w Polsce:
Najgorszy pomysł na rodzinne zdjęcie do ramki:
Rzecz, którą każdy wozi w schowku samochodowym:
Co mówi pies na widok listonosza:
Najgorsza nazwa dla nowej linii metra:
Sekretny składnik bigosu cioci:
Najgorszy moment na kichnięcie:
Najgorsza zabawka, jaką można dać dziecku:
Nowa konkurencja weselna, która skończy się źle:
Najgorsze hasło do wi-fi:
Wiadomość, którą mama wysyła na rodzinnej grupie:
Co gołąb robi na pomniku przez cały dzień:
Najgorszy pomysł na niespodziankę urodzinową:
Najbardziej polski sport ekstremalny:
Nazwa dinozaura odkrytego właśnie w Bieszczadach:
Co mówi trener, gdy drużyna przegrywa 0:7:
Rzecz, której nikt nigdy nie przeczytał do końca:
Najgorsza mowa na pogrzebie chomika:
Nowy owoc, który właśnie wyhodowali naukowcy:
Co robi nocny stróż w muzeum, kiedy się nudzi:
Najgorsze hasło na transparencie na meczu:
Najdziwniejsza nazwa ulicy w Polsce:
Co mówi ślimak, kiedy w końcu dociera do celu:
Najgorsza rzecz do powiedzenia egzaminatorowi na prawie jazdy:
Pamiątka, którą wujek zawsze przywozi z wakacji:
Najgorszy pomysł na lekcję WF-u:
Wymówka, żeby nie zmywać naczyń:
Nowy obowiązkowy przedmiot w szkole:
Co mówi bałwan, kiedy przychodzi wiosna:
Najgorszy dzwonek w telefonie:
Rzecz, którą można kupić tylko na stacji benzynowej o 2 w nocy:
"""

FAMILY_FINAL = """
Rzecz, którą słychać na każdej wywiadówce:
Najgorszy pomysł na rodzinny wyjazd:
Co znajdziesz w lodówce studenta:
Nowy przysmak na odpuście:
Prawdziwa treść listu do Mikołaja od dorosłego:
Najgorsza nazwa dla statku wycieczkowego:
Co krzyczy pan z megafonem na plaży:
Pierwsze zdanie najgorszej bajki na dobranoc:
Nowy zawód przyszłości:
Najgorszy powód, żeby dzwonić do babci o północy:
Dokąd naprawdę uciekają skarpetki z pralki:
Hasło na kubek dla najgorszego szefa świata:
Nowa atrakcja w zoo:
Co naprawdę znaczy „pip” mikrofalówki:
Najdziwniejsza rzecz w kolejce do kasy w hipermarkecie:
Najgorszy pomysł na kostium na bal przebierańców:
Co mówi Polak na widok promocji:
Tytuł filmu o życiu twojej lodówki:
Pierwsze słowa dziecka urodzonego w 2050 roku:
Rzecz, której nie wolno robić w bibliotece:
"""

ADULT = """
Prawdziwy powód, dla którego szef zwołał spotkanie o 16:55:
Co wujek krzyczy po trzecim kieliszku:
Najgorsza rzecz do powiedzenia na pierwszej randce:
Co jest naprawdę w kebabie o trzeciej w nocy:
Najgorszy tekst na podryw w dyskoncie:
Wymówka, żeby nie przyjść na firmową wigilię:
Najgorsza rzecz do znalezienia w telefonie partnera:
Nazwa nowej wódki smakowej:
Co naprawdę znaczy „musimy porozmawiać”:
Najgorszy toast weselny:
Prawdziwa treść maila „zgodnie z moją poprzednią wiadomością”:
Najgorszy opis profilu w aplikacji randkowej:
Co robi księgowa po godzinach:
Hasło reklamowe piwa bezalkoholowego:
Najgorsza rzecz do powiedzenia teściowej przy pierwszym spotkaniu:
Co mówi barman, kiedy ma cię dość:
Najgorszy powód do rozwodu:
Co naprawdę dzieje się na wyjeździe integracyjnym:
Najgorsza nazwa dla drinka:
Kac w trzech słowach:
Prawdziwy powód, dla którego kolega z pracy zawsze pracuje zdalnie:
Co ludzie wpisują w wyszukiwarkę o 4 nad ranem:
Najgorsza rzecz do powiedzenia na rozmowie o podwyżkę:
Nowe hasło motywacyjne w korporacji:
Najgorszy moment na telefon od eks:
Co sąsiedzi słyszą przez ścianę w sobotę wieczorem:
Najgorszy pomysł na wieczór kawalerski:
Najgorszy pomysł na wieczór panieński:
Co naprawdę robi informatyk, kiedy mówi „kompiluje się”:
Najgorsza rzecz do powiedzenia na ślubie przyjaciół:
Sekretny składnik nalewki dziadka:
Co mówi Polak przy szwedzkim stole w Egipcie:
Najgorsza wymówka, żeby nie iść na siłownię:
Prawdziwy powód, dla którego para kupuje psa:
Najgorsza wiadomość do wysłania po pijaku:
Zasada, która wisi w każdym klubie nocnym:
Tytuł romansu dla wędkarzy:
Najgorszy prezent na rocznicę:
Co kryje się w historii przeglądarki szefa:
Najgorsza nazwa dla biura matrymonialnego:
Co naprawdę znaczy „wpadnę tylko na jedno piwo”:
Najgorsze miejsce na oświadczyny:
Co mówi lekarz, gdy zobaczy wyniki twojej wątroby:
Najgorsze zdanie w ogłoszeniu o pracę:
Rzecz, do której nikt się nie przyzna, że robi w samochodzie:
Najgorszy pomysł na pierwszy taniec weselny:
Wymówka, żeby wyjść wcześniej z imprezy:
Co naprawdę jest w zielonej butelce na weselu:
Najgorsza rzecz do powiedzenia w sypialni:
Prawdziwy powód, dla którego sąsiadka zawsze patrzy przez wizjer:
Najgorszy temat na rozmowę z szefem przy kawie:
Doświadczenie zawodowe w CV kogoś, kto codziennie imprezuje:
Najmniej romantyczne wyznanie miłości:
Najgorszy prezent od firmy na święta:
Co mówi kierowca nocnego autobusu:
Nowy dzień wolny od pracy, który wszyscy by uszanowali:
Najgorsza nazwa dla sklepu z bielizną:
Co znajdziesz w szufladzie pod łóżkiem singla:
Najgorsze hasło reklamowe aplikacji randkowej:
Co naprawdę dzieje się w open space w piątek po 15:
Najgorsza rzecz do powiedzenia policjantowi podczas kontroli:
Piosenka, którą puszczają na każdej osiemnastce o 2 w nocy:
Najgorszy pomysł na Walentynki:
Hasło reklamowe najtańszego dentysty w mieście:
Najgorsza rzecz do zrobienia na firmowej wideokonferencji:
Najgorszy temat rozmowy w saunie:
Co myśli kelner, kiedy zostawiasz 2 złote napiwku:
Nowa nazwa dla kredytu hipotecznego:
Co naprawdę znaczy „jestem już w drodze”:
Najgorsza rzecz do powiedzenia rodzicom partnera:
Prawdziwa treść wiadomości „hej, śpisz?”:
Co mówi szef, kiedy prosisz o urlop w sierpniu:
Najgorszy pomysł na start-up:
Co ludzie robią w windzie, kiedy myślą, że nikt nie widzi:
Nowy znak zodiaku dla ludzi po trzydziestce:
Najgorsza nazwa dla piwa kraftowego:
Co robi para po dziesięciu latach małżeństwa w piątkowy wieczór:
Najgorszy powód, żeby zadzwonić na 112:
Pierwsza wiadomość od kogoś poznanego na siłowni:
Najgorsza rzecz do wrzucenia na portal dla profesjonalistów:
Co mówi taksówkarz o 4 nad ranem:
Prawdziwy powód, dla którego nikt nie odbiera telefonu z banku:
Najgorszy pomysł na tatuaż po pijaku:
Co przepowie wróżka na weselu kuzyna:
Najgorszy sposób na zerwanie:
Rzecz, którą każdy robi na kacu, a nikt się nie przyznaje:
Najgorsza rzecz do wpisania w CV:
Prawdziwy powód, dla którego goście zostają na weselu do piątej rano:
Najgorsza nazwa dla zespołu weselnego:
Co mówi nawigacja, kiedy jedziesz do teściów:
Nowy napis na tablicy przed salą weselną:
Najgorsza rzecz do zamówienia na pierwszej randce:
Co naprawdę jest w „kawie” sąsiada:
Najgorsze życzenia z okazji rozwodu:
Co mówi DJ, kiedy nikt nie tańczy:
Prawdziwy powód, dla którego firma kupiła piłkarzyki:
Najgorsza rzecz do powiedzenia po pierwszym pocałunku:
Nazwa nowego leku na kaca:
Co rodzice piszą na grupie klasowej po 22:
Najgorsza rzecz do usłyszenia od mechanika:
"""

ADULT_FINAL = """
Tradycja weselna, która powinna zniknąć:
Co naprawdę dzieje się w szatni amatorskiej ligi piłkarskiej:
Najgorszy pomysł na firmową imprezę:
Co mówi wujek, kiedy skończy się wódka:
Najgorsza wymówka, żeby nie oddzwonić:
Prawdziwy powód, dla którego sąsiedzi wyprowadzili się w nocy:
Hasło reklamowe motelu przy autostradzie:
Co znajdziesz w kieszeni marynarki po weselu:
Najgorszy pomysł na randkę w ciemno:
Nowa kategoria w aplikacji randkowej:
Najgorsze zdanie w małżeńskiej kłótni:
Co naprawdę robi szef w zamkniętym gabinecie:
Najgorsze życzenia na czterdziestkę:
Pierwsze słowa po przebudzeniu na cudzej kanapie:
Nazwa nowego telewizyjnego programu randkowego:
Najgorszy powód, żeby się oświadczyć:
Co mówi Polak, który przegrywa w kasynie:
Prawdziwa treść notatki służbowej „w sprawie lodówki”:
Najgorsza rzecz do powiedzenia na rozmowie kwalifikacyjnej:
Co naprawdę znaczy „zostańmy przyjaciółmi”:
"""

X18 = """
Najgorsza rzecz do krzyknięcia w trakcie seksu:
Nazwa nowej zabawki erotycznej dla emerytów:
Co naprawdę robią ludzie w przymierzalni:
Najgorsze hasło na opakowaniu prezerwatyw:
Tytuł filmu dla dorosłych o urzędnikach skarbówki:
Co szepnąć w łóżku, żeby natychmiast zepsuć nastrój:
Najgorszy pseudonim gwiazdy porno:
Najgorsza rzecz w seksie pod namiotem:
Kolor bielizny erotycznej, który nikogo nie podnieca:
Najgorsza rzecz do znalezienia w hotelowym łóżku:
Co mówi seksuolog po wysłuchaniu twojej historii:
Najgorsze hasło bezpieczeństwa:
Prawdziwy powód, dla którego sąsiad kupił wodoodporny materac:
Tytuł erotyku napisanego przez księgowego:
Najgorsza rzecz do usłyszenia od lekarza podczas badania prostaty:
Najmniej seksowne miejsce na szybki numerek:
Co mówi urolog po trzydziestym pacjencie danego dnia:
Nazwa pozycji seksualnej inspirowanej składaniem mebli:
Najgorsza rzecz do wysłania podczas sekstingu:
Tatuaż nad pośladkami, którego się żałuje:
Najgorsza wymówka, gdy ktoś przyłapie cię nago:
Co krzyczy pijany wujek, zdejmując koszulę na weselu:
Najgorsza wiadomość od eks o trzeciej w nocy:
Co naprawdę leży w szufladzie nocnej szanującej się babci:
Nazwa nowej choroby wenerycznej:
Najgorsza rzecz do powiedzenia nago:
Najbardziej polskie przekleństwo na określenie poniedziałku:
Co jest napisane na ścianie w dworcowej toalecie:
Najgorszy pomysł na grę wstępną:
Tytuł polskiego pornosa z lat 90.:
Co mówią jądra, kiedy jest zimno:
Najgorsza nazwa dla agencji towarzyskiej:
Rzecz, której nie mówi się podczas striptizu:
Najgorsza rzecz w porannym seksie:
Najgorszy tekst na podryw w saunie:
Prawdziwa przyczyna złamanego łóżka w hotelu:
Najgorszy prezent od kochanka:
Co robi Polak, kiedy skończy się papier toaletowy:
Nazwa żelu intymnego o smaku polskiego dania:
Najgorszy dźwięk podczas seksu:
Co szepcze do siebie koks przed lustrem na siłowni:
Najgorszy moment na puszczenie bąka:
Co jest w kopercie od skąpego wujka na weselu:
Najgorsze imię dla penisa:
Najgorsze imię dla biustu:
Co ludzie naprawdę oglądają w nocy w hotelu:
Najgorsza rzecz do powiedzenia na plaży nudystów:
Hasło reklamowe wibratora na baterie słoneczne:
Co mówi plemnik, który przegrał wyścig:
Najgorsza nazwa dla klubu swingersów:
Najgorsza rzecz w seksie po kebabie:
Najgorszy fetysz do wyznania na pierwszej randce:
Co mówi łóżko w hotelu po weselu:
Najgorsza rzecz do zrobienia w jacuzzi z nieznajomymi:
Nowa nazwa na kaca giganta:
Co naprawdę znaczy „wejdziesz na kawę?”:
Jak nazwać wczorajszą imprezę, której nikt nie pamięta:
Co robi pies, kiedy widzi, że się całujecie:
Najgorsze miejsce na zgubienie stringów:
Co mówi kac morderca o 7 rano:
Najgorsze hasło w kalendarzu z nagimi strażakami:
Nazwa drinka, po którym budzisz się w Czechach:
Co krzyczy sąsiadka zza ściany:
Najgorsza rzecz do zrobienia po pijaku w całodobowym sklepie:
Najgorsza literówka w erotycznej wiadomości:
Co naprawdę robią kosmici z porwanymi ludźmi:
Najgorsza rzecz do znalezienia w historii przeglądarki dziadka:
Nazwa salonu masażu z „dodatkowymi usługami”:
Co mówi biust po zdjęciu stanika:
Najgorszy opis zdjęcia na portalu dla dorosłych:
Najgorszy sposób na obudzenie partnera:
Napis na majtkach na pierwszą randkę:
Najgorsze zdanie do powiedzenia przy rodzinnym stole po wódce:
Co dziadek robi z tabletkami na potencję, których nie potrzebuje:
Najgorszy powód, żeby pójść do sex shopu:
Co robi Polak na all inclusive po dziesięciu drinkach:
Najgorsza rzecz do zrobienia na pierwszym spotkaniu z aplikacji randkowej:
Tytuł piosenki disco polo o romansie z sąsiadką:
Co mówi prezerwatywa, kiedy pęka:
Najgorszy napis na wycieraczce w domu swingersów:
Co ludzie piszą w anonimowych wyznaniach o 2 w nocy:
Najgorszy moment na rozwolnienie:
Co mówi partner na widok twoich nowych majtek:
Najgorsze imię do pomylenia w łóżku:
Jak nazwać zapach w łazience po wujku:
Najgorsza rzecz w seksie przez telefon:
Najgorszy pomysł na kostium erotyczny:
Prawdziwy powód, dla którego sąsiad ma przyciemniane szyby:
Najgorsza rzecz do powiedzenia, kiedy partner się rozbiera:
Co szepcze striptizer do emerytki na wieczorze panieńskim:
Nazwa nowej pigułki na potencję:
Co krzyczysz, budząc się obok nieznajomej osoby:
Najgorsze miejsce na nagie selfie:
Co mówi tyłek po ostrym curry:
Najgorszy pomysł na domowy film dla dorosłych:
Najgorsza rzecz w nudyzmie zimą:
Najgorszy podpis pod nagim zdjęciem:
Rzecz, po której każdy krzyczy „o kurwa!”:
Co mówi lekarz na SOR-ze, wyciągając coś z czyjegoś tyłka:
Najgorsza rzecz, jaką można powiedzieć w trakcie stosunku:
"""

X18_FINAL = """
Najgorsza rzecz do powiedzenia po seksie:
Nazwa nowej pozycji seksualnej:
Co naprawdę dzieje się na wieczorze kawalerskim w Pradze:
Najgorszy napis na koszulce w sex shopie:
Co mówi Polak, który pierwszy raz widzi nudystów:
Najgorsze zdanie w erotyku napisanym przez sztuczną inteligencję:
Co znajdziesz w telefonie po weselu:
Najgorszy powód, żeby się rozebrać:
Tytuł wspomnień starej kanapy z akademika:
Najgorsza rzecz do wyszeptania komuś do ucha w autobusie:
Co mówi sąsiad, który wszystko słyszał:
Najgorsza nazwa dla prezerwatyw:
Co ludzie robią w toalecie w samolocie:
Najgorszy moment na zdjęcie spodni:
Pierwsze słowa po przebudzeniu na potężnym kacu:
Najgorsza rzecz w seksie w samochodzie:
Najgorszy prezent na wieczór panieński:
Co krzyczy pijany wujek do DJ-a:
Najgorsza rzecz do pomylenia w ciemności:
Co mówi materac po dwudziestu latach małżeństwa:
"""

# Gotowce: generic answers that fit after any "…:" prompt.
QUIPS = {
  'family': """
Skarpetki nie do pary
Coś, o czym lepiej nie mówić przy babci
Ziemniaki. Zawsze ziemniaki.
Zupa pomidorowa z wczorajszego rosołu
Kartofel w kapeluszu
Zgubione klucze
Paragon sprzed trzech lat
Gołąb z ambicjami
Rosół w niedzielę o 13:00
Kapcie po dziadku
Wielka dmuchana kaczka
Kot, który wszystko widział
Pierogi ruskie na zimno
Wujek z wąsem i kijkami do nordic walking
Cisza w słuchawce
Reklamówka pełna reklamówek
Gąbka do naczyń
Stara nokia, która wciąż działa
Kompot z suszu
Sandały ze skarpetkami
""",
  'adult': """
Trzeci kieliszek
Eks, który wciąż lajkuje zdjęcia
Niedzielny kac
Mail od szefa w piątek o 17:00
Zbyt szczera teściowa
Rachunek za prąd
Nalewka wujka Mietka
Kredyt na 30 lat
Grill u sąsiada bez zaproszenia
„Hej, śpisz?” o drugiej w nocy
Wyjazd integracyjny nad morze
Ostatni nocny autobus
""",
  '18+': """
Pomyłka w ciemności
Majtki na żyrandolu
Nalewka i złe decyzje
Kac moralny w rozmiarze XXL
Coś, czego nie pokażę na grupie rodzinnej
Gołe pośladki w świetle księżyca
Prezerwatywa z promocji
Wąsaty striptizer z Radomia
Krzyk sąsiadki zza ściany
Pozycja na leniwego żółwia
Zgubione stringi
Wujek w samych slipach
""",
}

def lines(block):
    return [l.strip() for l in block.strip().splitlines() if l.strip()]

def entries(block, tier, start):
    return [{'id': start + i, 'text': t, 'tier': tier} for i, t in enumerate(lines(block))]

prompts = entries(FAMILY, 'family', 1) + entries(ADULT, 'adult', 201) + entries(X18, '18+', 401)
finals = entries(FAMILY_FINAL, 'family', 1001) + entries(ADULT_FINAL, 'adult', 1101) + entries(X18_FINAL, '18+', 1201)
quips = []
for tier, start in (('family', 5001), ('adult', 5101), ('18+', 5201)):
    quips += entries(QUIPS[tier], tier, start)

out = {
    'version': 1,
    'license': 'CC BY 4.0 — see LICENSE-CONTENT',
    'tiers': ['family', 'adult', '18+'],
    'prompts': prompts,
    'finalPrompts': finals,
    'safetyQuips': quips,
}
here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, '..', 'server', 'games', 'riposta', 'prompts.json')
with open(path, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
    f.write('\n')
for t in ('family', 'adult', '18+'):
    print(t, sum(p['tier'] == t for p in prompts), 'prompts,', sum(p['tier'] == t for p in finals), 'finals,', sum(q['tier'] == t for q in quips), 'quips')
