class BaseElement extends HTMLElement {
  constructor() {
    super();
    this._renderId = null;
  }

  setState(patch) {
    Object.assign(this, patch);
    this._scheduleRender();
  }

  _scheduleRender() {
    if (!this.isConnected || this._renderId) return;

    this._renderId = requestAnimationFrame(() => {
      this._renderId = null;
      this.render();
    });
  }

  disconnectedCallback() {
    if (this._renderId) {
      cancelAnimationFrame(this._renderId);
      this._renderId = null;
    }
  }
}