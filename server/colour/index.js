const fs = require('fs/promises')
const path = require('path')

const crc32 = require('crc-32')
const express = require('express')
const { asyncHandler } = require('../utils')
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
      res.status(404).render('404', { url: `"#${colour}"` })
    }
  }
})

const image = fs.readFile(path.resolve(__dirname, './preview.png'))

router.get(
  '/:colour/preview.png',
  asyncHandler(async (req, res) => {
    const { colour: hexColour } = req.params
    if (hexStrict.test(hexColour)) {
      // Based on https://github.com/SheepTester/colour-previewer/blob/main/src/handlers.rs#L89-L100
      const colour = parseInt(hexColour, 16)

      // Clone image bytes
      const bytes = new Uint8Array(await image)

      // Replace the colour in the palette (PLTE chunk) with the given colour
      bytes[0x4b] = colour >> 16
      bytes[0x4c] = (colour >> 8) & 0xff
      bytes[0x4d] = colour & 0xff

      // Update the CRC at the end of the PLTE chunk
      const view = new DataView(bytes.buffer)
      view.setInt32(0x4e, crc32.buf(bytes.slice(0x47, 0x4e)))

      res.set('Content-Type', 'image/png')
      res.send(Buffer.from(bytes))
    } else {
      res.status(404).render('404', { url: `"#${hexColour}"` })
    }
  })
)
