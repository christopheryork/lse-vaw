// import d3 from 'd3'

import fe from './fisheye'

const BLURB_WIDTH = 250

const MARGINS = { top: 75, right: 75, bottom: 150, left: 75 }
const MIN_SIZE = { width: BLURB_WIDTH + MARGINS.left + MARGINS.right,
                   height: 100 + MARGINS.top + MARGINS.bottom }

const FISHEYE_DISTORTION = 10

// state

let width, height   // screen state
let x, y            // scales
let density         // addit'l data
let axis            // components


// install svg elements
let svg = d3.select('body')
  .append('svg')

let g = svg.append('g')
  .attr('transform', 'translate(' + [MARGINS.left, MARGINS.top] + ')')

g.append('rect')
  .attr('class', 'ether')
g.append('path')
  .attr('class', 'density')
g.append('g')
  .attr('class', 'x axis')
g.append('g')
  .attr('class', 'anchors')
g.append('g')
  .attr('class', 'events')
g.append('g')
  .attr('class', 'blurbs')

// bootstrap
d3.tsv('./data.tsv', (err, data) => {
  if(err) throw err
  // convert data to javascript types
  data.forEach( (d,i) => { d.year = +d.year; d.index = i } )
  // load and install visualization
  let years = data.map( (d) => d.year )
  // calculate initial state and size
  calibrate(years)
  // initial draw
  redraw(data, width/2)
  // update the installed visualization on window resize
  throttle('resize', 'optimizedResize')
  d3.select(window).on('optimizedResize', function() {
    calibrate(years)
    redraw(data, width/2)
  })
  // animate to new focus on mouse hover
  d3.select('svg .ether')
    .on('mousemove', function() { redraw(data, d3.mouse(this)[0]) })
})


// new merged update function (install + update)
function redraw(data, center) {
  // adjust size
  svg.attr('width', width + MARGINS.left + MARGINS.right)
    .attr('height', height + MARGINS.top + MARGINS.bottom)
  svg.select('.ether')
    .attr('width', width)
    .attr('height', height + MARGINS.bottom)

  // adjust fisheye scale
  x.focus(center)

  // draw events
  let event = svg.select('.events')
    .selectAll('.event')
      .data(data, (d) => d.index)
  event.exit().remove()                // NOT TECHNICALLY NECESSARY
  event.enter().append('circle')
    .attr('class', 'event')
    .merge(event)
      .attr('cx', (d) => x(d.year))
      .attr('cy', height)

  // draw blurbs
  let num_blurbs = Math.floor(width / BLURB_WIDTH)
  let distances = data.map( (d) => Math.abs( x(d.year) - center))
  let blurb_events = d3.range(0,distances.length)
    .sort( (a,b) => d3.ascending(distances[a], distances[b]))   // sort event indices by distance from center
    .slice(0, num_blurbs)                                       // subset by number of visible blurbs
    .map( (i) => data[i] )                                      // dereference indices
    .sort( (a,b) => d3.ascending(a.year, b.year))               // show in timeline order left to right
  let blurb_scale = d3.scaleBand()
    .domain(d3.range(0,num_blurbs))
    .range([0,width])
    .padding(.15)

  let blurb_bounds = []
  let blurb = svg.select('.blurbs')
    .selectAll('.blurb')
      .data(blurb_events, (d) => d.index)

  blurb.exit()
    .each( function(d,i) { blurb_bounds[i] = null })
    .remove()
  let blurb_enter = blurb.enter().append('g')
    .attr('class', 'blurb')

  // year badge at top of blurb
  let badge = blurb_enter.append('g')
    .attr('class', 'badge')
    .attr('transform', 'translate(' + (blurb_scale.bandwidth()/2) + ')')
  badge.append('circle')
    .attr('class', 'year border')
  badge.append('circle')
    .attr('class', 'year')
  badge.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '.3em')
    .text( (d) => d.year )

  // blurb text

  blurb_enter.append('text')
    .attr('class', 'text')
    .attr('x', 0)
    .attr('y', '5em')
    .attr('dy', '.66em')
    .text( (d) => d.title /* + d.text */ )
    .call(wrap, blurb_scale.bandwidth())

  blurb_enter.merge(blurb)
    .attr('transform', (d,i) => 'translate(' + blurb_scale(i) + ')')
    .each( function(d,i) {
      blurb_bounds[i] = d3.select(this).node().getBBox()
    })

  // anchor lines between timeline and blurbs
  let anchor = svg.select('.anchors')
    .selectAll('.anchor')
      .data(blurb_events, (d) => d.index)

  anchor.exit().remove()
  anchor.enter().append('path')
    .attr('class', 'anchor')
    .merge(anchor)
      .attr('d', anchor_d)

  // draw axes
  let x_axis = svg.select('.x.axis')
    .attr('transform', 'translate(' + [0, height] + ')')
    .call(axis)

  x_axis.selectAll('line')
      .attr('y2', '4em')

  x_axis.selectAll('text')
        .style('text-anchor', 'start')
        .attr('transform', 'rotate(-90)')
        .attr('x', '-4em')
        .attr('y', 0)
        .attr('dy', '-.3em')

  // SVG path string for an anchor
  function anchor_d(d,i) {
    const BLURB_PADDING = 25
    const ANCHOR_NUDGE = height / 4
    let blurb_margin = blurb_scale.bandwidth() * blurb_scale.paddingInner() / 5
    let curve = d3.line().curve(d3.curveBasis)
    let blurb_x = blurb_scale(i) + blurb_scale.bandwidth()/2
    let blurb_y = blurb_bounds[i].y + blurb_bounds[i].height + blurb_margin*3
    let anchor_y = d3.max(blurb_bounds, (d) => d.y + d.height) + blurb_margin*3 + ANCHOR_NUDGE / 2
    let event_x = x(d.year)

    let points = [ [event_x, height],
                   [event_x, height - ANCHOR_NUDGE],
                   [blurb_x, anchor_y],
                   [blurb_x, blurb_y] ]
    let path = 'M' + [blurb_scale(i) - blurb_margin, blurb_y - blurb_margin*2] +
               'v' + (BLURB_PADDING/2) +
               'h' + (blurb_scale.bandwidth() + blurb_margin*2) +
               'v' + (-BLURB_PADDING/2)
    return curve(points) + path
  }

}

