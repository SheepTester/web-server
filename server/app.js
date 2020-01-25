const express = require('express')
const cors = require('cors')

const port = process.env.NODE_ENV === 'production' ? 80 : 3000

const app = express()
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send({ ok: 'probably' })
})

app.listen(port, () => {
  console.log('We are watching.')
})
