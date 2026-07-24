class BaseElement extends HTMLElement {
  constructor() {
    super();
    this._renderId = null;
    this._controllers = [];
    this._resourceKeys = [];
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

  fetchData(url) {
    const controller = new AbortController();
    this._controllers = [...this._controllers, controller];
    const { signal } = controller;

    const resource = { error: null, readyState: 'pending', data: null };
    resource[Symbol.for('isResource')] = true;
    resource[Symbol.for('controller')] = controller;

    const cleanup = () => {
      this._controllers = this._controllers.filter((c) => c !== controller);
    };

    (async () => {
      try {
        const res = await fetch(url, { signal });
        if (signal.aborted) { cleanup(); return; }
        const response = await this._parseBody(res);
        if (!res.ok) {
          const message = typeof response === 'string' ? response : response?.message || res.statusText;
          throw new Error(message);
        }
        resource.error = null;
        resource.readyState = 'done';
        resource.data = response;
        cleanup();
        this.setState(this._getResourceState());
      } catch (error) {
        if (error.name === 'AbortError') { cleanup(); return; }
        console.error(error);
        if (signal.aborted) { cleanup(); return; }
        resource.error = error;
        resource.readyState = 'done';
        resource.data = null;
        cleanup();
        this.setState(this._getResourceState());
      }
    })();

    return resource;
  }

  setState(patch) {
    if (!patch || typeof patch !== 'object') return;

    const keys = Object.keys(patch);
    if (keys.length === 0) return;

    // Check if anything actually changed before proceeding
    let hasChanges = false;
    for (const key of keys) {
      const newVal = patch[key];
      const oldVal = this[key];

      if (newVal !== oldVal) {
        // A new resource object is always a change, even if its fields
        // currently match the old one (e.g. two pending fetches in a row).
        if (oldVal?.[Symbol.for('isResource')] && newVal?.[Symbol.for('isResource')]) {
          oldVal[Symbol.for('controller')]?.abort();
        }
        hasChanges = true;
      }
    }

    if (!hasChanges) return;

    const newResourceKeys = keys.filter((key) => patch[key]?.[Symbol.for('isResource')]);
    const droppedResourceKeys = keys.filter((key) => !patch[key]?.[Symbol.for('isResource')]);
    this._resourceKeys = [...new Set([...this._resourceKeys, ...newResourceKeys])]
      .filter((key) => !droppedResourceKeys.includes(key));
    Object.assign(this, patch);
    Object.assign(this, this._getResourceState());
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
    this._controllers.forEach((c) => c.abort());
    this._controllers = [];
  }
}
