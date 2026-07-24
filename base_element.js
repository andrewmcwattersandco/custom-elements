const IS_RESOURCE = Symbol('isResource');
const CONTROLLER = Symbol('controller');

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
    resource[IS_RESOURCE] = true;
    resource[CONTROLLER] = controller;

    const cleanup = () => {
      this._controllers = this._controllers.filter((c) => c !== controller);
    };

    (async () => {
      try {
        const res = await fetch(url, { signal });
        if (signal.aborted) { cleanup(); return; }
        const response = await this._parseBody(res);
        if (signal.aborted) { cleanup(); return; }
        if (!res.ok) {
          const message = typeof response === 'string' ? response : response?.message || res.statusText;
          throw new Error(message);
        }
        cleanup();
        const key = this._resourceKeys.find((k) => this[k] === resource);
        const newResource = { error: null, readyState: 'done', data: response };
        newResource[IS_RESOURCE] = true;
        this.setState({ [key]: newResource });
      } catch (error) {
        if (error.name === 'AbortError') { cleanup(); return; }
        console.error(error);
        if (signal.aborted) { cleanup(); return; }
        cleanup();
        const key = this._resourceKeys.find((k) => this[k] === resource);
        const newResource = { error, readyState: 'done', data: null };
        newResource[IS_RESOURCE] = true;
        this.setState({ [key]: newResource });
      }
    })();

    return resource;
  }

  setState(patch) {
    if (!patch || typeof patch !== 'object') return;

    const keys = Object.keys(patch);
    if (keys.length === 0) return;

    // Detect whether anything actually changed before proceeding.
    const changedKeys = keys.filter((key) => patch[key] !== this[key]);
    if (changedKeys.length === 0) return;

    // Abort any resource being replaced/dropped by this patch.
    for (const key of changedKeys) {
      const oldVal = this[key];
      if (oldVal?.[IS_RESOURCE] && oldVal.readyState !== 'done') {
        oldVal[CONTROLLER]?.abort();
      }
    }

    const newResourceKeys = keys.filter((key) => patch[key]?.[IS_RESOURCE]);
    const droppedResourceKeys = keys.filter((key) => !patch[key]?.[IS_RESOURCE]);
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
    this._resourceKeys.forEach((key) => { delete this[key]; });
    this._resourceKeys = [];
  }
}