"use strict"

/*
 * Extract TSV data file from main project index.html file
 */

let fs = require('fs')
let cheerio = require('cheerio')

let $ = cheerio.load(fs.readFileSync('../index.html'))

let lines = []

lines.push(['period','year','title','text'].join('\t'))

$('.period').each( function() {
  let period = $(this).find('h2').text()

  $(this).find('li').each( function() {
    let year = $(this).find('.year').text()
    let title = $(this).find('h4').text()
    let text = $(this).find('p').text()

    lines.push([period, year, title, text].join('\t').trim())
  })
})

let out = fs.writeFileSync('./data.tsv', lines.join('\n'))