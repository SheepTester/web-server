const forever = require('forever-monitor')
const path = require('path')

// https://stackoverflow.com/a/43285131
// But the regex that forever-monitor uses doesn't accept that
// https://github.com/foreversd/forever-monitor/blob/master/lib/forever-monitor/monitor.js#L517
// It needs to be quoted. (╯▔皿▔)╯
const child = new forever.Monitor([/^win/.test(process.platform) ? '"npm.cmd"' : 'npm', 'run', 'serve:loop'], {
  silent: false,
  env: { NODE_ENV: 'production' },
  logFile: path.resolve(__dirname, '../public/child-log.txt'),
  outFile: path.resolve(__dirname, '../public/child-stdout.txt'),
  errFile: path.resolve(__dirname, '../public/child-stderr.txt')
})

child.on('restart', () => {
  console.log(`Restart #${child.times} [${new Date().toLocaleTimeString()}]`)
})

child.on('exit', () => {
  console.log('Okay I\'ll stop now')
})

child.start()
