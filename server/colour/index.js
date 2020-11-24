const express = require('express')
const router = express.Router()
module.exports = router

const hexStrict = /^[0-9a-f]{6}$/
const hexLoose = /[0-9a-f]{6}|[0-9a-f]{3}/i

router.get('/:colour', (req, res) => {
  const { colour } = req.params
  if (hexStrict.test(colour)) {
    res.render('colour', { colour })
  } else {
    const match = colour.match(hexLoose)
    if (match) {
      const [str] = match
      if (str.length === 6) {
        res.redirect(`./${str.toLowerCase()}`)
      } else {
        res.redirect(`./${[...str.toLowerCase()].map(c => c + c).join('')}`)
      }
    } else {
      res.status(404).render('colour', { colour })
    }
  }
})
