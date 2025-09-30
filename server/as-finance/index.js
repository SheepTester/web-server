const express = require('express')
const fs = require('fs/promises')
const { asyncHandler } = require('../utils')
const scrape = import('./scrape.mjs')
const router = express.Router()
module.exports = router

function getToday () {
  const date = new Date()
  return `${date.getFullYear()}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

function estimateCurrentTerm () {
  // 1032 is WI25 and it increments fall winter spring
  const date = new Date()
  const month = date.getMonth()
  // JAN FEB MAR assumed to be winter; APR MAY JUN JUL assumed to be spring; AUG
  // SEP OCT NOV DEC assumed to be fall
  return String(
    1032 + (date.getFullYear() - 2025) * 3 + (month < 3 ? 0 : month < 8 ? 1 : 2)
  )
}

/**
 * @param {import('./scrape.mjs').Cost[]} costs
 */
function displayCosts (costs) {
  return costs
    .map(
      ({ type, description, awarded, appealApproved }) =>
        `[${type}] ${description} ($${appealApproved || awarded})`
    )
    .join('\n')
}

/**
 * @param {string} date
 * @param {{questions: Record<string, string>, costs: import('./scrape.mjs').Cost[], documents: import('./scrape.mjs').Document[]}} object
 * @param {number} eventId
 * @param {number} minute
 */
function generateLink (date, { questions, costs, documents }, eventId, minute) {
  delete questions['WHO IS THIS REQUEST FOR?']

  const minuteStr = minute.toString().padStart(2, '0')

  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: 'TEMPLATE',
    text: '*free food @ place',
    details: [
      'Link: todo .',
      displayCosts(costs),
      `📑 Documents:\n${
        documents.length
          ? documents
            .map(
              ({ name, path }) => `${name} (https://finance.ucsd.edu${path})`
            )
            .join('\n')
          : '(none)'
      }`,
      `${questions.ORGANIZATION} - ${questions['NAME OF EVENT']}. Expected ${
        questions['ESTIMATED UNDERGRADUATE ATTENDANCE']
      } attendees.\nhttps://google.com/search?q=${encodeURIComponent(
        `ucsd ${questions.ORGANIZATION}`
      )}`,
      `⚠️ All information comes from https://finance.ucsd.edu/Home/ViewApplication/${eventId} @Khushi\nIf the event time is between 5:01 and 5:29 pm, that is not the true time. You can find the true event time online.`,
      Object.entries(questions)
        .map(([question, answer]) => `❓${question}\n${answer}`)
        .join('\n\n')
    ].join('\n\n'),
    location: questions.VENUE,
    dates: `${date.replaceAll('-', '')}T17${minuteStr}00/${date.replaceAll(
      '-',
      ''
    )}T18${minuteStr}00`
  })}`
}

async function getFullEvents (date, term) {
  const { getEvents, getApplication } = await scrape
  const events = (await getEvents(+term)).filter(
    event => event.date.toISOString().slice(0, 10) === date
  )
  return await Promise.all(
    events.map(async (event, i) => {
      const application = await getApplication(event.finId)
      return {
        ...event,
        application,
        costs: displayCosts(application.costs),
        link: generateLink(date, application, event.finId, i + 1),
        time: `17:${(i + 1).toString().padStart(2, '0')}`
      }
    })
  )
}

const scrapeRequests = {}

// I want to know how much /as-finance/ is being used. Hopefully browsers won't
// have unique enough user agents to be personally identifying, but I want to
// distinguish humans from bots.
const TRACKING_PATH = 'public/as-finance-visits.json'
const trackingRef = fs
  .readFile(TRACKING_PATH, 'utf-8')
  .catch(() => '{}')
  .then(JSON.parse)
  .then(current => ({ current }))

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const today = getToday()
    const date = req.query.date ?? today
    const term = req.query.term ?? estimateCurrentTerm()
    const key = `${date} ${term}`
    if (!scrapeRequests[key]) {
      scrapeRequests[key] = getFullEvents(date, term)
      // Invalidate cache entry after 30 min
      setTimeout(() => {
        delete scrapeRequests[key]
      }, 30 * 60 * 1000)
    }

    res.render('as-finance', {
      date,
      term,
      events: await scrapeRequests[key]
    })

    const ref = await trackingRef
    ref.current[today] ??= { today: { total: 0 }, other: { total: 0 } }
    const eventClass = today === date ? 'today' : 'other'
    ref.current[today][eventClass].total++
    const userAgent = `ua:${req.header('user-agent') ?? ''}`
    ref.current[today][eventClass][userAgent] ??= 0
    ref.current[today][eventClass][userAgent]++
    fs.writeFile(TRACKING_PATH, JSON.stringify(ref.current, null, '\t') + '\n')
  })
)
