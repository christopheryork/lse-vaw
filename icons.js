function icons(elem, data, callback) {
  var icons = d3.set(data.map(function(d) { return d.category }))

  icons = icons.values()
  icons.sort()

  d3.select(elem).selectAll('img')
      .data(icons)
    .enter().append('img')
      .attr('src', function(d) { return 'images/' + d + '.jpg' })
      .attr('alt', function(d) { return d })

  if(callback) { callback.call() }
}