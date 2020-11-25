const path = require('path')
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
  })
  .serve(app)
