#!/usr/bin/env python3
"""Builds server/games/obstaw/content.json. Card texts are original paraphrases
of the task ideas (the physical card wording is NOT copied).
  sec: hourglass (15 yellow / 30 red / 60 black) or None = no hourglass.
  tries: attempts note shown under the task, e.g. "3 próby", "2 z 5 prób".
"""
import json, pathlib

# (text, tries, sec)
SKILL = [
 ("Znajdź na stole 5 niebieskich przedmiotów i połóż je razem.", None, 60),
 ("Z odległości około metra wrzuć plastikową butelkę (0,5 l, napełnioną do jednej czwartej wodą) na stół tak, żeby stanęła.", "5 prób", None),
 ("Wygraj z innym graczem w kamień-papier-nożyce.", "3 wygrane w 5 partiach", None),
 ("Stojąc, połóż cukierek na leżącym ołówku, unieś ołówek i złap cukierek ustami, zanim spadnie.", "3 próby", None),
 ("Usiądź na ręczniku i przesuń się nim po podłodze do przodu o około 2 metry.", None, 60),
 ("Przeczołgaj się pod stołem z łyżką w ustach, a na niej kostką do gry. Kostka nie może spaść.", "3 próby", None),
 ("Wygłoś minutową przemowę o wybranym przez siebie owocu. Bez powtórek i bez zawahania dłuższego niż 3 sekundy.", None, 60),
 ("Podbij grzbietem dłoni kartę leżącą na krawędzi stołu i złap ją w locie.", "4 udane próby z 6", None),
 ("Stojąc na jednej nodze, pocałuj się w stopę.", None, None),
 ("Połóż klepsydrę na przedramieniu przy łokciu, zegnij rękę i przetocz ją po splecionych przedramionach aż do łokcia.", "3 próby", None),
 ("Zwiń język w rurkę.", None, 60),
 ("Pstryknij palcem klepsydrę tak, żeby strąciła drugą, stojącą około 50 cm dalej.", "2 udane próby z 5", None),
 ("Podnieś inną osobę o podobnej wadze i utrzymaj ją w powietrzu przez 30 sekund. Osobę wybierz przed zakładami.", None, 30),
 ("Przytrzymaj ustami dwa suche makarony spaghetti, połóż na nich trzeci w poprzek i utrzymaj go tak 5 sekund bez dotykania ustami.", None, 60),
 ("Połóż 5 ołówków na wierzchu dłoni, podrzuć je i złap wszystkie, zanim spadną.", "3 udane próby z 5", None),
 ("Utrzymaj łyżeczkę na czubku nosa przez 30 sekund.", None, None),
 ("Ktoś robi zdjęcie przedmiotu z otoczenia, mocno je powiększa i pokazuje tylko jego fragment. Znajdź ten przedmiot.", None, 15),
 ("Dwoma ołówkami jak pałeczkami przenieś kolejno pionek, kostkę i klepsydrę na odległość 1,5 metra do kubka.", None, 30),
 ("Bez pomocy rąk stań na jednej nodze, usiądź na krześle i wstań z powrotem.", None, None),
 ("Powiedz pięć razy pod rząd, szybko i bez pomyłki: „W czasie suszy suchą szosą Sasza sobie szedł”.", "3 próby", None),
 ("Utrzymaj półtoralitrową plastikową butelkę w równowadze na palcu przez 15 sekund.", "2 próby", 15),
 ("Połóż 2 monety na łokciu, podrzuć je i złap w dłoń.", None, None),
 ("Podrzuć stopą własny but tak, żeby wylądował na krześle stojącym około 2 metry dalej.", "4 próby", None),
 ("Połóż klepsydrę na stole, a 50 cm dalej kostkę. Jednym pchnięciem klepsydry uderz w kostkę.", "2 udane próby z 5", None),
 ("Podrzuć kostkę do góry, obróć się o 360 stopni i złap ją.", "3 udane próby z 5", None),
 ("Usiądź na podłodze i wstań, trzymając na głowie książkę, która nie może spaść.", "2 próby", None),
 ("Ułóż na szyjce butelki 4 widelce w poprzek tak, żeby żaden nie spadł przez 15 sekund.", None, 60),
 ("Połóż kostkę na stopie i podrzuć ją tak, by wpadła do szklanki stojącej metr dalej. Liczy się też kostka, która wypadnie po tym, jak była w środku.", "5 prób", None),
 ("Umieść na stopie wieszak ubraniowy i podrzuć go tak, by zawisł na wyciągniętym palcu wskazującym.", "3 próby", None),
 ("Trzymając szklankę na górze stopy, obejdź dookoła stół w ciągu minuty. Jeśli szklanka spadnie, próba jest nieudana.", None, 60),
 ("Znajdź i połóż na stole 3 przedmioty, których nazwa zaczyna się na literę „P”.", None, 60),
 ("Stój 30 sekund na lewej nodze z zamkniętymi oczami.", None, 30),
 ("Zrób 3 małe kulki z papieru toaletowego i „przyssij” je po kolei nosem, a następnie przenieś do szklanki oddalonej o 2 metry.", None, 60),
 ("Stojąc na jednej nodze, podnieś z podłogi kostkę leżącą pół metra od Ciebie.", None, None),
 ("Zabierz rękę, zanim przeciwnik zdąży ją klepnąć. Siedzicie naprzeciw siebie z rękami na stole.", "2 udane próby z 5", None),
 ("Wyrzuć dwie monety zza pleców do góry i złap je.", "2 próby", None),
 ("Przez 30 sekund unikaj odpowiedzi „nie” na pytania zadawane przez innych graczy. Nie możesz się zastanawiać dłużej niż 2 sekundy.", None, 30),
 ("Zapisz na telefonie tekst z 12 słów w ciągu 30 sekund. Inny gracz zapisuje tekst na kartce i czyta go na głos, a potem zapisuje go ten, kto wykonuje zadanie.", None, 30),
 ("Upuść kartę z wysokości 1,5 metra tak, żeby wylądowała tekstem do góry.", "3 udane próby z 5", None),
 ("Napisz swoje nazwisko wspak w ciągu minuty.", None, 60),
 ("Wstań z pozycji leżącej na plecach, nie podpierając się ramionami ani rękami.", None, None),
 ("Z odległości 2 metrów wrzuć 3 karty do pudełka.", "5 prób", None),
 ("Z zamkniętymi oczami, z rozłożonymi szeroko rękami, zetknij ze sobą palce wskazujące.", "3 udane próby z 5", None),
 ("Trzy razy odbij kostkę udem i złap ją w powietrzu.", None, 30),
 ("Wyciągnij kartkę spod butelki tak, żeby butelka się nie przewróciła.", "3 próby", None),
 ("Rozkręć na wyciągniętym palcu 3 wieszaki i utrzymaj je w ruchu przez minutę.", "3 próby", 60),
 ("Napełnij miskę wodą. Przenoś wodę ustami do szklanki stojącej 2 metry dalej, aż szklanka będzie pełna.", None, None),
 ("Połóż kartę na szczycie butelki i zrzuć ją rzutem kostki z odległości 2 metrów.", "2 udane próby z 5", None),
 ("Wachluj gazetą tak, żeby przesunąć kartkę o 1,5 metra na wyznaczone miejsce.", None, 30),
 ("Zapisz na telefonie w 15 sekund ciąg „Cba” powtórzony 10 razy, z odstępem między kolejnymi „Cba” (Cba Cba Cba…). C musi być wielką literą.", None, 15),
]

