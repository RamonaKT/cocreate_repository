import { setupMindmap } from './scripts/script-core.js';
export class CoCreateMindmap extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    
    const cocreateCss = new URL('./styles/cocreate-style.css', import.meta.url);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cocreateCss;

    this.shadowRoot.append(link); 

    const container = document.createElement('div');
    container.innerHTML = `
      <div id="toolbar">
        <div class="node-template" draggable="true" data-type="1">Ebene 1</div>
        <div class="node-template" draggable="true" data-type="2">Ebene 2</div>
        <div class="node-template" draggable="true" data-type="3">Ebene 3</div>
      </div>

      <div id="mindmap-container">
        <div id="sidebar-left" class="sidebar">
          <img src="./img/icon-manual.png" alt="Icon manual"
            style="cursor: pointer;" draggable="false" 
            onclick="this.getRootNode().getElementById('dialogIconManual').showModal()">

          <dialog id="dialogIconManual">
            <h2>Quick-Start manuell</h2>
            <p>save to open new mindmap. everyone needs access to server. share id. have fun.</p>
            <button class="close" draggable="false"
              onclick="this.closest('dialog').close()">Schließen</button>
          </dialog>

          <img src="./cocreate-assets/img/icon-overview.png" alt="Icon overview user"
            style="cursor: pointer;" draggable="false" 
            onclick="this.getRootNode().getElementById('dialogIconOverviewUser').showModal(); window.loadUsersForCurrentMindmap(this.getRootNode());">

          <dialog id="dialogIconOverviewUser">
            <h2>User-Overview</h2>
            <div id="userListContainer"></div>
            <button class="close" 
              onclick="this.closest('dialog').close()">Schließen</button>
          </dialog>

          <img src="cocreate-assets/img/icon-download.png" alt="Icon Download pdf"
            class="pdfButton" id="downloadbtn" style="cursor: pointer;" draggable="false">

          <img src="cocreate-assets/img/icon-save.png" alt="Icon save" id="saveButton"
            style="cursor: pointer;" draggable="false">
        </div>

        <div id="ipLockOverlay">
          <div class="overlay-box">
            <p id="overlayMessage">Möchtest du diese IP wirklich sperren?</p>
            <div class="overlay-buttons">
              <button id="confirmLockBtn">Ja, sperren</button>
              <button id="cancelLockBtn">Abbrechen</button>
            </div>
          </div>
        </div>

        <svg id="mindmap" width="1000" height="600"></svg>
      </div>
    `;

    this.shadowRoot.appendChild(container); 
    setupMindmap(this.shadowRoot);
     
  }
}

customElements.define('cocreate-mindmap', CoCreateMindmap);
