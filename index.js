import Tabletop from 'tabletop'
import d3 from 'd3'

import fe from './fisheye'


const DATA_URL = 'https://docs.google.com/spreadsheets/d/12m1zaJVgUwJj3-F19XFAWnyWzbaRHdC3SB-ARDRpf4k/pubhtml'
const MARGINS = { top: 100, right: 100, bottom: 150, left: 100 }

const FISHEYE_DISTORTION = 8
const FISHEYE_DUR = 2000

const BLURB_WIDTH = 350

const CURSOR_PROPORTION = 0.2

// state

let width, height

let x, y, axis

let data, density


// bootstrap
Tabletop.init({ key: DATA_URL,
                simpleSheet: true,
                callback: (data) => {
                  // convert data to javascript types
                  data.forEach( (d) => { d.year = + d.year } )
                  // load and install visualization
                  install(document.body, data)
                  // update the installed visualization
                  throttle('resize', 'optimizedResize')
                  d3.select(window).on('optimizedResize', resize)
                  // animate to new focus on mouse hover
                  d3.select('svg .ether')
                    .on('mousemove', function() { focus(d3.mouse(this)) })
                    .on('mouseout',  function() { focus(null) })
                }
              })

// change fisheye distortion to focus on given screen point
let focus_time

function focus(center) {
  let dur = FISHEYE_DUR
  if(center) {
    focus_time = focus_time || new Date()
    dur = Math.max(0, FISHEYE_DUR - (new Date() - focus_time))
  } else {
    focus_time = null
  }
  update(dur, center)
}

// run once to set up state
function install(elem, new_data) {

  data = new_data

  // set up global state
  width = window.innerWidth - MARGINS.left - MARGINS.right
  height = window.innerHeight - MARGINS.top - MARGINS.bottom

  // d3 configuration and state

  x = fe.fisheye.scale(d3.scaleLinear)
    .domain(d3.extent(data.map((d) => d.year)))
    .distortion(0)

  axis = d3.axisBottom(x)
    .tickFormat(d3.format('4d'))

  // data analysis
  let kde = kernelDensityEstimator(epanechnikovKernel(20), x.ticks(100))
  density = kde(data.map( (d) => d.year ))

  y = d3.scaleLinear()
    .domain(d3.extent(density.map( (d) => d[1] )))

  // svg elements

  let svg = d3.select(elem)
    .append('svg')
      .append('g')
        .attr('transform', 'translate(' + [MARGINS.left, MARGINS.top] + ')')

  svg.append('rect')
    .attr('class', 'ether')

  svg.append('path')
    .attr('class', 'density')

  svg.append('g')
    .attr('class', 'x axis')

  let event = svg.append('g')
      .attr('class', 'events')
    .selectAll('.event')
      .data(data)
    .enter().append('g')
      .attr('class', 'event')

  let blurb = event.append('g')
    .attr('class', 'blurb stage_1')
    .attr('transform', 'translate(15,15)')

  blurb.append('text')
    .attr('class', 'title')
    .attr('x', 0)
    .attr('y', '5em')
    .attr('dy', '.66em')
    .text( (d) => d.title )
    .call(wrap, BLURB_WIDTH)

  blurb.append('text')
    .attr('class', 'text')
    .attr('x', 0)
    .attr('y', '7em')
    .attr('dy', '.66em')
    .text( (d) => d.text )
    .call(wrap, BLURB_WIDTH)

  event.append('path')
    .attr('class', 'pole stage_1')

  event.append('circle')
    .attr('class', 'anchor stage_0')

  let badge = event.append('g')
    .attr('class', 'badge stage_1')
    .attr('transform', 'translate(' + (BLURB_WIDTH/2) + ')')

  badge.append('circle')
    .attr('class', 'year border')
  badge.append('circle')
    .attr('class', 'year')

  badge.append('text')
    .attr('text-anchor', 'middle')
    .attr('y1', -height)
    .attr('dy', '.3em')
    .text( (d) => d.year )

  let cursor = svg.append('path')
    .attr('class', 'cursor')

  update()

  d3.selectAll('.stage_1')
    .attr('opacity', 0)
}

function update(dur=0, center=null) {

  // immediate changes

  x.distortion(center ? FISHEYE_DISTORTION : 0)
   .focus(center ? center[0] : 0)

  x.range([0, width])
  y.range([height, height * 1 / 5])

  let svg = d3.select('svg')
    .attr('width', width + MARGINS.left + MARGINS.right)
    .attr('height', height + MARGINS.top + MARGINS.bottom)

  svg.select('.ether')
    .attr('width', width)
    .attr('height', height)

  svg.select('.x.axis')
    .attr('transform', 'translate(' + [0, height] + ')')


  // (possibly) animated changes

  let opacity = d3.scalePow()
    .exponent(.5)
    .domain([0, width/2])
    .range([1, 0])

  let line = d3.area()
    .x( (d) => x(d[0]) )
    .y1( (d) => y(d[1]) )
    .y0(height)
    .curve(d3.curveBasis)

  svg = svg.transition()
    .duration(dur)

  svg.select('.density')
    .attr('d', line(density))

  svg.selectAll('.event')
    .attr('transform', (d) => 'translate(' + x(d.year) + ')')

  svg.selectAll('.event .pole')
    .attr('d', 'M0 ' + height + 'V0H' + (BLURB_WIDTH / 2))

  svg.selectAll('.event .anchor')
    .attr('cy', height)

  svg.selectAll('.event .stage_1')
    .attr('opacity', (d) => center ? opacity(Math.abs(center[0] - x(d.year))) : 0)

//      (center && Math.abs(center[0] - x(d.year)) < width * CURSOR_PROPORTION / 2 ? 1 : 0))

  let x_axis = svg.select('.x.axis')
    .call(axis)

  x_axis.selectAll('line')
      .attr('y2', '4em')
      .attr('y1', -height)

  x_axis.selectAll('text')
        .style('text-anchor', 'start')
        .attr('transform', 'rotate(-90)')
        .attr('x', '-4em')
        .attr('y', 0)
        .attr('dy', '-.3em')

  svg.select('.cursor')
     .attr('d', center ? 'M' + (center[0] - width * CURSOR_PROPORTION / 2) + ' ' + -MARGINS.top + 'h' + (width * CURSOR_PROPORTION) +
                         'v' + (height + MARGINS.top + MARGINS.bottom) + 'h' + -(width * CURSOR_PROPORTION) : '')
}


// update visualization when window is resized
function resize(new_width, new_height) {
  width = new_width || window.innerWidth - MARGINS.left - MARGINS.right
  height = new_height || window.innerHeight - MARGINS.top - MARGINS.bottom

  update()
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

/*

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
*/

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
        y = text.attr("y"),
        dy = parseFloat(text.attr("dy")),
        tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em")
    while (word = words.pop()) {
      line.push(word)
      tspan.text(line.join(" "))
      if (tspan.node().getComputedTextLength() > width) {
        line.pop()
        tspan.text(line.join(" "))
        line = [word]
        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word)
      }
    }
  })
}
