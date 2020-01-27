const express = require('express')
const router = express.Router()
module.exports = router

const assert = require('assert')
const { asyncHandler, has, randomID, hashPassword } = require('./utils.js')

const path = require('path')
const low = require('lowdb')
const FileAsync = require('lowdb/adapters/FileAsync')

function goodPassword (password) {
  return typeof password === 'string' &&
    password.length >= 8
}

Promise.all([
  low(new FileAsync(path.resolve(__dirname, './db-users.json'))),
  low(new FileAsync(path.resolve(__dirname, './db-sessions.json'))),
  low(new FileAsync(path.resolve(__dirname, './db-games.json'), { defaultValue: [] }))
]).then(async ([usersDB, sessionsDB, gamesDB]) => {
  const [users, sessions, games] = [usersDB, sessionsDB, gamesDB].map(db => db.value())

  const SESSION_LENGTH = 21 * 86400 * 1000 // 21 days
  function createSession (user) {
    const sessionID = randomID()
    sessions[sessionID] = { user, end: Date.now() + SESSION_LENGTH }
    return sessionID
  }

  function verifySession (sessionID) {
    const session = sessions[sessionID]
    assert(has(sessions, sessionID), 'Session doesn\'t exist!')
    if (Date.now() > session.end) {
      delete sessions[sessionID]
      // Don't write to database because:
      // 1. It's not really that important here
      // 2. This function doesn't return a promise so nothing can then/catch on it.
      // Something else'll save it later.
      throw new Error('Session expired!')
    }
    assert(has(users, session.user), 'Nonexistent user...?')
    return {
      user: users[session.user],
      username: session.user
    }
  }

  function getGame (req, authUser) {
    const { game: gameID } = req.query
    const game = games[gameID]
    assert(has(games, gameID), 'Nonexistent game!')
    if (authUser) {
      assert(authUser.myGames.includes(gameID), 'Not creator of game!')
    }
    return { game, gameID }
  }

  const usernameRegex = /^[a-z0-9_-]{3,}$/

  async function userSettings (user, { name, password, oldPassword, email, bio }, init) {
    if (init || name !== undefined) {
      assert(typeof name === 'string', 'Name not string!')
      assert(name.length > 0, 'Empty name!')
      user.name = name
    }
    if (init || password !== undefined) {
      assert(goodPassword(password), 'Tasteless password!')
      const { salt, password: oldHash } = user
      if (!init) {
        // Verify that user knows old password
        assert(await hashPassword(oldPassword, salt) === oldHash, 'Old password matchn\'t!')
      }
      user.password = await hashPassword(password, salt)
    }
    if (init || email !== undefined) {
      assert(typeof email === 'string', 'Email not string!')
      assert(email.length > 0, 'Empty email!')
      user.email = email
    }
    if (bio !== undefined) {
      assert(typeof bio === 'string', 'Bio not string!')
      user.bio = bio
    }
  }

  function gameSettings (game, { name, description, password }, init) {
    if (init || name !== undefined) {
      assert(typeof name === 'string', 'Name is not string!')
      assert(name.length > 0, 'Empty name!')
      game.name = name
    }
    if (description) {
      assert(typeof description === 'string', 'Description is not string!')
      game.description = description
    }
    if (init || password !== undefined) {
      assert(typeof password === 'string', 'Password is not string!')
      game.password = password
    }
  }

  function shuffleTargets (players) {
    for (let i = players.length; i--;) {
      if (i > 0) {
        const targetIndex = Math.floor(Math.random() * i)
        const target = players[targetIndex]
        players[i][1].target = target[0]
        target[1].assassin = players[i][0]
        // Swap target with next item so its target gets set etc etc
        players[targetIndex] = players[i - 1]
        players[i - 1] = target
      } else {
        // Last item targets first item
        players[i][1].target = players[players.length - 1][0]
        players[players.length - 1][1].assassin = players[i][0]
      }
    }
  }

  // People can spam-create users
  router.post('/create-user', asyncHandler(async (req, res) => {
    const { username } = req.body
    assert(typeof username === 'string', 'Username not a string!')
    assert(usernameRegex.test(username), 'Boring username!')
    assert(!has(users, username), 'Username taken!')

    const salt = randomID()
    users[username] = {
      salt,
      bio: '',
      games: [],
      myGames: []
    }
    await userSettings(users[username], req.body, true)

    const sessionID = createSession(username)

    await Promise.all([usersDB.write(), sessionsDB.write()])
    res.send({ session: sessionID })
  }))

  router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body
    const user = users[username]
    assert(has(users, username), 'Nonexistent user!')
    assert(await hashPassword(password, user.salt) === user.password, 'Password too creative!')
    const session = createSession(username)
    await sessionsDB.write()
    res.send({ session, username })
  }))

  router.post('/logout', asyncHandler(async (req, res) => {
    delete sessions[req.get('X-Session-ID')]
    await sessionsDB.write()
    res.send({ ok: 'ideally' })
  }))

  router.post('/user-settings', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    await userSettings(user, req.body, false)
    await usersDB.write()
    res.send({ ok: 'if i remember' })
  }))

  // Authenticated user data (for user options)
  // TODO: Send games and myGames
  router.get('/user-settings', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { name, email, bio } = user
    res.send({ name, email, bio })
  }))

  // Public user data (for profiles)
  router.get('/user', asyncHandler(async (req, res) => {
    const { user: username } = req.query
    assert(has(users, username), 'User doesn\'t exist!')
    const { name, bio, myGames, games } = users[username]
    res.send({
      name,
      bio,
      myGames: myGames.map(game => ({
        game,
        name: games[game].name,
        started: games[game].started,
        ended: games[game].ended
      })),
      games: games.map(game => ({
        game,
        name: games[game].name,
        started: games[game].started,
        ended: games[game].ended,
        kills: games[game].players[username].kills
      }))
    })
  }))

  router.post('/create-game', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))

    const game = {
      description: '',
      players: {},
      started: false,
      ended: false
    }
    gameSettings(game, req.body, true)
    games.push(game)

    const gameID = games.indexOf(game).toString()
    user.myGames.push(gameID)

    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ game: gameID })
  }))

  router.post('/game-settings', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game } = getGame(req, user)
    gameSettings(game, req.body, false)
    await gamesDB.write()
    res.send({ ok: 'with luck' })
  }))

  router.get('/game-settings', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game } = getGame(req, user)
    const { name, description, password, players, started, ended } = game
    res.send({
      name,
      description,
      password,
      // Should targets and kill codes be available to the game creator?
      players: Object.entries(players)
        .map(([username, { target, kills }]) => ({
          username,
          name: users[username].name,
          alive: !!target,
          kills
        })),
      started,
      ended
    })
  }))

  router.get('/game', asyncHandler(async (req, res) => {
    const { game } = getGame(req)
    const { name, description, players, started, ended } = game
    res.send({
      name,
      description,
      players: Object.entries(players)
        .map(([username, { target, kills }]) => ({
          username,
          name: users[username].name,
          alive: !!target,
          kills
        })),
      started,
      ended
    })
  }))

  router.post('/join', asyncHandler(async (req, res) => {
    const { user, username } = verifySession(req.get('X-Session-ID'))
    const { game, gameID } = getGame(req)
    const { password } = req.body
    assert(!game.started, 'Game already started!')
    // Case insensitive
    assert(password.toLowerCase() === game.password.toLowerCase(), 'Password bad!')
    user.games.push(gameID)
    game.players[username] = { kills: 0, code: 'TODO' }
    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ ok: 'with luck' })
  }))

  router.post('/leave', asyncHandler(async (req, res) => {
    const { user, username } = verifySession(req.get('X-Session-ID'))
    const { game, gameID } = getGame(req)
    const { user: target } = req.body
    let targetUsername = username
    let targetUser = user
    if (target) {
      // Session user should be owner of the game
      assert(user.myGames.includes(gameID), 'Only owners can kick!')
      assert(!game.ended, 'Game has ended!')
      assert(has(users, target), 'Target doesn\'t exist!')
      targetUsername = target
      targetUser = users[target]
    } else {
      assert(!game.started, 'Game already started!')
    }
    assert(targetUser.games.includes(gameID), 'User is not a player, no need to kick!')

    if (game.started) {
      const targetPlayer = game.players[targetUsername]
      // Redirect target
      game.players[targetPlayer.assassin].target = targetPlayer.target
      game.players[targetPlayer.target].assassin = targetPlayer.assassin
      game.alive--
      if (game.alive === 1) {
        game.ended = true
      }
    }
    targetUser.games.splice(targetUser.games.indexOf(gameID), 1)
    delete game.players[targetUsername]

    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ ok: 'if i didnt goof' })
  }))

  router.post('/start', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game } = getGame(req, user)
    assert(!game.started, 'Game already started!')

    const players = Object.entries(game.players)
    assert(players.length >= 2, 'Not enough players!')
    shuffleTargets(players)
    game.alive = players.length
    game.started = true

    await gamesDB.write()
    res.send({ ok: 'if all goes well' })
  }))

  router.get('/status', asyncHandler(async (req, res) => {
    const { username } = verifySession(req.get('X-Session-ID'))
    const { game } = getGame(req)
    assert(game.started, 'Game hasn\'t started!')
    assert(!game.ended, 'Game has ended!')
    assert(has(game.players, username), 'Not a player!')

    const { target, code } = game.players[username]
    res.send({
      target,
      targetName: users[target].name,
      code
    })
  }))

  router.post('/kill', asyncHandler(async (req, res) => {
    const { username } = verifySession(req.get('X-Session-ID'))
    const { game } = getGame(req)
    assert(game.started, 'Game hasn\'t started!')
    assert(!game.ended, 'Game has ended!')
    assert(has(game.players, username), 'Not a player!')

    const player = game.players[username]
    assert(player.target, 'Player was killed!')
    const target = game.players[player.target]

    const { code } = req.body
    assert(code === target.code, 'Wrong code!')

    player.kills++
    player.target = target.target
    game.players[target.target].assassin = username
    player.code = 'TODO' // Regenerate code

    delete target.target
    game.alive--

    if (game.alive === 1) {
      game.ended = true
    }

    await gamesDB.write()
    res.send({ ok: 'safely' })
  }))

  router.post('/shuffle', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game } = getGame(req, user)
    assert(game.started, 'Game hasn\'t started!')
    assert(!game.ended, 'Game ended!')

    shuffleTargets(Object.entries(game.players).filter(player => player.target))

    await gamesDB.write()
    res.send({ ok: 'probably' })
  }))
})