# (question, sec, sample answers or [])
MENTAL = [
 ("Czy wymienisz 3 znane osoby o imieniu Władysław?", 30, ["Władysław Jagiełło", "Władysław Łokietek", "Władysław Reymont", "Władysław Szpilman", "Władysław Broniewski", "Władysław Gomułka", "Władysław Sikorski", "Władysław Bartoszewski"]),
 ("Czy wymienisz 4 marki kawy?", 30, []),
 ("Czy wymienisz 7 miast w Polsce zaczynających się na literę W?", 60, ["Warszawa", "Wrocław", "Włocławek", "Wałbrzych", "Wieliczka", "Wejherowo", "Wadowice", "Wągrowiec", "Wolsztyn", "Wołomin", "Wieluń", "Wisła", "Władysławowo", "Wodzisław Śląski"]),
 ("Czy znajdziesz 5 słów zawierających „TOR”? (np. kurator, tort)", 30, []),
 ("Czy znajdziesz 5 słów zawierających „STO”? (np. stokrotka, stoper)", 30, []),
 ("Czy wymienisz 6 kuchennych przyrządów na 5 lub 6 liter?", 60, []),
 ("Gracz odgaduje zwierzę, o którym myśli ktoś inny, zadając 10 pytań, na które odpowiedź brzmi „tak” lub „nie”. Zwierzę uzgodnijcie przed zakładami.", 60, []),
 ("Czy wymienisz 8 królów Polski?", 60, ["Mieszko I", "Bolesław Chrobry", "Mieszko II", "Kazimierz Odnowiciel", "Bolesław Śmiały", "Władysław Herman", "Bolesław Krzywousty", "Władysław Łokietek", "Kazimierz Wielki", "Ludwik Węgierski", "Władysław Jagiełło", "Kazimierz Jagiellończyk", "Jan Olbracht", "Zygmunt Stary", "Zygmunt August", "Stefan Batory", "Zygmunt III Waza", "Jan Kazimierz", "Jan III Sobieski", "August II Mocny", "Stanisław August Poniatowski"]),
 ("Czy wymienisz nazwiska 3 znanych kucharzy?", 30, []),
 ("Czy wymienisz 4 rasy kotów?", 15, ["perski", "syjamski", "maine coon", "brytyjski krótkowłosy", "sfinks", "ragdoll", "bengalski", "norweski leśny", "abisyński", "birmański", "devon rex", "syberyjski"]),
 ("Czy wymienisz 4 części samochodu na 5 lub 6 liter?", 60, []),
 ("Czy wymienisz 6 miast w Polsce zaczynających się na literę K?", 60, ["Kraków", "Katowice", "Kielce", "Koszalin", "Kalisz", "Konin", "Kołobrzeg", "Kętrzyn", "Kłodzko", "Krosno", "Kutno", "Kościan", "Kartuzy", "Kościerzyna", "Kluczbork"]),
 ("Jeden gracz zapisuje proste równanie, używając tylko plusów i minusów (np. 87 − 6 + 2 + 1 = 84), po czym usuwa te znaki. Czy rozgrywający zdoła wstawić plusy i minusy tak, żeby wynik był poprawny?", 60, []),
 ("Czy wymienisz nazwy dziesięciu stacji telewizyjnych?", 60, []),
 ("Czy wymienisz 4 znane muzea?", 30, []),
 ("Czy wymienisz 8 rodzajów ryb?", 60, ["karp", "szczupak", "sandacz", "okoń", "leszcz", "pstrąg", "łosoś", "dorsz", "śledź", "sum", "węgorz", "płoć", "tuńczyk", "makrela", "flądra", "lin", "boleń", "jesiotr"]),
 ("Czy wypowiesz 6 wyrazów, które zawierają słowo „SKLEP”?", 60, []),
 ("Czy wymienisz 3 owoce na 5 liter?", 60, ["banan", "mango", "śliwa", "limka"]),
 ("Czy wymienisz 5 walut? (np. euro)", 30, ["euro", "dolar", "funt", "frank", "złoty", "jen", "korona", "forint", "rubel", "juan", "lej", "peso", "rupia", "lira", "real"]),
 ("Czy wymienisz 7 przedmiotów, które można znaleźć w szpitalu?", 30, []),
 ("Czy wymienisz 5 synonimów słowa „PIENIĄDZE”?", 60, ["gotówka", "forsa", "kasa", "szmal", "grosz", "mamona", "fundusze", "środki", "dutki", "pieniądz", "waluta", "gotowizna"]),
 ("Czy wymienisz 8 znaków interpunkcyjnych? Przykład: kropka, przecinek, myślnik.", 60, ["kropka", "przecinek", "średnik", "dwukropek", "myślnik", "nawias", "cudzysłów", "pytajnik", "wykrzyknik", "wielokropek", "łącznik", "apostrof", "ukośnik"]),
 ("Czy wymienisz 4 owoce lub warzywa zaczynające się na literę B?", 30, ["banan", "burak", "bakłażan", "brokuł", "brzoskwinia", "bób", "borówka", "brukselka", "botwina", "bataty"]),
 ("Czy wymienisz 5 słów zawierających „ŚLA”? (np. ślad, koślawy)", 30, []),
 ("Czy ocenisz, ile stron ma dowolna gazeta lub magazyn (±10 stron), bez zaglądania do środka?", 30, []),
 ("Czy w ciągu 30 sekund odnajdziesz słowo „NIKT” w dowolnej gazecie lub magazynie?", 30, []),
 ("Czy gracz odgadnie, kiedy upłynie 30 sekund (można się pomylić o 5 sekund)?", 30, []),
 ("Wymień 7 rodzajów płynów nadających się do spożycia. Chodzi o typ napoju, a nie jego markę (np. woda, kawa).", 30, ["woda", "kawa", "herbata", "mleko", "sok", "piwo", "wino", "lemoniada", "kompot", "kakao", "cola", "wódka", "kefir", "napar", "smoothie", "cydr", "whisky"]),
 ("Czy wymienisz nazwy 5 zwierząt zaczynających się na literę K?", 60, ["kot", "koń", "krowa", "kura", "kaczka", "koza", "kruk", "kret", "królik", "kangur", "krokodyl", "koala", "karp", "kuna", "kozica", "kania", "kormoran", "kukułka", "krab", "kogut", "kondor", "kobra", "kawka", "kos", "komar", "kameleon"]),
 ("Czy gracz odgadnie, o którym słynnym piłkarzu chodzi, zadając 10 pytań z odpowiedzią „tak” lub „nie”? Piłkarza wybierzcie przed zakładami.", 60, []),
 ("Czy zdołasz wymienić 4 żeńskie imiona na 5 liter?", 30, []),
 ("Czy zdołasz wymienić nazwy 3 owoców na 6 liter?", 15, ["jagoda", "daktyl", "agrest", "malina", "morela", "wiśnia", "śliwki", "banany"]),
 ("Gracz rzuca kostką 7 razy z rzędu. Czy zapamiętasz w odpowiedniej kolejności, co wyrzucił?", 60, []),
 ("Czy zdołasz wymienić 4 męskie imiona na 5 liter?", 30, []),
 ("Czy zdołasz wymienić 4 owoce lub warzywa zaczynające się na literę P?", 30, ["pomidor", "papryka", "pietruszka", "pomarańcza", "porzeczka", "pór", "pigwa", "pomelo", "pasternak"]),
 ("Ktoś odczytuje pełne nazwiska i numery telefonów 2 kontaktów ze swojego telefonu. Czy rozgrywający zapamięta je?", 60, []),
 ("Czy zdołasz wymienić nazwy 5 planet?", 15, ["Merkury", "Wenus", "Ziemia", "Mars", "Jowisz", "Saturn", "Uran", "Neptun"]),
 ("Czy zdołasz wymienić 3 męskie imiona na 6 liter?", 15, []),
 ("Czy zdołasz ocenić, ile stron ma dowolna książka (±30 stron), nie otwierając jej?", 30, []),
 ("Czy zdołasz w ciągu 30 sekund odnaleźć słowo „WIĘC” w dowolnej gazecie lub magazynie?", 60, []),
 ("Czy zdołasz wymienić 3 żeńskie imiona na 6 liter?", 30, []),
 ("Czy wymienisz nazwiska 3 znanych aktorów lub aktorek na literę T?", 30, []),
 ("Czy wymienisz 5 rodzajów obuwia?", 30, ["adidasy", "kozaki", "szpilki", "klapki", "trampki", "sandały", "mokasyny", "baletki", "półbuty", "kalosze", "japonki", "botki", "sztyblety", "półkozaki", "kapcie"]),
 ("Jeden z graczy przypisuje literom A, B i C dowolne cyfry od 0 do 9 (np. A = 4, B = 6, C = 9). Rozgrywający patrzy na listę 10 sekund. Inny gracz układa równanie z samych liter (nie więcej niż czterech), np. A + C + A − C = ?. Czy rozgrywający poda poprawny wynik?", 60, []),
 ("Ktoś pokazuje na telefonie przez 10 sekund jakiś obrazek. Czy rozgrywający zapamięta 2 dowolne szczegóły, o które zostanie zapytany? (np. jakiego koloru był sweter?)", 30, []),
 ("Czy zdołasz wymienić 5 planet w kolejności od Słońca?", 30, ["Merkury", "Wenus", "Ziemia", "Mars", "Jowisz"]),
]

