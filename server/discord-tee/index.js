const express = require('express')
const router = express.Router()
module.exports = router

const dlog = require('../deprecated-route-usage-logger.js')

router.get('/', (req, res) => {
  dlog(req)
  const fallbackUrl = req.query.default ?? req.query.discord
  if (!fallbackUrl) {
    res.status(404).send('usage: ?discord=[url]&default=[url]')
    return
  }
  if (req.get('user-agent')?.includes('Discordbot')) {
    res.redirect(req.query.discord ?? fallbackUrl)
  } else {
    res.redirect(req.query.default ?? fallbackUrl)
  }
})
