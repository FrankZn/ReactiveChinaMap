import Zoom from "./Zoom.js";

const __CONFIG__ = {
  main_id: "map",
  sidebar_id: "sidebar"
}

function select_main(config=__CONFIG__) {
  return d3.select(`#${config.main_id}`);
}

function select_sidebar(config=__CONFIG__) {
  return d3.select(`#${config.sidebar_id}`);
}

function properties2html(properties) {
  var html = '';
  for (const [key, value] of Object.entries(properties)) {
    html += `${key}: ${value}<br />`
  }
  return html;
}

class StateMain {
  #selected = [];
  #adcodes;
  #OM;
  #full_geojsons = {};
  #single_geojsons = {};

  setOM(OM) {
    this.#OM = OM;
    OM.subscribe("region-click", this.handle_select);
    return this;
  }

  init() {
    const json = d3.json('static/adcode.json')
      .then(data => this.#adcodes = data);

    // return Promise.all([csv, json]);
    return json;
  }

  handle_select = ({event, adcode}) => {
    const i = this.#selected.indexOf(adcode);
    if (i >= 0)   // Delete adcode from this.selected
      this.#selected.splice(i, 1);
    else          // Add adcode to this.selected
      this.#selected.push(adcode);

    this.#OM.publish("state-update-region-selected", this.#selected);
  }

  is_parent = (adcode) => this.#adcodes[adcode].children.length > 0;

  get_parent = (adcode) => {
    return this.#adcodes[adcode].parent;
  }

  get_name = (adcode) => {
    return this.#adcodes[adcode].name;
  }

  async get_full_geojson(adcode) {
    if (adcode in this.#full_geojsons)
      return this.#full_geojsons[adcode];
    
    const url = `static/geojson/${adcode}_full.json`;
    return d3.json(url)
      .then(geojson => {
        return this.#full_geojsons[adcode] = geojson;
      });
  }

  async get_single_geojson(adcode) {
    if (adcode in this.#single_geojsons)
      return this.#single_geojsons[adcode];
    const parent_adcode = this.get_parent(adcode);
    const geojson = await this.get_full_geojson(parent_adcode);
    for (let feature of geojson.features) {
      if (feature.properties.adcode == adcode) {
        return this.#single_geojsons[adcode] = feature;
      }
    }
  }
}

class MapTooltip {
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
    OM.subscribe("region-mouseover", this.handle_mouseover)
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

class SelectedTable {
  data = [];

  setDiv(div) {
    this.div = div;
    this.table = div.append("table")
        .classed("selected-counties", true);
    return this;
  }

  setOM(OM) {
    this.OM = OM;
    OM.subscribe("state-update-region-selected", this.handle_state_update_region_selected);
    return this;
  }

  setState(state) {
    this.state = state;
    return this;
  }

  valid_adcode_filter = (adcode) => {
    return true;
  }

  handle_state_update_region_selected = (selected) => {
    this.data = selected.filter(this.valid_adcode_filter);
    this.render();
  }

  handle_region_click = (event, adcode) => {
    this.OM.publish("region-click", {event, adcode});
  }

  render = () => {
    const entries = this.table.selectAll("tr")
        .data(this.data)
        .join("tr")
        .classed("selected-counties", true)
        .text(adcode => "");  // Necessary
    entries
      .append("td")
        .classed("selected-counties", true)
        .text(adcode => this.state.get_name(adcode));
    entries
      .append("td")
        .classed("selected-counties", true)
      .append("button")
        .text("delete")
        .on("click", (event, adcode) => this.handle_region_click(event, adcode));
    return this;
  }
}

class MapMain {
  #OM;
  #pre_selected = [];
  adcode = "100000";
  center = [112.72, 32.357];
  scale = 360;
  constructor() {
  }

  setOM(OM) {
    this.#OM = OM;
    OM.subscribe("state-update-region-selected", this.handle_state_update_region_selected);
    OM.subscribe("event-render-adcode", this.handle_event_render_adcode);
    OM.subscribe("event-zoom-transform", this.handle_event_zoom_transform);
    OM.subscribe("event-render-parent", this.handle_event_render_parent);
    return this;
  }

  setSvg(svg) {
    const rect = svg.node().getBoundingClientRect();
    this.translate = [rect.width/2, rect.height/2];
    this.projection = d3.geoMercator()
        .center(this.center)
        .scale(this.scale)
        .translate(this.translate);

    // Add groups
    this.map_g = svg.append("g")
        .classed("regions", true);
    this.current_g = this.map_g.append("g")
        .classed("current-regions", true);
    this.selected_g = this.map_g.append("g")
        .classed("selected-regions", true);

    return this;
  }

  setState(state) {
    this.state = state;
    return this;
  }

  handle_state_update_region_selected = (selected) => {
    this.update_map(selected);
  }

  handle_event_render_adcode = ({adcode}) => {
    return this.render(adcode);
  }

  handle_event_zoom_transform = ({transform}) => {
    this.map_g.attr("transform", transform);
  }

  handle_event_render_parent = () => {
    if(this.state.get_parent(this.adcode)) {
      this.render(this.state.get_parent(this.adcode));
    }
  }

  update_map = async (selected) => {
    if (selected == undefined)
      selected = this.#pre_selected;
    else
      this.#pre_selected = selected;

    const path = d3.geoPath().projection(this.projection);
    const adcodes = selected
      // .filter(this.valid_adcode_filter)
      .filter(adcode => {
        if (this.state.get_parent(adcode)) {    // Filter directed ancestor
          adcode = this.state.get_parent(adcode);
          if (adcode == this.adcode)
            return false;
        }
        while(this.state.get_parent(adcode)) {  // Filter indirect ancestor
          adcode = this.state.get_parent(adcode);
          if (adcode == this.adcode)
            return true;
        }
        return false;
      });

    const data = await Promise.all(adcodes
      .map(async (adcode) => this.state.get_single_geojson(adcode)));

    this.selected_g
      .selectAll("path.region")
      .data(data)
      .join("path")
        .classed("region", true)
        .attr("d", path);

    this.current_g
      .selectAll("path.region")
        .classed("selected-region", d => {
          const adcode = d.properties.adcode;
          return selected.includes(adcode);
        });
  }

  handle_region_click = async (event, d) => {
    const adcode = d.properties.adcode;
    this.#OM.publish("region-click", {event, adcode});
    await this.state.get_single_geojson(adcode);
  }

  render_map = (geojson) => {
    const projection = this.projection;
    const path = d3.geoPath().projection(projection);

    this.current_g
      .selectAll("path.region")
      .data(geojson.features)
      .join("path")
        .classed("region", true)
        .attr("d", path)
        .on("click", this.handle_region_click)
        .on("mouseover", (event, d) => this.#OM.publish("region-mouseover", {event, d}))
        .on("mousemove", (event, d) => this.#OM.publish("region-mousemove", {event, d}))
        .on("mouseleave", (event, d) => this.#OM.publish("region-mouseleave", {event, d}))
        .on("wheel", this.handle_wheel)
    this.update_map();
    return geojson;
  }
  
  render_center = (geojson) => {
    const projection = this.projection;
    const data = geojson.features.filter(d => "center" in d.properties)
  
    this.map_g.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", d =>  projection(d.properties.center)[0])
      .attr("cy", d => projection(d.properties.center)[1])
      .attr('r', 2)
      .attr('fill', "lavender");
    return geojson;
  }

  handle_wheel = (event, d) => {
    if (event.wheelDelta > 0) {
      this.render(d.properties.adcode);
    }
  }

  render(adcode) {
    if (this.state.is_parent(adcode)) {
      this.adcode = adcode;
      this.state.get_full_geojson(adcode)
        .then(this.render_map)
        // .then(this.render_center)
        .catch(e => console.log(e));
    }
  }
}

class TimeSlider {
  setSvg(svg) {
    this.svg = svg;
    return this;
  }

  setOM(OM) {
    this.OM = OM;
    return this;
  }

  render() {
    const years = d3.range(0, 17)
      .map(d => new Date(1997+d, 1, 1));
    this.time_slider = d3.sliderBottom()
        .min(d3.min(years))
        .max(d3.max(years))
        .step(1000*60*60*24*365)
        .width(300)
        .tickFormat(d3.timeFormat('%Y'))
        .tickValues(years.filter((d, i) => i % 2 == 0))
        .default(new Date(1997, 1, 1))
        .on("onchange", val => {
          this.OM.publish("year_update", val.getFullYear());
        })

    this.svg.append('g')
        .classed('time-slider', true)
        .call(this.time_slider);

    return this;
  }
}

export default async function map_main(OM) {
  
  const div = select_main();
  const sidebar = select_sidebar();
  const svg = div.append("svg").classed("map", true);

  const state = new StateMain();
  state
      .setOM(OM);
  await state.init();
  
  const map = new MapMain()
      .setOM(OM)
      .setSvg(svg)
      .setState(state);
  map.render(map.adcode);

  const zoom = new Zoom();
  zoom
      .setOM(OM)
      .setSvg(svg);

  const tooltip = new MapTooltip();
  tooltip
      .setDiv(div)
      .setOM(OM);

  const selected_table = new SelectedTable();
  selected_table
      .setDiv(sidebar)
      .setOM(OM)
      .setState(state)
      .render();

  const time_slider = new TimeSlider();
  time_slider
      .setSvg(svg)
      .setOM(OM)
      .render();

  state.handle_select({adcode: "110105"});
  state.handle_select({adcode: "110106"});
  state.handle_select({adcode: "110107"});

  return map;
}
