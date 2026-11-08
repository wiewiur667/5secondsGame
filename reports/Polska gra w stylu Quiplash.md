# „Riposta”: polski pojedynek na żarty dla Party Hub

Mechanikę Quiplash da się odtworzyć w Party Hub jako oryginalną grę (roboczo **„Riposta”**) bez żadnych zmian w transporcie WebSocket. Gra to w gruncie rzeczy prosta maszyna stanów: **każdy gracz dostaje 2 prompty, każdy prompt trafia do 2 graczy**, więc przy N graczach mamy N anonimowych pojedynków na rundę. Głosują wszyscy poza dwójką autorów, punkty dzieli się proporcjonalnie do udziału w głosach, a runda 2 liczy się podwójnie. Wszystko to mieści się w istniejącym kontrakcie `GameModule`: jeden hubowy „question” to jeden pojedynek, punktowany dokładnie raz. Hub wymaga za to czterech niewielkich zmian: ustawień deklarowanych przez grę (poziom tonu, timery), hooka `scoringIds` (żeby widzowie nie trafiali do tabeli wyników), ładowania configu przez moduł oraz rozbicia `/board` na komponenty per gra. Kilka liczb z fanowskich wiki jest spornych lub niepotwierdzonych, przede wszystkim **bonus za „sweep” (250 według Fandom vs 100/200 według Jackboxpedii)**, domyślne timery i limit znaków. Dla każdej z nich niżej podaję własną, uzasadnioną wartość. Treść musi być w 100% oryginalna i pisana od razu po polsku, bo Jackbox nigdy nie wydał polskiej wersji, a otwarte bazy promptów są albo copyleft, albo bez licencji. Rekomenduję **bank pisany offline (szkice z LLM + ludzka selekcja), dołączony do builda jako JSON**. Generowanie promptów online przez LLM ma być tylko opcjonalnym dodatkiem z cichym powrotem do lokalnego banku, dzięki czemu gra w pełni działa bez internetu.

## Jak naprawdę działa oryginał: dwie rundy pojedynków, finał i sporne bonusy

### Przydział promptów i głosowanie są dobrze udokumentowane

