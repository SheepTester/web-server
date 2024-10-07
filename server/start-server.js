const forever = require('forever-monitor')
const path = require('path')
const fs = require('fs')

// All these Node programs look the same to me
process.title = 'WEBSERVER'

console.log(`Start [${new Date().toLocaleString()}]`)
console.error(`Start [${new Date().toLocaleString()}]`)

// https://stackoverflow.com/a/43285131
// But the regex that forever-monitor uses doesn't accept that
// https://github.com/foreversd/forever-monitor/blob/master/lib/forever-monitor/monitor.js#L517
// It needs to be quoted. (╯▔皿▔)╯
const child = new forever.Monitor(
  [/^win/.test(process.platform) ? '"npm.cmd"' : 'npm', 'run', 'serve:loop'],
  {
    silent: false,
    env: { NODE_ENV: 'production' },
    logFile: path.resolve(__dirname, '../public/child-log.txt'),
    outFile: path.resolve(__dirname, '../public/child-stdout.txt'),
    errFile: path.resolve(__dirname, '../public/child-stderr.txt'),
    // Undocumented option that avoids overwriting the file
    // https://github.com/foreversd/forever-monitor/blob/master/lib/forever-monitor/plugins/logger.js#L30
    append: true,
    // Breaking change, shell: true required to run .cmd on Windows to avoid
    // EINVAL
    // https://github.com/nodejs/node/issues/52681#issuecomment-2076426887
    spawnWith: { shell: true }
  }
)

child.on('restart', () => {
  console.log(`Restart #${child.times} [${new Date().toLocaleString()}]`)
  console.error(`Restart #${child.times} [${new Date().toLocaleString()}]`)
})

child.on('exit:code', code => {
  console.error(`Exit code ${code} [${new Date().toLocaleString()}]`)
})

child.on('exit', () => {
  console.log(`Okay, I'll stop now. [${new Date().toLocaleString()}]`)
})

fs.writeFileSync(
  path.resolve(__dirname, '../public/last-pid-start-server.txt'),
  `[${new Date().toLocaleString('ja-JP', {
    timeZone: 'America/Los_Angeles'
  })}] ${process.pid} (start-server.js)`
)

child.start()
