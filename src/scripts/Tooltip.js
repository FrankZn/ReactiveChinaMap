function properties2html(properties) {
  var html = '';
  for (const [key, value] of Object.entries(properties)) {
    html += `${key}: ${value}<br />`
  }
  return html;
}

export default class Tooltip {
  #OM;
  offset_x = 8;
  offset_y = 8;
  duration = 200;
  opacity = 0.8;
  setDiv(div) {
    this.div = div;
    this.tooltip = div.append("div")
        .classed("tooltip", true)
        .style("opacity", 0);
    return this;
  }

  setOM(OM) {
    this.#OM = OM;
    this.#OM
        .subscribe("region-mouseover", this.handle_mouseover)
        .subscribe("region-mousemove", this.handle_mousemove)
        .subscribe("region-mouseleave", this.handle_mouseleave);

    return this;
  }

  handle_mouseover = ({event, d}) => {
    this.tooltip
        .html(properties2html(d.properties))
        .transition()
        .duration(this.duration)
        .style("opacity", this.opacity)
        .style("left", `${event.clientX + this.offset_x}px`)
        .style("top", `${event.clientY + this.offset_y}px`);
  }

  handle_mousemove = ({event, d}) => {
    this.tooltip
        .style("left", `${event.clientX + this.offset_x}px`)
        .style("top", `${event.clientY + this.offset_y}px`);
  }

  handle_mouseleave = ({event, d}) => {
    this.tooltip.transition()
        .duration(this.duration)
        .style("opacity", 0);
  }
}
