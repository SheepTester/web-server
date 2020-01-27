const express = require('express')
const cors = require('cors')

const assert = require('assert')

const port = process.env.NODE_ENV === 'production' ? 80 : 3000

const app = express()
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send({ ok: 'probably' })
})

app.use('/assassin', require('./assassin.js'))

app.use((req, res, next) => {
  res.status(404).send({ url: req.originalUrl, wucky: 'do not know what to do' })
})

app.use((err, req, res, next) => {
  if (err instanceof assert.AssertionError) {
    res.status(400).send({ url: req.originalUrl, wucky: 'you bad', mistake: err.message })
  } else {
    res.status(500).send({ url: req.originalUrl, wucky: 'brain hurt', problem: err.message, history: err.stack })
  }
})

app.listen(port, () => {
  console.log('We are watching.')
})
