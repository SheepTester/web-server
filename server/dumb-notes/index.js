const express = require('express')
const router = express.Router()
module.exports = router

const assert = require('assert')
const { asyncHandler } = require('../utils.js')

const path = require('path')
const low = require('lowdb')
const FileAsync = require('lowdb/adapters/FileAsync')

low(new FileAsync(path.resolve(__dirname, './db-notes.json')))
  .then(db => {
    router.get('/:id/edit', (req, res) => {
      res.render('notes', {
        id: req.params.id,
        content: db.get(req.params.id).value() || ''
      })
    })

    router.post('/:id/save', asyncHandler(async (req, res) => {
      assert(typeof req.body.content === 'string', 'Body is not a JSON string!')
      await db.set(req.params.id, req.body.content).write()
      res.end()
    }))
  })
