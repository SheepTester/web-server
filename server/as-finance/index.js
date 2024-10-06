const express = require('express')
const router = express.Router()
module.exports = router

function getToday () {
  const date = new Date()
  return `${date.getFullYear()}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

router.get('/', (req, res) => {
  const date = req.query.date ?? getToday()
  res.render('as-finance', {
    date
  })
})
