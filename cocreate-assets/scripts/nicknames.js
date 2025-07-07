
export function createNicknameModal(shadowroot = document) {
    if (shadowroot.getElementById('nicknameModal')) return; 

    
    const modal = shadowroot.createElement('div');
    modal.id = 'nicknameModal';
    modal.innerHTML = `
    <div class="modal-content">
      <h2>Nickname wählen</h2>
      <input id="nicknameInput" type="text" placeholder="Dein Nickname" />
      <button id="nicknameSubmitButton">Speichern</button>
    </div>
  `;

    shadowroot.body.appendChild(modal);

    shadowroot.getElementById('nicknameSubmitButton').addEventListener('click', submitNickname);


  shadowroot.getElementById('nicknameInput').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitNickname();
    }
  });

}


export function showNicknameModal(shadowRoot = document) {
  // 1. Wenn shadowRoot = document → eigenen Container + Shadow DOM erzeugen
  if (shadowRoot === document) {
    let container = document.getElementById('nickname-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'nickname-container';
      document.body.appendChild(container);
    }

    if (!container.shadowRoot) {
      const shadow = container.attachShadow({ mode: 'open' });

      // Optional: CSS einfügen
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('./styles/cocreate-style.css', import.meta.url);
      shadow.appendChild(link);

      shadowRoot = shadow; // ⚠️ Jetzt wirklich ShadowRoot setzen
    } else {
      shadowRoot = container.shadowRoot;
    }
  }

  // 2. Modal anzeigen oder erstellen
  let modal = shadowRoot.getElementById('nicknameModal');

  if (!modal) {
    createNicknameModal(shadowRoot); // ← DEINE Funktion bleibt erhalten
    modal = shadowRoot.getElementById('nicknameModal');
  }

  if (modal) {
    modal.style.display = 'flex';
  } else {
    console.error("⚠️ Konnte Modal nicht anzeigen – fehlt.");
  }

  // 3. Nickname zurücksetzen
  sessionStorage.removeItem("mindmap_nickname");
  localStorage.removeItem("mindmap_nickname");
}


export async function submitNickname() {
  const input = shadowRoot.getElementById('nicknameInput').value.trim();
  if (!input) {
    alert("Bitte Nickname eingeben.");
    return;
  }

  const mindmapId = new URLSearchParams(window.location.search).get('id');
  if (!mindmapId) {
    alert("Keine gültige Mindmap-ID in der URL.");
    return;
  }

  let ip = 'unknown';
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    ip = data.ip;
  } catch (err) {
    console.warn("IP konnte nicht ermittelt werden:", err);
  }

const { data: existingLocks, error: lockError } = await supabase
  .from('users')
  .select('locked, locked_until')
  .eq('ipadress', ip)
  .eq('mindmap_id', mindmapId);

if (lockError) {
  alert("Fehler beim Sperr-Check.");
  return;
}

const now = new Date();
const anyLocked = existingLocks?.some(user =>
  user.locked && (!user.locked_until || new Date(user.locked_until) > now)
);

if (anyLocked) {
  alert("Du bist für diese Mindmap aktuell gesperrt.");
  return;
}


  try {
// versuch dass pro Mindmap nur jeder nickname einmal, aber sonst häufiger
    const { data: existingUser, error } = await supabase
  .from('users')
  .select('*')
  .eq('nickname', input)
  .eq('mindmap_id', mindmapId)
  .maybeSingle();

if (error) {
  alert("Fehler beim Überprüfen des Nicknames.");
  return;
}

if (existingUser) {
  if (existingUser.locked) {
    alert("Dieser Nickname ist aktuell gesperrt.");
    return;
  }
  alert("Dieser Nickname ist für diese Mindmap bereits vergeben.");
  return;
}

        // Hol dir admin_ip für diese Mindmap
    const { data: creationData, error: creationError } = await supabase
      .from('creations')
      .select('admin_ip')
      .eq('creationid', mindmapId)
      .single();

    if (creationError || !creationData) {
      alert("Mindmap-Info konnte nicht geladen werden.");
      return;
    }

    const isAdmin = creationData.admin_ip === ip;

// versuch dass pro Mindmap nur jeder nickname einmal, aber sonst häufiger
      const { error: insertError } = await supabase
  .from('users')
  .insert([{
    nickname: input,
    ipadress: ip,
    locked: false,
    admin: isAdmin,
    mindmap_id: parseInt(mindmapId)
  }]);


    if (isAdmin) console.log("Adminrechte zugewiesen");


    if (insertError) {
      alert("Fehler beim Speichern: " + insertError.message);
      return;
    }

    // Nutzer erfolgreich gespeichert
    userNickname = input;
    localStorage.setItem("mindmap_nickname", userNickname);
    shadowRoot.getElementById('nicknameModal')?.remove();
    startIpLockWatcher(ip);
    console.log("Neuer Nutzer gespeichert & Zugriff erlaubt:", userNickname);

  } catch (err) {
    console.error("Fehler bei Nickname-Speicherung:", err);
    alert("Fehler beim Speichern.");
  }
};


