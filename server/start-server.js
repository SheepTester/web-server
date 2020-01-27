const forever = require('forever-monitor')
const path = require('path')

const child = new forever.Monitor(['npm', 'run', 'serve:loop'], {
  silent: false
})

child.on('restart', () => {
  console.log(`Restart #${child.times}`)
})

child.on('exit', () => {
  console.log('Okay I\'ll stop now')
})

child.start()
