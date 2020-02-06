# Assassination docs

On the client-side, this is known as Elimination. I changed the name after making the backend. Oops!

**TODO: Notifications. Requires POST `email-notifs` Boolean, GET `notifications`, and POST `read-notifs`. Existing activities should add to notifications. Perhaps notifications should also send emails if enabled.**

**TODO: Global stats**

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
  myGames : Array<{ game : String, name : String, started : Boolean, ended : Boolean }>}
  games : Array<{ game : String, name : String, started : Boolean, ended : Boolean, kills : Number }>
}
```

**TODO: Designs currently also want the number of participants and whether the person is alive or dead.**

## POST `create-game`

Requires authentication. Takes

```ts
{ name : String, description : String, password : String }
```

`description` is optional.

### What's a good game name?

At most a hundred characters. Can't be empty.

### What's a good game description?

At most 2k chars.

### What's a good game password?

Known on the client-side as a passphrase, it's at most 200 characters. It can be empty.

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
  players : Array<{ username : String, name : String, alive : Boolean, kills : Number}>,
  started : Boolean,
  ended : Boolean
}
```

Requires auth.

**TODO: Designs currently want the join time.**

## GET `game?game=[GAME]`

```ts
{
  name : String,
  description : String,
  players : Array<{ username : String, name : String, alive : Boolean, kills : Number}>,
  started : Boolean,
  ended : Boolean
}
```

No auth.

## POST `join?game=[GAME]`

Okays given with auth

```ts
{ password : String }
```

## POST `leave?game=[GAME]`

Used for both kicking and leaving on one's own.

You can give nothing but auth to leave yourself, or give a target

```ts
{ target : String }
```

Returns an ok.

You can't leave while a game is running, but players can still be kicked.

**TODO: Kick reason**

### What happens if my target is kicked?

The kicked person's target becomes your target.

**TODO: This should also reset the code.**

## POST `start?game=[GAME]`

With auth, start the game. Returns an ok. Requires at least 2 players.

## GET `status?game=[GAME]`

While a game is running, with auth, it'll give

```ts
{ target : String, targetName : String, code : String }
```

`target` is a username. `targetName` is their display name. `code` is used for killing (see below).

**TODO: The client needs better way to get statuses for ALL active games at once.**

**TODO: Generate better codes.**

### What are kill codes?

Kill codes are four random nouns from [this list](https://gist.github.com/fogleman/7b26877050cac235343d) used to assassinate people

## POST `kill?game[GAME]`

With auth, you also need to give:

```ts
{ code : String }
```

The `code` is the target's kill code.

## POST `shuffle?game[GAME]`

With an ongoing game and auth, it'll do shufflances and ok.

**TODO: This ought to return the new player list.**
