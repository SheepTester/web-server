const express = require('express')
const router = express.Router()
module.exports = router

require('../db.js').then(async client => {
  const db = client.db('assync')

  require('./dislikes.js')(router, db)
})
