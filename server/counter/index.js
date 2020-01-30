const express = require('express')
const router = express.Router()
module.exports = router

const assert = require('assert')
const { asyncHandler } = require('../utils.js')

const path = require('path')
const low = require('lowdb')
const FileAsync = require('lowdb/adapters/FileAsync')

low(new FileAsync(path.resolve(__dirname, './db-counter.json')))
  .then(db => {
    router.get('/:id/', (req, res) => {
      res.send(db.get(req.params.id, 0).value().toString())
    })

    router.post('/:id/increment', asyncHandler(async (req, res) => {
      await db.set(req.params.id, db.get(req.params.id, 0).value() + 1).write()
      res.end()
    }))
  })
