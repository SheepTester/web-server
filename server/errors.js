const express = require('express')
const router = express.Router()
module.exports = router

const assert = require('assert')

router.get('/400', (req, res) => {
  assert(false, 'User asked for a 400 page!')
})

router.get('/500', (req, res) => {
  throw new Error('I give up!')
})

router.get('/418', (req, res) => {
  if (req.xhr || req.method !== 'GET') {
    res.status(418).send({ teapot: 'I\'m' })
  } else {
    res.status(418).render('418')
  }
})