Seria obsługuje **3–8 graczy plus publiczność do 10 000 osób** ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))). W rundach 1 i 2 każdy gracz odpowiada na dwa prompty w wyznaczonym czasie ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))). Klony open source opisują tę samą regułę „każdy prompt odpowiadany przez dwóch graczy” i z niej wyprowadzają, że liczba promptów w rundzie równa się liczbie graczy ([quiplash-js](https://github.com/simondiep/quiplash-js), [quip-pro](https://github.com/jlrtweedie/quip-pro)). Autor quiplibre wyjaśnia sens dwóch promptów na osobę: przy jednym prompcie nieparzysta liczba graczy wymuszałaby pauzę dla kogoś ([quiplibre](https://github.com/wyattscarpenter/quiplibre)). Matematycznie przydział to graf 2-regularny. Najprostsza poprawna konstrukcja to przetasować graczy i dać prompt *i* parze (p_i, p_(i+1 mod N)). Każdy gracz ma wtedy dwóch *różnych* przeciwników dla każdego N ≥ 3 i nikt nigdy nie czeka. **Faktyczny algorytm Jackboxa nie jest opublikowany.** To samo dotyczy tego, czy runda 2 unika par z rundy 1. Przy N = 3 uniknąć powtórek się nie da, przy N ≥ 5 już tak.

Odpowiedzi ujawnia się, gdy wszyscy je wyślą albo gdy skończy się czas. Faza pisania kończy się więc wcześniej, jeśli komplet jest gotowy ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))). Przy każdym pojedynku gracze i publiczność wybierają jedną z dwóch odpowiedzi „albo mogą nie wybrać wcale” ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))). Autorzy nie głosują we własnym pojedynku, co pośrednio wynika z definicji „sweepu” i bezpośrednio z kodu klonu (`players.length - 2` głosujących) ([quiplash-js](https://github.com/simondiep/quiplash-js)). Z tego płynie ważna konsekwencja dla małych grup: **przy 3 graczach każdy pojedynek ma tylko jednego głosującego gracza**, więc wynik zawsze wynosi 100/0 albo 0/0. Recenzja Shacknews z 2015 roku krytykowała, że głosowanie trwało do końca timera nawet po oddaniu wszystkich głosów ([Shacknews](https://www.shacknews.com/article/90364/quiplash-review-just-add-people-and-lash-away)). Wcześniejsze zamykanie głosowania to więc tania poprawa tempa, którą warto wbudować od początku.

### Punktacja jest proporcjonalna, ale wartości bonusów są sporne

Według Fandom w rundzie 1 obowiązuje wzór **„1% głosujących = 10 punktów” plus 100 punktów bonusu za wygraną, a w rundzie 2 wartości się podwajają** ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))). Pojedynek dzieli więc pulę 1000 (R1) lub 2000 (R2). Snippety Jackboxpedii potwierdzają maksimum 1000/2000 za prompt ([Jackboxpedia, Quiplash 3](https://jackbox.wiki/wiki/Quiplash_3)). Shacknews dodaje, że w rundzie 2 podwajają się „nawet bonusy” ([Shacknews](https://www.shacknews.com/article/90364/quiplash-review-just-add-people-and-lash-away)). Identyczne odpowiedzi to „Jinx”, za który żaden z autorów nie dostaje punktów ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))). Brak odpowiedzi lub odpowiedź ocenzurowana oznacza, że przeciwnik dostaje wszystkie punkty ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))). Zwycięzcą jest gracz z największą liczbą punktów po trzech rundach, a remis na pierwszym miejscu daje kilku zwycięzców ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))).

Poniższa tabela zbiera liczby, których **nie wolno traktować jako potwierdzonych**:

| Element | Co mówią źródła | Status |
|---|---|---|
| Bonus za sweep („Quiplash”) | Fandom: **+250 zamiast +100** ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))); Jackboxpedia QL2: **+100 (R1) / +200 (R2)** ([Jackboxpedia QL2](https://jackbox.wiki/wiki/Quiplash_2)); Jackboxpedia QL1: „10% puli” ([Jackboxpedia QL1](https://jackbox.wiki/wiki/Quiplash)) | **SPORNE**, może zależeć od wersji gry; strony Jackboxpedii czytane tylko w snippetach |
| Warunek sweepu | wszyscy gracze + >50% publiczności; „Super” przy >90% publiczności ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))) | udokumentowane, ale wartość punktowa „Super” jest **nieznana** |
| Minimalna liczba graczy do sweepu | osiągnięcia wymagają gry „5+ graczy” ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))) | **NIEPEWNE**: warunek może dotyczyć tylko osiągnięcia, nie bonusu |
| Safety Quip | od QL2 losowa gotowa odpowiedź za połowę punktów; w QL3 odpowiedź powiązana z promptem ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))) | sposób liczenia „połowy” (czy dotyczy też bonusu) **nieznany** |
| Remis | 50/50 bez bonusu wynika ze wzoru i z kodu klonu ([quiplash-js](https://github.com/simondiep/quiplash-js)) | **niepotwierdzone oficjalnie** |
| Timer pisania / głosowania | użytkownicy Steam: ok. 20–25 s na głos ([Steam](https://steamcommunity.com/app/351510/discussions/0/343787920141286244/)); słabe źródło: ok. 60 s na pisanie ([SoftHandTech](https://softhandtech.com/how-many-questions-is-quiplash/)) | **NIEZWERYFIKOWANE** |
| Limit znaków odpowiedzi | brak źródła (krąży wartość ~45) | **NIEZWERYFIKOWANE** |
| Waga głosów publiczności | w 2015 głos widza był wart tyle co głos gracza ([Steam](https://steamcommunity.com/app/351510/discussions/0/530647080136312408/)) | późniejsze wersje **nieudokumentowane** |
| Finał Thriplash (QL3) | punkty potrojone, „6000 maks.” wg jednego snippetu ([TrueAchievements](https://www.trueachievements.com/game/The-Jackbox-Party-Pack-7/walkthrough/3)) | **niejednoznaczne** (×3 względem R1 czy R2?) |

### Finał zmieniał się w każdej wersji, a w lokalizacjach kulał

Quiplash 1/XL: wszyscy odpowiadają na **ten sam prompt**, każdy gracz ma **3 głosy** (może je skumulować), widz ma 1 głos, a **pulę 3000** dzieli się wzorem „1% = 30 pkt” ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))). Quiplash 2 wprowadził „Last Lash” w trzech formatach (akronim, komiks, zdanie ze słowem) z medalami złoto/srebro/brąz, przy czym w grach na 3–4 graczy przyznaje się tylko złoto i srebro ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))). Quiplash 3 wrócił do par, ale każdy gracz pisze **trzy odpowiedzi na jeden prompt**, a nieparzysty gracz walczy z gotową odpowiedzią prowadzącego ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))). Dla polskiej gry najważniejsza jest krytyka z lokalizacji. Francuscy gracze piszą, że formaty akronimowe wymuszają rzadkie litery (K, W, Y), a „Word Lash” opiera się na krótkich, wieloznacznych angielskich słowach. Szacują też, że ¼–⅕ promptów w innych wersjach językowych trzeba było napisać od nowa zamiast tłumaczyć ([Steam](https://steamcommunity.com/app/1111940/discussions/0/5297878338982043761/)). Wniosek: polski finał nie powinien kopiować formatów językowych z angielskiego, tylko używać formatu neutralnego językowo.

## Projekt dla Party Hub: rekomendowany zestaw reguł z wybranymi wartościami

Poniższe reguły to **nasze decyzje projektowe**. Tam, gdzie oryginał jest sporny albo nieznany, wybór uzasadniam. Nazewnictwo jest celowo własne: w UI nie pojawiają się słowa Quiplash, Safety Quip, Jinx, Thriplash, Last Lash ani żadna postać prowadzącego.

| Element („Riposta”) | Wartość | Uzasadnienie |
|---|---|---|
| Gracze / widzowie | 3–8 graczy; 9. osoba i każdy dołączający w trakcie gry zostaje **widzem** | zakres oryginału ([Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))) |
| Przydział (R1, R2) | 2 prompty na gracza, 2 graczy na prompt, cykl Hamiltona po losowym tasowaniu; w R2 przy N ≥ 5 do 20 prób uniknięcia par z R1 | brak publicznego algorytmu, to standardowa konstrukcja |
| Timer pisania | **90 s** na oba prompty (GM: 45–180 s); koniec wcześniej, gdy wszyscy aktywni gracze wyślą | oryginalne wartości niezweryfikowane; polskie odpowiedzi są dłuższe |
| Limit odpowiedzi | **60 znaków** (twardo na serwerze + `maxlength`), prompt ≤ 90 znaków | polskie słowa są dłuższe niż angielskie; wartość „~45” niezweryfikowana |
| Timer głosowania | **20 s** (GM: 10–40 s); koniec, gdy zagłosują wszyscy uprawnieni gracze (widzowie nie blokują) | poprawka krytyki z Shacknews |
| Wynik pojedynku | 8 s ekranu wyniku, potem auto-dalej (istniejący przełącznik `autoAdvance`) | wzorzec 5 Second Rule |
| Punkty (R1) | `round(1000 × udział / 10) × 10` + **100** za wygraną | wzór Fandom |
| Mnożnik R2 | ×2 na wszystko (pula 2000, bonus 200) | Fandom + Shacknews |
| **„Riposta doskonała” (sweep)** | **+250 zamiast +100 w R1, +500 w R2**; warunek: ≥ 2 głosy graczy, 0 głosów graczy na przeciwnika, a jeśli głosowali widzowie, ich udział > 50% | **wartość sporna**: wybieramy liczbę Fandom, bo wariant 100/200 nie odróżnia sweepu od zwykłej wygranej; wymóg ≥ 2 głosów wyłącza trywialny sweep przy 3 graczach |
| „Super” sweep | **nie w MVP** | wartość punktowa nieznana |
| **„Gotowiec” (safety quip)** | przycisk wstawia odpowiedź wybraną przez serwer z puli danego poziomu; **połowa wszystkich punktów** (udział + bonus), zaokrąglona w dół do 10; może wygrać; **maks. 1 na gracza na rundę** | połowa punktów zgodnie z QL2/3; limit to nasza decyzja, żeby gotowce nie zastępowały pisania |
| Brak odpowiedzi po czasie | serwer automatycznie wstawia Gotowca (połowa punktów); etykieta „gotowiec” widoczna dopiero przy wyniku | telefony często się blokują (CLAUDE.md), a pojedynek nadal daje TV materiał do głosowania |
| „Telepatia” (jinx) | identyczne po normalizacji (NFD, bez diakrytyków, małe litery, bez interpunkcji) → **0 dla obu**, bez głosowania | Fandom; „żółw” = „zolw” |
| Remis | podział 50/50, bez bonusu | spójne ze wzorem |
| 0 oddanych głosów | 0 punktów dla obu | oryginał nie definiuje tego przypadku |
| Waga publiczności | cała publiczność waży `min(liczba głosujących widzów, max(1, ceil(V/2)))`, gdzie V to liczba głosujących graczy, a jej głosy dzielą tę wagę proporcjonalnie | rozwiązuje znany problem „widzowie zagłuszają graczy” ([Steam](https://steamcommunity.com/app/351510/discussions/0/530647080136312408/)); publiczność ma maksymalnie ok. ⅓ wagi |
| **Wielki Finał** | jeden wspólny prompt dla wszystkich graczy, każdy pisze 1 odpowiedź (75 s); każdy gracz ma **3 żetony** do rozdzielenia (można kumulować, nie na siebie), widz ma 1 żeton; czas 40 s | format QL1 jest neutralny językowo; brak akronimów i gier słownych |
| Punkty finału | pula **1000 × N**, dzielona proporcjonalnie do ważonych żetonów; najlepsza odpowiedź +300 (przy remisie każda z najlepszych) | pula oryginału (3000) nie skaluje się z N; przy 8 graczach finał (8000) to ok. 45% puli R2 (~17 600), więc odrabianie strat jest realne |
| Koniec | najwięcej punktów wygrywa, remis = współzwycięzcy | Fandom |

Ten model daje przewidywalne tempo. Przy 8 graczach runda to mniej więcej 90 s pisania plus 8 × (≈3 s zapowiedzi + 20 s głosu + 8 s wyniku), czyli około 5,5 min. Cała gra z finałem trwa **około 13–16 minut** (szacunek, nie pomiar).

### Telewizor pokazuje scenę, telefon jest prywatnym pulpitem

| Faza | TV (`/board`) | Telefon gracza | Telefon widza |
|---|---|---|---|
| Lobby | QR (SVG), lista graczy, kto będzie widzem | imię | „Oglądasz jako widz” |
| Pisanie | numer rundy, licznik, „5/8 napisało” (bez treści i bez przydziałów) | 2 własne prompty, pola tekstowe, przycisk Gotowiec | odliczanie |
| Głosowanie | prompt + odpowiedzi A/B w losowej kolejności | 2 przyciski (autor widzi „Twój pojedynek”) | 2 przyciski |
| Wynik | autorzy, głosujący imiennie, %, punkty, baner „Riposta doskonała!” / „Telepatia!” / „gotowiec” | to samo skrótowo + flaga 🚩 | to samo |
| Finał | siatka wszystkich odpowiedzi, potem wyniki | 3 żetony na odpowiedziach innych | 1 żeton |
| Koniec | podium + nagrody | wynik | wynik |

## Integracja z kodem: co już pasuje, a co trzeba zmienić w hubie

### Większość rzeczy już działa

Kontrakt `GameModule` (`server/games/types.ts`) ma już wszystko, czego potrzebuje gra wieloetapowa. `submit(s, pid, payload: any, elapsedSec, hubFlags)` przyjmuje dowolny ładunek, więc odpowiedzi tekstowe, głosy i żetony to tylko konwencja `{kind:'answer'|'safety'|'vote'|'tokens', …}`. `stateForPlayer` buduje osobny widok dla każdego gracza: na tym samym wzorcu Music Impostor wysyła impostorowi inne wideo. `tick` zwraca `true` na krawędzi punktowania, a hub stosuje `score()` dokładnie raz na krawędzi `playing → revealed`. Rekomendowane mapowanie: **jeden hubowy „question” = jeden pojedynek**. Etap pisania jest wewnętrznym pod-etapem pierwszego pojedynku rundy (`stage:'write' → 'vote' → revealed`), analogicznie do `awaitingStart` w 5 Second Rule. Następne pojedynki tej rundy startują od razu w `stage:'vote'`. Finał to jeden „question” z `stage:'finalWrite' → 'finalVote'`. Po finale `next()` zwraca `false` i hubowe `end()` pokazuje podium. Przyciski GM Next/Skip/Pause/End działają bez zmian, a `replay` oznacza „powtórz głosowanie tego pojedynku”, bo hub sam cofa punkty przez `lastPts`.

Wszystkie reguły muszą być egzekwowane w module gry względem hubowego `elapsedSec`, zgodnie z zasadą z CLAUDE.md: tożsamość z gniazda, nie z ładunku. Odpowiedź przyjmujemy tylko w etapie pisania, przed terminem (+1 s tolerancji), od gracza tej rundy i tylko dla promptu, który mu przydzielono. Tekst przechodzi przez NFC, usunięcie znaków sterujących i zero-width, zwinięcie spacji, trim i cięcie do 60 znaków. Głos przyjmujemy z `matchupId` równym bieżącemu, `choice ∈ {0,1}`, od nie-autora, jeden na głosującego, z osobnymi licznikami dla graczy i widzów. Tekst Gotowca zawsze wybiera serwer. Odpowiedzi renderujemy wyłącznie przez interpolację `{{ }}`, nigdy przez `v-html`.

### Wycieki są głównym ryzykiem

`publicView` trafia do `GET /api/gm/state`, a ten endpoint nie ma autoryzacji. Wszystko, co jest w `publicView`, jest więc w praktyce publiczne. Przed ujawnieniem wyniku żaden widok nie może zawierać pid autora, imion autorów, przydziałów promptów (zdradzają, kto z kim walczy) ani bieżących wyników głosowania. Kolejność A/B ma być losowana i zapisana w stanie, a nie wyprowadzana z kolejności pid. Identyfikatory odpowiedzi mają być nieprzezroczyste. Przy ponownym połączeniu `stateForPlayer` zwraca zapisane na serwerze odpowiedzi, a komponent nadpisuje lokalny szkic tylko przy zmianie promptu (wzorzec `FiveSecondRule.vue`). Szkice warto wysyłać z debounce, żeby zablokowany telefon nie tracił tekstu.

### Cztery konieczne zmiany w hubie i dwie opcjonalne

Hub ma dziś na sztywno ustawienia specyficzne dla 5SR (pola, settery, przypadki w `[action].post.ts`, bloki `v-if` w `gm.vue`). Zakłada też, że każdy aktywny gracz punktuje: `hub.ts:255` inicjuje `totals` dla wszystkich `activeIds()`, a `hub.ts:269-271` dopisuje spóźnionych na poziomie minimum. Widzowie trafiliby więc do tabeli wyników. Configi są importowane na sztywno w `hub.ts:12`, a `usedQuestions` (`hub.ts:40`) to jeden `Set<number>`, w którym id promptów zderzyłyby się z id pytań 5SR. `/board` renderuje pola 5SR bezwarunkowo. Hub nie jest też dziś importowalny w testach Node (import katalogu `'../games'` plus `setInterval` w konstruktorze), więc zmiany w hubie wymagają małego refaktoru, żeby dało się je testować.

## Polska treść: oryginalny bank z poziomami i gramatyką odporną na odmianę

### Rynek jest pusty, a cudze bazy są prawnie toksyczne

Jackbox lokalizuje tylko na angielski, francuski, włoski, niemiecki i hiszpański ([Steam: Quiplash 3](https://store.steampowered.com/app/1111940/Quiplash_3/), [Jackbox](https://www.jackboxgames.com/how-were-bringing-jackbox-games-to-countries-around-the-world)), a polskie serwisy wprost odnotowują brak polskiego ([instalki.pl](https://www.instalki.pl/news/gry/imprezowa-gra-quiplash-za-darmo-na-steam-dobra-zabawa-na-luzne-spotkania/)). Najbliższy polski odpowiednik to komercyjne, zamknięte Karty Dżentelmenów (18+, licencjonowany spin-off CAH) ([kallax.io](https://kallax.io/boardgame/FI881-Karty-Dżentelmenów)). Otwarte źródła odpadają. Cards Against Humanity jest na licencji **CC BY-NC-SA** z zastrzeżoną nazwą ([cardsagainsthumanity.com](https://www.cardsagainsthumanity.com/)), quiplibre na **AGPL-3.0** ([GitHub](https://github.com/wyattscarpenter/quiplibre)), a inne klony nie mają licencji, więc wszystkie prawa są zastrzeżone. Domieszanie takich tekstów „zaraziłoby” licencję banku, a listy z nieopisanych repozytoriów często zawierają zeskrobane prompty Jackboxa. Repozytorium jest publikowane, więc bank trzeba traktować jako dystrybuowany. Potrzebny jest osobny plik licencji treści (np. CC BY 4.0) i adnotacja, że nie użyto tekstów Jackboxa ani CAH. Mechaniki i formaty (pojedynek, głosowanie) traktuję jako idee, a nie chronioną ekspresję. To ocena projektowa, nie porada prawna.

### Porównanie źródeł promptów i rekomendacja

| Opcja | Offline | Jakość | Koszt / wysiłek | Ryzyko | Werdykt |
|---|---|---|---|---|---|
| A. Ręczne pisanie | tak | najwyższa, gdy autor jest zabawny | ok. 2–3 wieczory na poziom przy 300 promptach (szacunek) | brak | dobre, ale wolne |
| **B. Szkice z LLM w czasie builda + ludzka selekcja** | **tak** | wysoka po selekcji | 5000 szkiców przez Batch API to ok. $1–2 ([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)); głównym kosztem jest czas selekcji (szacowane 15–30% zostaje) | kalki z angielskiego, generyczność | **REKOMENDOWANE jako trzon** |
| C. LLM na żywo w lobby | nie | zmienna, bez kontroli | ok. $0,001–0,04 za grę (Haiku–Opus 5.5) ([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)) | odmowy przy 18+, opóźnienie, wymaga klucza | **tylko opcjonalny dodatek** |
| D. Otwarte bazy / tłumaczenia | tak | — | niski | licencje (NC-SA, AGPL), prompty Jackboxa | **odrzucone** |
| E. Prompty pisane przez graczy w lobby | tak | zależy od grupy | zero | żarty wewnętrzne wykluczają część osób | późniejsze rozszerzenie |

Rekomendacja: **B jako fundament, A do szlifu i całego poziomu 18+, C jako przełącznik „Świeże prompty (online)”**. C pobiera prompty podczas lobby z twardym timeoutem ok. 8 s, waliduje je (schemat, ≤ 90 znaków, deduplikacja, blocklista dla poziomu rodzinnego) i w razie błędu po cichu wraca do JSON-a. Zaakceptowane prompty dopisuje do `generated-prompts.jsonl`, żeby po przeglądzie można je było awansować do banku. Treści na poziomie 18+ powinny być głównie pisane ręcznie, bo modele mogą odmawiać najostrzejszych treści seksualnych. Polski tekst zużywa w typowych tokenizerach ok. 2–3 razy więcej tokenów na słowo niż angielski ([PLLuM, arXiv 2511.03823](https://arxiv.org/pdf/2511.03823)), ale przy tych cenach koszt nie ma znaczenia. Liczy się jakość. Klucz API zostaje na serwerze Nitro, a jego brak po prostu wyłącza opcję w panelu GM.

### Poziomy tonu, gramatyka i rozmiar banku

Poziomy są **kumulatywne z wagami**, żeby gra na wyższym poziomie nie stawała się monotonna. *Rodzinny* (`family`) bierze 100% z rodzinnego i nie zawiera alkoholu ani seksu. *Dla dorosłych* (`adult`) to ok. 60% adult i 40% family: aluzje, alkohol, praca, związki. *18+* to ok. 50% 18+, 30% adult i 20% family: dosadny język, ale żart celuje w sytuacje i instytucje, nie w grupy chronione. Proporcje to ocena projektowa. Najważniejszy problem języka polskiego jest gramatyczny: **luka w środku zdania wymusza przypadek, rodzaj i liczbę**, więc odpowiedzi w złej formie brzmią źle. Zasady pisania promptów są więc następujące. Luka zawsze stoi na końcu po dwukropku („Prezent od babci, którego nikt nie chce: ___”). Dobre ramy to „rzecz / coś / tekst / tytuł / nazwa”, cytaty („Co krzyczy wujek po trzecim kieliszku?”) i tytuły, które są naturalnie w mianowniku. Prompty nie powinny zwracać się do gracza w czasie przeszłym z rodzajem („zrobiłeś/-aś”) ani zadawać pytań tak/nie. Diakrytyki są obsługiwane, ale nie wymagane, a porównanie przy „Telepatii” je ignoruje. Wytyczne pisarzy Jackboxa są uniwersalne: prompt ma być konkretny, ale nieprzeładowany, struktury powinny się zmieniać, a autor musi umieć sam od razu na niego odpowiedzieć ([Jackbox: How to Write a Good Quiplash Prompt](https://www.jackboxgames.com/how-to-write-a-good-quiplash-prompt)). Działają absurdalne przesłanki, krępujące wspomnienia i sytuacje związane z konkretnym wydarzeniem ([Jackbox: The Science of Creating a Quiplash Prompt](https://www.jackboxgames.com/the-science-of-creating-a-quiplash-prompt/)). Rodzinne tematy o niskim ryzyku to wesela, Wigilia, PKP, urzędy, działka, wywiadówka. Polityka i religia trafiają za przełącznik tematów, bo zasada „znaj publiczność” mówi, że wykluczenie choćby 1–2 osób psuje zabawę ([Jackbox](https://www.jackboxgames.com/how-to-write-a-good-quiplash-prompt)).

Zużycie to ok. 2N + 1 promptów na grę, czyli 17 przy 8 graczach i ok. 70 na wieczór z czterema grami. Cel na start to **ok. 300 promptów na poziom plus ≥ 30 promptów finałowych na poziom**, docelowo 600–1000. Minimalny próg do scalenia MVP proponuję ustawić na 100 promptów i 20 finałów na poziom, czyli więcej niż 16 + 1 potrzebne na jedną grę ośmioosobową bez powtórek. Przykłady w duchu tych zasad (oryginalne, napisane w ramach researchu): rodzinny „Najgorsza rzecz, jaką można znaleźć w pierogu: ___”, dla dorosłych „Prawdziwy powód, dla którego szef zwołał spotkanie o 16:55: ___”, finał „Rzecz, którą słychać na każdej wywiadówce: ___”. Każdy dodany prompt przechodzi test autora: trzy odpowiedzi w 30 sekund, inaczej prompt wypada.

## Plan wdrożenia z konkretnymi plikami

| Krok | Pliki | Zakres |
|---|---|---|
| 1. Refaktor huba pod testy | `server/utils/hub.ts`, `server/games/index.ts` | eksport klasy `Hub` osobno od singletonu, import `'../games/index.ts'`, `setInterval` uruchamiany jawnie; `test/hub.test.ts` |
| 2. Rozszerzenie kontraktu | `server/games/types.ts` | `settings?` (schemat enum/int/bool z min/max/label), `scoringIds?(s)`, `maxPlayers?`, `config?` (statyczny import JSON w module), opcjonalnie `tick(s, t, ctx?: {activeIds})` |
| 3. Hub generyczny | `server/utils/hub.ts` (`:12`, `:40`, `:241-255`, `:269-271`, `gmState`) | `gameSettings` + `setOption()` z walidacją, `scoringIds` zamiast `activeIds()` przy `totals`, `used: Map<gameId, Set>`, config z modułu; pola 5SR bez zmian |
| 4. Endpoint GM i transport | `server/api/gm/[action].post.ts`, `server/routes/ws.ts` | akcja `set-option`; odrzucanie wiadomości WS > 4 KB przed `JSON.parse` |
| 5. Logika gry (czyste funkcje) | `server/games/riposta/assign.ts`, `scoring.ts`, `normalize.ts` | cykl z wstrzykiwanym RNG i unikaniem par z R1; wzory z tabeli reguł; NFC/NFD, porównanie przy Telepatii |
| 6. Moduł gry | `server/games/riposta/index.ts` + jedna linia w `server/games/index.ts` | etapy write/vote/revealed/finalWrite/finalVote, Gotowiec, widzowie, `publicView` bez wycieków, `flag()` dla promptu |
| 7. Treść | `server/games/riposta/prompts.json`, `server/games/riposta/LICENSE-CONTENT` | `{version, tiers, prompts[{id,text,tier,tags,structure}], finalPrompts, safetyQuips[{id,text,tier}]}`, id unikalne |
| 8. Telefon | `app/components/games/Riposta.vue`, `app/pages/index.vue` | `v-else-if="state.game === 'riposta'"`, pola z `maxlength=60`, szkic chroniony przy reconnect, `.topbar` w normalnym przepływie |
| 9. TV | `app/pages/board.vue`, `app/components/board/FiveSecondRuleBoard.vue`, `app/components/board/RipostaBoard.vue` | rozdzielenie kodu po `live.game`, układy per etap |
| 10. Panel GM | `app/pages/gm.vue`, `app/composables/useGm.ts` | generyczny render `settings` (poziom, timery), widzowie jako osobne chipy |
| 11. Testy | `test/riposta.test.ts`, `test/riposta-content.test.ts` | przydział (każdy 2, prompt 2 autorów), terminy, Gotowiec, Telepatia, waga publiczności, sweep z ≥ 2 głosami, idempotentny `score`, brak wycieków przed wynikiem, `next()` → `false` po finale, schemat i rozmiar banku per poziom |
| 12. Online (po MVP) | `server/games/riposta/llm.ts`, `.gitignore` (`generated-prompts.jsonl`) | env `RIPOSTA_LLM_KEY` + ustawienie `useOnlinePrompts` (domyślnie wyłączone), `onlineAvailable` w `gmState`, `await` z timeoutem w asynchronicznym handlerze `start` |

Kolejność jest celowa. Kroki 1–4 to zmiany platformowe, które zwracają się też przy kolejnych grach, bo CLAUDE.md obiecuje „folder + jedna linia w rejestrze”, a dziś trzeba jeszcze edytować `hub.ts`. Kroki 5–7 da się w całości pokryć testami `node:test` bez przeglądarki. Kroki 8–10 weryfikuje się ręcznie na buildzie produkcyjnym, bo WebSockety w trybie dev są niestabilne. Seen-tracking między restartami (plik obok `FLAG_FILE`) i przełączniki tematów (polityka, religia) warto dodać po MVP.

## Wnioski

Odtworzenie tej mechaniki jest tańsze, niż sugeruje jej renoma. Najtrudniejsze nie są punkty ani sieć, tylko trzy rzeczy, których Jackbox nigdy nie musiał rozwiązywać po polsku: gramatyka promptów odporna na odmianę, finał bez anglojęzycznych gier słownych i licencyjnie czysty bank treści. Fanowska dokumentacja okazuje się niespójna dokładnie tam, gdzie projektant potrzebuje liczb (sweep, timery, limit znaków). To raczej uwalnia niż ogranicza: wartości można dobrać pod warunki domowej imprezy (3–8 osób, mała publiczność, telefony, które się blokują) zamiast pod streamy z tysiącami widzów.

Druga obserwacja dotyczy samej platformy. Gra tekstowa jest pierwszą, która wymusza na Party Hub prawdziwe rozdzielenie ról (gracz vs widz), ustawienia deklarowane przez moduł i limit rozmiaru wiadomości. Te zmiany, wykonane porządnie przy okazji „Riposty”, zamieniają hub z platformy dla dwóch konkretnych gier w rzeczywiście rozszerzalny silnik. Opcja online pozostaje przy tym tym, czym być powinna: dodatkiem, którego brak nie zmienia niczego w rozgrywce w sieci lokalnej.