import importlib.util, random
HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("pool", HERE / "obstaw-acting-pool.py")
pool = importlib.util.module_from_spec(spec); spec.loader.exec_module(pool)

SCR = pathlib.Path("/tmp/claude-0/-home-user-5secondsGame/f28202e3-3eee-5a6b-b267-e7999b646afd/scratchpad")
EXTRA_A = HERE / "obstaw-acting-extra.json"   # extra phrases (generated, reviewed)
EXTRA_M = HERE / "obstaw-mental-extra.json"
subjects = [x.strip() for x in pool.SUBJECTS if x.strip()]
actions = [x.strip() for x in pool.ACTIONS if x.strip()]
if EXTRA_A.exists():
    e = json.loads(EXTRA_A.read_text()); subjects += e["subjects"]; actions += e["actions"]
mental_extra = json.loads(EXTRA_M.read_text()) if EXTRA_M.exists() else []

TOTAL_ACTING, TOTAL_MENTAL, TOTAL_SKILL = 188, 50, 50

def card(i, **kw): return {"id": i, **kw}
skill = [card(1 + i, text=t, **({"tries": tr} if tr else {}), sec=s) for i, (t, tr, s) in enumerate(SKILL)]
allm = list(MENTAL) + [(m["q"], m["sec"], m["hints"]) for m in mental_extra]
mental = [card(101 + i, q=q, sec=s, hints=h) for i, (q, s, h) in enumerate(allm[:TOTAL_MENTAL])]

old = json.loads(pathlib.Path("server/games/obstaw/content.json").read_text())
acting = [c for c in old["acting"] if c["id"] <= 224]   # the 24 hand-written cards are kept as they are
rng = random.Random(2024)
used = {p for c in acting for p in (*c["first"], *c["second"])}
S = [x for x in subjects if x not in used]; A = [x for x in actions if x not in used]
rng.shuffle(S); rng.shuffle(A)
need = TOTAL_ACTING - len(acting)
assert len(S) >= 2 * need and len(A) >= 2 * need, (len(S), len(A), need)
for k in range(need):
    acting.append({"id": 225 + k, "first": [S[2 * k], S[2 * k + 1]], "second": [A[2 * k], A[2 * k + 1]]})

out = {"skill": skill, "mental": mental, "acting": acting}
pathlib.Path("server/games/obstaw/content.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
print(len(skill), len(mental), len(acting), "total", len(skill) + len(mental) + len(acting))
