const express = require('express')
const cors = require('cors')

const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { exec } = require('child_process')
const { asyncHandler, hashPassword } = require('./utils.js')

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

const restartHash = 'f1794bff3750523268b8aa3bab403a2598f3ff96bc58c0d543b65d634b52eaeff1fc5875b1a59e09bed0a161b9747b2fe76cf40cda8e962f3be2f4044efa34ec'
const restartSalt = 'You shall never know my password!'
app.post('/restart', asyncHandler(async (req, res) => {
  if (!app.stop) {
    throw new Error('Cannot stop!')
  } else if (await hashPassword(req.body.password, restartSalt) === restartHash) {
    exec('npm run serve:update > public/upgrade-log.txt', err => {
      if (err) {
        throw err
      } else {
        res.end(app.stop)
      }
    })
  } else {
    res.status(401).end()
  }
}))

app.use('/assassin', require('./assassin/index.js'))

app.use('/errors', require('./errors/index.js'))

app.use('/note', require('./note/index.js'))

app.use('/counter', require('./counter/index.js'))

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

// https://stackoverflow.com/a/43370201
const errorStream = fs.createWriteStream(path.resolve(__dirname, '../public/error-log.txt'), { flags: 'a' })
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
    errorStream.write(new Date().toString() + '\n' + err.stack + '\n\n')
  }
})

if (require.main === module) {
  const server = app.listen(3000, () => {
    console.log('We are watching.')
  })
  app.stop = () => {
    server.close()
  }
}

module.exports = app
