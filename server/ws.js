let wsIsReady
const wsReady = new Promise(resolve => {
  wsIsReady = resolve
})
module.exports = { wsReady, wsIsReady }