export async function initializeAccessControl(shadowRoot) {
  const mindmapId = new URLSearchParams(window.location.search).get('id');
  if (!mindmapId) return;

  createNicknameModal(); // Modal vorbereiten

  let ip = 'unknown';
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    ip = data.ip;
  } catch (err) {
    console.warn("IP konnte nicht ermittelt werden:", err);
    showNicknameModal();
    return;
  }

  startIpLockWatcher(ip, mindmapId, shadowRoot);

  const storedNickname = localStorage.getItem("mindmap_nickname");

  if (storedNickname) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('nickname', storedNickname)
        .eq('ipadress', ip)
        .maybeSingle();

      if (!error && user && !user.locked && user.mindmap_id === mindmapId) {
        userNickname = storedNickname;
        console.log("Automatisch eingeloggt:", userNickname);
        shadowRoot.getElementById('nicknameModal')?.remove();
        return;
      }
    } catch (e) {
      console.error("Fehler bei Login mit gespeicherten Nickname:", e);
    }
  }

  // Fallback: Suche Benutzer mit passender IP und Mindmap
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('ipadress', ip)
      .eq('mindmap_id', mindmapId)
      .maybeSingle();

    if (!error && user && !user.locked) {
      userNickname = user.nickname;
      localStorage.setItem("mindmap_nickname", userNickname);
      console.log("Automatisch über IP eingeloggt:", userNickname);
      shadowRoot.getElementById('nicknameModal')?.remove();
      return;
    }

  } catch (err) {
    console.error("Fehler bei Login über IP:", err);
  }

  loadUsersForCurrentMindmap(shadowRoot);

  showNicknameModal();
}


export function startIpLockWatcher(ip, mindmapId, shadowRoot) {
  async function checkLock() {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('nickname, locked, locked_until')
        .eq('ipadress', ip)
        .eq('mindmap_id', mindmapId);

      if (error) {
        console.error("Fehler bei Lock-Check:", error.message);
      } else {
        const now = new Date();

        for (const user of users) {
          if (user.locked) {
            const until = user.locked_until ? new Date(user.locked_until) : null;
            if (until && now >= until) {
              await supabase
                .from('users')
                .update({ locked: false, locked_until: null })
                .eq('nickname', user.nickname)
                .eq('mindmap_id', mindmapId);

              console.log(`🔓 Nutzer ${user.nickname} automatisch entsperrt.`);
            } else {
              console.warn(`🚫 Nutzer ${user.nickname} ist noch gesperrt.`);
              showNicknameModal();
              return;
            }
          }
        }
      }
    } catch (err) {
      console.error("Fehler bei Lock-Überprüfung:", err);
    }

    setTimeout(checkLock, 5000); // regelmäßig prüfen
  }

  checkLock();
}


export async function loadUsersForCurrentMindmap(shadowRoot = document) {
  const mindmapId = new URLSearchParams(window.location.search).get('id');
  const container = shadowRoot.getElementById('userListContainer');
  container.innerHTML = ''; // vorher leeren

  if (!mindmapId) {
    container.textContent = "Keine gültige Mindmap-ID.";
    return;
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('nickname, locked, admin, ipadress')
    .eq('mindmap_id', mindmapId);

  if (error) {
    container.textContent = "Fehler beim Laden der Nutzer.";
    console.error("Fehler beim Laden der User:", error.message);
    return;
  }

  if (!users || users.length === 0) {
    container.textContent = "Keine Nutzer gefunden.";
    return;
  }

  const currentUser = users.find(u => u.nickname === userNickname);
  const isAdmin = currentUser?.admin;

  users.forEach(user => {
    const div = shadowRoot.createElement('div');
    div.className = 'user-entry';
    if (user.locked) div.classList.add('locked');

    const nameSpan = shadowRoot.createElement('span');
    nameSpan.textContent = user.nickname;
    div.appendChild(nameSpan);

    if (user.admin) {
      const badge = shadowRoot.createElement('span');
      badge.className = 'badge admin';
      badge.textContent = 'Admin';
      div.appendChild(badge);
    }

    if (isAdmin && user.nickname !== userNickname) {
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        userToLock = user.nickname;
        shadowRoot.getElementById('dialogIconOverviewUser').close();

        shadowRoot.getElementById('ipLockOverlay').style.display = 'flex';
        shadowRoot.getElementById('overlayMessage').textContent =
          `Do you want to lock IP from "${user.nickname}" ?`;
      });
    }

    container.appendChild(div);
  });
}


export async function lockUserByNickname(nickname) {
  const lockUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 Minuten

  const { error } = await supabase
    .from('users')
    .update({ locked: true, locked_until: lockUntil })
    .eq('nickname', nickname);

  if (error) {
    alert("Fehler beim Sperren: " + error.message);
    return;
  }

  console.log(`User "${nickname}" wurde bis ${lockUntil} gesperrt.`);
}
