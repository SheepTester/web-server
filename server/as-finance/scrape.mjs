// https://github.com/SheepTester/ucsd-event-scraper/blob/main/explore/finance/scrape.ts

import { parse, HTMLElement } from 'node-html-parser'

function children (element) {
  return Array.from(element.childNodes).filter(
    node => node instanceof HTMLElement
  )
}

async function fetchTerm (termId) {
  return fetch('https://finance.ucsd.edu/Home/ListFunded', {
    headers: {
      cookie: await fetch('https://finance.ucsd.edu/Home/UpdateTerm', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          referer: 'https://finance.ucsd.edu/Home/ListFunded'
        },
        redirect: 'manual',
        body: `FinanceTerm=${termId}`
      }).then(r =>
        r.headers
          .getSetCookie()
          .map(cookie => cookie.split('; path=')[0])
          .join('; ')
      )
    }
  }).then(r => r.text())
}

/**
 * @param {number} termId
 * @returns {Promise<Event[]>}
 */
export async function getEvents (termId) {
  const doc = parse(await fetchTerm(termId))
  const table =
    doc
      .getElementById('FundedTable')
      ?.childNodes.findLast(node => node instanceof HTMLElement) ??
    expect('#FundedTable tbody')
  const results = []
  for (const row of children(table)) {
    const [finId, organization, name, date, venue, awarded, updated] = children(
      row
    ).map(td => td.textContent.trim())
    results.push({
      finId: +finId.replaceAll('*', ''),
      organization,
      name,
      date: new Date(
        `${date.slice(0, 4)}-${date.slice(4, 6)}-${
          date.slice(6).split(/\r?\n/)[0]
        }`
      ),
      venue,
      awarded: awarded ? +awarded.replace(/[$,]/g, '') : undefined,
      updated: new Date(
        `${updated.slice(0, 4)}-${updated.slice(4, 6)}-${
          updated.slice(6).split(/\r?\n/)[0]
        }`
      ),
      hasPostEval: !!row.querySelector('.btn-info')?.getAttribute('href')
    })
  }
  return results
}

function fetchApplication (finId) {
  return fetch(`https://finance.ucsd.edu/Home/ViewApplication/${finId}`).then(
    r => r.text()
  )
}

/**
 * @param {number} finId
 * @returns {Promise<{questions: Record<string, string>, costs: Cost[], documents: Document[]}>}
 */
export async function getApplication (finId) {
  const doc = parse(await fetchApplication(finId))
  const questions = {}
  for (const dl of doc.getElementsByTagName('dl')) {
    const items = children(dl)
    for (let i = 0; i < items.length; i += 2) {
      const dt = items[i].textContent.trim()
      const dd = items[i + 1].textContent.trim()
      const checkbox = items[i + 1].querySelector('input')
      questions[dt] = checkbox
        ? checkbox.getAttribute('checked') ?? 'unchecked'
        : dd
    }
  }
  const costs = []
  const table = doc.querySelector('tbody') ?? expect('tbody')
  for (const row of children(table)) {
    const tds = children(row)
    if (tds[0].getAttribute('colspan')) {
      // Ignore total
      continue
    }
    const [
      type,
      description,
      requested,
      awarded,
      appealRequested,
      appealApproved
    ] = tds.map(td => td.textContent.trim())
    costs.push({
      type,
      description,
      requested: +requested.replace(/[$,]/g, ''),
      awarded: +awarded.replace(/[$,]/g, ''),
      appealRequested: appealRequested
        ? +appealRequested.replace(/[$,]/g, '')
        : undefined,
      appealApproved: appealApproved
        ? +appealApproved.replace(/[$,]/g, '')
        : undefined
    })
  }
  const documents = []
  for (const a of doc.getElementsByTagName('a')) {
    const href = a.getAttribute('href')
    if (href?.startsWith('/Home/DownloadFile')) {
      documents.push({ name: a.textContent, path: href })
    }
  }
  return { questions, costs, documents }
}

// Thank you ChatGPT

/**
 * @typedef {Object} Event
 * @property {number} finId
 * @property {string} organization
 * @property {string} name
 * @property {Date} date
 * @property {string} venue
 * @property {number} [awarded]
 * @property {Date} updated
 * @property {boolean} hasPostEval
 */

/**
 * @typedef {Object} Application
 * @property {string} org
 * @property {string} eventName
 * @property {string} date
 * @property {string} venue
 * @property {boolean} onCampus
 * @property {string} description
 * @property {number} attendanceEstimate
 * @property {boolean} admissionCharge
 * @property {boolean} philanthropic
 * @property {string} otherFunding
 * @property {string} status
 * @property {string} created
 * @property {string} changed
 */

/**
 * @typedef {Object} Cost
 * @property {string} type
 * @property {string} description
 * @property {number} requested
 * @property {number} awarded
 * @property {number} [appealRequested]
 * @property {number} [appealApproved]
 */

/**
 * @typedef {Object} Document
 * @property {string} name
 * @property {string} path
 */
