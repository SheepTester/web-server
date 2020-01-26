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

  const usernameRegex = /^[a-z0-9_-]{3,}$/

  // People can spam-create users
  router.post('/create-user', asyncHandler(async (req, res) => {
    const { username, name, password, email } = req.body
    assert(typeof username === 'string', 'Username not a string!')
    assert(usernameRegex.test(username), 'Tasteless username!')
    assert(!has(users, username), 'Username taken!')
    assert(typeof name === 'string', 'Name not a string!')
    assert(name.length > 0, 'Empty name!')
    assert(goodPassword(password), 'Boring password!')
    assert(typeof email === 'string', 'Email not a string!')
    assert(email.length > 0, 'Empty email!')
    const salt = randomID()
    const hashedPassword = await hashPassword(password, salt)
    users[username] = {
      name,
      password: hashedPassword,
      salt,
      email,
      bio: '',
      games: [],
      myGames: []
    }
    const sessionID = createSession
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
    const { name, password, oldPassword, email, bio } = req.body
    if (name) {
      assert(typeof name === 'string', 'Name not string!')
      assert(name.length > 0, 'Empty name!')
      user.name = name
    }
    if (password) {
      assert(goodPassword(password), 'Poor password sense!')
      // Verify that user knows old password
      const { salt, password: oldHash } = user
      assert(await hashPassword(oldPassword, salt) === oldHash, 'Old password matchn\'t!')
      user.password = await hashPassword(password, salt)
    }
    if (email) {
      assert(typeof email === 'string', 'Email not string!')
      assert(email.length > 0, 'Empty email!')
      user.email = email
    }
    if (bio) {
      assert(typeof bio === 'string', 'Bio not string!')
      user.bio = bio
    }
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
    const { name, description, password } = req.body
    assert(typeof name === 'string', 'Name not string!')
    assert(name.length > 0, 'Empty name!')
    assert(typeof description === 'string', 'Description not string!')
    assert(typeof password === 'string', 'Password not string!')
    const game = {
      name,
      description,
      password,
      players: {},
      started: false,
      ended: false
    }
    games.push(game)
    const gameID = games.indexOf(game)
    user.myGames.push(gameID)
    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ game: gameID })
  }))

  router.post('/game-settings', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game: gameID } = req.query
    const { name, description, password } = req.body
    const game = games[gameID]
    assert(has(games, gameID), 'Nonexistent game!')
    assert(user.myGames.includes(gameID), 'You are not the owner!')
    if (name) {
      assert(typeof name === 'string', 'Name is not string!')
      assert(name.length > 0, 'Empty name!')
      game.name = name
    }
    if (description) {
      assert(typeof description === 'string', 'Description is not string!')
      game.description = description
    }
    if (password) {
      assert(typeof password === 'string', 'Password is not string!')
      game.password = password
    }
    await gamesDB.write()
    res.send({ ok: 'with luck' })
  }))

  router.get('/game-settings', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game: gameID } = req.query
    const game = games[gameID]
    assert(has(games, gameID), 'Nonexistent game!')
    assert(user.myGames.includes(gameID), 'You are not the owner!')
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
    const { game: gameID } = req.query
    const game = games[gameID]
    assert(has(games, gameID), 'Nonexistent game!')
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
    const { game: gameID } = req.query
    const { password } = req.body
    const game = games[gameID]
    // Case insensitive
    assert(password.toLowerCase() === game.password.toLowerCase(), 'Password bad!')
    user.games.push(gameID)
    game.players[username] = { kills: 0, dead: false }
    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ ok: 'with luck' })
  }))

  router.post('/leave', asyncHandler(async (req, res) => {
    const { user, username } = verifySession(req.get('X-Session-ID'))
    const { game: gameID } = req.query
    const { user: target } = req.body
    const game = games[gameID]
    assert(has(games, gameID), 'Nonexistent game!')
    let targetUsername = username
    let targetUser = user
    if (target) {
      // Session user should be owner of the game
      assert(user.myGames.includes(gameID), 'Only owners can kick!')
      targetUsername = target
      targetUser = users[target]
    }
    assert(targetUser.games.includes(gameID), 'User is not a player, no need to kick!')
    targetUser.games.splice(targetUser.games.indexOf(gameID), 1)
    delete game.players[targetUsername]
    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ ok: 'if i didnt goof' })
  }))

  return router
})()
