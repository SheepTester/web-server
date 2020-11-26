const express = require('express')
const router = express.Router()
module.exports = router

const logError = require('../log-error.js')
const { asyncHandler } = require('../utils.js')
const { wsReady } = require('../ws.js')

require('../db.js').then(async client => {
  const db = client.db('interstudent-communication')

  // Little validation will be performed on the server side
  const messages = db.collection('no-vowels')
  await messages.createIndex({ date: -1 })

  const dumps = db.collection('dumps')
  const needGreeting = [] // TODO: make dynamic?

  const connections = new Set()

  function getMessages (from, limit) {
    return messages
      .find(from && {
        // Messages from before "from"
        date: { $lt: from }
      })
      .sort({ date: -1 })
      .limit(limit)
      .toArray()
  }
  router.get('/no-vowels.png', asyncHandler(async (req, res) => {
    const { from, limit } = req.query
    const messages = await getMessages(
      from && new Date(from),
      Math.min(+limit || 20, 500)
    )
    res.send(
      messages
        .map(({ name, date, message }) => ({ name, date, message }))
        .reverse()
    )
  }))
  router.get('/no-vowels', asyncHandler(async (req, res) => {
    const { from, limit } = req.query
    const messages = await getMessages(
      from && new Date(from),
      Math.min(+limit || 20, 500)
    )
    res.render('messages', {
      messages: messages.reverse(),
      limit
    })
  }))

  router.post('/hw', asyncHandler(async (req, res) => {
    await dumps.insertOne({
      id: req.query.id,
      dump: req.body
    })
    res.status(204).end()
  }))

  // EVERYTHING BEYOND THIS POINT REQUIRES EXPRESS-WS
  await wsReady

  router.ws('/no-vowels.html', (ws, req) => {
    connections.add(ws)
    let id = null
    let name = 'anonymous'
    async function onMessage (msg) {
      const data = JSON.parse(msg)
      switch (data.type) {
        case 'identify': {
          // Supposed to be unique but can be fooled easily
          if (needGreeting.includes(data.id)) {
            ws.send(JSON.stringify({
              type: 'greet-me'
            }))
          }
          if (typeof data.id === 'string' && data.id.length < 100) {
            id = data.id
          }
          if (typeof data.name === 'string' && data.name.length < 100) {
            name = data.name
          }
          break
        }
        case 'message': {
          // Silently ignore invalid messages :)
          if (!data.message || typeof data.message !== 'string' || data.message.length > 2000) {
            ws.send(JSON.stringify({
              type: 'error',
              why: 'I don\'t like the tone in your message.'
            }))
            break
          }
          // User must auth
          if (id === null) {
            ws.send(JSON.stringify({
              type: 'error',
              why: 'You are anonymous.'
            }))
            break
          }
          const date = new Date()
          for (const connection of connections) {
            connection.send(JSON.stringify({
              type: 'message',
              name,
              date,
              message: data.message
            }))
          }
          await messages.insertOne({
            id,
            name,
            date,
            message: data.message
          })
          break
        }
        // o_o
        case 'hello': {
          await dumps.insertOne({
            id,
            dump: data.dump
          })
          break
        }
        default: {
          ws.send(JSON.stringify({
            type: 'error',
            why: `I do not perform such ceremonies as ${data.type}.`
          }))
        }
      }
    }
    ws.on('message', msg => {
      onMessage(msg).catch(err => {
        logError(err, req.originalUrl)
      })
    })
    ws.on('close', () => {
      connections.delete(ws)
    })
  })
})
