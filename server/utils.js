const crypto = require('crypto')

module.exports.asyncHandler = fn =>
  (req, res, next) =>
    fn(req, res, next).catch(next)

module.exports.has = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop)

// I arbitrarily chose 21
module.exports.randomID = (length = 21) => crypto.randomBytes(length).toString('hex')

module.exports.hashPassword = (password, salt) =>
  new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, hash) => {
      if (err) {
        reject(err)
      } else {
        resolve(hash.toString('hex'))
      }
    })
  })
