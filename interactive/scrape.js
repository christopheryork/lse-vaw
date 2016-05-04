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
    let title = enquote( $(this).find('h4').text() )
    let text = enquote( $(this).find('h4').nextAll().text() )

    let cols = [period, year, title, text]

    lines.push(cols.join('\t'))
  })
})

let out = fs.writeFileSync('./data.tsv', lines.join('\n'))

function enquote(s) {
  // see RFC4180: http://tools.ietf.org/html/rfc4180
  if (s.match(/(\t|"|\n)/)) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}
