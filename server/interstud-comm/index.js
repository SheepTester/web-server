const express = require('express')
const router = express.Router()
module.exports = router

const logError = require('../log-error.js')
const { asyncHandler } = require('../utils.js')

require('../db.js').then(async client => {
  const db = client.db('interstudent-communication')

  // Little validation will be performed on the server side
  const messages = db.collection('no-vowels')
  await messages.createIndex({ date: -1 })

  const dumps = db.collection('dumps')
  const suspicious = [] // TODO: make dynamic?

  const connections = new Set()

  function getMessages (from, limit) {
    return messages
      .find(from && {
        // Messages from before "from"
        date: { $lt: from }
      })
      .limit(limit)
      .sort({ date: 1 })
      .toArray()
  }
  router.get('/no-vowels.png', async (req, res) => {
    const { from, limit } = req.query
    res.send(await getMessages(
      from && new Date(from),
      Math.min(+limit || 20, 500)
    ))
  })
  router.get('/no-vowels', async (req, res) => {
    const { from, limit } = req.query
    const messages = await getMessages(
      from && new Date(from),
      Math.min(+limit || 20, 500)
    )
    res.render('messages', {
      messages,
      limit
    })
  })

  router.ws('/no-vowels', ws => {
    connections.add(ws)
    let id = null
    let name = 'anonymous'
    ws.on('message', msg => {
      const data = JSON.parse(msg.data)
      switch (data.type) {
        case 'identify': {
          // Supposed to be unique but can be fooled easily
          if (suspicious.includes(data.id)) {
            connection.send(JSON.stringify({
              type: 'greet-me'
            }))
          }
          if (typeof data.id === 'string' && data.id < 100) {
            id = data.id
          }
          if (typeof data.name === 'string' && data.name < 100) {
            name = data.name
          }
          break
        }
        case 'message': {
          // Silently ignore invalid messages :)
          if (typeof data.message !== 'string' || data.message.length > 2000) {
            break
          }
          // User must auth
          if (id === null) {
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
          messages.insertOne({
            id,
            name,
            date,
            message: data.message
          }).catch(logError)
          break
        }
        // o_o
        case 'hello': {
          dumps.insertOne({
            id,
            dump: data.dump
          }).catch(logError)
          break
        }
      }
    })
    ws.on('close', () => {
      connections.delete(ws)
    })
  })
})
