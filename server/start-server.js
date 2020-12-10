const forever = require('forever-monitor')

// https://stackoverflow.com/a/43285131
const child = new forever.Monitor([/^win/.test(process.platform) ? 'npm.cmd' : 'npm', 'run', 'serve:loop'], {
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
