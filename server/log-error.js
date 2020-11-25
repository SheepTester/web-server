const fs = require('fs')
const path = require('path')

// https://stackoverflow.com/a/43370201
const errorStream = fs.createWriteStream(
  path.resolve(__dirname, '../public/error-log.txt'),
  { flags: 'a' }
)

module.exports = function logError (err, url = 'somewhere') {
  errorStream.write(`${new Date().toString()} at ${url}\n${err.stack}\n\n`)
}
