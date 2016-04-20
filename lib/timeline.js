function timeline(elem, data, callback) {

  var converter = new showdown.Converter({headerLevelStart: 4})

  var nest = d3.nest()
    .key(function(d) { return d.period })
    .sortKeys(function(a,b) { return d3.ascending(period(a)[0], period(b)[0]) })
    .sortValues(function(a,b) { return d3.ascending(a.year, b.year) })
    .entries(data)

  var section = d3.select(elem).selectAll('section')
      .data(nest)
    .enter().append('section')
      .attr('class', 'period')

  section.append('h2')
      .html(function(d) { return d.key })

  var entry = section.append('ul').selectAll('li')
        .data( function(d) { return d.values })
      .enter().append('li')

  entry.append('div').attr('class', 'banner')
       .append('div').attr('class', 'year')
    .html( function(d) { return d.year })
  entry.append('div').html( function(d) { return converter.makeHtml('#' + d.title) })
  entry.append('div').html( function(d) { return converter.makeHtml(d.text) })

  if(callback) { callback.call() }

  // determine when a named period started
  function period(name) {
    return d3.extent(data.filter(function(d) { return d.period === name })
                         .map(function(d) { return d.year }))
  }
}