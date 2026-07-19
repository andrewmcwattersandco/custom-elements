class BaseElement extends HTMLElement {
  constructor() {
    super();
    this._renderId = null;
    this._controller = null;
    this._resourceKeys = [];
  }

  setState(patch) {
    Object.assign(this, patch);
    this._scheduleRender();
  }

  async _parseBody(res) {
    const type = res.headers.get('content-type') || '';

    if (type.includes('application/octet-stream')) return res.arrayBuffer();
    if (type.startsWith('image/') || type.startsWith('audio/') || type.startsWith('video/')) return res.blob();
    if (type.includes('multipart/form-data')) return res.formData();
    if (type.includes('application/json')) return res.json();
    if (type.includes('text/') || type.includes('application/xml')) return res.text();

    return res.text();
  }

  _getResourceState() {
    const readyState = this._resourceKeys.every((key) => this[key]?.readyState === 'done')
      ? 'done'
      : 'pending';
    const error = this._resourceKeys.map((key) => this[key]?.error).find(Boolean) ?? null;
    return { readyState, error };
  }

  async fetchState(urls) {
    if (this._controller) {
      this._controller.abort();
    }

    const controller = new AbortController();
    this._controller = controller;
    const { signal } = controller;
    const keys = Object.keys(urls);

    const staleKeys = this._resourceKeys.filter((key) => !keys.includes(key));
    staleKeys.forEach((key) => delete this[key]);

    this._resourceKeys = keys;

    this.setState({
      ...Object.fromEntries(
        keys.map((key) => [key, { error: null, readyState: 'pending', response: null }])
      ),
      ...this._getResourceState(),
    });

    keys.forEach(async (key) => {
      try {
        const res = await fetch(urls[key], { signal });
        const response = await this._parseBody(res);
        if (!res.ok) {
          const message = typeof response === 'string' ? response : response?.message || res.statusText;
          throw new Error(message);
        }
        if (signal.aborted) return;
        this[key] = { error: null, readyState: 'done', response };
        this.setState(this._getResourceState());
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error(error);
        if (signal.aborted) return;
        this[key] = { error, readyState: 'done', response: null };
        this.setState(this._getResourceState());
      }
    });
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
    if (this._controller) {
      this._controller.abort();
      this._controller = null;
    }
  }
}