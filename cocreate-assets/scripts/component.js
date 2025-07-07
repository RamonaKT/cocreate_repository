class MyMindmap extends HTMLElement {
  async connectedCallback() {
    // KEIN Shadow DOM – Stil wird übernommen
    this.innerHTML = `
      <div id="mindmap_container">
        <svg id="mindmap" width="1000" height="600"></svg>
        <button id="saveButton">💾 Speichern</button>
      </div>
    `;

    const module = await import('http://141.72.13.151:8200/cocreate-mindmap.js');
    module.setupMindmap(this);  // Achtung: setupMindmap muss exportiert sein!
  }
}

customElements.define('my_mindmap', MyMindmap);
