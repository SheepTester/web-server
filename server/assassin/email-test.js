const templates = require('./email-templates.js')

templates.mail(
  'seanthesheep22@outlook.com',
  templates.resetPassword({
    username: 'test-user-1',
    resetID: 'be8c72248c0c01fde291acd0133839a4ac49dcc8d0'
  })
)
  .then(console.log)
