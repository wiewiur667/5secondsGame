# Party Hub

A LAN party-game hub. Players join from their phones; the first player to join
is the game master and runs the games from the same screen. Games:

- **Music Impostor** — everyone hears the same song except one impostor, who
  gets a different one. Guess who after the round.
- **5 Second Rule** — pick 3 correct options before the 5-second timer runs out.
  300 Polish questions across three decks: **Dla Par**, **Pikantne** (18+),
  **Impreza**. The timer starts on a button press; answers stay hidden until
  someone hits **Reveal**; standings show between questions with a countdown.

Adding a game = drop a folder under `server/games/` + one line in
`server/games/index.ts`.

## Run with Docker (recommended for a NAS)

```bash
docker compose up -d --build
```

Then on any phone on the same network, open `http://<nas-ip>:3333`.
The game-master screen shows the exact join URL + a QR code.

Change the port by editing `docker-compose.yml` (`"8080:3333"` maps host 8080).

### Without compose

```bash
docker build -t party-hub .
docker run -d -p 3333:3333 --restart unless-stopped --name party-hub party-hub
```

## Run without Docker

```bash
npm install
npm run build
HOST=0.0.0.0 PORT=3333 node .output/server/index.mjs
```

Dev mode: `npm run dev` (binds 0.0.0.0:3333).

## Notes

- All state is in memory — one game session per running container. Restart to reset.
- Questions live in `server/games/five-second-rule/questions.json`; songs in
  `server/games/music-impostor/music.json`.
- LAN gotcha: if phones can't reach the host, the router may have "AP/client
  isolation" on — disable it, or use a hotspot.

## Tests

```bash
npm test
```
