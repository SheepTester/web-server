// Run local database
// /c/Program\ Files/MongoDB/Server/4.4/bin/mongod.exe

const logError = require('./log-error.js')

const { MongoClient } = require('mongodb')
const client = new MongoClient('mongodb://127.0.0.1:27017', {
  // Using these because https://mongoosejs.com/ does /shrug
  useNewUrlParser: true,
  useUnifiedTopology: true
})
module.exports = client.connect()
  .then(() => client)
  .catch(err => {
    logError(err, 'db.js (connecting to the database)')
    client.close()
    return Promise.reject(err)
  })
