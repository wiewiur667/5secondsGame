# Quiplash series: core round mechanics (rounds 1 and 2, head-to-head)

Research notes for designing an original Polish party game with similar mechanics. Only mechanics are described here: no names, prompts or art to be copied.

**Source access caveat (read first):** The two main fan wikis could only be partly read. The Fandom wiki ("Jackbox Games Wiki") was read in full as raw wikitext through its MediaWiki API: https://jackboxgames.fandom.com/api.php?action=parse&page=Quiplash_(series)&prop=wikitext. All the single-game pages (Quiplash, Quiplash XL, Quiplash 2, Quiplash 3) redirect to that one series page. Jackboxpedia (jackbox.wiki) returned 403 / a bot wall, so its figures below come only from search-engine snippets of its pages, not from a full read. The official Jackbox support pages give no scoring or timer numbers. Two open-source clones were cloned and read: quiplibre and quiplash-js. They show how others implemented the rules and are **secondary sources, not evidence of Jackbox's real rules**. No Reddit thread with a scoring analysis turned up in searches.

## 1. Prompt assignment: 2 prompts per player, 2 players per prompt, odd counts, 3–8 players

### Takeaway
In rounds 1 and 2, every player answers exactly two prompts and every prompt goes to exactly two players. So with N players there are N prompts and N head-to-head matchups per round, and the structure works the same for odd and even N. The game supports 3–8 players plus an audience of up to 10,000. Jackbox's actual pairing algorithm is not published. A "cyclic shift + constrained shuffle" approach (each player is paired with two different opponents) is the standard way to do it and is what open-source clones use.

