

  const DATA_URL = 'https://docs.google.com/spreadsheets/d/12m1zaJVgUwJj3-F19XFAWnyWzbaRHdC3SB-ARDRpf4k/pubhtml'
  const MARGINS = { top: 10, right: 10, bottom: 10, left: 10 }

  let width, height

  // load data
  Tabletop.init({ key: DATA_URL,
                  simpleSheet: true,
                  callback: (data) => {
                    // convert data to javascript types
                    data.forEach( (d) => { d.year = + d.year } )
                    // load and install visualization
                    install(data, update)
                    // update the installed visualization
                    d3.select(window).on('resize', () => {
                      resize(window.innerWidth, window.innerHeight)
                    })
                    // animate to new focus on mouse hover
                    d3.select('svg').on('mouseover', () => {
                      var year = d3.mouse(this)
                    })
                  }
                })

  // update visualization when window is resized
  function resize(new_width, new_height) {
    width = new_width
    height = new_height
  }

  function focus(year) {
  }


  // generate timeline
  function visualize(data) {
    type(data)

    var svg = d3.select('#viz')
      .attr('width', width + margins.left + margins.right)
      .attr('height', height + margins.top + margins.bottom)
      .append('g')
        .attr('transform', 'translate(' + [margins.left, margins.top] + ')')

    var categories = d3.set(data.map(function(d) { return d.category }))
    categories = categories.values()
    categories.sort()

    var color = d3.scale.ordinal()
      .domain(categories)
      .range(['#705685', '#ba0d5e', '#9da42a', '#e88b00', '#44739b', '#12a19a'])

    var y = d3.scale.ordinal()
      .domain(categories)
      .rangeRoundPoints([height / 3, height - 20])
    var image_size = y.range()[1] - y.range()[0]

    var years = d3.extent(data, function(d) { return d.year })

    var deflection = {}
    deflection[years[0] - running] = 0
    deflection[years[1] + running] = 0
    data.forEach(function(d0) {
      data.forEach(function(d1) {
        if(Math.abs(d1.year - d0.year) < running) {
          deflection[d1.year] = (deflection[d1.year] || 0) + 1
        }
      })
    })

    var x = d3.scale.linear()
      .domain(d3.extent(d3.keys(deflection)))
      .range([0, width])

    var deflect_scale = d3.scale.linear()
      .domain([0,d3.max(d3.values(deflection))])
      .range([0,height / 3])

    var y_axis = svg.append('g')
        .attr('class', 'y axis')
      .selectAll('image')
        .data(categories)
      .enter().append('use')
        .attr('xlink:href', function(d) { return 'icons.svg#' + d })
        .attr('transform', function(d) { return 'translate(' + [-30, y(d)-15] +')scale(.5)' })

    var x_axis = d3.svg.axis()
      .orient('bottom')
      .scale(x)
      .tickFormat(function(d) { return '' + d })

    svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(' + [0, height] + ')')
      .call(x_axis)

    var timeline = svg.append('g')
      .attr('class', 'timeline')

    var path = timeline.selectAll('path')
        .data(categories)
      .enter().append('path')

    path.attr('d', function(cat) {
      var line = d3.svg.line()
        .x(function(d) { return x(+d.key) })
        .y(function(d) { return y(cat) - deflect_scale(deflection[d.key]) })
        .interpolate('monotone')

      return line(d3.entries(deflection))
    })

    var entries_e = timeline.selectAll('.entry')
        .data(data)
      .enter().append('g')
        .attr('class', 'entry')
        .attr('transform', function(d) { return 'translate(' + x(d.year) + ')' })

    entries_e.append('circle')
        .attr('cy', function(d) { return y(d.category) - deflect_scale(deflection[d.year]) })
        .attr('fill', function(d) { return color(d.category) })

    var label = entries_e.append('g')
      .attr('class', 'label')

    label.append('line')
      .attr('y2', function(d) { return y(d.category) - deflect_scale(deflection[d.year]) })

    var box = label.append('g')
      .attr('class', 'box')
      .attr('transform', function(d) { return 'translate(' + (width - x(d.year) > 350 ? 5 : -355) + ')' })

    box.append('rect')
      .attr('x', 5)
      .attr('y', '-0.3em')
      .attr('width', 350)

    box.append('text')
      .attr('class', 'title')
      .attr('x', 0)
      .attr('y', 0)
      .attr('dy', '.66em')
      .text(function(d) { return d.title })
      .call(wrap, 350)

    box.append('text')
      .attr('class', 'blurb')
      .attr('x', 0)
      .attr('y', 0)
      .attr('dy', 3.66 +'em')
      .text(function(d) { return d.text })
      .call(wrap, 350)

    box.each(function() {
      var me = d3.select(this)
      var lines = me.selectAll('tspan').size() + 3
      me.select('rect')
        .attr('height', lines + 'em')
    })
  }

  // from https://bl.ocks.org/mbostock/4341954
  function kernelDensityEstimator(kernel, x) {
    return function(sample) {
      return x.map(function(x) {
        return [x, d3.mean(sample, function(v) { return kernel(x - v); })];
      });
    };
  }
  function epanechnikovKernel(scale) {
    return function(u) {
      return Math.abs(u /= scale) <= 1 ? .75 * (1 - u * u) / scale : 0;
    };
  }

  // from https://bl.ocks.org/mbostock/7555321
  function wrap(text, width) {
    text.each(function() {
      var text = d3.select(this),
          words = text.text().split(/\s+/).reverse(),
          word,
          line = [],
          lineNumber = 0,
          lineHeight = 1.1, // ems
          y = text.attr("y"),
          dy = parseFloat(text.attr("dy")),
          tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
      while (word = words.pop()) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
        }
      }
    });
}