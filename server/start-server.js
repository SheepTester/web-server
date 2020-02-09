const forever = require('forever-monitor')

const child = new forever.Monitor(['npm', 'run', 'serve:loop'], {
  silent: false,
  env: { NODE_ENV: 'production' }
})

child.on('restart', () => {
  console.log(`Restart #${child.times}`)
})

child.on('exit', () => {
  console.log('Okay I\'ll stop now')
})

child.start()
