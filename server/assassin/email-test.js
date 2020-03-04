const mail = require('./mailer.js')

mail({
  from: { name: 'Orbiit Elimination', address: 'sy24484@pausd.us' },
  to: { address: 'seanthesheep22@outlook.com' },
  subject: 'Password reset link',
  text: `You said you forgot your password. If that was you, follow this link to reset your password:

https://nodemailer.com/message/

If that wasn't you, ignore this message.

May the odds ever be in your favour,
Ovinus Real.`
})
  .then(console.log)