### Cited Findings
- Player range is "3-8 players + audience", and "3 to 8 players can join the game and 10,000 players can join the audience." — [Jackbox Games Fandom wiki, Quiplash (series)](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- "In the first and second rounds, players must give an answer to two prompts in the allotted time." — [Fandom, Quiplash (series)](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- A Steam user describing the original game says "everyone gets 2 questions on their choice of device". A Jackbox Games staff account replied in the same thread on Jun 30, 2015 but did not dispute this. — [Steam discussion, Quiplash app 351510](https://steamcommunity.com/app/351510/discussions/0/523890528710287203)
- Jackbox's official support table lists Quiplash 3 (Party Pack 7) as 3–8 players and supporting Extended Timers. — [Jackbox support: How many players can join each game?](https://support.jackboxgames.com/hc/en-us/articles/15794756085015-How-many-players-can-join-each-game) (seen as a search snippet)
- Why two prompts each: "If each player only answered one prompt, and therefore was in one matchup, then in an odd number of players one would be left out in the cold, possibly given a bye. So, since that can be easily avoided by answering two prompts, we do that." The author admits he never studied how Quiplash does it. — [quiplibre readme (open-source clone, secondary)](https://github.com/wyattscarpenter/quiplibre)
- quiplibre's algorithm, read in the code (`quiplibre.html`, about lines 197–235): copy the player list, rotate it by one position (random direction) so nobody faces themselves, then do random swaps that are rejected if they would create a self-match. For each index i, one new prompt goes to `players[i]` (as their 1st prompt) and `rotated[i]` (as their 2nd prompt). Result: N prompts, each player in exactly 2 matchups. — [quiplibre source](https://github.com/wyattscarpenter/quiplibre)
- quiplash-js comments "Total number of prompts is equal to the number of players" and hard-codes the pairings per player count (for 3 players: P1 gets prompts 0 and 1, P2 gets 0 and 2, and so on). — [simondiep/quiplash-js, server/state/PromptsAnswersVotes.js (secondary)](https://github.com/simondiep/quiplash-js)
- Another clone states the same rule: "Players each receive a different set of prompts, and each prompt is answered by two players." — [jlrtweedie/quip-pro README (secondary)](https://github.com/jlrtweedie/quip-pro)
- Odd player counts only matter for a special case in the **final** round of Quiplash 3, not in rounds 1–2: "In odd-numbered games, a player that's ranked last on the second round is chosen to quip against Schmitty himself (with Schmitty simply answering with a pre-written response)." — [Fandom, Quiplash (series)](https://jackboxgames.fandom.com/wiki/Quiplash_(series))

### Inferences
- With "2 prompts per player, 2 players per prompt", the matchups form a 2-regular graph (a set of cycles over the players). Any N ≥ 3 works, so no bye is ever needed in rounds 1–2. The simplest correct construction: shuffle the players into a random order p0…p(N-1) and give prompt i to (p_i, p_(i+1 mod N)). That is one Hamiltonian cycle, and each player gets two *different* opponents whenever N ≥ 3.
- For round 2, a designer would probably want new opponent pairs. With N = 3 that cannot happen, because each player only has two possible opponents. Avoiding repeats from round 1 is possible from N ≥ 5. This is a design choice; no source confirms that Jackbox does it.
- Per round: N matchups are shown. Over rounds 1 and 2: 2N head-to-head matchups (for example, 16 with 8 players, 6 with 3 players).

### Gaps
- Jackbox's real pairing algorithm (random cycle? avoiding round-1 repeats?) is not documented in any source found.
- No source found on how Jackbox's rounds 1–2 behave at exactly 3 players beyond the general rule. Note that with 3 players only 1 person can vote on each matchup.

## 2. Answer timers, character limits, no answer, Safety Quip

### Takeaway
No reliable source gives the default answer-timer length or character limit for any version. Both are gaps. What is documented: **Quiplash 1/XL**: if you don't answer (or your answer is censored), your opponent gets all the points by default. **Quiplash 2** added a Safety Quip button that fills in a random stock answer and halves your points. **Quiplash 3** reworked the Safety Quip so its answers relate to the prompt, but "half points still apply". All versions have an "Extended Timers" setting.

### Cited Findings
- "If a player does not give an answer to the prompt in time, or their answer got censored by moderation or manually, then their opponent will get all the points by default." — [Fandom, Quiplash (series)](https://jackboxgames.fandom.com/wiki/Quiplash_(series)) (written under general Game Rules; the wiki does not say which version.)
- Answers are revealed "once all the players give their answers or after the response timer runs out" (wiki text: "of after", a typo for "or after"). So the writing phase ends early once everyone has submitted. — [Fandom, Quiplash (series)](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- Quiplash 2: "Introduced in Quiplash 2 is a Safety Quip option, which provides half points and inserts a random submission as the answer." — [Fandom, Quiplash (series)](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- Quiplash 3: "the Safety Quip was reworked in this game to answer with something decently related to the prompt. However, half points still apply." — [Fandom, Quiplash (series)](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- A Safety Quip can still win: the InterLASHional achievement "Safety Dance" is "Win a battle with a Safety Quip". The Quiplash 3 achievement "Safety Net" is "Got a Quiplash with a safety quip". — [Fandom achievements list](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- A fan guide says the halving applies even when the Safety Quip wins. — search snippet of [Steam Quiplash achievements guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2869364388) and [DeviantArt "The Safety Quip"](https://www.deviantart.com/sandrag1/art/The-Safety-Quip-815130433) (low-authority sources)
- A critic's view on Quiplash 2 Safety Quips: in their experience the random answer is rarely relevant. This is opinion. — [Mechanics of Magic, Critical Play: Quiplash 2](https://mechanicsofmagic.com/2024/04/24/critical-play-quiplash-2-phuc/)
- TV Tropes describes the Quiplash 2 Safety Quip as trading points for skipping a hard prompt. — [TV Tropes, The Jackbox Party Pack](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/TheJackboxPartyPack)
- Extended Timers: a Jackbox Games staff reply says "We also have an extended timer feature that will help streamers" (Quiplash 1, 2015). — [Steam discussion](https://steamcommunity.com/app/351510/discussions/0/523890528710287203). The Party Pack wiki describes the setting as "Enable very long timers. Recommended only for streamed games." — [Fandom, The Jackbox Party Pack (series)](https://jackboxgames.fandom.com/wiki/The_Jackbox_Party_Pack_(series)) (search snippet)
- Voting timer, from users only: one user claims "The extended timer gives you 20 seconds to choose from two options"; the original poster says "its like 25 secs or so". No developer confirmed either. — [Steam discussion "Increasing time?"](https://steamcommunity.com/app/351510/discussions/0/343787920141286244/)
- A low-authority article claims players "usually have around 60 seconds" to answer. — [SoftHandTech](https://softhandtech.com/how-many-questions-is-quiplash/) (not reliable; not cross-checked)

### Inferences
- Version difference on non-answers: Quiplash 1/XL had a forfeit, where the opponent gets everything. From Quiplash 2 on, the Safety Quip button exists as a voluntary option. Whether a player who simply times out in Quiplash 2/3 gets an automatic Safety Quip or a forfeit is **not confirmed** by any source read.
- How "half points" is calculated (halve the vote-percentage points only, or also the win bonus?) is not specified. A designer must choose.

### Gaps
- Default answer-timer length (any version), voting-timer length, and Extended Timer multiplier: no trustworthy source found. The author's unverified memory is roughly 90 s to write both answers and about 15–20 s per vote. **Do not cite this; it needs checking in-game.**
- Character limit for answers: no source found in any version. (Unverified memory says about 45 characters. Treat as unconfirmed.)
- Whether a timed-out player in Quiplash 2/3 gets an auto-filled Safety Quip.

## 3. Voting: who votes, participants, ties, display order

### Takeaway
Each matchup shows the prompt and the two answers on the shared screen. Everyone except the two authors votes for one answer or abstains, and the audience also votes. Answers are anonymous until the result is revealed. Ties split the vote-share points, and no one gets the winner bonus. The tie handling is supported only by clone code and the general percentage formula; no official source states it.

### Cited Findings
- "When both answers to the prompt are shown, players and audience members choose one of the two answers, or they may not choose at all." — [Fandom, Quiplash (series)](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- A Quiplash requires that "all the players and more than half of the audience voted for their quip". Since the opponent obviously won't vote for you, "all the players" means all eligible voters, which suggests the two authors don't vote. — [Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- Clone implementation: the expected number of votes per matchup is `players.length - 2`, and the README TODO says the authors "will not be able to vote on their round". — [simondiep/quiplash-js QuiplashHandler.js (secondary)](https://github.com/simondiep/quiplash-js)
- Steam store description: your answer is "pitted against another player's answer in a head-to-head clash" and the crowd votes. — [Quiplash on Steam](https://store.steampowered.com/app/351510/Quiplash/)
- The audience in the final round of Quiplash 1/XL: "each audience member has only one vote" (players have 3). — [Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- Shacknews (2015 review) complained that the input timer did not end automatically once all votes were cast. In Quiplash 1 at launch, voting ran for the full timer. — [Shacknews review](https://www.shacknews.com/article/90364/quiplash-review-just-add-people-and-lash-away)

### Inferences
- With N players, each matchup has N − 2 player voters: 1 voter at N = 3, 6 at N = 8. Percentages are coarse at small N (with 3 players, every matchup is 100/0 or 0/0).
- Tie: by the percentage formula, a 50/50 split gives each player 500 points (round 1) and nobody gets the "win" bonus. quiplash-js labels both "TIE" and gives no win bonus. This is consistent but not confirmed as Jackbox's behavior.
- Order of matchups on screen and left/right placement of the answers: not documented. Presumably randomized so voters can't tell who wrote what.

### Gaps
- Official tie rule and on-screen ordering: not found.
- Whether participants in Quiplash 3 can see live vote counts: not found.

## 4. Scoring formula: per vote, round 2 multiplier, QUIPLASH bonus, winner bonus, Jinx

### Takeaway
Scoring is **proportional to vote share, not a flat amount per vote**. Round 1: each 1% of the vote is worth 10 points, so a matchup splits 1,000 points by vote share, plus a 100-point win bonus. Round 2 doubles everything (2,000 pool + 200 bonus). A clean sweep ("Quiplash") pays a bigger bonus in place of the normal one. The size of that bonus is **disputed between sources**: +250 instead of +100 (Fandom) versus 100 in R1 / 200 in R2 (Jackboxpedia, Quiplash 2 page). A Jinx (identical answers) gives both players 0. In Quiplash 2/3, a sweep with >90% of the audience is a "Super Quiplash". The game is played over three rounds, with the most points winning (ties allowed).

### Cited Findings
- "In the first round, points are awarded according to the formula '1% of those who voted = 10 points' + a bonus of 100 points for winning. In the second round, these values are doubled." — [Fandom, Quiplash (series)](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- Cross-check, Jackboxpedia Quiplash 3 page (search snippets): "The maximum of points players can receive in this round for each prompt is 1,000 for 100% of the votes". Round 2 "is the same like in the first round, but the points are doubled. The maximum points for each prompt is 2,000 for 100% of the votes." The Thriplash final has "a maximum of 6,000 per prompt". — [Jackboxpedia, Quiplash 3](https://jackbox.wiki/wiki/Quiplash_3) (snippet only; page blocked)
- Cross-check, Shacknews 2015 review of Quiplash 1: round two doubles all points, "even the bonuses". — [Shacknews](https://www.shacknews.com/article/90364/quiplash-review-just-add-people-and-lash-away) (search snippet)
- Quiplash (sweep) bonus, Fandom: "A player will get a 'Quiplash' if all the players and more than half of the audience voted for their quip. The reward is an additional 250 points instead of 100. If more than 90% of the audience votes for the quip, then it's a 'Super Quiplash'." — [Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- **Disagreement**, Jackboxpedia Quiplash 2 page (snippet): a sweep means keeping all the points "plus a bonus of 100 (in Round 1) or 200 (in Round 2)". — [Jackboxpedia, Quiplash 2](https://jackbox.wiki/wiki/Quiplash_2) (snippet only)
- **Different wording**, Jackboxpedia original Quiplash page (snippet): the bonus is described as "10% of the given point pool in said round". That equals 100 in R1 (10% of 1,000) and 200 in R2, which matches the Quiplash 2 snippet, not Fandom's 250. — [Jackboxpedia, Quiplash](https://jackbox.wiki/wiki/Quiplash) (snippet only)
- Player-count condition for a Quiplash: the Quiplash XL achievement "Quip Tease" is "Get a Quiplash (sweep votes in a 5+-player game)". InterLASHional's "The Titular Win" is "sweep votes in a 5+-player game", and "Quip It Good" is "Get a Super Quiplash! (all player votes and 90% audience votes in a 5+ player game)". — [Fandom achievements](https://jackboxgames.fandom.com/wiki/Quiplash_(series)). The 5+ condition may apply only to the achievement, but it suggests the sweep bonus is not awarded in 3–4 player games, where only 1–2 people vote.
- Jinx: "If both players wrote exactly the same answer, the prompt is declared a 'JINX' and neither of the players get points." — [Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series)). Confirmed by the achievement "Hi, Jinx! – Enter the same thing as your opponent" (same page) and by the [Steam achievements guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2869364388) ("neither player will be awarded points", snippet).
- Safety Quip: half points (Quiplash 2 and 3). See section 2.
- No answer or censored answer: the opponent gets all the points by default. — [Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- Win condition: "The player with the highest number of points (including any ties for the highest number) after three rounds is declared the winner." — [Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- Final round for context (not head-to-head). Quiplash 1/XL: everyone answers one prompt and each player has 3 votes; "all players divide 3000 points according to the formula '1% of those who voted = 30 points'". Quiplash 2: "Last Lash" in three variants (acronym / comic / word), with gold-silver-bronze medal voting (only gold and silver at 3–4 players). Quiplash 3: "Thrip Lash", three answers to one prompt, points tripled. — [Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series)); Thriplash ×3 / 6,000 max is from the [Jackboxpedia Quiplash 3](https://jackbox.wiki/wiki/Quiplash_3) snippet.
- Clone comparison (secondary, *not* Jackbox's rules): quiplash-js gives 100 per vote, +100 to the winner, and doubles the total on a sweep (needs ≥2 votes). quiplibre gives votes × round number. A third-party game, Quip Battle, gives 100 per vote + win bonus, ×2 in R2, ×3 in R3, +100 for a unanimous sweep with ≥2 voters. — [quiplash-js](https://github.com/simondiep/quiplash-js), [quiplibre](https://github.com/wyattscarpenter/quiplibre), [tableparty.io Quip Battle](https://tableparty.io/quip-battle)

### Inferences (worked math, using the Fandom formula)
- Round 1, one matchup with V voters and v_A votes for A: A gets round(1000 · v_A / V), B gets the rest. The winner adds +100, or on a sweep +250 (Fandom) / +100 (Jackboxpedia) **in place of** the normal bonus. Total paid per matchup: 1,100 normally, 1,250 on a Fandom-style sweep, and 1,000 split 500/500 on a tie (no bonus).
- Round 2: the same numbers ×2, so a pool of 2,000, a win bonus of 200, and a sweep bonus of 500 under the Fandom figure (assuming it is doubled as "these values are doubled" implies) or 200 under the Jackboxpedia figure.
- Points paid per round ≈ N matchups × 1,100 (R1) or × 2,200 (R2). Example with 8 players: about 8,800 in R1 and about 17,600 in R2, so round 2 counts for twice as much and comebacks are possible.
- A player's maximum in round 1 is 2 matchups × (1,000 + sweep bonus) = 2,200 (Fandom figure); in round 2, 4,400.
- Rounding: since 1% = 10 points, points are probably shown in multiples of 10, but how fractional percentages (for example 1/3 = 33.3%) round is not documented.
- Safety Quip "half points" applied to a sweep win under the Fandom formula would be 0.5 × (1,000 + 250) = 625, if the bonus is also halved. Unconfirmed.
- With 0 voters (for example, abstentions only), the percentage formula is undefined. A designer needs a rule, such as 0 points each with no bonus.

### Gaps
- The size of the sweep bonus is disputed: 250 (Fandom) vs 100/200, i.e. 10% of the pool (Jackboxpedia). It may also differ by version (Quiplash 1 vs 2 vs 3). I could not read the full Jackboxpedia pages to settle it.
- Whether the Super Quiplash gives extra points beyond a normal Quiplash, and how much: no source gives a number.
- Whether the audience counts in "those who voted" for the percentage, and how much weight it has compared with players. The Fandom wording ("1% of those who voted") suggests the audience is pooled in. Quiplash 2/3 may use the audience as a single block; not confirmed.
- Whether the forfeit to the opponent pays 1,000 + bonus or something else: not specified.

## 5. Pacing: round and game length, matchups shown

### Takeaway
A game is three rounds: two head-to-head rounds of N matchups each, then one all-player final round. So an 8-player game shows 16 head-to-head matchups plus the final. No source with measured timings was found. Jackbox's official store and support pages do not give a session length for Quiplash in any source read.

### Cited Findings
- Three rounds, winner after round 3. — [Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series))
- Two prompts per player per round; matchups are revealed one at a time with voting after each. — [Fandom](https://jackboxgames.fandom.com/wiki/Quiplash_(series)); one-at-a-time head-to-head reveal also described in the [Steam store page](https://store.steampowered.com/app/351510/Quiplash/)
- Shacknews (2015) noted the voting timer did not cut short once all votes were in (Quiplash 1), which slowed the pace. — [Shacknews](https://www.shacknews.com/article/90364/quiplash-review-just-add-people-and-lash-away)

### Inferences
- Rough model for a designer (not sourced): writing phase T_w (one timer covering both prompts) + N × (reveal ~5–10 s + vote T_v + results ~5–10 s) per round. With N = 8, T_v ≈ 20 s and T_w ≈ 90 s, that is about 1.5 + 8 × ~40 s ≈ 7 min per round, giving about 15–20 min per game including the final and the host's patter. Treat this as an estimate only.
- The matchup count grows linearly with N, so 8-player games run about 2.7× longer in voting than 3-player games. Ending each vote early once all eligible voters have voted (which Quiplash 1 originally did not do) is a cheap pacing win.

### Gaps
- No official or measured total game duration found. Store pages and the Jackbox support pages read give none.
- Default timer lengths (see section 2) are needed to make the pacing estimate firm.
- Source warning: the Netflix-hosted Jackbox help page titled "What is Quiplash 3?" actually describes a bluffing game ("guessing correctly and by tricking other players into picking your fake answer"), which is Fibbage-style mechanics, not Quiplash. Do not rely on it. — [Netflix Jackbox Party Essentials help: What is Quiplash 3?](https://games-netflix.helpshift.com/hc/en/57-the-jackbox-party-essentials/faq/1869-what-is-quiplash-3/?p=all)
