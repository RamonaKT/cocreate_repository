class MindmapEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.draggedType = null;
    this.dragTarget = null;
    this.offset = { x: 0, y: 0 };

    this.allNodes = [];
    this.allConnections = [];
    this.selectedNode = null;
    this.selectedConnection = null;

    this.viewBox = {
      x: 0,
      y: 0,
      w: 500,
      h: 500
    };

    this.zoom = 1;
    this.zoomStep = 0.025;
    this.minZoom = 0.1;
    this.maxZoom = 3;
  }

  async connectedCallback() {
      console.log('Mindmap Editor verbunden');
    const cssURL = new URL('mindmap-editor.css', import.meta.url);
    const cssText = await fetch(cssURL).then(res => res.text());

    const style = document.createElement('style');
    style.textContent = cssText;

    this.shadowRoot.innerHTML = `
      <div id="toolbar">
        <div class="node-template" data-type="1" draggable="true">Ebene 1</div>
        <div class="node-template" data-type="2" draggable="true">Ebene 2</div>
        <div class="node-template" data-type="3" draggable="true">Ebene 3</div>
      </div>
      <div id="mindmap-container">
        <svg id="mindmap" width="100%" height="600" style="background: #fff;"></svg>
      </div>
    `;

    this.shadowRoot.prepend(style);
    this.init();
  }

  init() {
    const svg = this.shadowRoot.getElementById('mindmap');
    this.svg = svg;

    svg.setAttribute("viewBox", `0 0 500 500`);
    svg.style.touchAction = 'none';

    const getCSSColor = (level) =>
      getComputedStyle(document.documentElement).getPropertyValue(`--color-level-${level}`).trim();

    this.nodeStyles = {
      1: { r: 60, color: getCSSColor(1), label: 'Ebene 1', fontSize: 16 },
      2: { r: 50, color: getCSSColor(2), label: 'Ebene 2', fontSize: 14 },
      3: { r: 40, color: getCSSColor(3), label: 'Ebene 3', fontSize: 12 },
    };

    this.shadowRoot.querySelectorAll('.node-template').forEach(el => {
      el.addEventListener('dragstart', e => {
        this.draggedType = e.target.getAttribute('data-type');
      });
    });

    svg.addEventListener('dragover', e => e.preventDefault());
    svg.addEventListener('drop', e => {
      e.preventDefault();
      const point = this.getSVGPoint(e.clientX, e.clientY);
      this.createDraggableNode(point.x, point.y, this.draggedType);
    });

    svg.addEventListener('pointermove', this.onPointerMove.bind(this));
    svg.addEventListener('pointerup', this.onPointerUp.bind(this));
    svg.addEventListener('pointercancel', this.onPointerUp.bind(this));
    svg.addEventListener('click', this.onSvgClick.bind(this));
    svg.addEventListener('wheel', this.onWheel.bind(this));

    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  getSVGPoint(x, y) {
    const pt = this.svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  createDraggableNode(x, y, type) {
    const style = this.nodeStyles[type];
    if (!style) return;

    const id = 'node' + this.allNodes.length;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "draggable");
    group.setAttribute("transform", `translate(${x}, ${y})`);
    group.dataset.nodeId = id;
    this.svg.appendChild(group);

    let shape;
    if (type === "1") {
      shape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      shape.setAttribute("cx", 0);
      shape.setAttribute("cy", 0);
      shape.setAttribute("rx", style.r);
      shape.setAttribute("ry", style.r * 0.6);
    } else {
      shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      shape.setAttribute("x", -style.r);
      shape.setAttribute("y", -style.r * 0.6);
      shape.setAttribute("width", style.r * 2);
      shape.setAttribute("height", style.r * 1.2);
      shape.setAttribute("rx", type === "2" ? 15 : 0);
      shape.setAttribute("ry", type === "2" ? 15 : 0);
    }

    shape.setAttribute("fill", style.color);
    group.appendChild(shape);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", 0);
    text.setAttribute("y", 0);
    text.setAttribute("fill", "black");
    text.setAttribute("font-size", style.fontSize);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("alignment-baseline", "middle");
    text.textContent = "...";
    group.appendChild(text);

    this.allNodes.push({ id, group, x, y, r: style.r });

    group.addEventListener('pointerdown', (e) => {
      if (e.shiftKey || e.target.tagName === 'INPUT') return;
      const point = this.getSVGPoint(e.clientX, e.clientY);
      const node = this.allNodes.find(n => n.id === id);
      if (!node) return;
      this.dragTarget = group;
      this.offset.x = point.x - node.x;
      this.offset.y = point.y - node.y;
      shape.classList.add('dragging');
    });

    group.addEventListener('click', e => {
      e.stopPropagation();
      this.onNodeClick(id);
    });

    text.addEventListener('dblclick', e => {
      e.stopPropagation();
      if (group.querySelector('foreignObject')) return;

      const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
      fo.setAttribute("x", -style.r);
      fo.setAttribute("y", -10);
      fo.setAttribute("width", style.r * 2);
      fo.setAttribute("height", 20);

      const input = document.createElement("input");
      input.setAttribute("type", "text");
      input.setAttribute("value", text.textContent);
      input.setAttribute("placeholder", "Bezeichnung eingeben");

      fo.appendChild(input);
      fo.style.pointerEvents = 'all';
      group.appendChild(fo);

      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      input.addEventListener("blur", () => {
        if (input.value.trim()) text.textContent = input.value.trim();
        group.removeChild(fo);
      });

      input.addEventListener("keydown", e => {
        if (e.key === "Enter") input.blur();
        else if (e.key === "Escape") group.removeChild(fo);
      });
    });
  }

  onNodeClick(id) {
    if (this.selectedConnection) {
      this.selectedConnection.classList.remove('highlighted');
      this.selectedConnection = null;
    }

    if (this.selectedNode === null) {
      this.selectedNode = id;
      this.highlightNode(id, true);
    } else if (this.selectedNode !== id) {
      this.connectNodes(this.selectedNode, id);
      this.highlightNode(this.selectedNode, false);
      this.selectedNode = null;
    } else {
      this.highlightNode(this.selectedNode, false);
      this.selectedNode = null;
    }
  }

  highlightNode(id, on) {
    const node = this.allNodes.find(n => n.id === id);
    if (!node) return;
    const shape = node.group.querySelector('ellipse, rect');
    if (on) shape.classList.add('highlighted');
    else shape.classList.remove('highlighted');
  }

  onPointerMove(e) {
    if (!this.dragTarget) return;
    const point = this.getSVGPoint(e.clientX, e.clientY);
    const id = this.dragTarget.dataset.nodeId;
    const node = this.allNodes.find(n => n.id === id);
    const newX = point.x - this.offset.x;
    const newY = point.y - this.offset.y;
    this.dragTarget.setAttribute("transform", `translate(${newX}, ${newY})`);
    node.x = newX;
    node.y = newY;
    this.updateConnections(id);
  }

  onPointerUp() {
    if (this.dragTarget) {
      const id = this.dragTarget.dataset.nodeId;
      const node = this.allNodes.find(n => n.id === id);
      const shape = node.group.querySelector('ellipse, rect');
      shape.classList.remove('dragging');
    }
    this.dragTarget = null;
  }

  onSvgClick() {
    if (this.selectedNode !== null) {
      this.highlightNode(this.selectedNode, false);
      this.selectedNode = null;
    }
    if (this.selectedConnection) {
      this.selectedConnection.classList.remove('highlighted');
      this.selectedConnection = null;
    }
  }

  updateConnections(movedId) {
    this.allConnections.forEach(conn => {
      if (conn.fromId === movedId || conn.toId === movedId) {
        const from = this.allNodes.find(n => n.id === conn.fromId);
        const to = this.allNodes.find(n => n.id === conn.toId);
        conn.line.setAttribute("x1", from.x);
        conn.line.setAttribute("y1", from.y);
        conn.line.setAttribute("x2", to.x);
        conn.line.setAttribute("y2", to.y);
      }
    });
  }

  connectNodes(fromId, toId) {
    const from = this.allNodes.find(n => n.id === fromId);
    const to = this.allNodes.find(n => n.id === toId);
    if (!from || !to) return;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    line.setAttribute("stroke", "#888");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("class", "connection-line");

    line.addEventListener("click", e => {
      e.stopPropagation();
      if (this.selectedNode !== null) this.highlightNode(this.selectedNode, false);
      if (this.selectedConnection) this.selectedConnection.classList.remove("highlighted");
      this.selectedConnection = line;
      line.classList.add("highlighted");
    });

    line.addEventListener("contextmenu", e => {
      e.preventDefault();
      this.svg.removeChild(line);
      this.allConnections = this.allConnections.filter(conn => conn.line !== line);
      if (this.selectedConnection === line) this.selectedConnection = null;
    });

    this.svg.insertBefore(line, this.svg.firstChild);
    this.allConnections.push({ fromId, toId, line });
  }

  onWheel(e) {
    e.preventDefault();
    this.zoom += e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
    this.zoom = Math.min(Math.max(this.zoom, this.minZoom), this.maxZoom);

    const mouseSVG = this.getSVGPoint(e.clientX, e.clientY);
    const newWidth = 500 / this.zoom;
    const newHeight = 500 / this.zoom;

    this.viewBox.x = mouseSVG.x - (mouseSVG.x - this.viewBox.x) * (newWidth / this.viewBox.w);
    this.viewBox.y = mouseSVG.y - (mouseSVG.y - this.viewBox.y) * (newHeight / this.viewBox.h);
    this.viewBox.w = newWidth;
    this.viewBox.h = newHeight;

    this.updateViewBox();
  }

  updateViewBox() {
    this.svg.setAttribute("viewBox", `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
  }

  onKeyDown(e) {
    const tag = document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement.isContentEditable) return;

    switch (e.key.toLowerCase()) {
      case 'delete':
      case 'backspace':
        e.preventDefault();
        if (this.selectedConnection) {
          this.svg.removeChild(this.selectedConnection);
          this.allConnections = this.allConnections.filter(c => c.line !== this.selectedConnection);
          this.selectedConnection = null;
        } else if (this.selectedNode) {
          const node = this.allNodes.find(n => n.id === this.selectedNode);
          if (!node) return;
          this.svg.removeChild(node.group);
          this.allNodes = this.allNodes.filter(n => n.id !== this.selectedNode);
          this.allConnections = this.allConnections.filter(c => {
            const match = c.fromId === this.selectedNode || c.toId === this.selectedNode;
            if (match) this.svg.removeChild(c.line);
            return !match;
          });
          this.selectedNode = null;
        }
        break;
      case 'w':
      case 'arrowup':
        this.viewBox.y -= 20;
        this.updateViewBox();
        break;
      case 's':
      case 'arrowdown':
        this.viewBox.y += 20;
        this.updateViewBox();
        break;
      case 'a':
      case 'arrowleft':
        this.viewBox.x -= 20;
        this.updateViewBox();
        break;
      case 'd':
      case 'arrowright':
        this.viewBox.x += 20;
        this.updateViewBox();
        break;
    }
  }
}

customElements.define('mindmap-editor', MindmapEditor);




async function exportMindmapToPDF() {
  const { jsPDF } = window.jspdf;

  const svgElement = document.querySelector('mindmap-editor')?.shadowRoot?.getElementById('mindmap');
  if (!svgElement) {
    alert("Mindmap SVG nicht gefunden!");
    return;
  }
  
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [svgElement.clientWidth, svgElement.clientHeight],
  });

  // svg2pdf erwartet ein Promise (oder callback)
  await window.svg2pdf(svgElement, pdf, {
    xOffset: 0,
    yOffset: 0,
    scale: 1
  });

  pdf.save("mindmap.pdf");
}




/*
const supabaseUrl = process.env.SUPABASEURL;
const supabaseKey = process.env.SUPABASEKEY;
*/
const supabaseUrl = 'https://hnwelnphgipfckclbfzy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhud2VsbnBoZ2lwZmNrY2xiZnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMTgwNDYsImV4cCI6MjA2NDg5NDA0Nn0.J7s9FgaGCuA110Ql2za713HWp_xP2jM21t96sWD-xSI';




// Überprüfe, ob die Umgebungsvariablen korrekt geladen wurden
if (!supabaseUrl || !supabaseKey) {
    console.log('Supabase URL:', supabaseUrl);  // Gibt die URL aus
    console.log('Supabase Key:', supabaseKey);  // Gibt den Key aus
    console.error('Supabase URL oder Schlüssel fehlen!');
    process.exit(1);
}

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);




let userNickname = null;

window.submitNickname = async function () {
  const input = document.getElementById('nicknameInput').value.trim();
  if (!input) {
    alert("Bitte gib einen Nickname ein.");
    return;
  }

  let ip = 'unbekannt';
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    ip = data.ip;
    console.log("IP-Adresse:", ip);
  } catch (err) {
    console.warn("IP konnte nicht ermittelt werden:", err);
  }

  // --- CHECK: Ist IP aktuell blockiert (locked_until in Zukunft)?
  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('locked_until')
      .eq('ipadress', ip)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      alert("Fehler beim IP-Check: " + fetchError.message);
      return;
    }

    if (existingUser?.locked_until) {
      const now = new Date();
      const until = new Date(existingUser.locked_until);
      if (until > now) {
        alert(`Diese IP ist noch bis ${until.toLocaleTimeString()} gesperrt für neue Nicknamen.`);
        return;
      }
    }
  } catch (err) {
    console.error("Fehler beim locked_until-Check:", err);
    return;
  }

  // --- Admin-Check: erster User?
  let isAdmin = false;
  try {
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (checkError) {
      alert("Fehler beim Admin-Check: " + checkError.message);
      return;
    }

    isAdmin = existingUsers.length === 0;
  } catch (err) {
    console.warn("Fehler beim Admin-Check:", err);
  }

  // --- Neuen Nickname speichern mit 10-Minuten-Sperre
  const lockUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase
    .from('users')
    .insert([{
      nickname: input,
      ipadress: ip,
      admin: isAdmin,
      locked_until: lockUntil
    }]);

  if (insertError) {
    alert("Fehler beim Speichern: " + insertError.message);
    return;
  }

  userNickname = input;
  sessionStorage.setItem("mindmap_nickname", userNickname);
  document.getElementById('nicknameModal').style.display = 'none';
  console.log("Nickname gespeichert:", userNickname);
};




window.addEventListener('load', async () => {
  let ip = 'unbekannt';

  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    ip = data.ip;
    console.log("IP-Adresse erkannt:", ip);
  } catch (err) {
    console.error("IP konnte nicht ermittelt werden:", err);
    showNicknameModal();
    return;
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('nickname, locked')
      .eq('ipadress', ip)
      .maybeSingle();

    if (error) {
      console.error("Fehler bei der Benutzerprüfung:", error.message);
      showNicknameModal();
      return;
    }

    if (!user || user.locked === true) {
      console.warn("Zugang gesperrt oder noch kein User für IP");
      showNicknameModal();
    } else {
      userNickname = user.nickname;
      sessionStorage.setItem("mindmap_nickname", userNickname);
      document.getElementById('nicknameModal').style.display = 'none';
      console.log("Benutzer automatisch erkannt:", userNickname);
    }

    startIpLockWatcher(ip);

  } catch (err) {
    console.error("Fehler bei der IP-Login-Logik:", err);
    showNicknameModal();
  }
});

function showNicknameModal() {
  sessionStorage.removeItem("mindmap_nickname");
  document.getElementById('nicknameModal').style.display = 'flex';
}


async function loadAndDisplayAllUsers() {
  const container = document.getElementById('userListContainer');
  if (!container) {
    console.warn("Container für Nutzerliste nicht gefunden!");
    return;
  }

  container.innerHTML = '';

  const { data: allUsers, error } = await supabase
    .from('users')
    .select('nickname, locked, admin, ipadress');

  if (error) {
    console.error("Fehler beim Laden der Benutzer:", error.message);
    return;
  }

  if (!userNickname) {
    console.warn("Aktueller Benutzername nicht geladen.");
    return;
  }

  const { data: currentUserData, error: selfError } = await supabase
    .from('users')
    .select('nickname, admin')
    .eq('nickname', userNickname)
    .maybeSingle();

  if (selfError || !currentUserData) {
    console.warn("Fehler beim Laden des aktuellen Users oder kein Treffer.");
    return;
  }

  const isAdmin = currentUserData.admin;

  allUsers.forEach(user => {
  const div = document.createElement('div');
  div.className = 'user-entry';
  if (user.locked) div.classList.add('locked');

  // Hauptname
  const nameSpan = document.createElement('span');
  nameSpan.textContent = user.nickname;
  div.appendChild(nameSpan);

  // Admin-Badge NUR wenn wirklich true
  if (user.admin === true || user.admin === 'true' || user.admin === 1) {
    const badge = document.createElement('span');
    badge.className = 'badge admin';
    badge.textContent = 'Admin';
    div.appendChild(badge);
  }

  // Rechtsklick-Sperren (Admin → andere User)
  if (isAdmin && user.nickname !== userNickname) {
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const confirmed = confirm(`Möchtest du die IP von "${user.nickname}" sperren?`);
      if (confirmed) {
        lockUserByNickname(user.nickname);
      }
    });
  }

  container.appendChild(div);
});

}


async function lockUserByNickname(nickname) {
  const { error } = await supabase
    .from('users')
    .update({ locked: true })
    .eq('nickname', nickname);

  if (error) {
    alert("Fehler beim Sperren: " + error.message);
    return;
  }

  alert(`Benutzer "${nickname}" wurde gesperrt.`);
  loadAndDisplayAllUsers(); // Liste aktualisieren
}


function startIpLockWatcher(ip) {
  setInterval(async () => {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('locked')
        .eq('ipadress', ip)
        .eq('nickname', userNickname)  // ← zusätzlicher Filter
        .maybeSingle();

      if (error) {
        console.error("Fehler beim Sperrcheck:", error.message);
        return;
      }

      if (user && user.locked === true) {
        console.warn("Zugang durch Sperre blockiert (Nickname oder IP)");
        showNicknameModal();
      }

    } catch (err) {
      console.error("Fehler beim automatischen Sperr-Check:", err);
    }
  }, 5000); // alle 5 Sekunden
}

