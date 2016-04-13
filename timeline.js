function timeline(elem, callback) {
  // fetch and visualize data
  d3.csv('data.csv', function(err, data) {
    if(err) throw err

    type(data)

    let nest = d3.nest()
      .key(function(d) { return d.period })
      .sortKeys(function(a,b) { return d3.ascending(period(a)[0], period(b)[0]) })
      .sortValues(function(a,b) { return d3.ascending(a.year, b.year) })
      .entries(data)

    let section = d3.select(elem).selectAll('section')
        .data(nest)
      .enter().append('section')
        .attr('class', 'period')

    section.append('h2')
        .html(function(d) { return d.key })

    let entry = section.append('ul').selectAll('li')
          .data( function(d) { return d.values })
        .enter().append('li')

    entry.append('div').attr('class', 'banner')
         .append('div').attr('class', 'year')
      .html( function(d) { return d.year })
    entry.append('h4').html( function(d) { return d.title })
    entry.append('p').html( function(d) { return d.text })

    if(callback) { callback.call() }

    // determine when a named period started
    function period(name) {
      return d3.extent(data.filter(function(d) { return d.period === name })
                           .map(function(d) { return d.year }))
    }
  })

  // convert ajax data file to javascript types
  function type(data) {
    data.forEach(function(d) {
      d.year = +d.year
    })
  }
}
