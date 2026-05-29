class LikeButton extends BaseElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.handleClick = this.handleClick.bind(this);
  }

  connectedCallback() {
    this.setState({ liked: false });
  }

  handleClick() {
    this.setState({ liked: true });
  }

  render() {
    const { liked, shadowRoot } = this;

    if (liked) {
      shadowRoot.innerHTML = /* html */ 'You liked this.';
      return;
    }

    shadowRoot.innerHTML = /* html */ `<button>Like</button>`;
    shadowRoot.querySelector('button').addEventListener('click', this.handleClick);
  }
}

customElements.define('like-button', LikeButton);