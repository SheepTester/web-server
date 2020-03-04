const nodemailer = require('nodemailer')
const { email, password } = require('./gmail.json')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: email,
    pass: password
  }
})

module.exports = function mail (options) {
  return new Promise((resolve, reject) => {
    transporter.sendMail(options, (error, info) => {
      if (error) reject(error)
      else resolve(info)
    })
  })
}
