export default class Zoom {
    #OM;
  
    setOM(OM) {
      this.#OM = OM;
      return this;
    }
  
    setSvg(svg) {
      const rect = svg.node().getBoundingClientRect();
      const zoom = d3.zoom()
        .translateExtent([[-5, -5], [rect.width+5, rect.height+5]])
        .scaleExtent([1, 256])
        .on("start", this.handle_zoom_start)
        .on("zoom", this.handle_zoom)
        .on("end", this.handle_zoom_end);
      svg.call(zoom);
    }
  
    #k_before_zoom = 1;
    handle_zoom_start = (event) => {
      const transform = event.transform;
      this.#k_before_zoom = transform.k;
    }
  
    handle_zoom = (event) => {
      const transform = event.transform;
      this.#OM.publish("event-zoom-transform", {transform});
    }
  
    handle_zoom_end = (event) => {
      const transform = event.transform;
      if (transform.k == 1) {
        this.#OM.publish("event-render-adcode", {adcode: "100000"});
      }
      else if (transform.k < 4 && transform.k < this.#k_before_zoom) {
        this.#OM.publish("event-render-parent", {});
      }
    }
  }
