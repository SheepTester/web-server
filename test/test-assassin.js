/* global fetch */

const HOST = 'http://localhost:3000'

const TEST_ID = Math.random().toString(36).slice(2)

function assert (prom, message) {
  return Promise.resolve(prom)
    .catch(err => {
      console.error('Test failed', err)
      return false
    })
    .then(test => {
      const p = document.createElement('p')
      p.textContent = message
      if (test) {
        p.className = 'pass'
      } else {
        p.className = 'fail'
      }
      document.body.appendChild(p)
      return test || {}
    })
}

function shouldFail (prom) {
  return prom
    .then(content => {
      console.warn('Test didn\'t fail', content)
      return false
    })
    .catch(() => true)
}

function get (path, session) {
  return fetch(HOST + path, {
    headers: {
      'X-Session-ID': session
    }
  })
    .then(r => r.ok
      ? r.json()
      : r.json()
        .then(json => Promise.reject(json)))
}

function post (path, session, body) {
  return fetch(HOST + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': session
    },
    body: JSON.stringify(body)
  })
    .then(r => r.ok
      ? r.json()
      : r.json()
        .then(json => Promise.reject(json)))
}

async function test () {
  // Create users
  const { session } = await assert(post('/assassin/create-user', null, {
    username: `test-${TEST_ID}-a`,
    name: 'Test user A',
    bio: `I am a byproduct of test ${TEST_ID}!`,
    password: 'test password A',
    email: 'a@example.com'
  }), 'Make user A')
  const { session: b } = await assert(post('/assassin/create-user', null, {
    username: `test-${TEST_ID}-b`,
    name: 'Test user B',
    bio: `I am also a byproduct of test ${TEST_ID}!`,
    password: 'test password B',
    email: 'b@example.com'
  }), 'Make user B')

  // Change and get info
  await assert(post('/assassin/user-settings', session, {
    name: 'user A name changed!',
    password: 'new password A',
    oldPassword: 'test password A'
  }), 'Change user A settings')
  await assert(
    get('/assassin/user-settings', session)
      .then(({ name }) => name === 'user A name changed!'),
    'Get user A settings'
  )
  await assert(
    get(`/assassin/user?user=test-${TEST_ID}-a`, null)
      .then(({ name }) => name === 'user A name changed!'),
    'Get user A profile'
  )

  // Log out and log in
  await assert(post('/assassin/logout', session), 'Log out A')
  await assert(shouldFail(post('/assassin/login', null, {
    username: `test-${TEST_ID}-a`,
    password: 'wrong password'
  })), 'Wrong password for A should fail')
  const { session: a } = await assert(post('/assassin/login', null, {
    username: `test-${TEST_ID}-a`,
    password: 'new password A'
  }), 'Log in A')

  // Create game
  const { game } = await assert(post('/assassin/create-game', a, {
    name: `Test game ${TEST_ID}`,
    password: ''
  }), 'Create game')

  // Update and get game settings
  await assert(post(`/assassin/game-settings?game=${game}`, a, {
    description: 'This is an automatically generated test game',
    password: 'test'
  }), 'Change game settings')
  await assert(
    get(`/assassin/game-settings?game=${game}`, a)
      .then(({ password }) => password === 'test'),
    'Get game settings'
  )
  await assert(
    get(`/assassin/game?game=${game}`, null)
      .then(({ description }) => description === 'This is an automatically generated test game'),
    'Get game profile'
  )

  // Join game
  await assert(post(`/assassin/join?game=${game}`, a, {
    password: 'test'
  }), 'A joins game')
  await assert(post(`/assassin/join?game=${game}`, b, {
    password: 'test'
  }), 'B joins game')

  // Kick and leave
  await assert(post(`/assassin/leave?game=${game}`, a), 'A leaves game')
  await assert(post(`/assassin/leave?game=${game}`, b, {
    target: `test-${TEST_ID}-b`
  }), 'A kicks B')

  // Rejoin
  await assert(post(`/assassin/join?game=${game}`, a, {
    password: 'test'
  }), 'A rejoins game')
  await assert(post(`/assassin/join?game=${game}`, b, {
    password: 'test'
  }), 'B rejoins game')

  // Start game
  await assert(post(`/assassin/start?game=${game}`, a), 'Start game')

  // Get status
  await assert(
    get(`/assassin/status?game=${game}`, a)
      .then(({ target }) => target === `test-${TEST_ID}-b`),
    'A gets target (should be B)'
  )
  const { code } = await assert(get(`/assassin/status?game=${game}`, b), 'B gets kill code')

  // Shuffle
  await assert(post(`/assassin/shuffle?game=${game}`, a), 'Shuffle targets')

  // Kill
  await assert(post(`/assassin/kill?game=${game}`, a, { code }), 'A kills B')
  await assert(
    get(`/assassin/game?game=${game}`, null)
      .then(({ ended }) => ended),
    'Game ends'
  )
}

test()
