const forever = require('forever-monitor')
const path = require('path')

// https://stackoverflow.com/a/43285131
const child = new forever.Monitor([/^win/.test(process.platform) ? 'npm.cmd' : 'npm', 'run', 'serve:loop'], {
  silent: false,
  env: { NODE_ENV: 'production' },
  logFile: path.resolve(__dirname, '../public/child-log.txt'),
  outFile: path.resolve(__dirname, '../public/child-stdout.txt'),
  errFile: path.resolve(__dirname, '../public/child-stderr.txt')
})

child.on('restart', () => {
  console.log(`Restart #${child.times}`)
})

child.on('exit', () => {
  console.log('Okay I\'ll stop now')
})

child.start()
