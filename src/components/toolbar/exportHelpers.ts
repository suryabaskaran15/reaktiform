import type { ColumnDef } from "../../types";

// ─────────────────────────────────────────────────────────────
//  CLIENT-SIDE CSV EXPORT
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  CELL VALUE SERIALISER
//  Converts any stored value to a human-readable string for export.
//  Handles: async select { value, label } objects, SelectOption[]
//  arrays (multiselect), plain arrays, primitives.
// ─────────────────────────────────────────────────────────────
function serialiseForExport(val: unknown): string {
  if (val === null || val === undefined) return "";
  // Single async select — { value, label }
  if (
    typeof val === "object" &&
    !Array.isArray(val) &&
    "label" in (val as object)
  ) {
    return String((val as { label: unknown }).label);
  }
  // Array — could be string[] (static multi) or SelectOption[] (async multi)
  if (Array.isArray(val)) {
    return val
      .map((item) =>
        item && typeof item === "object" && "label" in item
          ? String((item as { label: unknown }).label)
          : String(item ?? ""),
      )
      .join(", ");
  }
  return String(val);
}

export function exportToCsv(
  cols: ColumnDef[],
  rows: import("@tanstack/react-table").Row<import("../../types").Row>[],
  getVal: (row: import("../../types").Row, key: string) => unknown,
) {
  const headers = cols.map((c) => `"${String(c.label).replace(/"/g, '""')}"`);
  const dataRows = rows
    .filter((r) => !r.getIsGrouped())
    .map((tanRow) => {
      const row = tanRow.original;
      return cols
        .map((col) => {
          const val = getVal(row, col.key as string);
          const str = serialiseForExport(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",");
    });
  const csv = [headers.join(","), ...dataRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `export-${today()}.csv`);
}

// ─────────────────────────────────────────────────────────────
//  CLIENT-SIDE EXCEL EXPORT — pure JS, zero external deps.
//  Generates a valid .xlsx using OpenXML SpreadsheetML.
//  For complex formatting/formulas use the onExport server callback.
// ─────────────────────────────────────────────────────────────
export function exportToXlsx(
  cols: ColumnDef[],
  rows: import("@tanstack/react-table").Row<import("../../types").Row>[],
  getVal: (row: import("../../types").Row, key: string) => unknown,
) {
  // Flatten to 2D array: header + data
  const header = cols.map((c) => c.label);
  const data = rows
    .filter((r) => !r.getIsGrouped())
    .map((tanRow) => {
      const row = tanRow.original;
      return cols.map((col) => {
        const val = getVal(row, col.key as string);
        return serialiseForExport(val);
      });
    });
  const allRows = [header, ...data];

  // XML escaping
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // Build shared strings table for memory efficiency
  const strings: string[] = [];
  const strIdx = new Map<string, number>();
  const si = (s: string) => {
    if (!strIdx.has(s)) {
      strIdx.set(s, strings.length);
      strings.push(s);
    }
    return strIdx.get(s)!;
  };

  // Build worksheet XML
  const rows_xml = allRows
    .map((row, ri) => {
      const cells = row
        .map((cell, ci) => {
          const colLetter = String.fromCharCode(65 + ci);
          const ref = `${colLetter}${ri + 1}`;
          const str = String(cell);
          return `<c r="${ref}" t="s"><v>${si(str)}</v></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${rows_xml}</sheetData>
</worksheet>`;

  const stringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}
</sst>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  // Pack as ZIP (minimal OOXML ZIP without external lib)
  // Uses a self-contained minimal ZIP encoder
  const files: { name: string; data: string }[] = [
    { name: "[Content_Types].xml", data: contentTypesXml },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: relsXml },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml },
    { name: "xl/sharedStrings.xml", data: stringsXml },
  ];

  const blob = buildZip(files);
  triggerDownload(blob, `export-${today()}.xlsx`);
}

// ── Minimal ZIP builder — no external dependency
function buildZip(files: { name: string; data: string }[]): Blob {
  const enc = new TextEncoder();
  const crc32Table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  const crc32 = (buf: Uint8Array) => {
    let c = 0xffffffff;
    for (const b of buf) c = crc32Table[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32le = (n: number) => [
    n & 0xff,
    (n >> 8) & 0xff,
    (n >> 16) & 0xff,
    (n >> 24) & 0xff,
  ];

  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const dataBytes = enc.encode(file.data);
    const crc = crc32(dataBytes);
    const local = new Uint8Array([
      0x50,
      0x4b,
      0x03,
      0x04,
      0x14,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // mod time+date
      ...u32le(crc),
      ...u32le(dataBytes.length),
      ...u32le(dataBytes.length),
      ...u16le(nameBytes.length),
      0x00,
      0x00,
      ...nameBytes,
    ]);
    parts.push(local, dataBytes);
    const dir = new Uint8Array([
      0x50,
      0x4b,
      0x01,
      0x02,
      0x14,
      0x00,
      0x14,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u32le(crc),
      ...u32le(dataBytes.length),
      ...u32le(dataBytes.length),
      ...u16le(nameBytes.length),
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u32le(offset),
      ...nameBytes,
    ]);
    central.push(dir);
    offset += local.length + dataBytes.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array([
    0x50,
    0x4b,
    0x05,
    0x06,
    0x00,
    0x00,
    0x00,
    0x00,
    ...u16le(files.length),
    ...u16le(files.length),
    ...u32le(centralSize),
    ...u32le(offset),
    0x00,
    0x00,
  ]);

  const all = [...parts, ...central, eocd];
  const total = all.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of all) {
    out.set(a, pos);
    pos += a.length;
  }
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(url);
}
