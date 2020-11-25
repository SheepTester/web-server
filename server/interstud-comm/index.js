const express = require('express')
const router = express.Router()
module.exports = router

require('../db.js').then(client => {
  const db = client.db('interstudent-communication')
  const messages = db.collection('messages')
  router.get('/', async (req, res) => {
    // TODO
  })
})