// set state based on screen size
function calibrate(years) {
  width = Math.max(window.innerWidth - MARGINS.left - MARGINS.right, MIN_SIZE.width)
  height = Math.max(window.innerHeight - MARGINS.top - MARGINS.bottom, MIN_SIZE.height)

  console.log('calibrated: ' + width + 'x' + height)

  // major scale: years
  x = fe.fisheye.scale(d3.scaleLinear)
    .domain(d3.extent(years))
    .range([0,width])
    .distortion(FISHEYE_DISTORTION)

  // data analysis based on x scale
  let kde = kernelDensityEstimator(epanechnikovKernel(20), x.ticks(100))
  density = kde(years)

  // minor scale: density
  y = d3.scaleLinear()
    .domain(d3.extent(density.map( (d) => d[1] )))
    .range([height, height * 1 / 5])

  // major scale axis
  axis = d3.axisBottom(x)
    .tickFormat(d3.format('4d'))
}

// utilities
function throttle(type, name, obj) {
  obj = obj || window
  var running = false
  var func = function() {
    if (running) { return; }
    running = true
     requestAnimationFrame(function() {
       obj.dispatchEvent(new CustomEvent(name))
       running = false
    })
  }
  obj.addEventListener(type, func)
}

// from https://bl.ocks.org/mbostock/4341954
function kernelDensityEstimator(kernel, x) {
  return function(sample) {
    return x.map(function(x) {
      return [x, d3.mean(sample, function(v) { return kernel(x - v); })]
    })
  }
}
function epanechnikovKernel(scale) {
  return function(u) {
    return Math.abs(u /= scale) <= 1 ? .75 * (1 - u * u) / scale : 0
  }
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
        x = text.attr("x"),
        y = text.attr("y"),
        dy = parseFloat(text.attr("dy")),
        tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em")
    while (word = words.pop()) {
      line.push(word)
      tspan.text(line.join(" "))
      if (tspan.node().getComputedTextLength() > width) {
        line.pop()
        tspan.text(line.join(" "))
        line = [word]
        tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word)
      }
    }
  })
}
