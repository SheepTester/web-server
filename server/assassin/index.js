const express = require('express')
const router = express.Router()
module.exports = router

const assert = require('assert')
const { asyncHandler, has, randomID, hashPassword } = require('../utils.js')

const path = require('path')
const low = require('lowdb')
const FileAsync = require('lowdb/adapters/FileAsync')

function goodPassword (password) {
  return typeof password === 'string' &&
    password.length >= 1 &&
    password.length <= 200
}

Promise.all([
  require('./random-id.js'),
  // vN is for when I want to invalidate the current database format during
  // development and restart the existing data. This method should NOT be used
  // during production lol.
  low(new FileAsync(path.resolve(__dirname, './db-users-v4.json'))),
  low(new FileAsync(path.resolve(__dirname, './db-sessions-v4.json'))),
  low(new FileAsync(path.resolve(__dirname, './db-games-v4.json'))),
  low(new FileAsync(path.resolve(__dirname, './db-notifications-v4.json'))),
  low(new FileAsync(path.resolve(__dirname, './db-global-v4.json'), {
    defaultValue: {
      kills: 0,
      active: 0
    }
  }))
]).then(async ([randomWords, ...databases]) => {
  const [
    usersDB,
    sessionsDB,
    gamesDB,
    notificationsDB,
    globalStatsDB
  ] = databases
  const [
    users,
    sessions,
    games,
    notifications,
    globalStats
  ] = databases.map(db => db.value())

  // Autocreate the admin account with username "a" and password "temporary admin password"
  // The admin should quickly change the password to something else.
  if (!users.a) {
    users.a = {
      salt: "37da8bb2c7eafc8e644133a938873973afdd0664a2",
      bio: "",
      games: [],
      myGames: [],
      emailNotifs: false,
      lastEdited: 1582853269298,
      name: "",
      password: "0becf0400e82a4b09360f3c707a89e183c055b31a46972ab47f265388147c759b9a99e4f9d01c132307365a99f27c0a34caf8a614c6f7f466b5dd53da988c2c9",
      email: "",
      isAdmin: true
    }
    notifications.a = []
  }

  // Maximum time between shuffles where shuffle notifications will merge
  const MAX_SHUFFLE_NOTIF_TIME = 30 * 60 * 1000 // Half an hour

  function randomCode () {
    return randomWords(3).join(' ')
  }

  const SESSION_LENGTH = 21 * 86400 * 1000 // 21 days
  function createSession (user) {
    const sessionID = randomID()
    sessions[sessionID] = { user, end: Date.now() + SESSION_LENGTH }
    return sessionID
  }

  function verifySession (sessionID) {
    const session = sessions[sessionID]
    assert(has(sessions, sessionID), 'You\'re not signed in. (Invalid session)')
    if (Date.now() > session.end) {
      delete sessions[sessionID]
      // Don't write to database because:
      // 1. It's not really that important here
      // 2. This function doesn't return a promise so nothing can then/catch on it.
      // Something else'll save it later.
      throw new Error('Your session has expired. (Invalid session)')
    }
    assert(has(users, session.user), 'Nonexistent user...? (Invalid session)')
    return {
      user: users[session.user],
      username: session.user
    }
  }

  function getGameFrom (req, authUser) {
    const { game: gameID } = req.query
    assert(has(games, gameID), 'This game does not exist.')
    const game = games[gameID]
    if (authUser && !authUser.isAdmin) {
      assert(authUser.myGames.includes(gameID), 'You are not the creator of this game.')
    }
    return { game, gameID }
  }

  const usernameRegex = /^[a-z0-9_-]{3,20}$/

  async function userSettings (user, { name, password, oldPassword, email, bio }, init) {
    user.lastEdited = Date.now()
    if (init || name !== undefined) {
      assert(typeof name === 'string', 'Name not string!')
      name = name.trim()
      assert(name.length > 0, 'Empty name!')
      assert(name.length <= 50, 'Name too long! (Sorry if your name is actually this long; this is to prevent abuse. I hope you\'ll understand.)')
      user.name = name
    }
    if (init || password !== undefined) {
      assert(goodPassword(password), 'Tasteless password!')
      const { salt, password: oldHash } = user
      if (!init) {
        // Verify that user knows old password
        assert(await hashPassword(oldPassword, salt) === oldHash, 'The old password is incorrect.')
      }
      user.password = await hashPassword(password, salt)
    }
    if (init || email !== undefined) {
      assert(typeof email === 'string', 'Email not string!')
      assert(email.length > 0, 'Empty email!')
      assert(email.length <= 320, 'Email too long!')
      user.email = email
    }
    if (bio !== undefined) {
      assert(typeof bio === 'string', 'Bio not string!')
      assert(bio.length <= 2000, 'Bio too long!')
      user.bio = bio
    }
  }

  function gameSettings (game, { name, description, password, joinDisabled }, init) {
    game.lastEdited = Date.now()
    if (init || name !== undefined) {
      assert(typeof name === 'string', 'Name is not string!')
      name = name.trim()
      assert(name.length > 0, 'Empty name!')
      assert(name.length <= 100, 'Name too long!')
      game.name = name
    }
    if (description !== undefined) {
      assert(typeof description === 'string', 'Description is not string!')
      assert(description.length <= 2000, 'Description too long!')
      game.description = description
    }
    if (password !== undefined) {
      assert(typeof password === 'string', 'Passphrase is not string!')
      assert(password.length <= 200, 'Passphrase too long!')
      game.password = password
    }
    if (joinDisabled !== undefined) {
      assert(typeof joinDisabled === 'boolean', 'joinDisabled is not boolean!')
      game.joinDisabled = joinDisabled
    }
  }

  // "Safe" getters; in loops it shouldn't throw an error if one person doesn't
  // exist for some reason, so this is a placeholder.

  const emptyUser = {
    salt: '',
    bio: 'This user does not exist.',
    games: [],
    myGames: [],
    emailNotifs: 0,
    lastEdited: 0,
    name: 'Nonexistent user',
    password: '',
    email: ''
  }
  function getUser (username) {
    return has(users, username) ? users[username] : emptyUser
  }

  const emptyGame = {
    creator: '',
    password: '',
    description: 'This game does not exist.',
    players: {},
    started: false,
    ended: false,
    lastEdited: 0,
    name: 'Nonexistent game'
  }
  function getGame (gameID) {
    return has(games, gameID) ? games[gameID] : emptyGame
  }

  const emptyPlayer = {
    kills: 0,
    code: '',
    joined: 0,
    assassin: '',
    killed: 0
  }
  function getPlayer (game, username) {
    return has(game.players, username) ? game.players[username] : emptyPlayer
  }

  function shuffleTargets (players) {
    for (let i = players.length; i--;) {
      players[i][1].code = randomCode() // (Re)Generate code
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

  function oneDied (gameID, game) {
    game.alive--
    if (game.alive === 1) {
      globalStats.active--
      game.ended = Date.now()
      const winner = Object.keys(game.players).find(player => getPlayer(game, player).target)
      game.winner = winner
      sendNotifToGame(gameID, {
        type: 'game-ended',
        winner,
        time: Date.now()
      }, true)
    }
  }

  function sendNotif (user, notification) {
    if (!notifications[user]) notifications[user] = []
    notifications[user].splice(0, 0, notification)
  }

  function sendNotifToGame (gameID, notification, includeDead) {
    const game = getGame(gameID)
    if (!game.notifications) {
      game.notifications = { _id: 0 }
    }
    const id = game.notifications._id++
    game.notifications[id] = notification
    for (const [player, { target }] of Object.entries(game.players)) {
      if (includeDead || target) {
        // Create a new reference per player; otherwise marking a notification
        // as read will mark as read for everyone
        sendNotif(player, { game: gameID, id })
      }
    }
  }

  function extendNotif ({ read = false, ...notifObj }) {
    const game = notifObj.game
    if (notifObj.id !== undefined) {
      const gameNotifs = getGame(notifObj.game).notifications || {}
      notifObj = gameNotifs[notifObj.id] || {}
    }
    // Shallow clone object
    const notification = {
      type: '',
      time: 0,
      read,
      ...notifObj
    }
    if (game) {
      // This is a lazy way of adding the `game` property since notifications
      // from game references do not have a game attribute themselves
      notification.game = game
      notification.gameName = getGame(game).name
    }
    switch (notification.type) {
      case 'kicked-new-target':
      case 'game-started':
      case 'shuffle':
        notification.targetName = getUser(notification.target).name
        break
      case 'killed-self':
        notification.name = getUser(notification.user).name
        break
      case 'killed':
        notification.name = getUser(notification.by).name
        break
      case 'game-ended':
        notification.winnerName = getUser(notification.winner).name
        break
    }
    return notification
  }

  // People can spam-create users
  router.post('/create-user', asyncHandler(async (req, res) => {
    const { username } = req.body
    assert(typeof username === 'string', 'Username not a string!')
    assert(usernameRegex.test(username), 'Boring username!')
    // Using traditional property get here so that things like "__proto__"
    // automatically exist and won't goof up everything.
    assert(!users[username], 'This username has already been taken.')

    const salt = randomID()
    const user = {
      salt,
      bio: '',
      games: [],
      myGames: [],
      emailNotifs: false
    }
    await userSettings(user, req.body, true)
    users[username] = user
    notifications[username] = []

    const sessionID = createSession(username)

    await Promise.all([usersDB.write(), sessionsDB.write(), notificationsDB.write()])
    res.send({ session: sessionID })
  }))

  router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body
    assert(has(users, username), 'Such a user does not exist. Maybe you misspelled your username?')
    const user = users[username]
    assert(await hashPassword(password, user.salt) === user.password, 'The password given is incorrect.')
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
  router.get('/user-settings', (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { name, email, bio } = user
    res.send({ name, email, bio })
  })

  // Public user data (for profiles)
  router.get('/user', (req, res) => {
    const { user: username } = req.query
    assert(has(users, username), 'This user does not exist.')
    const { name, bio, myGames, games: joinedGames } = users[username]
    res.send({
      name,
      bio,
      myGames: myGames.map(gameID => {
        const game = getGame(gameID)
        return {
          game: gameID,
          name: game.name,
          state: game.started ? (game.ended ? 'ended' : 'started') : 'starting',
          time: game.started ? game.ended || game.started : game.created,
          players: Object.keys(game.players).length
        }
      }),
      games: joinedGames.map(gameID => {
        const game = getGame(gameID)
        return {
          game: gameID,
          name: game.name,
          state: game.started ? (game.ended ? 'ended' : 'started') : 'starting',
          players: Object.keys(game.players).length,
          kills: getPlayer(game, username).kills,
          alive: !getPlayer(game, username).killed,
          // `updated` is kind of like the last updated time for a game in the
          // context of this user. Before a game starts, it gives the creation
          // time. After the game starts, it gives the player's death. If the
          // player hasn't died yet, it'll give the end time of the game, but
          // if the game hasn't ended yet, then it'll give the start time.
          updated: game.started
            ? (getPlayer(game, username).killed ||
              game.ended ||
              game.started)
            : game.created
        }
      })
    })
  })

  router.post('/create-game', asyncHandler(async (req, res) => {
    const { user, username } = verifySession(req.get('X-Session-ID'))

    let gameID
    do {
      gameID = Math.floor(Math.random() * 0x100000).toString(16).padStart(5, '0')
    } while (games[gameID])
    const game = {
      creator: username,
      password: '',
      description: '',
      players: {},
      started: false,
      ended: false,
      created: Date.now()
    }
    gameSettings(game, req.body, true)
    games[gameID] = game
    user.myGames.push(gameID)

    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ game: gameID })
  }))

  router.post('/delete-game', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { gameID, game } = getGameFrom(req, user)
    assert(Object.keys(game.players).length === 0, 'Cannot have anyone in the game!')
    assert(!game.started, 'Game already started! Oh well.')
    delete games[gameID]
    user.myGames = user.myGames.filter(game => game !== gameID)
    await [usersDB.write(), gamesDB.write()]
    res.send({ ok: 'memorably' })
  }))

  router.post('/game-settings', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game } = getGameFrom(req, user)
    gameSettings(game, req.body, false)
    await gamesDB.write()
    res.send({ ok: 'with luck' })
  }))

  router.get('/game-settings', (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game } = getGameFrom(req, user)
    const {
      name,
      description,
      password,
      joinDisabled = false,
      players,
      started,
      ended
    } = game
    res.send({
      name,
      description,
      password,
      joinDisabled,
      // Should targets and kill codes be available to the game creator?
      players: Object.entries(players)
        .map(([username, { kills, joined, killed }]) => ({
          username,
          name: getUser(username).name,
          alive: !killed,
          kills,
          joined
        })),
      state: started ? (ended ? 'ended' : 'started') : 'starting'
    })
  })

  router.get('/game', (req, res) => {
    const { game } = getGameFrom(req)
    const {
      creator,
      name,
      description,
      players,
      joinDisabled = false,
      started,
      ended,
      created
    } = game
    res.send({
      creator,
      creatorName: getUser(creator).name,
      name,
      description,
      joinDisabled,
      players: Object.entries(players)
        .map(([username, { kills, killed, assassin, joined }]) => ({
          username,
          name: getUser(username).name,
          alive: !killed,
          killTime: killed || null,
          killer: killed ? assassin : null,
          killerName: killed ? getUser(assassin).name : null,
          kills,
          joined
        })),
      state: started ? (ended ? 'ended' : 'started') : 'starting',
      time: started ? ended || started : created
    })
  })

  router.get('/games', (req, res) => {
    const { query, regex: useRegex = false, strict = false } = req.query
    let filter = () => true
    if (typeof query === 'string') {
      if (useRegex !== false) {
        const regex = new RegExp(query, typeof useRegex === 'string' ? useRegex : '')
        filter = ([, { name }]) => regex.test(name)
      } else {
        if (strict) {
          filter = ([, { name }]) => name.includes(query)
        } else {
          const simplifiedQuery = query.toLowerCase().trim()
          filter = ([, { name }]) => name.toLowerCase().includes(simplifiedQuery)
        }
      }
    }
    res.send(Object.entries(games)
      .filter(filter)
      .map(([gameID, { name }]) => ({
        game: gameID,
        name
      })))
  })

  router.get('/names', (req, res) => {
    const { games: gameList, users: userList, defaultGame, defaultUser } = req.query
    res.send({
      games: !gameList ? [] : gameList.split(',').map(gameID =>
        has(games, gameID) ? games[gameID].name : defaultGame === undefined ? gameID : defaultGame),
      users: !userList ? [] : userList.split(',').map(username =>
        has(users, username) ? users[username].name : defaultUser === undefined ? username : defaultUser)
    })
  })

  router.post('/join', asyncHandler(async (req, res) => {
    const { user, username } = verifySession(req.get('X-Session-ID'))
    const { game, gameID } = getGameFrom(req)
    const { password } = req.body
    assert(!game.joinDisabled, 'Joining has been disabled!')
    assert(!game.started, 'Game already started!')
    assert(!user.games.includes(gameID) && !game.players[username], 'User already in game!')
    // Case insensitive
    assert(password.toLowerCase().trim() === game.password.toLowerCase().trim(), 'Password bad!')
    user.games.push(gameID)
    game.players[username] = { kills: 0, joined: Date.now() }
    await Promise.all([usersDB.write(), gamesDB.write()])
    res.send({ name: user.name })
  }))

  router.post('/leave', asyncHandler(async (req, res) => {
    const { user, username } = verifySession(req.get('X-Session-ID'))
    const { game, gameID } = getGameFrom(req)
    const { user: target, reason = '' } = req.body
    let targetUsername = username
    let targetUser = user
    if (target) {
      // Session user should be owner of the game
      assert(user.myGames.includes(gameID), 'Only owners can kick!')
      assert(!game.ended, 'Game has ended!')
      assert(has(users, target), 'Target doesn\'t exist!')
      targetUsername = target
      targetUser = users[target]
      sendNotif(targetUsername, {
        type: 'kicked',
        game: gameID,
        reason,
        time: Date.now()
      })
    } else {
      assert(!game.started, 'Game already started!')
    }
    assert(has(game.players, targetUsername), 'User is not a player, no need to kick!')

    if (game.started) {
      const targetPlayer = game.players[targetUsername]
      // Redirect target
      // idk what the best thing to do is if for some reason these players don't exist
      getPlayer(game, targetPlayer.assassin).target = targetPlayer.target
      getPlayer(game, targetPlayer.target).assassin = targetPlayer.assassin
      // I don't think it's necessary to regenerate the assassin's code.
      oneDied(gameID, game)
      sendNotif(targetPlayer.assassin, {
        type: 'kicked-new-target',
        game: gameID,
        target: targetPlayer.target,
        time: Date.now()
      })
    }
    targetUser.games = targetUser.games.filter(game => game !== gameID)
    delete game.players[targetUsername]

    await Promise.all([usersDB.write(), gamesDB.write(), globalStatsDB.write(), notificationsDB.write()])
    res.send({ ok: 'if i didnt goof' })
  }))

  router.post('/start', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game, gameID } = getGameFrom(req, user)
    assert(!game.started, 'Game already started!')

    const players = Object.entries(game.players)
    assert(players.length >= 2, 'Not enough players!')
    shuffleTargets(players)
    game.alive = players.length
    game.started = Date.now()
    globalStats.active++
    const now = Date.now()
    for (const [player, { target }] of Object.entries(game.players)) {
      sendNotif(player, {
        type: 'game-started',
        game: gameID,
        target,
        time: now
      })
    }

    await Promise.all([gamesDB.write(), globalStatsDB.write(), notificationsDB.write()])
    res.send({ ok: 'if all goes well' })
  }))

  router.get('/status', (req, res) => {
    const { username } = verifySession(req.get('X-Session-ID'))
    const { gameID, game } = getGameFrom(req)
    assert(game.started, 'Game hasn\'t started!')
    assert(!game.ended, 'Game has ended!')
    assert(has(game.players, username), 'Not a player!')

    const { target, code } = game.players[username]
    assert(target, 'You have already been eliminated.')
    res.send({
      game: gameID,
      gameName: game.name,
      target,
      targetName: getUser(target).name,
      code
    })
  })

  router.get('/statuses', (req, res) => {
    const { username, user } = verifySession(req.get('X-Session-ID'))
    const { all } = req.query
    const statuses = []
    const others = []
    for (const gameID of user.games) {
      const game = getGame(gameID)
      if (has(game.players, username)) {
        const entry = {
          game: gameID,
          gameName: game.name
        }
        if (game.started) {
          if (game.ended) {
            others.push({ ...entry, state: 'ended', time: game.ended })
          } else {
            const { target, code } = game.players[username]
            if (target) {
              statuses.push({
                ...entry,
                target,
                targetName: getUser(target).name,
                code
              })
            } else {
              others.push({ ...entry, state: 'started', time: game.players[username].killed || game.started })
            }
          }
        } else {
          others.push({ ...entry, state: 'starting', time: game.players[username].joined })
        }
      }
    }
    if (all) {
      res.send({ statuses, others })
    } else {
      res.send(statuses)
    }
  })

  router.post('/kill', asyncHandler(async (req, res) => {
    const { username } = verifySession(req.get('X-Session-ID'))
    const { game, gameID } = getGameFrom(req)
    const { self = false } = req.query
    assert(game.started, 'Game hasn\'t started!')
    assert(!game.ended, 'Game has ended!')
    assert(has(game.players, username), 'Not a player!')

    const player = game.players[username]
    assert(player.target, 'Player was killed!')

    let killer, victim
    if (self) {
      victim = player
      assert(has(game.players, player.assassin), 'Uh... your assassin isn\'t a participant of this game. Please send an email to sy24484@pausd.us because this shouldn\'t be happening.')
      killer = game.players[player.assassin]

      sendNotif(player.assassin, {
        type: 'killed-self',
        game: gameID,
        user: username,
        time: Date.now()
      })
    } else {
      killer = player
      assert(has(game.players, player.target), 'Uh... your target isn\'t a participant of this game. Please send an email to sy24484@pausd.us because this shouldn\'t be happening.')
      victim = game.players[player.target]

      const { code } = req.body
      assert(code.toLowerCase().replace(/\s/g, '') === victim.code.toLowerCase().replace(/\s/g, ''), 'The given code is incorrect. Trying checking the spelling again.')

      sendNotif(player.target, {
        type: 'killed',
        game: gameID,
        by: username,
        time: Date.now()
      })
    }

    killer.kills++
    killer.target = victim.target
    getPlayer(game, victim.target).assassin = victim.assassin

    delete victim.target
    victim.killed = Date.now()

    oneDied(gameID, game)
    globalStats.kills++

    await Promise.all([gamesDB.write(), globalStatsDB.write(), notificationsDB.write()])
    res.send({ ok: 'safely' })
  }))

  router.post('/shuffle', asyncHandler(async (req, res) => {
    const { user } = verifySession(req.get('X-Session-ID'))
    const { game, gameID } = getGameFrom(req, user)
    assert(game.started, 'Game hasn\'t started!')
    assert(!game.ended, 'Game ended!')

    shuffleTargets(Object.entries(game.players).filter(player => player[1].target))

    const now = Date.now()
    for (const [player, { target }] of Object.entries(game.players)) {
      if (target) {
        if (notifications[player]) {
          const notifs = notifications[player]
          // Delete recent consecutive shuffle notifications within 30 minutes
          while (notifs[0] && notifs[0].type === 'shuffle' &&
            notifs[0].game === gameID && notifs[0].time > now - MAX_SHUFFLE_NOTIF_TIME) {
            notifs.splice(0, 1)
          }
        }
        sendNotif(player, {
          type: 'shuffle',
          game: gameID,
          target,
          time: now
        })
      }
    }

    await [gamesDB.write(), notificationsDB.write()]
    res.send({ ok: 'probably' })
  }))

  router.get('/stats', (req, res) => {
    const { kills, active } = globalStats
    res.send({
      kills,
      active,
      games: Object.keys(games).length
    })
  })

  router.get('/notifications', (req, res) => {
    const { username } = verifySession(req.get('X-Session-ID'))
    let { from = 0, limit = 10 } = req.query
    from = +from
    limit = +limit
    assert(!Number.isNaN(from), 'Invalid `from`!')
    assert(!Number.isNaN(limit), 'Invalid `limit`!')
    assert(from >= 0, '`from` needs to be >= 0')
    assert(limit > 0 && limit <= 40, '`limit` needs to be (0, 40]')
    const notifs = notifications[username]
    let unread = 0
    for (let i = 0; i < notifs.length && !notifs[i].read; i++) {
      unread++
    }
    res.send({
      notifications: notifs.slice(from, from + limit)
        .map((notif, i) => {
          // In case something went wrong, we can just mark these broken-off
          // unread notifications as read here.
          if (from + i >= unread && !notif.read) {
            notif.read = true
          }
          return extendNotif(notif)
        }),
      end: notifs.length <= from + limit,
      unread
    })
  })

  router.post('/read', asyncHandler(async (req, res) => {
    const { username } = verifySession(req.get('X-Session-ID'))
    const notifs = notifications[username]
    for (let i = 0; i < notifs.length && !notifs[i].read; i++) {
      notifs[i].read = true
    }
    await notificationsDB.write()
    res.send({ ok: 'perhaps' })
  }))
})
