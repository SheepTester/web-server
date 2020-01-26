# Assassin Game Conceptualizations

Billy Uglieur creates a new game. He calls it "Billy's Epic Game." In the description, he writes "Please see my website for the rules."

Internally, the client ought to tell the server about this. Perhaps a POST request to `/assassin/new-game` with Billy's session ID and:

```json
{
  "name": "Billy's Epic Game",
  "description": "Please see my website for the rules."
}
```

The server creates the game. This is stored in a separate database mapping a game ID to its object. The game ID also gets put in Billy's user object so he can access a list of his games. The server returns the game ID, and the client opens to the game settings page.

When creating the game object, it needs to store the following:

```json
{
  "name": "Game name",
  "description": "Game description; can list rules, etc. so should support newlines. Might want to consider Markdown formatting, but that's a job for the client.",
  "players": {
    "player-username": {
      "target": "target-username",
      "kills": 0,
      "code": "kill code"
    }
  },
  "codes": [
    "join code"
  ],
  "started": false,
  "ended": false
}
```

I think I'll keep this simple. When the game hasn't started, people can join and leave. The targets are not assigned nor shown. Participants are always publicly listed. Once the game starts, which cannot be undone, targets will be assigned to each player, and new players can't join anymore. At any time, the name and description can be changed, and players can be removed by the game creator.

I want join and kill codes to be something with high uniqueness but also is easy to remember. Maybe it could be four English words or something (eg "correct horse battery staple").

~~On game creation, a join code is automatically created. Join codes can be created or revoked, and all can be revoked at once.~~ Actually, I think I will make this a settable password or something. Apparently assassingame.com has a 4-digit join code and a password.

Mr. Uglieur sees the game settings page, with a "start" button, which is disabled because there's no one in the game yet. It displays the game name and description, which are still editable. When he updates the description, it automatically saves. One join code is listed: *happy otter random code*. He sends this to his friends.

Sulijen Kesupo receives the code and goes to the site to enter it in. His name will appear on Mr. Uglieur's game settings page with an option to remove. Mr. Uglieur can join the game if he wants.

Eventually, a couple other people join, so Mr. Uglieur starts the game. Now the players can access their kill code and target's name and profile.

It is a peaceful day in Jan Puli's neighbourhood. Jan Puli lies comfortably on his beach chair in his front yard, listening to the birds chirping and the occasional gentle breeze rustling the leaves. Suddenly, his nose is hit by an artificially sweet fruit-flavoured scent. He jumps out of his chair and swivels around, revealing Sulijen, dressed from head to toe in black, holding a spoon. They pause, then Sulijen strikes with his spoon. Before Jan Puli reacts, he finds Sulijen's spoon pressing on his forehead. In Sulijen's other hand is his phone.

"Your code, please," he asks, sneering at Jan Puli.

"Epic panda sample code," Jan Puli recites. Sulijen retracts his spoon-holding hand and stows it in his pocket, then types in the code on his phone. Jan Puli has been assassinated.

Internally, this marks Jan Puli as dead and gives Jan Puli's target to Sulijen. This also increments Sulijen's kill count by one. If Jan Puli were the second-to-last person alive, the game ends, but he isn't, so the game doesn't end.

At some point, activity becomes stagnant, so Mr. Uglieur decides to shuffle targets. There's a button on the game settings page that allows him to do this.

It turns out an unknown person named `Gamepro5` doesn't actually exist, so Mr. Uglieur kicks him. Sulijen had that user as a target, so their target is set to Gamepro5's target.

When the penultimate person is killed, the game ends.

This all requires:

- POST `/create-game` Create new game (session, name, description) -> game ID
- Create join code (session, game) -> join code
- Revoke join code (session, code) -> ok
- POST `/game-settings` Set game settings (session, game, info...) -> ok
- GET `/game-settings` Get game settings (session, game) -> info...
- GET `/game` Get game info (game) -> info...
- POST `/join` Join game (session, code) -> game ID
- POST `/leave` Remove player (session, game, player) -> ok
- POST `/start` Start game (session, game) -> ok
- GET `/status` Get status, kill code, and target (session, game) -> is dead?, kill code, player username, name
- POST `/kill` Kill target (session, game, kill code) -> ok
- POST `/shuffle` Shuffle targets (session, game) -> ok
