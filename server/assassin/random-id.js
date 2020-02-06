const fs = require('fs').promises
const path = require('path')

module.exports = fs.readFile(path.resolve(__dirname, './nouns.txt'), 'utf8')
  .then(nouns => {
    nouns = nouns.split('\n').filter(word => word)
    return () => {
      const id = []
      for (let i = 0; i < 4; i++) {
        id.push(nouns[Math.floor(Math.random() * nouns.length)])
      }
      return id.join(' ')
    }
  })
