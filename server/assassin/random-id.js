const fs = require('fs').promises
const path = require('path')

module.exports = fs.readFile(path.resolve(__dirname, './nouns.txt'), 'utf8')
  .then(nouns => {
    nouns = nouns.split(/\r?\n/).filter(word => word)
    return (words = 1) => {
      const id = []
      for (let i = 0; i < words; i++) {
        id.push(nouns[Math.floor(Math.random() * nouns.length)])
      }
      return id
    }
  })
