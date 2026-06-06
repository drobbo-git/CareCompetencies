// Minimal STORE-only ZIP writer (no compression, no dependencies).
// Good enough for shipping text files as a downloadable archive.
//
// Layout per file:
//   Local file header (30 bytes + name)
//   File data (uncompressed)
//   Central directory header (46 bytes + name)
//   End of central directory record (22 bytes)
//
// We compute CRC32 ourselves with a lazily-built lookup table.

export interface ZipEntry {
  path: string;       // e.g. "CareCompetencies/etl/README.md"
  contents: string;   // file contents as UTF-8 text
}

let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// MS-DOS date/time packed into two 16-bit values.
function dosDateTime(d: Date): { date: number; time: number } {
  const year = Math.max(1980, d.getFullYear());
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  return { date, time };
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}
function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

export function buildZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const now = new Date();
  const { date: dosDate, time: dosTime } = dosDateTime(now);

  // Pre-encode all file contents + names so we can compute sizes/offsets.
  type Prepared = {
    nameBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc: number;
    localHeaderOffset: number;
  };
  const prepared: Prepared[] = [];

  // First pass to compute total file payload size.
  let runningOffset = 0;
  const localChunks: Uint8Array[] = [];

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const dataBytes = encoder.encode(entry.contents);
    const crc = crc32(dataBytes);

    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    writeU32(view, 0, 0x04034b50);        // local file header signature
    writeU16(view, 4, 20);                // version needed
    writeU16(view, 6, 0);                 // flags
    writeU16(view, 8, 0);                 // method: STORE
    writeU16(view, 10, dosTime);
    writeU16(view, 12, dosDate);
    writeU32(view, 14, crc);
    writeU32(view, 18, dataBytes.length); // compressed size = uncompressed (STORE)
    writeU32(view, 22, dataBytes.length); // uncompressed size
    writeU16(view, 26, nameBytes.length); // file name length
    writeU16(view, 28, 0);                // extra field length
    header.set(nameBytes, 30);

    prepared.push({
      nameBytes,
      dataBytes,
      crc,
      localHeaderOffset: runningOffset,
    });

    localChunks.push(header);
    localChunks.push(dataBytes);
    runningOffset += header.length + dataBytes.length;
  }

  // Central directory.
  const centralChunks: Uint8Array[] = [];
  let centralSize = 0;
  for (const p of prepared) {
    const central = new Uint8Array(46 + p.nameBytes.length);
    const view = new DataView(central.buffer);
    writeU32(view, 0, 0x02014b50);            // central dir signature
    writeU16(view, 4, 20);                    // version made by
    writeU16(view, 6, 20);                    // version needed
    writeU16(view, 8, 0);                     // flags
    writeU16(view, 10, 0);                    // method: STORE
    writeU16(view, 12, dosTime);
    writeU16(view, 14, dosDate);
    writeU32(view, 16, p.crc);
    writeU32(view, 20, p.dataBytes.length);   // compressed size
    writeU32(view, 24, p.dataBytes.length);   // uncompressed size
    writeU16(view, 28, p.nameBytes.length);   // file name length
    writeU16(view, 30, 0);                    // extra field length
    writeU16(view, 32, 0);                    // comment length
    writeU16(view, 34, 0);                    // disk number
    writeU16(view, 36, 0);                    // internal attrs
    writeU32(view, 38, 0);                    // external attrs
    writeU32(view, 42, p.localHeaderOffset);  // relative offset of local header
    central.set(p.nameBytes, 46);

    centralChunks.push(central);
    centralSize += central.length;
  }

  // End of central directory record.
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  writeU32(eocdView, 0, 0x06054b50);
  writeU16(eocdView, 4, 0);
  writeU16(eocdView, 6, 0);
  writeU16(eocdView, 8, prepared.length);
  writeU16(eocdView, 10, prepared.length);
  writeU32(eocdView, 12, centralSize);
  writeU32(eocdView, 16, runningOffset);
  writeU16(eocdView, 20, 0);

  return new Blob(
    [...localChunks, ...centralChunks, eocd],
    { type: "application/zip" },
  );
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}