const express = require('express')
const cors = require('cors')

const assert = require('assert')
const { exec } = require('child_process')
const { asyncHandler, hashPassword } = require('./utils.js')

const dbClient = require('./db.js')
const logError = require('./log-error.js')
const { wsIsReady } = require('./ws.js')

const app = express()
app.use(express.json())
app.use(cors())
app.set('view engine', 'ejs')
app.set('view options', {
  rmWhitespace: true
})
app.use(express.static('public'))

// Annoying Greenlock gives the http(s)server asynchronously (after app is
// created), but express-ws needs the server object D:
app.onServer = server => {
  // Second argument: https://github.com/HenningM/express-ws/blob/master/src/index.js
  // https://stackoverflow.com/a/32705838
  require('express-ws')(app, server)

  wsIsReady()
}

app.get('/', (req, res) => {
  if (requestForHtml(req)) {
    res.render('index')
  } else {
    res.send({ ok: 'possibly' })
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
        res.end(stop)
      }
    })
  } else {
    res.status(401).end()
  }
}))
async function stop () {
  dbClient.then(client => client.close())
  app.stop()
}

app.use('/assassin', require('./assassin/index.js'))

app.use('/errors', require('./errors/index.js'))

app.use('/note', require('./note/index.js'))

app.use('/counter', require('./counter/index.js'))

app.use('/colour', require('./colour/index.js'))

app.use('/assync', require('./assync/index.js'))

app.use('/interstud-comm', require('./interstud-comm/index.js'))

app.use('/sgy', require('./sgy/index.js'))

function requestForHtml (req) {
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation/List_of_default_Accept_values
  const accept = req.get('accept')
  // All browsers send text/html first
  return accept.includes('text/html') ||
    // Just in case...
    accept.includes('application/xhtml+xml') ||
    accept.includes('application/xml') ||
    // Only XML-related MIME type in IE8's accept header
    accept.includes('application/xaml+xml')
}

app.use((req, res, next) => {
  if (req.method === 'GET' && requestForHtml(req)) {
    res.status(404).render('404', { url: req.originalUrl })
  } else {
    res.status(404).send({
      wucky: 'do not know what to do',
      url: req.originalUrl
    })
  }
})

app.use((err, req, res, next) => {
  if (err instanceof assert.AssertionError) {
    if (req.method === 'GET' && requestForHtml(req)) {
      res.status(400).render('400', { error: err.message })
    } else {
      res.status(400).send({
        wucky: 'you bad',
        url: req.originalUrl,
        mistake: err.message
      })
    }
  } else {
    if (req.method === 'GET' && requestForHtml(req)) {
      res.status(500).render('500', { error: err.stack })
    } else {
      res.status(500).send({
        wucky: 'brain hurt',
        url: req.originalUrl,
        problem: err.message,
        history: err.stack
      })
    }
    logError(err, req.originalUrl)
  }
})

if (require.main === module) {
  const server = app.listen(3000, () => {
    console.log('We are watching.')
  })
  app.stop = () => {
    server.close()
  }
  app.onServer(server)
}

module.exports = app
