# Polish-language prompt content for an original Quiplash-style party game

Scope: content sourcing, licensing, prompt-design guidance, Polish-language specifics, LLM generation options, bank sizing, and original example prompts in three GM-selectable tiers (rodzinny / pikantny / 18+ bez cenzury). Research date: 2026-11-08. Sixteen web searches and fetches; Jackbox's support FAQ returned HTTP 403 and could not be read directly.

## 1. Is there an official Jackbox Polish localization, or Polish fan translations or clones?

### Takeaway
No. Jackbox has never shipped Polish. Its localized games use English plus French, Italian, German and Spanish (EFIGS), and later Brazilian Portuguese. No Polish Quiplash clone or fan translation of note turned up. The closest Polish analog is a commercial card game, Karty Dżentelmenów, a licensed spin-off of Cards Against Humanity. The Polish market for this game type is open, but Jackbox prompt text is proprietary and must not be copied or translated.

### Cited Findings
- Quiplash 3's Steam page lists exactly five languages for interface, audio and subtitles: English, French, Italian, German and Spanish (Spain). Polish is not among them. — [Steam: Quiplash 3](https://store.steampowered.com/app/1111940/Quiplash_3/)
- Jackbox (Belia Portillo, 21 Apr 2023) says Quiplash 2 InterLASHional (2020) "introduced French, Italian, German, and Spanish as additional languages", followed by Drawful 2 (2021) and The Jackbox Party Starter (2022). Party Pack 9 (2022) was "the first Party Pack fully localized", and Party Pack 10 keeps the same commitment. Polish is not mentioned. — [Jackbox: How We're Bringing Jackbox Games to Countries Around the World](https://www.jackboxgames.com/how-were-bringing-jackbox-games-to-countries-around-the-world)
- Party Pack 9 got the EFIGS languages (French, Italian, German, Latin-American and Castilian Spanish) through a free Language Pack update in December 2022. — [TheSixthAxis](https://www.thesixthaxis.com/2022/11/21/jackbox-party-pack-9-update-adds-new-jokes-prompts-efigs-localisation-coming-in-december/); [Jackbox: the jackbox language pack](https://www.jackboxgames.com/the-jackbox-language-pack/)
- Jackbox's support FAQ ("Why aren't your games available in my native language") says Party Pack 10 and The Jackbox Party Starter were the first with Brazilian Portuguese. This comes from a search-result summary only; the page returned 403 when fetched. — [Jackbox Support](https://support.jackboxgames.com/hc/en-us/articles/15794788412951-Why-aren-t-your-games-available-in-my-native-language)
- Third-party retailer listings show Party Pack 11 (Oct 2025) as English only. I could not reach Steam's own language table for it. — [Fanatical](https://www.fanatical.com/en/game/the-jackbox-party-pack-11); [Nintendo AU eShop](https://www.nintendo.com/au/games/nintendo-switch/the-jackbox-party-pack-11/)
- Polish storefronts and press say the original Quiplash is English only ("Quiplash jest tylko w języku angielskim"; "Pewnym minusem jest obecność Quiplash wyłącznie w języku angielskim"). — [psdeals.net PL](https://psdeals.net/pl-store/game/60601/quiplash); [instalki.pl](https://www.instalki.pl/news/gry/imprezowa-gra-quiplash-za-darmo-na-steam-dobra-zabawa-na-luzne-spotkania/)
- Steam pages viewed in Polish show "Polski język nie jest obsługiwany" for Party Pack 5 and similar notices for Party Pack 6 and the first Party Pack. — [Steam PP5 (pl)](https://store.steampowered.com/app/774461/The_Jackbox_Party_Pack_5/?l=polish); [Steam PP6 (pl)](https://store.steampowered.com/app/1005300/The_Jackbox_Party_Pack_6/?l=polish)
- Karty Dżentelmenów (publisher Kojar) is a Polish party card game "inspired by Cards Against Humanity (and with their blessing)". Cards are in Polish and English; it is rated 18+ for 3–15 players. It comes in many episodes, for example Episode 3 (2017) with 220 new cards, and Episode 6 (2019). It is commercial and closed content. — [kallax.io](https://kallax.io/boardgame/FI881-Karty-Dżentelmenów); [analog.games](https://www.analog.games//gameItem/show/419cd83f9659632e019659b29a6c21a1?lang=DE); [boardgamematcher](https://boardgamematcher.com/game/karty-dżentelmenów-epizod-szósty)
- Kojar also publishes the "(Nie) Powinieneś" series (parts 1–3), another Polish adult party card game. — [morele.net](https://www.morele.net/kojar-nie-powinienes-6476855/)
- Polish- and English-language web searches found no Polish Quiplash clone or fan translation. Unrelated Polish itch.io games (e.g. "Polskie Przysłowia") came up instead. — [search results e.g. itch.io](https://nurek.itch.io/polskie-przyslowia)

### Inferences
- Jackbox has added languages slowly, only for large Western European markets plus Brazilian Portuguese. A Polish Quiplash from Jackbox is unlikely soon, so an original Polish game fills a real gap for Polish groups.
- The Polish players who exist (the Karty Dżentelmenów buyers) mostly expect adult humor. The 18+ tier will probably get the most use at adult parties, and the family tier at family gatherings.
- Copyright: short phrases are often not protectable alone, but a curated collection of Jackbox prompts, and its translation (a derivative work), clearly belongs to Jackbox. Copying or translating Jackbox prompt lists, including fan-scraped lists on GitHub or Reddit, is off limits. Design principles and formats (fill-in-the-blank, head-to-head voting) are not protected expression.

### Gaps
- I could not read the Jackbox support FAQ (HTTP 403) or Steam's Party Pack 11 language table, so whether any 2025–2026 Jackbox title added Polish is unconfirmed. The evidence I found says it did not.
- No Polish fan-translation mod for Quiplash turned up. Absence of evidence is not proof.

## 2. Openly licensed prompt datasets and licensing implications

### Takeaway
No high-quality permissively licensed (CC0, CC-BY, MIT) Polish prompt bank turned up. Open Quiplash clones are mostly code-only or copyleft: Quiplibre is AGPL-3.0, and other clones have no license, which means all rights reserved. Cards Against Humanity is CC BY-NC-SA 4.0: non-commercial, share-alike, and its name is trademarked. It is usable only for structural inspiration, and copying its text would infect the bank's license. The cleanest approach is to write everything originally (by hand, or LLM-drafted and then human-curated) and license the bank yourself.

### Cited Findings
- Cards Against Humanity's site links its free downloads to CC BY-NC-SA 4.0. It says "there's no legal way to use these PDFs to make money" and that the company owns the name, design, logos and writing; using the name needs a license. — [cardsagainsthumanity.com](https://www.cardsagainsthumanity.com/)
- Older sources cite CC BY-NC-SA 2.0, so the license version changed over time. Derivative versions must stay non-commercial and share-alike and need a different name. — [Boing Boing 2012](https://boingboing.net/2012/05/13/cards-against-humanity-a-nast.html); [Made with Creative Commons](https://medium.com/made-with-creative-commons/card-against-humanity-8c0cc2c6c299)
- Quiplibre (wyattscarpenter/quiplibre), an open Quiplash-like game, is AGPL-3.0. Prompts sit in a `prompts` array inside `quiplibre.html`. Contributors must "Only submit prompts you have the legal right and volition to release under the project's license." Language support is not documented. — [GitHub: quiplibre](https://github.com/wyattscarpenter/quiplibre); [AlternativeTo](https://alternativeto.net/software/quiplibre/about)
- Other GitHub clones (khayyamsaleem/quiplash-clone, hunter-atk/Quiplash-Clone, yodigi7/quiplash) show no license in the index listings. — [relatedrepos: khayyamsaleem](https://relatedrepos.com/gh/khayyamsaleem/quiplash-clone); [relatedrepos: hunter-atk](https://relatedrepos.com/gh/hunter-atk/Quiplash-Clone); [relatedrepos: yodigi7](https://relatedrepos.com/gh/yodigi7/quiplash)
- Polish-adjacent CAH code projects exist on GitHub (GJKrupa/wwa "Online version of the popular game Cards Against Humanity"; jakub-galecki/CAH), but I could not confirm whether they contain Polish card text or what their licenses are. — [GitHub: GJKrupa/wwa](https://www.github.com/GJKrupa/wwa); [GitHub: jakub-galecki/CAH](https://github.com/jakub-galecki/CAH)

### Inferences
- **License mixing:** prompts derived from CAH (BY-NC-SA) would force the whole bank file to BY-NC-SA. Prompts copied from Quiplibre would bring AGPL obligations. Prompts from unlicensed repos are all rights reserved, and many such repos probably contain scraped Jackbox text anyway. Copying from any of these is a bad trade for a few hundred short strings.
- **Private or home use vs a public repo:** keeping content strictly at home and never distributing it is low practical risk. Publishing a repo is distribution, so anything committed needs a clear license chain. The 5secondsGame repo is presumably on GitHub, so treat the bank as published.
- **Recommendation:** write 100% original prompts and add an explicit license file for the bank, e.g. CC BY 4.0 or CC0 for content and MIT for code. Note in the repo that no Jackbox or CAH text was used. Do not ingest third-party prompt lists, even "for inspiration", in a form that leads to near-verbatim copies. Reading them to learn structure is fine.
- Keep LLM-drafted content in the same original-content category. Prompt the model to write new prompts, never to "list Quiplash prompts", which invites regurgitating Jackbox text. Run a quick similarity check against any known Jackbox prompts you remember or see.

### Gaps
- No openly licensed Polish prompt corpus for this genre was found. If one exists, it is obscure.
- The licenses of the Polish CAH GitHub projects are unverified.

## 3. What makes a good Quiplash-style prompt (design guidance)

### Takeaway
Jackbox's own writers say good prompts are specific but not overloaded, use funny words and imaginary premises, invite many quick answers (the writer should be able to answer it instantly), suit the audience, vary in structure (not only fill-in-the-blanks), and draw on embarrassing or real-life situations and some crude humor. A prompt should take seconds to read and invite a noun phrase or short sentence, never a yes or no.

### Cited Findings
- Spencer Ham (Jackbox), "How to Write a Good Quiplash Prompt":
  1. **Think ahead.** "If you can't think of a good answer to your own prompt, then it's probably not going to be a very good" prompt.
  2. **Know your audience.** Inside jokes work only if everyone shares them: "If you're alienating even 1-2 people, the game is a lot less fun."
  3. **Specificity is 78.4% of it.** "The title of an erotic movie" is too vague; "...for elephants" is good; "...a 1940's erotic film for elephants at the St. Louis Zoo" is "way too much info to process."
  4. **Variety is king.** "Don't just write fill-in-the blanks--mix it up with prompts in the form of questions and statements." Vary the joke type as well: puns, phrases, questions, objects.
  5. **Don't overthink it.**
  — [Jackbox: How to Write a Good Quiplash Prompt](https://www.jackboxgames.com/how-to-write-a-good-quiplash-prompt)
- C.J. Tuor (Jackbox writing staff, 14 May 2019), "The Science of Creating a Quiplash Prompt". Patterns that work:
  - silly words and imaginary premises ("What the boogeyman is afraid of")
  - mining embarrassing memories ("The worst song when stripping for a lover")
  - event-specific prompts ("Best thing to scream out of a moving party bus")
  - prompts that spark real conversation ("The worst way to spell Mississippi")
  - crude and bodily humor, which recurs in their games
  - sincere questions ("What are mannequins always thinking?")
  — [Jackbox: The Science of Creating a Quiplash Prompt](https://www.jackboxgames.com/the-science-of-creating-a-quiplash-prompt/)
- Game structure: rounds 1–2 give each player two prompts, and each prompt is answered head-to-head by two players. The final round has all players answer one shared prompt with increasing point multipliers. Quiplash 3's final round is "Thriplash", where players give three answers. — [Mechanics of Magic: Critical Play Quiplash](https://mechanicsofmagic.com/2022/04/22/critical-play-quiplash-nadin/); [Jackbox: Quiplash 3](https://www.jackboxgames.com/quiplash-three)
- A Quiplash 2 custom-episode author made sets of 16 prompts as "exactly enough" for an eight-player game. This comes from a search-result summary. — [Jackbox: How to Write a Good Quiplash Prompt (search summary)](https://www.jackboxgames.com/how-to-write-a-good-quiplash-prompt)
- Reviewers note the game becomes less fun when the prompts are weak, because the humor depends on the prompt giving players a springboard. — [mechanicsofmagic.com Critical Play](https://mechanicsofmagic.com/2024/04/23/critical-play-quiplash-4/)

### Inferences (practical checklist for the Polish bank)
- **Length:** aim for about 4–14 words, readable aloud in under 5 seconds on a phone or TV. Put one concrete anchor in each prompt (a place, person-type or event) and no more than two.
- **Answer shape:** the prompt should invite a noun phrase, a short quote or a title. Avoid yes/no ("Czy…?"), numeric answers, and prompts with one obvious correct answer.
- **Structure mix** (per Ham's variety rule), roughly 40% "Najgorsza/Najlepsza X…", 20% quotes ("Co mówi/krzyczy X…"), 15% titles or names ("Tytuł…", "Nazwa…"), 15% sincere or absurd questions ("O czym naprawdę myślą…?"), and 10% Thriplash-style "Trzy rzeczy, które…" for the final round.
- **Tags per prompt:** `tier`, `structure`, `topic`, `final` (suits a three-answer final). This lets the engine avoid two "Najgorsza rzecz…" prompts in a row and lets the GM filter topics.
- **Self-test rule:** whoever adds a prompt writes 3 answers in under 30 seconds. If they can't, cut it (Ham's "think ahead").

### Gaps
- No Jackbox GDC talk specifically about Quiplash prompt-writing was found in this pass. The two Jackbox blog posts are the primary design sources.

## 4. Polish-specific considerations (humor, grammar, input, limits)

### Takeaway
The main Polish problem is grammatical. A mid-sentence blank forces case, gender and number agreement that free-text answers will break. The solution is to phrase prompts so the answer stands alone after a colon or dash, or as a direct object/quote, in the nominative or a quotation. Cultural material is rich (wesela, PRL, rodzina, szkoła, urzędy, PKP, memy), but partisan politics and religion split groups and should sit in higher tiers or behind a topic toggle. Diacritics must be fully supported but never required.

### Cited Findings
- Common LLM tokenizers need about 2–3 times more tokens per word for Polish than for English. Examples: Mistral-7B about 3.14 vs 1.88 tokens per word; a European survey puts Polish at about 2.25 vs English at about 1.23. This affects LLM cost estimates (section 5). — [PLLuM paper, arXiv 2511.03823](https://arxiv.org/pdf/2511.03823); [Bielik 11B v3, arXiv 2601.11579](https://arxiv.org/pdf/2601.11579); [Tokenizer tax across 25 European languages (review)](https://www.themoonlight.io/es/review/the-tokenizer-tax-across-25-european-languages-domain-invariance-cross-lingual-few-shot-effects-and-the-ukrainian-penalty)
- Jackbox's "know your audience" rule warns that alienating even 1–2 players ruins the fun. This bears directly on political and religious material in mixed Polish groups. — [Jackbox: How to Write a Good Quiplash Prompt](https://www.jackboxgames.com/how-to-write-a-good-quiplash-prompt)

### Inferences (language and culture guidance)
The points below come from Polish grammar and general knowledge, not from sources fetched in this pass.

**Grammar: phrase prompts so any answer fits**
- **Avoid mid-sentence blanks.** "Babcia zawsze daje mi ___ na urodziny" forces the accusative case; an answer in the wrong case reads badly and confuses voters. Put the blank at the end, after a colon: "Prezent od babci, którego nikt nie chce: ___". An answer in the nominative or as a free phrase then always fits.
- **Use "rzecz/coś/powód/tekst/hasło/tytuł/nazwa" frames:** "Najgorsza rzecz, jaką można powiedzieć na weselu" (from the brief) is ideal. The relative clause absorbs the grammar, and the answer is a standalone quote or noun phrase.
- **Gender agreement:** avoid prompts addressing "you" with past-tense verbs ("Co zrobiłeś/zrobiłaś…") or adjectives that mark gender. Use neutral forms: impersonal "Co robi się…", infinitives ("Najgorszy sposób, żeby…"), the formal-neutral "Twój/Twoja" with nouns, or third-person characters ("teściowa", "szwagier", "pan z urzędu"). If a second-person form is unavoidable, use the slash form "zrobiłeś/-aś", but it looks clunky on a TV.
- **Quote prompts** ("Co krzyczy wujek po trzecim kieliszku?") avoid case issues entirely, since the answer is direct speech.
- **Titles and names** ("Tytuł polskiej telenoweli o…", "Nazwa nowego smaku chipsów…") are grammar-safe, because titles are nominative by nature.
- **Thriplash-style finals:** "Trzy rzeczy, których nie mówi się przy teściowej:" with a list of three free phrases works naturally.
- **Plural vs singular:** "Rzecz, którą…" invites one item. If plurals are fine, use "Coś, co…", which agrees with anything.
- **Lowercase:** displaying player answers in their original case is fine. Don't auto-capitalize mid-sentence answers.

**Diacritics and phone input**
- Phone keyboards with the Polish layout produce diacritics by long-press. Many players skip them ("zolw" instead of "żółw"). Accept both and never normalize away diacritics in display.
- **Duplicate detection:** if the engine flags identical answers (the "jinx" mechanic in Quiplash 2/3), compare after normalizing with NFD plus diacritic stripping and lowercasing, because "żółw" and "zolw" should count as the same answer.
- **Fonts:** fonts on the TV and board screens must include Latin Extended-A (ą ć ę ł ń ó ś ź ż). Most system fonts do.
- **Encoding:** store the bank as UTF-8 JSON in NFC normalization.

**Character limits**
- Quiplash uses a short answer cap (commonly cited as about 45 characters; not verified in this pass). Polish words are longer on average than English and inflect heavily, so set the answer limit around 60–80 characters. Keep prompt text at or under about 90 characters so it fits on a phone without scrolling and is readable on the TV.

**Cultural material and topics by risk**
- **Low risk (all tiers):** wesela (oczepiny, poprawiny, wódka, wujek), Wigilia and the 12 dishes, grzybobranie, działka, PKP delays, urzędy and queues, szkoła (wychowawczyni, wywiadówka, matura), rodzina (teściowa, ciocia "a kiedy ślub?"), Polish weather complaining, kebab at 3 a.m., Biedronka/Żabka, Januszex workplace culture, "Pan Kanapka"-style everyday absurdity, polskie memy (generic forms rather than specific viral images that date quickly).
- **Medium risk:** PRL nostalgia (works for 40+, opaque to teens), the church as an institution (ksiądz po kolędzie is mostly gentle and popular, while doctrinal mockery is not), football and the national team, drinking culture (fine for adults, avoid in the family tier).
- **High risk (18+ tier only, ideally behind a separate "polityka" toggle):** named current politicians, parties, PiS/PO polarization, abortion, the Smoleńsk crash, Holocaust or WWII trauma, ethnic jokes (Ukrainians, Roma, Jews). Partisan prompts can split a family table, and some topics touch real tragedies. Even in "unrestricted" mode, write prompts that punch at situations and institutions, not at protected groups. The players supply the edge; the prompt just opens the door.
- **Datedness:** named celebrities and memes age fast. Keep them under about 10% of the bank and tag them `dated:true` so they can be rotated out.

### Gaps
- I found no published Polish linguistics resource on fill-in-the-blank or template agreement for games. The grammar guidance is my own analysis; localization engineering references (e.g. ICU MessageFormat or Mozilla Fluent discussions of Polish cases) could be cited in a follow-up.
- The actual Quiplash character limit was not verified in this pass.

## 5. LLM-generated prompts (Claude API): online feature vs build-time drafting

### Takeaway
LLMs are best used offline at build time: bulk-draft thousands of Polish candidates per tier, then have a human curate the best into the JSON bank shipped with the game. That keeps the game fully offline and the quality controlled. An optional live "fresh prompts" mode via the Claude API is cheap, with cost negligible per game even on mid-tier models. It needs internet, adds a few seconds of latency (best hidden by pre-fetching during the lobby), and needs a local fallback. Tone control by tier is a system prompt plus a validation pass. The unrestricted 18+ tier may hit model safety limits on the most extreme content. Explicit sexual content in particular may be refused, so that tier should rely on the human-written bank.

### Cited Findings
- Claude API prices per million tokens (input/output), from Anthropic's pricing page as of Nov 2026:

  | Model | Input | Output |
  |---|---|---|
  | Claude Haiku 5.5 (≤100k-token prompts) | $0.10 | $0.50 |
  | Claude Sonnet 5.5 | $2 | $10 |
  | Claude Opus 5.5 | $4 | $20 |
  | Claude Haiku 4.5 | $1 | $5 |
  | Claude Sonnet 4.6 | $3 | $15 |

  Cache hits are a small fraction of the base input price (e.g. Sonnet 5.5 at $0.10/MTok). — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- The Batch API gives "a 50 percent discount on both input and output tokens" for asynchronous jobs, e.g. Sonnet 5.5 at $1/$5 and Opus 5.5 at $2/$10. This suits build-time bulk drafting. — [Anthropic pricing: Batch processing](https://platform.claude.com/docs/en/about-claude/pricing)
- Polish costs about 2–3 times the tokens per word of English with general tokenizers; one Polish developer guide estimates about 40% more tokens than English. Claude's own tokenizer ratio was not measured in these sources. — [PLLuM arXiv 2511.03823](https://arxiv.org/pdf/2511.03823); [swmansion agentic-engineering: model pricing](https://agentic-engineering.swmansion.com/expanding-horizons/model-pricing/)
- A multilingual long-context benchmark (ONERULER, 2025) was widely reported in Polish media as showing Polish to be "the best language for AI". The swmansion guide calls that a misreading, a claim separate from token cost. Do not use it as evidence of Polish humor quality. — [swmansion guide](https://agentic-engineering.swmansion.com/expanding-horizons/model-pricing/); [DEV: One ruler to measure them all](https://dev.to/__2ddbae6bb7d/one-ruler-to-measure-them-all-how-language-affects-llm-quality-5f54)

### Inferences (cost, latency, architecture)
- **Live cost per game** (8 players, about 17 prompts): request about 25 prompts to allow filtering. Input is about 1.5k tokens (system prompt with tier rules, style examples and a list of recent prompts to avoid). Output is 25 prompts × about 15 Polish words × about 2.5 tokens per word, roughly 1k tokens, rounded up to about 1.5k with JSON overhead.
  - Sonnet 5.5: about 1.5k × $2/M + 1.5k × $10/M ≈ $0.018 per game.
  - Haiku 5.5: about $0.001 per game.
  - Opus 5.5: about $0.036 per game.
  - Even 1,000 games costs single-digit to tens of dollars. Cost is not a constraint; quality is.
- **Build-time bank drafting:** generating 5,000 candidates (about 3 tiers × 1,700) at about 40 output tokens each is about 200k output tokens. With the Batch API on Opus 5.5 that is about $2, or about $1 on Sonnet 5.5. Spend the effort on curation instead: expect perhaps a 15–30% keep rate after human review for humor quality and Polish grammar (my estimate, not sourced).
- **Latency:** a short Sonnet or Haiku JSON response of about 1.5k output tokens usually takes a few seconds. To hide it, fetch at game start or in the lobby, never between rounds, and stream or validate the JSON before the round begins. If the request fails or times out (about 8 s), fall back silently to the local bank.
- **Offline-first design:**
  1. Ship `prompts.pl.json` with tiers.
  2. Treat the optional online mode as "dobierz świeże prompty", generated at lobby time.
  3. Write accepted generated prompts to a local cache file (`generated-prompts.jsonl`, similar to the existing `flagged-questions.jsonl` pattern) so they can be replayed offline and promoted into the main bank after review.
  4. Let players flag bad ones (reuse the 🚩 mechanic from the 5 Second Rule game).
- **Tone and safety control:**
  - Use a per-tier system prompt with explicit rules and 10–20 curated example prompts per tier as few-shot style anchors, plus grammar rules from section 4 (blank at the end, gender-neutral, no yes/no).
  - Validate the output: JSON schema, length ≤90 characters, a blocklist regex per tier (e.g. no profanity in rodzinny), and a dedupe check against the bank and recent history.
  - Optionally run a cheap second classification pass with Haiku ("which tier is this?") and reject mismatches.
- **18+ tier and LLMs:** mainstream APIs allow crude humor, profanity and innuendo, but may decline graphic sexual content or jokes about protected groups. Make the 18+ tier mostly human-written. Use the LLM only for the "pikantny" and milder 18+ material.
- **Quality caveat:** LLMs tend to produce generic, safe and English-calqued Polish humor ("Najgorsza rzecz do powiedzenia na pierwszej randce") and repeat structures. Few-shot examples in real colloquial Polish, a ban on calques, and requests for concrete Polish anchors (e.g. "PKP", "Żabka", "oczepiny") help. Human curation is still essential.
- **API key security:** keep the key on the server (Nitro), never on phones. The key's absence simply disables the online option.

### Gaps
- I found no published evaluation of LLM humor quality in Polish. The quality claims above are judgment, not measurement.
- Claude's tokens-per-word ratio for Polish was not measured. The 2–3× figure comes from other tokenizers.
- Specific Anthropic usage-policy wording for adult humor was not fetched in this pass.

## 6. Recommended bank size per tier

### Takeaway
One game uses about 2N+1 prompts (N = players): about 13 for 6 players, 17 for 8. A party night of 3–5 games with 8 players consumes about 50–85 prompts. Each tier should have at least about 300 prompts at launch and grow toward 600–1,000, plus "already seen" tracking persisted to disk. A GM who selects a higher tier should also draw from the lower tiers (cumulative pools).

### Cited Findings
- Rounds 1 and 2: each player gets two prompts and each prompt goes to two players, so N prompts per round. The final round is one shared prompt. — [Mechanics of Magic](https://mechanicsofmagic.com/2022/04/22/critical-play-quiplash-nadin/)
- A custom-episode author found 16 prompts "exactly enough" for an eight-player game (two rounds × 8, excluding the final). — [Jackbox page search summary](https://www.jackboxgames.com/how-to-write-a-good-quiplash-prompt)
- The repo's existing 5 Second Rule bank is 1,100 questions (11 × 100), which shows the scale this project has already curated. — [/home/user/5secondsGame/CLAUDE.md](file:///home/user/5secondsGame/CLAUDE.md)

### Inferences
- **Usage math:** 8 players × 4 games per night ≈ 68 prompts. A regular group playing monthly uses about 800 prompts per year.
  - With 300 prompts per tier and seen-tracking, there are about 4 nights before any repeat.
  - With cumulative pools (18+ draws from all three tiers: about 900+), there are about 13 nights.
  - Repeats in Quiplash-style games hurt less than in trivia, because the answers differ. Still, groups notice repeated prompts within 2–3 sessions.
- **Targets:**
  - Launch: about 300 per tier, 900 total. Feasible as about 3,000–5,000 LLM drafts curated down, or about 2–3 evenings of human writing per tier.
  - Mature: 600–1,000 per tier.
  - Final-round (three-answer) prompts: about 10% of each tier, minimum 30 per tier, since only one is used per game.
- **Selection algorithm:**
  - Track `seenIds` in a JSON file next to the server (survives restarts, unlike the in-memory hub state).
  - Prefer unseen prompts and reset when the pool runs out.
  - Avoid the same `structure` or `topic` tag back to back.
- **Tier semantics:** make tiers cumulative with a weighting knob. For example, "pikantny" draws about 60% from pikantny and 40% from rodzinny; 18+ draws about 50% from 18+, 30% from pikantny and 20% from rodzinny. Pure top-tier games tend to get monotonous, because crude prompts flatten answer variety. This is my design judgment, consistent with Ham's "variety is king".
- **Topic toggles** orthogonal to tiers: `polityka`, `religia`, `PRL/retro`, `memy`. These let the GM exclude divisive topics even in 18+.

### Gaps
- There is no published data on how many games a typical Polish party group plays per session. The 3–5 figure is an assumption.

## 7. Original example prompts (written for this research, not taken from any source)

### Takeaway
Below are 15 original Polish prompts per tier, written by the researcher for illustration. They follow the grammar rules from section 4 (blank at the end, standalone answer, gender-neutral) and Jackbox's specificity and variety guidance. They are not copied or translated from Jackbox, CAH or Karty Dżentelmenów.

### Cited Findings
- Structure guidance applied: Ham's specific-but-not-overloaded rule and his mix of questions, statements and blanks; Tuor's silly premises, embarrassing moments and event-specific prompts. — [Jackbox: How to Write a Good Quiplash Prompt](https://www.jackboxgames.com/how-to-write-a-good-quiplash-prompt); [Jackbox: The Science of Creating a Quiplash Prompt](https://www.jackboxgames.com/the-science-of-creating-a-quiplash-prompt/)

### Inferences (example prompts; ★ = suitable as a three-answer final)

**Tier 1: Rodzinny (family-friendly, all ages, no alcohol or sex references)**
1. Najgorsza rzecz, jaką można znaleźć w pierogu: ___
2. Co naprawdę myśli kot, kiedy zrzuca kubek ze stołu?
3. Trzynasta potrawa wigilijna, której nikt nie tknie: ___
4. Wymówka ucznia, który nie odrobił lekcji, bo… ___
5. Tytuł bajki o gołębiu, który został prezesem: ___
6. Co mówi GPS, kiedy ma już dość kierowcy?
7. Najmniej przydatna supermoc na działce: ___
8. Nazwa nowej atrakcji w Ciechocinku: ___
9. Co szepcze choinka 7 stycznia?
10. Najgorsza nazwa dla psa sąsiada: ___
11. Nowy przedmiot w szkole, którego wszyscy by się bali: ___
12. Hasło reklamowe pociągu, który zawsze się spóźnia: ___
13. Co babcia chowa w szafie od 1987 roku?
14. Najdziwniejszy grzyb, jaki można przynieść z grzybobrania: ___
15. ★ Trzy rzeczy, które słychać na każdej wywiadówce: ___

**Tier 2: Pikantny (adults, light innuendo, alcohol, office, relationships, mild swearing at most)**
1. Najgorsza rzecz, jaką można powiedzieć na weselu w trakcie oczepin: ___
2. Co wujek krzyczy po trzeciej kolejce?
3. Najmniej romantyczne miejsce na oświadczyny: ___
4. Tekst, który od razu kończy pierwszą randkę: ___
5. Prawdziwy powód, dla którego szef zwołał spotkanie o 16:55: ___
6. Nazwa drinka, który serwują tylko na poprawinach: ___
7. Co naprawdę oznacza „wpadnę na chwilę” u szwagra?
8. Najgorszy prezent na rocznicę ślubu: ___
9. Wiadomość, której nie chcesz dostać od byłej osoby o 3 w nocy: ___
10. Tytuł poradnika dla teściowej, która „tylko pomaga”: ___
11. Co kelner myśli o stoliku, który zamówił jedną herbatę na pięć osób?
12. Najgorsza nazwa dla firmy kateringowej na wesela: ___
13. Hasło na transparencie podczas wieczoru kawalerskiego w Zakopanem: ___
14. Coś, czego nie należy wpisywać w CV, nawet jeśli to prawda: ___
15. ★ Trzy rzeczy, które Polak zabiera na majówkę: ___

**Tier 3: 18+ bez cenzury (explicit language allowed; still punches at situations, not protected groups)**
1. Najgorsza rzecz, jaką można krzyknąć w łóżku: ___
2. Nazwa sex-shopu prowadzonego przez emerytowaną polonistkę: ___
3. Co naprawdę robi ksiądz po kolędzie, kiedy nikt nie patrzy?
4. Najbardziej żenujące hasło do Wi-Fi w motelu przy trasie: ___
5. Tytuł polskiego filmu erotycznego nakręconego w urzędzie skarbowym: ___
6. Najgorsza rzecz do znalezienia w historii przeglądarki dziadka: ___
7. Co mówi kac o 7 rano w Niedzielę Wielkanocną?
8. Nowa pozycja seksualna nazwana na cześć PKP: ___
9. Najgorszy tekst na podryw na stypie: ___
10. Prawdziwa treść SMS-a, który rodzice wysłali sobie na weselu córki: ___
11. Co się dzieje na wyjeździe integracyjnym, ale zostaje na wyjeździe integracyjnym?
12. Najgorsze miejsce, żeby skończył się papier toaletowy: ___
13. Hasło kampanii wyborczej kandydata, który obiecuje tylko darmowy alkohol: ___ (deliberately fictional and non-partisan)
14. Co naprawdę jest w kompocie u teściowej?
15. ★ Trzy rzeczy, których nie mówi się przy pierwszym seksie: ___

Notes on the examples:
- All answer slots are at the end or the prompt is a question, so the answer stands alone. No gendered "zrobiłeś/zrobiłaś" forms are used.
- Only one prompt touches politics (18+ #13), and it is generic and fictional, consistent with putting politics behind a toggle.
- Religion appears once (18+ #3, a gentle institutional joke). Keep it tagged `religia` so the GM can exclude it.
- Tier 2 #9 uses "byłej osoby" as a gender-neutral workaround. A real bank might prefer "od eks" (indeclinable and gender-neutral in colloquial Polish).

### Gaps
- The examples have not been playtested. Their humor quality is unvalidated.
