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

async function generateLink (date, eventId) {
  const { questions, costs, documents } = await (
    await scrape
  ).getApplication(eventId)

  delete questions['WHO IS THIS REQUEST FOR?']

  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: 'TEMPLATE',
    text: '*free food @ place',
    details: [
      `${questions.ORGANIZATION} - ${questions['NAME OF EVENT']}. Expected ${questions['ESTIMATED UNDERGRADUATE ATTENDANCE']} attendees.`,
      costs
        .map(
          ({ type, description, awarded, appealApproved }) =>
            `[${type}] ${description} ($${appealApproved || awarded})`
        )
        .join('\n'),
      `https://finance.ucsd.edu/Home/ViewApplication/${eventId}`,
      Object.entries(questions)
        .map(([question, answer]) => `❓${question}\n${answer}`)
        .join('\n\n'),
      `Documents:\n${
        documents.length
          ? documents
              .map(
                ({ name, path }) => `${name} (https://finance.ucsd.edu${path})`
              )
              .join('\n')
          : '(none)'
      }`
    ].join('\n\n'),
    location: questions.VENUE,
    dates: `${date.replaceAll('-', '')}T0300/${date.replaceAll('-', '')}T0400`
  })}`
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { getEvents } = await scrape
    const date = req.query.date ?? getToday()
    const term = req.query.term ?? '1031'
    const events = (await getEvents(+term)).filter(
      event => event.date.toISOString().slice(0, 10) === date
    )
    res.render('as-finance', {
      date,
      term,
      events: await Promise.all(
        events.map(async event => ({
          ...event,
          link: await generateLink(date, event.finId)
        }))
      )
    })
    next()
  })
)
