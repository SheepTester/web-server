const fetch = require('node-fetch')

const assert = require('assert')
const { asyncHandler, responseOk, md5 } = require('../utils.js')

const validDomain = /^\w{1,50}$/
const validId = /^\d{1,16}$/
const validHash = /^[0-9a-f]{1,64}$/i

const sgyPortfolio = (domain, userId, portfolioId, pageId) =>
  `https://${domain}.schoology.com/portfolios/users/${userId}/portfolios/${portfolioId}/items/${pageId}`

module.exports = async function main (router, db) {
  const dislikes = db.collection('dislikes')
  await dislikes.createIndex({ domainNid: 1 }, { unique: true })

  // Only works for the SESSxyz value of "anything lol"
  const csrfToken = '8f79f8e20a0a54312c13ceb904bb3ed7'
  const cookies = new Map()

  router.post('/dislike/:domain/:nid', asyncHandler(async (req, res) => {
    const { domain, nid } = req.params
    const { userId, portfolioId, pageId, publicHash } = req.body

    assert(validDomain.test(domain), 'Bad domain. It should be a valid subdomain of Schoology.')
    assert(validId.test(nid), 'Invalid NID. It should be around ten digits.')
    const domainNid = `${domain}-${nid}`

    if (!cookies.get(domain)) {
      // md5 isn't a particularly expensive hash but I'm caching it anyways
      cookies.set(domain, `SESS${md5(`${domain}.schoology.com`)}=anything lol`)
    }

    assert(validId.test(userId), 'Tasteless user ID.')
    assert(validId.test(portfolioId), 'Boring portfolio ID.')
    assert(validId.test(pageId), 'Page ID has no flavour.')
    assert(validHash.test(publicHash), 'Public hash doesn\'t seem like a hash.')

    const { metadata: { content } } = await fetch(
      sgyPortfolio(domain, userId, portfolioId, pageId),
      {
        headers: {
          cookie: cookies.get(domain),
          'X-Csrf-Token': csrfToken,
          'X-Public-Hash': publicHash
        }
      }
    )
      .then(responseOk)
      .then(r => r.json())

    const update = content.includes(`[love${nid}]`)
      ? {
        $addToSet: {
          dislikers: userId
        }
      }
      : {
        $pull: {
          dislikers: userId
        }
      }
    await dislikes.updateOne({ domainNid }, {
      ...update,
      $setOnInsert: {
        domainNid
      }
    }, {
      upsert: true
    })
  }))

  router.get('/dislike/:domain/', asyncHandler(async (req, res) => {
    const { domain } = req.params
    assert(validDomain.test(domain), 'Bad domain. It should be a valid subdomain of Schoology.')
    const domainNids = req.query.nids
      .split('-')
      .filter(nid => validId.test(nid))
      .map(nid => `${domain}-${nid}`)

    if (domainNids.length === 0) {
      return res.send({})
    }

    const nidToDislikers = {}
    const result = await dislikes.find({
      domainNid: { $in: domainNids }
    }).toArray()
    for (const { domainNid, dislikers } of result) {
      nidToDislikers[domainNid.replace(domain + '-', '')] = dislikers
    }
    res.send(nidToDislikers)
  }))
}

/*
I'm just putting this here because it's cool but no longer needed

const sgyInit = domain => `https://${domain}.schoology.com/portfolios/init`

// I don't think the CSRF token expires because it seems deterministic
const { data: { csrfToken } } = await fetch(sgyInit(domain), {
  headers: {
    // This is amazing
    cookie: `SESS${md5(`${domain}.schoology.com`)}=anything lol`
  }
})
  .then(responseOk)
  .then(r => r.json())

*/
