const express = require('express')
const router = express.Router()
module.exports = router

const assert = require('assert')
const validHash = /^[0-9a-f]{1,64}$/i
const validAsgnId = /^\w{1,64}$/i
const { asyncHandler } = require('../utils.js')

require('../db.js').then(async client => {
  const db = client.db('assync')

  // "One-to-Many" from
  // https://www.mongodb.com/blog/post/6-rules-of-thumb-for-mongodb-schema-design-part-1
  const users = db.collection('users')
  await users.createIndex({ hash: 1 }, { unique: true })
  const assignments = db.collection('assignments')
  await assignments.createIndex({ assyncID: 1 }, { unique: true })

  // Mimics jsonstore.io
  router.get('/:hash/', asyncHandler(async (req, res) => {
    const { hash } = req.params
    assert.ok(validHash.test(hash), 'Hash doesn\'t look like a hash.')
    // https://docs.mongodb.com/drivers/node/usage-examples/findOne
    const userAssignments = await users.findOne({
      hash
    }) || { assignments: [] }
    const assignmentData = await assignments.find({
      assyncID: { $in: userAssignments.assignments }
    }).toArray()
    res.send({
      result: Object.fromEntries(
        assignmentData.map(asgn => [asgn.assyncID, asgn])
      ),
      ok: true
    })
  }))

  router.post('/:hash/:asgnId/', asyncHandler(async (req, res) => {
    const { hash, asgnId } = req.params
    assert.ok(validHash.test(hash), 'Hash doesn\'t look like a hash.')
    assert.ok(validAsgnId.test(hash), 'Assignment ID should be from generateID.')
    const {
      text,
      category,
      importance,
      dueObj: { d, m, y },
      period,
      done
    } = req.body
    // Generally lazy validation just to prevent abuse
    assert.ok(text.length < 10000, 'Spent less time planning your time. (hint: text too long)')
    assert.ok(category.length < 20, 'UGWA, use shorter category names, thanks.')
    assert.ok(typeof importance === 'number', 'Importance is a quantity.')
    assert.ok(typeof d === 'number', 'The date should be a number.')
    assert.ok(typeof m === 'number', 'The month should be a number.')
    assert.ok(typeof y === 'number', 'The year should be a number.')
    assert.ok(period === null || period.length < 20, 'UGWA, use shorter period names, thanks.')
    assert.ok(typeof done === 'boolean', 'You can either be done or not done!')
    // https://docs.mongodb.com/drivers/node/usage-examples/updateOne
    // updateOne(query, operators, options)
    await users.updateOne({ hash }, {
      $addToSet: {
        assignments: asgnId
      },
      // Used with upsert: true
      // https://docs.mongodb.com/manual/reference/operator/update/setOnInsert/#up._S_setOnInsert
      $setOnInsert: {
        hash
      }
    }, {
      // https://docs.mongodb.com/drivers/node/fundamentals/crud/write-operations/upsert
      upsert: true
    })
    const replacement = {
      user: hash,
      assyncID: asgnId,
      text,
      category,
      importance,
      dueObj: { d, m, y },
      period,
      done
    }
    await assignments.replaceOne({
      assyncID: asgnId
    }, replacement, {
      // "create a document if no documents match the query"
      upsert: true
    })
    res.send({ ok: true })
  }))

  router.delete('/:hash/:asgnId/', asyncHandler(async (req, res) => {
    const { hash, asgnId } = req.params
    assert.ok(validHash.test(hash), 'Hash doesn\'t look like a hash.')
    assert.ok(validAsgnId.test(hash), 'Assignment ID should be from generateID.')
    await users.updateOne({ hash }, {
      $pull: {
        // Removes assignment ID from assignments array
        assignments: asgnId
      }
    })
    await assignments.deleteOne({ assyncID: asgnId })
    res.send({ ok: true })
  }))
})
