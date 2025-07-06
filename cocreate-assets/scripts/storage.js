// ----------- NEU ANFANG -------------- //
let saveTimeout;
import { io } from "https://cdn.socket.io/4.8.0/socket.io.esm.min.js";
// ----------- NEU ENDE -------------- //

export function getSVGSource() {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}


export async function saveCurrentMindmap() {
  const title = prompt("Titel eingeben:");
  if (!title) return;

  const svgData = getSVGSource();
  const ip = await fetch('https://api.ipify.org').then(res => res.text());

  try {
    const result = await saveCreation(svgData, title, ip);

    // Nehme die ID der gespeicherten Zeile aus Supabase
    const id = result[0]?.creationid;
    if (id) {
      alert("Erfolgreich gespeichert! Du wirst weitergeleitet...");
      const link = `${location.origin}/index.html?id=${id}`;
      window.location.href = link;
      console.log(link);
    } else {
      alert("Gespeichert, aber keine ID zurückbekommen.");
    }
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    alert("Fehler beim Speichern!");
  }
}

export function exportMindmapAsSVG(svgElement) {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "mindmap.svg";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportMindmapToPDF() {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [svg.clientWidth, svg.clientHeight],
  });

  await svg2pdf(svg, pdf, {
    xOffset: 0,
    yOffset: 0,
    scale: 1
  });

  pdf.save("mindmap.pdf");
}

// ----------- NEU ANFANG -------------- //
export function scheduleSVGSave(delay = 1000) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveSVGToSupabase();
  }, delay);
}

export async function saveSVGToSupabase() {
  console.log("adding to supabase");
  const svgData = getSVGSource();
  const { data, error } = await supabase
    .from('creations')
    .update({ svg_code: svgData })
    .eq('creationid', mindmapId);

  if (error) {
    console.error('Fehler beim Speichern des SVGs:', error.message);
    // Optional: Fehler weiter werfen oder anderweitig behandeln
    throw new Error('Speichern des SVGs in Supabase fehlgeschlagen: ' + error.message);
  }

  console.log("added to supabase :)))")
  return data; // Optional: Rückgabe der aktualisierten Daten
}
// ----------- NEU ENDE -------------- //