const assert = require('assert')
const { asyncHandler } = require('../utils.js')

module.exports = async function main (router, db) {
  // Data that only need to be collected once per user
  const perUser = db.collection('per-user')
  await perUser.createIndex({ option: 1, value: 1 }, { unique: true })

  // Data collected over time
  const times = db.collection('times')
  await times.createIndex({ timestamp: 1 }, { unique: true })

  async function noteTime () {
    const tenMinuteInterval = new Date().toISOString().slice(0, 15)
    await times.updateOne({ timestamp: tenMinuteInterval }, {
      $inc: {
        // If the field does not exist, $inc creates the field and sets the field to the specified value.
        users: 1
      },
      $setOnInsert: {
        timestamp: tenMinuteInterval
      }
    }, {
      upsert: true
    })
  }

  // Collect time data (in 10-minute intervals)
  router.post('/urgent-schedule', asyncHandler(async (req, res) => {
    await noteTime()
    res.send({ status: 'No urgent schedule changes.' })
  }))

  // Collect the per-user data
  router.post('/check-update', asyncHandler(async (req, res) => {
    const { includeTime = 'yes' } = req.query
    if (includeTime === 'yes') {
      await noteTime()
    }
    // Unsure if bulk update is the best way to approach this but couldn't find
    // anything better than maybe $or.
    // https://stackoverflow.com/a/37023840
    const bulkUpdateOperations = Object.entries(req.body)
      .map(([option, value]) => {
        assert(typeof value === 'string', `${option}'s value should be a string!`)
        return {
          updateOne: {
            filter: { option, value },
            update: { $inc: { users: 1 } },
            upsert: true
          }
        }
      })
    await perUser.bulkWrite(bulkUpdateOperations)
    res.send({ status: 'No updates to club/staff lists.' })
  }))

  router.get('/users', asyncHandler(async (req, res) => {
    const { key: option, format = 'html' } = req.query
    if (!option) {
      res.render('ask-for-key', {
        key: 'Option name',
        description: 'Please specify an option name.'
      })
      return
    }
    const data = await perUser.find({
      option
    }).sort({ users: -1 }).toArray()
    if (format === 'json') {
      res.send(
        Object.fromEntries(data.map(({ value, users }) => [value, users]))
      )
    } else {
      res.render('table', {
        title: `Users for option ${option}`,
        columns: [['value', 'Value'], ['users', 'Number of users']],
        data
      })
    }
  }))

  router.get('/times', asyncHandler(async (req, res) => {
    const { format = 'html', from = null, to = null } = req.query
    // MongoDB doesn't ignore undefined values in query
    const range = {}
    if (from) range.$gte = from
    if (to) range.$lte = to
    const data = await times.find({
      // https://stackoverflow.com/a/44639902
      timestamp: from || to ? range : { $exists: true }
    }).sort({ timestamp: 1 }).toArray()
    if (format === 'json') {
      res.send(
        Object.fromEntries(data
          .map(({ timestamp, users }) => [timestamp, users]))
      )
    } else {
      res.render('table', {
        title: `Users over time`,
        columns: [['timestamp', 'Time (ten minute interval)'], ['users', 'Number of users']],
        data
      })
    }
  }))
}
