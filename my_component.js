class MyComponent extends BaseElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._controller = null;
  }

  connectedCallback() {
    this.setState({ error: null, isLoaded: false, items: [] });
    this._controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('https://api.example.com/items', {
          signal: this._controller.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        this.setState({ isLoaded: true, items: result });
      } catch (error) {
        if (error.name === 'AbortError') return;
        this.setState({ isLoaded: true, error });
      }
    })();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._controller) {
      this._controller.abort();
      this._controller = null;
    }
  }

  render() {
    const { error, isLoaded, items, shadowRoot } = this;
    if (error) {
      shadowRoot.innerHTML = /* html */ `<div>Error: ${error.message}</div>`;
    } else if (!isLoaded) {
      shadowRoot.innerHTML = /* html */ `<div>Loading...</div>`;
    } else {
      shadowRoot.innerHTML = /* html */ `<ul>
${items.map((item) => `  <li>${item.name} ${item.price}</li>`).join('\n')}
</ul>`;
    }
  }
}

customElements.define('my-component', MyComponent);