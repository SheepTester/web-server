const fs = require('fs')
const path = require('path')

const stream = fs.createWriteStream(
  path.resolve(__dirname, '../public/deprecated-routes.txt'),
  { flags: 'a' }
)
stream.write(`--- [${new Date().toLocaleString()}] ---\n`)

/**
 * @param {import('express').Request} req
 */
module.exports = function log (req) {
  stream.write(
    [
      '',
      `time: ${new Date().toLocaleString()}`,
      `path: ${req.method} ${req.path}`,
      `referer: ${req.get('referer') ?? req.get('origin')}`,
      `user-agent: ${req.get('user-agent')}`
    ].join('\n') + '\n'
  )
}
