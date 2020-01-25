const express = require('express')
const cors = require('cors')

const port = process.env.NODE_ENV === 'production' ? 80 : 3000

const app = express()
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send({ ok: 'probably' })
})

app.use((req, res, next) => {
  res.status(404).send({ url: req.originalUrl, problem: 'do not know what to do' })
})

app.use((err, req, res, next) => {
  res.status(500).send({ url: req.originalUrl, problem: 'brain hurt', history: err.stack })
})

app.listen(port, () => {
  console.log('We are watching.')
})
