const express = require('express')
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

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { getEvents, getApplication } = await scrape
    const date = req.query.date ?? getToday()
    const term = req.query.term ?? '1031'
    const events = (await getEvents(+term)).filter(
      event => event.date.toISOString().slice(0, 10) === date
    )
    res.render('as-finance', {
      date,
      term,
      events: await Promise.all(
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
    })
    next()
  })
)
