const express = require('express')
const router = express.Router()

const assert = require('assert')
const crypto = require('crypto')
const { asyncHandler } = require('./utils.js')

const path = require('path')
const low = require('lowdb')
const FileAsync = require('lowdb/adapters/FileAsync')

const users = low(new FileAsync(path.resolve(__dirname, './db-users.json')))
const sessions = low(new FileAsync(path.resolve(__dirname, './db-sessions.json')))
const games = low(new FileAsync(path.resolve(__dirname, './db-games.json')))

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
  return sessions
    .then(db => db
      .set(sessionID, { user, end: Date.now() + SESSION_LENGTH })
      .write())
    .then(() => sessionID)
}

function verifySession (sessionID) {
  return sessions.then(db => {
    const session = db.get(sessionID).value()
    if (!session) throw new Error('Fake session!')
    if (Date.now() > session.end) {
      return db.unset(sessionID).write()
        .then(() => Promise.reject(new Error('Session expired!')))
    }
    return users.then(db => ({
      user: db.get(session.user),
      username: session.user
    }))
  })
}

const usernameRegex = /^[\w-]{3,}$/

// People can spam-create users
router.post('/join', asyncHandler(async (req, res) => {
  const usersDB = await users
  const { username, name, password, email } = req.body
  assert(typeof username === 'string')
  assert(usernameRegex.test(username))
  assert(!usersDB.has(username).value())
  assert(typeof name === 'string')
  assert(name.length > 0)
  assert(goodPassword(password))
  assert(typeof email === 'string')
  assert(email.length > 0)
  const salt = randomID()
  const hashedPassword = await hashPassword(password, salt)
  const [, sessionID] = await Promise.all([
    usersDB
      .set(username, {
        name,
        password: hashedPassword,
        salt,
        email,
        bio: '',
        games: [],
        myGames: []
      })
      .write(),
    createSession(username)
  ])
  res.send({ session: sessionID })
}))

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body
  const user = await users.then(db => db.get(username).value())
  assert(user)
  assert(await hashPassword(password, user.salt) === user.password)
  res.send({ session: await createSession(username), username })
}))

router.post('/logout', asyncHandler(async (req, res) => {
  await sessions.then(db => db.unset(req.get('X-Session-ID')).write())
  res.send({ ok: 'ideally' })
}))

router.post('/user-settings', asyncHandler(async (req, res) => {
  const { user } = await verifySession(req.get('X-Session-ID'))
  const { name, password, oldPassword, email, bio } = req.body
  if (name) {
    assert(typeof name === 'string')
    assert(name.length > 0)
    user.set('name', name)
  }
  if (password) {
    assert(goodPassword(password))
    // Verify that user knows old password
    const { salt, password: oldHash } = user.value()
    assert(await hashPassword(oldPassword, salt) === oldHash)
    user.set('password', await hashPassword(password, salt))
  }
  if (email) {
    assert(typeof email === 'string')
    assert(email.length > 0)
    user.set('email', email)
  }
  if (bio) {
    assert(typeof bio === 'string')
    user.set('bio', bio)
  }
  await user.write()
  res.send({ ok: 'if i remember' })
}))

// Authenticated user data (for user options)
// TODO: Send games and myGames
router.get('/user-settings', asyncHandler(async (req, res) => {
  const { user } = await verifySession(req.get('X-Session-ID'))
  const { name, email, bio } = user.value()
  res.send({ name, email, bio })
}))

// Public user data (for profiles)
router.get('/user', asyncHandler(async (req, res) => {
  const { username } = req.query
  const { name, bio } = await users.then(db => db.get(username).value())
  res.send({ name, bio })
}))

router.post('/create-game', asyncHandler(async (req, res) => {
  const { user } = await verifySession(req.get('X-Session-ID'))
  const { name, description, password } = req.body
  assert(typeof name === 'string')
  assert(name.length > 0)
  assert(typeof description === 'string')
  assert(typeof password === 'string')
  const gamesDB = await games
  const gameID = gamesDB.keys().size().value().toString()
  assert(!gamesDB.has(gameID).value())
  await Promise.all([
    user.get('myGames').push(gameID).write(),
    gamesDB.set(gameID, {
      name,
      description,
      password,
      players: {},
      started: false,
      ended: false
    }).write()
  ])
  res.send({ game: gameID })
}))

router.post('/game-settings', asyncHandler(async (req, res) => {
  const { user } = await verifySession(req.get('X-Session-ID'))
  const { game: gameID } = req.query
  const { name, description, password } = req.body
  const game = await gamesDB.then(db => db.get(gameID))
  if (name) {
    assert(typeof name === 'string')
    assert(name.length > 0)
    game.set('name', name)
  }
  if (description) {
    assert(typeof description === 'string')
    game.set('description', description)
  }
  if (password) {
    assert(typeof password === 'string')
    game.set('password', password)
  }
  await game.write()
  res.send({ ok: 'with luck' })
}))

router.get('/game-settings', asyncHandler(async (req, res) => {
  const { user } = await verifySession(req.get('X-Session-ID'))
  const { game: gameID } = req.query
  const game = await gamesDB.then(db => db.get(gameID).value())
  assert(game)
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
  const game = await gamesDB.then(db => db.get(gameID).value())
  assert(game)
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
  const { user, username } = await verifySession(req.get('X-Session-ID'))
  const { game: gameID } = req.query
  const { password } = req.body
  const game = await gamesDB.then(db => db.get(gameID))
  // Case insensitive
  assert(game.get('password').toLower().isEqual(password.toLowerCase()).value())
  await Promise.all([
    user.get('games').push(game).write(),
    game.get('players').set(username, {
      kills: 0,
      dead: false
    }).write()
  ])
  res.send({ ok: 'with luck' })
}))

router.post('/leave', asyncHandler(async (req, res) => {
  const { user, username } = await verifySession(req.get('X-Session-ID'))
  const { game: gameID } = req.query
  const { user: target } = req.body
  const game = await gamesDB.then(db => db.get(gameID))
  let targetUser = user
  let targetUsername = username
  if (target) {
    // Session user should be owner of the game
    assert(user.get('myGames').has(gameID))
    targetUser = usersDB.then(db => db.get(target))
    targetUsername = target
  }
  await Promise.all([
    targetUser.get('games').pull(gameID).write(),
    game.get('players').unset(targetUsername).write()
  ])
  res.send({ ok: 'if i didnt goof' })
}))

module.exports = router
