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
    return users.then(db => db.get(session.user))
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
  assert(name.length)
  assert(goodPassword(password))
  assert(typeof email === 'string')
  assert(email.length)
  const salt = randomID()
  const hashedPassword = await hashPassword(password, salt)
  const [, sessionID] = await Promise.all([
    users.then(db => db
      .set(username, {
        name,
        password: hashedPassword,
        salt,
        email,
        bio: '',
        games: [],
        myGames: []
      })
      .write()),
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

router.post('/set', asyncHandler(async (req, res) => {
  const user = await verifySession(req.get('X-Session-ID'))
  const { name, password, oldPassword, email, bio } = req.body
  if (name) {
    assert(typeof name === 'string')
    assert(name.length)
    user.set('name', name)
  }
  if (password) {
    assert(goodPassword(password))
    // Verify that user knows old password
    const { salt, password: oldHash } = user.value()
    assert(await hashPassword(oldPassword, salt) === oldHash)
    user.set('password', hashPassword(password, salt))
  }
  if (email) {
    assert(typeof email === 'string')
    assert(email.length)
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
router.get('/get', asyncHandler(async (req, res) => {
  const user = await verifySession(req.get('X-Session-ID'))
  const { name, email, bio } = user.value()
  res.send({ name, email, bio })
}))

// Public user data (for profiles)
router.get('/get-user', asyncHandler(async (req, res) => {
  const { username } = req.query
  const { name, bio } = await users.then(db => db.get(username).value())
  res.send({ name, bio })
}))

module.exports = router
