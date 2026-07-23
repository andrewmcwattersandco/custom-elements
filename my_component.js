class MyComponent extends BaseElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.setState({ items: this.fetchData('https://api.example.com/items') });
  }

  render() {
    const { error, readyState, items, shadowRoot } = this;
    if (error) {
      shadowRoot.innerHTML = /* html */ `<div>Error: ${error.message}</div>`;
    } else if (readyState === 'pending') {
      shadowRoot.innerHTML = /* html */ `<div>Loading...</div>`;
    } else {
      shadowRoot.innerHTML = /* html */ `<ul>
${items.data.map((item) => `  <li>${item.name} ${item.price}</li>`).join('\n')}
</ul>`;
    }
  }
}

customElements.define('my-component', MyComponent);