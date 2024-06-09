const path = require('path')
const fs = require('fs')
const app = require('./app.js')

require('greenlock-express')
  .init({
    packageRoot: path.resolve(__dirname, '..'),
    configDir: './greenlock.d',
    maintainerEmail: 'seanthesheep22@outlook.com',
    cluster: false
  })
  .ready(servers => {
    const httpServer = servers.httpServer()
    const httpsServer = servers.httpsServer()
    app.stop = () => {
      httpServer.close()
      httpsServer.close()
    }
    app.onServer(httpsServer)
    console.log(`HTTPS server is running. [${new Date().toLocaleString()}]`)
  })
  .serve(app)

fs.writeFileSync(
  path.resolve(__dirname, '../public/last-pid-server.txt'),
  `[${new Date().toLocaleString('ja-JP', {
    timeZone: 'America/Los_Angeles'
  })}] ${process.pid} (server.js)`
)
