const express = require('express')
const cors = require('cors')

const assert = require('assert')

const port = process.env.NODE_ENV === 'production' ? 80 : 3000

const app = express()
app.use(express.json())
app.use(cors())
app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/', (req, res) => {
  if (req.xhr || req.method !== 'GET') {
    res.send({ ok: 'possibly' })
  } else {
    res.render('index')
  }
})

app.get('/400', (req, res) => {
  assert(false, 'User asked for a 400 page!')
})

app.get('/500', (req, res) => {
  throw new Error('I give up!')
})

app.get('/418', (req, res) => {
  if (req.xhr || req.method !== 'GET') {
    res.status(418).send({ teapot: 'I\'m' })
  } else {
    res.status(418).render('418')
  }
})

app.use('/assassin', require('./assassin.js'))

app.use((req, res, next) => {
  if (req.xhr || req.method !== 'GET') {
    res.status(404).send({ url: req.originalUrl, wucky: 'do not know what to do' })
  } else {
    if (req.originalUrl.endsWith('x')) {
      throw new Error('dummy error')
    }
    res.status(404).render('404', { url: req.originalUrl })
  }
})

app.use((err, req, res, next) => {
  if (err instanceof assert.AssertionError) {
    if (req.xhr || req.method !== 'GET') {
      res.status(400).send({ url: req.originalUrl, wucky: 'you bad', mistake: err.message })
    } else {
      res.status(400).render('400', { error: err.message })
    }
  } else {
    if (req.xhr || req.method !== 'GET') {
      res.status(500).send({ url: req.originalUrl, wucky: 'brain hurt', problem: err.message, history: err.stack })
    } else {
      res.status(500).render('500', { error: err.stack })
    }
  }
})

app.listen(port, () => {
  console.log('We are watching.')
})
