
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

function exportMindmapAsSVG(svgElement) {
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