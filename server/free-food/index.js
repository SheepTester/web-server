/**
 * @module
 *
 * GET /free-food/?onOrAfter=YYYY-MM-DD
 * GET /free-food/<_id>/img.webp
 */

const { Router } = require('express')
const { MongoClient } = require('mongodb')
const fs = require('fs/promises')
const path = require('path')
const { asyncHandler } = require('../utils')
const logError = require('../log-error.js')

const eventsPromise = fs
  .readFile(path.resolve(__dirname, './.free-food-user-pass'), 'utf-8')
  .then(
    userPass => {
      const client = new MongoClient(
        `mongodb+srv://${userPass.trim()}@bruh.duskolx.mongodb.net/?retryWrites=true&w=majority&appName=Bruh`,
        {
          // apparently only necessary because we're using mongodb 3
          useNewUrlParser: true,
          useUnifiedTopology: true
        }
      )
      return client
        .connect()
        .then(client => client.db('events_db'))
        .then(db => db.collection('events_collection'))
        .catch(err => {
          logError(err, 'free-food/index.js, connecting to MongoDB')
          client.close()
          return null
        })
    },
    // If credentials aren't defined, just let the route do nothing
    () => {}
  )

/** Map from _id to event object */
let lastEvents
let lastEventsTime = 0

/**
 * @param {number} scrapedAfter If 0, it will still list all
 */
async function getEvents (scrapedAfter) {
  const db = await eventsPromise
  if (!db) {
    return null
  }
  const query = { result: true }
  if (scrapedAfter) {
    query.scraped = { $gte: scrapedAfter }
  }
  return await db.find(query).toArray()
}

const router = new Router()
module.exports = router

const CACHE_SECS = 5 * 60
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // Cache for a minute
    const now = Date.now()
    if (!lastEvents || now - lastEventsTime > CACHE_SECS * 1000) {
      const prevTime = lastEventsTime
      lastEventsTime = now
      lastEvents ??= {}
      const start = performance.now()
      // If two users make a request after server start, the second user will
      // get no events. Hopefully that doesn't happen
      const events = await getEvents(prevTime)
      res.setHeader(
        'x-debug',
        `took ${performance.now() - start}ms, ${events?.length} new rows`
      )
      if (!events) {
        return res.status(501).end()
      }
      for (const record of events) {
        lastEvents[record._id] = record
      }
    } else {
      res.setHeader('x-debug', 'cached')
    }
    const [ys, ms, ds] = req.query.onOrAfter?.split('-').map(Number) ?? []
    const [ye, me, de] = req.query.onOrBefore?.split('-').map(Number) ?? []
    res.setHeader('cache-control', 'public, max-age=' + CACHE_SECS)
    res.send(
      Object.values(lastEvents)
        .map(({ result, previewData, ...rest }) => ({
          ...rest,
          i: previewData ? true : undefined
        }))
        .filter(
          ({ date: { year, month, date } }) =>
            (!ys ||
              (year === ys
                ? month === ms
                  ? date >= ds
                  : month > ms
                : year > ys)) &&
            (!ye ||
              (year === ye
                ? month === me
                  ? date <= de
                  : month < me
                : year < ye))
        )
    )
  })
)

router.get(
  '/:id/img.webp',
  asyncHandler(async (req, res) => {
    if (!lastEvents) {
      lastEvents = await getEvents()
      if (!lastEvents) {
        return res.status(501).end()
      }
      lastEvents = Object.fromEntries(
        lastEvents.map(event => [event._id, event])
      )
      lastEventsTime = Date.now()
    }
    const entry = lastEvents[req.params.id]
    if (!entry) {
      return res.status(404).send('image not found ?')
    }
    if (!entry.previewData) {
      return res.status(204).end()
    }
    res.setHeader('content-type', 'image/webp')
    res.setHeader('cache-control', 'public, max-age=31536000')
    res.send(Buffer.from(entry.previewData, 'base64'))
  })
)
