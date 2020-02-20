# Assassination docs

On the client-side, this is known as Elimination. I changed the name after making the backend. Oops!

## POST `create-user`

Give it a username and some starter name, password, and email info. A bio is optional.

```ts
{ username : String, name : String, password : String, email : String, bio : String }
```

```ts
{ session : String }
```

### What's a good username?

Three to twenty of: lowercase letters, digits, `_`, and `-`. It also can't be taken.

### What's a good name?

It just needs to exist. It's not that sophisticated. Also can't be over 50 characters.

### What's a good password?

Por lo menos 6 characters, of which one needs to be a space. Can't be over 200 characters.

### What's a good email?

There's currently no email validation because emails are pretty unpredictable. Validation is done on the client-side. I don't think it's a big deal if someone uses the API to send a malformed email. There's a limit of 320 characters max; [this article](https://blog.moonmail.io/what-is-the-maximum-length-of-a-valid-email-address-f712c6c4bc93) says it should be 254, but I don't really care.

### What's a good bio?

Can't be over 2k characters.

## POST `login`

```ts
{ username : String, password : String }
```

```ts
{ session : String, username : String }
```

I don't know why login returns the username while create user doesn't, but I won't change it.

## POST `logout`

Requires authentication. Returns an ok.

### How to authenticate?

You need to set the `X-Session-ID` header to the session ID.

### What's an ok?

```ts
{ ok : String }
```

`ok` is different depending the endpoint, so don't rely on its value. It's usually some English word or maybe two.

## What if there's no ok?

It'll either 400 or 500. If you don't set `X-Requested-With` to `XMLHttpRequest`, then it'll return an HTML page, which is hard to parse. When the header is set, it'll return JSON.

400 means the inputs given to the API are goofy. This could mean that a user doesn't exist or something. It'll look like

```ts
{ url : String, wucky : 'you bad', mistake : String }
```

A 500 error means the server code threw a genuine runtime error.

```ts
{ url : String, wucky : 'brain hurt', problem : String, history : String }
```

`history` is the error stack. `problem` is the JavaScript error message.

## GET/POST `user-settings`

You can POST to set them (see create user for the restrictions) or GET to get them.

POST returns an ok and accepts

```ts
{ name : String, email : String, bio : String, password : String, oldPassword : String }
```

If `password` isn't given then you don't need to give `oldPassword` either

GET returns

```ts
{ name : String, email : String, bio : String }
```

This requires authentication.

## GET `user?user=[username]`

Returns

```ts
{
  name : String,
  bio : String,
  myGames : Array<{
    game : GameID,
    name : String,
    state : State,
    time : Date,
    players : Number
  }>,
  games : Array<{
    game : GameID,
    name : String,
    state : State,
    players : Number,
    kills : Number,
    alive : Boolean,
    updated : Date
  }>
}
```

`time` is either the game end time, game start time, or game creation time; it'll take the latest one. It should coincide with the game state. Whenever `time` appears with `state`, it'll represent this.

`updated` is rather complex. I intend on using it for sorting a user's games by "last updated," which is a pretty ambiguous criteria. Here's my description of it.

```js
// `updated` is kind of like the last updated time for a game in the
// context of this user. Before a game starts, it gives the creation
// time. After the game starts, it gives the player's death. If the
// player hasn't died yet, it'll give the end time of the game, but
// if the game hasn't ended yet, then it'll give the start time.
```

### What's a `State`? And a `Date`?

`Date` is a date and time in milliseconds since whatever epoch JavaScript Dates use.

`State` is a string that is either `ended`, `started`, or `starting` (before the game has started).

## POST `create-game`

Requires authentication. Takes

```ts
{ name : String, description : String, password : String }
```

`description` is optional.

Returns

```ts
{ game : GameID }
```

### What's a `GameID`?

`GameID` is a string used to identify a game. Game IDs used to be incremental. Now, they're five digit hexadecimal sequences, like `e1e10`. They're always strings.

### What's a good game name?

At most a hundred characters. Can't be empty.

### What's a good game description?

At most 2k chars.

### What's a good game password?

Known on the client-side as a passphrase, it's at most 200 characters. It can be empty.

## POST `delete-game?game=[GAME]`

With auth, deletes the specified game given that there's no one in it. Gives an ok.

## GET/POST `game-settings?game=[GAME]`

POST takes

```ts
{ name : String, description : String, password : String }
```

and gives an ok.

GET returns

```ts
{
  name : String,
  description : String,
  password : String,
  players : Array<{
    username : String,
    name : String,
    alive : Boolean,
    kills : Number,
    joined : Date
  }>,
  state: State
}
```

`joined` is what `Date.now()` returns representing when the player joined. `kills` is an integer representing the number of eliminations this user has performed.

Requires auth.

### What's the `?game=[GAME]` part?

It's a URL query thing. `[GAME]` is the game ID.

### What makes a good name?

A nonempty, at most 100 char name is good.

### What makes a good password?

It can't be over 200 characters, but it can be empty.

### What makes a good description?

It can't be over 2k chars, but it can be empty.

## GET `game?game=[GAME]`

```ts
{
  creator : String,
  creatorName : String,
  name : String,
  description : String,
  players : Array<{
    username : String,
    name : String,
    alive : Boolean,
    killTime : Date | null,
    killer : String | null,
    killerName : String | null,
    kills : Number,
    joined : Date
  }>,
  state: State,
  time: Date
}
```

No auth.

## GET `games?query=[QUERY?]&regex=[OPTIONS?]&strict=[true?]`

Lists all the games like this:

```ts
Array<{ game : GameID, name : String }>
```

If `query` is given:

- If `regex` is specified, it'll create a RegExp object from `query` and use `regex` for options

- Otherwise, it'll do a simple text match search. Set `strict` to true to prevent it from doing it case insensitively

## GET `names?games=[GAMES]&users=[USERS]&defaultGame=[DEFAULT_GAME?]&defaultUser=[defaultUser?]`

`games` and `users` are a list of game IDs and usernames respectively, joined by a comma `,`. `defaultGame` (optional) is the default value that should be returned if a game doesn't exist, and likewise for `defaultUser` but for users. `users` is an array of usernames. This returns

```ts
{
  games : Array<String>,
  users : Array<String>
}
```

which are arrays of the display names or default values for each of the given game IDs/usernames.

## POST `join?game=[GAME]`

Okays given with auth

```ts
{ password : String }
```

This is case insensitive and trims whitespace at the ends.

## POST `leave?game=[GAME]`

Used for both kicking and leaving on one's own.

You can give nothing but auth to leave yourself, or give a target (and optional reason)

```ts
{ user : String, reason : String }
```

Returns an ok.

You can't leave while a game is running, but players can still be kicked.

When a player is kicked, their assassin's code is NOT regenerated.

### What happens if my target is kicked?

The kicked person's target becomes your target.

## POST `start?game=[GAME]`

With auth, start the game. Returns an ok. Requires at least 2 players.

## GET `status?game=[GAME]`

While a game is running, with auth, it'll give

```ts
{
  game : GameID,
  gameName : String,
  target : String,
  targetName : String,
  code : String
}
```

`target` is a username. `targetName` is their display name. `code` is used for killing (see `kill`).

(It returns `game` again a bit redundantly, but this is to retain symmetry with `statuses`)

### What are kill codes?

Kill codes are four random nouns from [this list](https://gist.github.com/fogleman/7b26877050cac235343d) (edited slightly) used to assassinate people

## GET `statuses?all=[true?]`

Gets statuses for all sections (see `status`). With auth,

```ts
Array<{
  game : GameID,
  gameName : String,
  target : String,
  targetName : String,
  code : String
}>
```

If you add `?all=true`, then it'll return this instead:

```ts
{
  statuses : Array<{
    game : GameID,
    gameName : String,
    target : String,
    targetName : String,
    code : String
  }>,
  others : Array<{
    game : GameID,
    gameName : String,
    state: State
  }>
}
```

## POST `kill?game[GAME]&self=[true?]`

With auth, you also need to give:

```ts
{ code : String }
```

The `code` is the target's kill code. Not case sensitive, and all whitespace is removed.

However, if `self` is true, then you don't need to give anything but auth, and it'll mark yourself as dead. This can be used if you're honest and know that your assassin has found you (see [#1](https://github.com/Orbiit/elimination/issues/1)).

When a player is killed, the assassin's code is NOT regenerated.

## POST `shuffle?game[GAME]`

With an ongoing game and auth, it'll do shufflances and ok.

THAT IS, shuffling rearranges the targets for all alive players. Codes are also regenerated.

## GET `stats`

Returns some global stats:

```ts
{ kills : Number, active : Number, games : Number }
```

`games` is the total number of games, and `active` is the number of games running.

## GET `/notifications?from=[0]&limit=[10]`

You need auth. Will return

```ts
{
  notifications : Array<{ type : String, time : Number, read : Boolean, ... }>,
  end : Boolean,
  unread: Number
}
```

`time` is whatever `Date.now()` returns. `read` is whether the notification has been marked read. `end` is whether there aren't any more notifications to go. `unread` is the number of unread notifications.

`limit` is the number of notifications to return per call. Maximum 40.

This is in reverse chronological order! (newest first)

### What notifications?

If the notification relates to a game, there are properties `game` (the ID, for the URL) and `gameName` (the display name). The following are values for the `type` property:

`game-started`: Announces when a game has been started to all players.

`killed`: When `by` (the killer's username) whose name is `name` (killer's display name) has killed you.

`game-ended`: Announces when the game has ended to all players. Has `winner` and `winnerName` which are the remaining alive person's username and display name, respectively.

`kicked`: When the game creator kicks a player. The `reason` is a string that can be empty. This can be sent before or during a game.

`shuffle`: When the targets get shuffled.

## POST `/read`

With auth. Marks all new notifications as read. Returns ok.

## TODO: Figure out how to send emails with Node

With this, I could add:

- Password reset forms

- Email notifications. Requires POST `email-notifs` boolean to keep track of whether they should be sent.
