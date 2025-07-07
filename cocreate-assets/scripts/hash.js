
export async function hashIp(ip) {
  // Fallback-SHA-256 für nicht-sichere Kontexte (nur JS, nicht WebCrypto)
  // KEIN kryptografisch sicherer Hash – aber ausreichend zur Unterscheidung
  function simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // in 32bit verwandeln
    }
    return Math.abs(hash).toString();
  }

  if (window.isSecureContext && window.crypto?.subtle) {
    // Sichere Umgebung (HTTPS, localhost)
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    // Unsichere Umgebung (HTTP etc.)
    return simpleHash(ip);
  }
}