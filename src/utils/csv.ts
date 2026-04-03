type CSVOptions = {
  delimiter?: string; // ";" recomendado pro Excel PT-BR
  bom?: boolean; // true -> UTF-8 BOM
};

export function toCSV(
  rows: Record<string, any>[],
  headers: string[],
  opts: CSVOptions = {}
) {
  const delimiter = opts.delimiter ?? ";";

  const escape = (v: any) => {
    const s = String(v ?? "");
    // Se tiver aspas, quebra de linha, delimitador -> precisa aspas + escapar aspas
    const needsQuotes = s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(delimiter);
    if (!needsQuotes) return s;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const lines: string[] = [];
  lines.push(headers.map(escape).join(delimiter));

  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(delimiter));
  }

  const content = lines.join("\n");
  if (opts.bom) {
    // UTF-8 BOM (ajuda Excel a entender acentos)
    return "\uFEFF" + content;
  }
  return content;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8"
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
