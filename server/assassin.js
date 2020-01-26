module.exports = (async () => {
  const express = require('express')
  const router = express.Router()

  const assert = require('assert')
  const crypto = require('crypto')
  const { asyncHandler, has } = require('./utils.js')

  const path = require('path')
  const low = require('lowdb')
  const FileAsync = require('lowdb/adapters/FileAsync')

  const [usersDB, sessionsDB, gamesDB] = await Promise.all([
    low(new FileAsync(path.resolve(__dirname, './db-users.json'))),
    low(new FileAsync(path.resolve(__dirname, './db-sessions.json'))),
    low(new FileAsync(path.resolve(__dirname, './db-games.json')), { defaultValue: [] })
  ])
  const [users, sessions, games] = [usersDB, sessionsDB, gamesDB].map(db => db.value())

  function randomID () {
    // I arbitrarily chose 21
    return crypto.randomBytes(21).toString('hex')
  }

  function goodPassword (password) {
    return typeof password === 'string' &&
      password.length >= 8
  }

  function hashPassword (password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, hash) => {
        if (err) {
          reject(err)
        } else {
          resolve(hash.toString('hex'))
        }
      })
    })
  }

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

  function userSettings (user, { name, password, oldPassword, email, bio }, init) {
    if (init || name !== undefined) {
      assert(typeof name === 'string', 'Name not string!')
      assert(name.length > 0, 'Empty name!')
      user.name = name
    }
    if (init || password !== undefined) {
      assert(goodPassword(password), 'Tasteless password!')
      if (!init) {
        // Verify that user knows old password
        const { salt, password: oldHash } = user
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

  function shuffleTargets (game) {
    const players = Object.entries(game.players)
    assert(players.length >= 2, 'Not enough players!')
    for (let i = players.length; i--;) {
      if (i > 0) {
        const targetIndex = Math.floor(Math.random() * i)
        const target = players[targetIndex]
        players[i][1].target = target[0]
        // Swap target with next item so its target gets set etc etc
        players[targetIndex] = players[i - 1]
        players[i - 1] = target
      } else {
        // Last item targets first item
        players[i][1].target = players[players.length - 1][0]
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
    userSettings(users[username], req.body, true)

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
    userSettings(user, req.body, false)
    await usersDB.write()
    res.send({ ok: 'if i remember' })
  }))

  // Authenticated user data (for user options)
  // TODO: Send games and myGames
  router.get('/user-settings', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { name, email, bio } = user.value()
    res.send({ name, email, bio })
  }))

  // Public user data (for profiles)
  router.get('/user', asyncHandler(async (req, res) => {
    const { username } = req.query
    const { name, bio } = users[username]
    res.send({ name, bio })
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

    const gameID = games.indexOf(game)
    user.myGames.push(gameID)

    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ game: gameID })
  }))

  router.post('/game-settings', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game } = getGame(req, user)
    const { name, description, password } = req.body
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
      players: Object.keys(players),
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
      players: Object.keys(players),
      started,
      ended
    })
  }))

  router.post('/join', asyncHandler(async (req, res) => {
    const { user, username } = verifySession(req.get('X-Session-ID'))
    const { game } = getGame(req)
    const { password } = req.body
    assert(!game.started, 'Game already started!')
    // Case insensitive
    assert(password.toLowerCase() === game.password.toLowerCase(), 'Password bad!')
    user.games.push(gameID)
    game.players[username] = { kills: 0, dead: false, code: 'TODO' }
    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ ok: 'with luck' })
  }))

  router.post('/leave', asyncHandler(async (req, res) => {
    const { user, username } = verifySession(req.get('X-Session-ID'))
    const { game } = getGame(req)
    const { user: target } = req.body
    let targetUsername = username
    let targetUser = user
    if (target) {
      // Session user should be owner of the game
      assert(user.myGames.includes(gameID), 'Only owners can kick!')
      targetUsername = target
      targetUser = users[target]
    } else {
      assert(!game.started, 'Game already started!')
    }
    assert(targetUser.games.includes(gameID), 'User is not a player, no need to kick!')
    targetUser.games.splice(targetUser.games.indexOf(gameID), 1)
    delete game.players[targetUsername]
    // TODO: If the game has started, should check to see if they were the penultimate person to end the game
    // Also, redirect targets to account for missing person
    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ ok: 'if i didnt goof' })
  }))

  router.post('/start', asyncHandler(async (req, res) => {
    const { user, username } = verifySession(req.get('X-Session-ID'))
    const { game } = getGame(req, user)
    assert(!game.started, 'Game already started!')
    shuffleTargets(game)
    game.started = true
    await gamesDB.write()
    res.send({ ok: 'if all goes well' })
  }))

  return router
})()
