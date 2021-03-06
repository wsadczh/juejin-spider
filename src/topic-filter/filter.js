const chalk = require('chalk')
const request = require('request-promise')
const { createHeap, findMaxPrev } = require('../utils/sortPrev')
const travelArticleData = require('../utils/travelArticleData')
const saveDataTofile = require('../utils/saveDataTofile')

function filterTitle(title, filterName) {
  let shouldAdd = false
  let targets = []
  let orMatch = false
  const newTitle = title.toLowerCase().replace(/[\s]/g, '')

  if (filterName.includes('&')) {
    targets = filterName.split('&').filter(_ => !!_.length)
  } else if (filterName.includes('|')) {
    orMatch = true
    targets = filterName.split('|').filter(_ => !!_.length)
  }

  if (orMatch) {
    shouldAdd = targets.some(v => {
      return newTitle.includes(v)
    })
  } else {
    shouldAdd = targets.every(v => {
      return newTitle.includes(v)
    })
  }

  return shouldAdd
}

module.exports = function filter(filterName, cb) {
  const calcStart = Date.now()
  console.log(`topic-filter ${filterName} start`)

  const idSet = new Set()
  const allArticleObj = {}

  function compareVal(a) {
    return a.collectionCount || 0
  }

  const target = Array(1000).fill({ collectionCount: 0 })

  createHeap(target, compareVal)

  travelArticleData(articleInfo => {
    const { objectId, user, collectionCount, title } = articleInfo
    if (!idSet.has(objectId) && filterTitle(title, filterName)) {
      idSet.add(objectId)
      allArticleObj[objectId] = objectId
      console.log(
        chalk.cyan(
          `collectionCount => ${collectionCount}, user => ${user.username}, level => ${user.level}`
        )
      )

      findMaxPrev(articleInfo, target, compareVal)
    }
  })

  target.sort((a, b) => b.collectionCount - a.collectionCount)

  saveDataTofile(
    '../topic-filter/assets',
    `filter-${filterName}.json`.replace(/\|/g, 'or'),
    target
  )

  // save as md
  async function generateMd() {
    const { sysTime1 } = await request('http://quan.suning.com/getSysTime.do', {
      json: true,
    })

    const timeStr = sysTime1.substr(0, 8)
    const title = `# ${filterName} 排行(${timeStr})\n\n`
    let content = '👍 点赞数，📌 标签\n'
    target.forEach((v, i) => {
      try {
        content += `- (${i + 1})[👍 ${v.collectionCount}][📌 ${
          v.tags[0].title
        }][${v.user.username}] [${v.title}](${v.originalUrl})\n`
      } catch (e) {
        console.log('maybe some error', e)
        console.log(v)
      }
    })

    saveDataTofile(
      '../topic-filter/assets',
      `filter-${filterName}.md`.replace(/\|/g, 'or'),
      title + content,
      false
    )
  }

  generateMd()
  console.log(`topic-filter ${filterName} end`)
  console.log(`${((Date.now() - calcStart) / 1000).toFixed(2)} s`)
  cb()
}
