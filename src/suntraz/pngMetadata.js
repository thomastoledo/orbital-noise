import extractChunksImport from "https://cdn.jsdelivr.net/npm/png-chunks-extract/+esm";
import encodeChunksImport from "https://cdn.jsdelivr.net/npm/png-chunks-encode/+esm";

const extractChunks = extractChunksImport?.default ?? extractChunksImport;
const encodeChunks = encodeChunksImport?.default ?? encodeChunksImport;

const textEncoder = new TextEncoder();

/**
 * Decoder note:
 * 1) Extract PNG iTXt chunk with keyword "suntraz"
 * 2) Parse JSON envelope ({ alg, iter, salt_b64, iv_b64, ct_b64 })
 * 3) Derive key with PBKDF2-SHA256 and decrypt ct with AES-256-GCM using the passphrase
 */

/**
 * @param {string} keyword
 * @param {string} text
 * @returns {{ name: string, data: Uint8Array }}
 */
function buildITXtChunk(keyword, text) {
  const keywordBytes = textEncoder.encode(keyword);
  const languageTagBytes = new Uint8Array(0);
  const translatedKeywordBytes = new Uint8Array(0);
  const textBytes = textEncoder.encode(text);

  const totalLength =
    keywordBytes.length +
    1 +
    1 +
    1 +
    languageTagBytes.length +
    1 +
    translatedKeywordBytes.length +
    1 +
    textBytes.length;

  const data = new Uint8Array(totalLength);
  let offset = 0;

  data.set(keywordBytes, offset);
  offset += keywordBytes.length;

  data[offset++] = 0; // keyword terminator
  data[offset++] = 0; // compression flag (0 = uncompressed)
  data[offset++] = 0; // compression method

  data.set(languageTagBytes, offset);
  offset += languageTagBytes.length;

  data[offset++] = 0; // language tag terminator

  data.set(translatedKeywordBytes, offset);
  offset += translatedKeywordBytes.length;

  data[offset++] = 0; // translated keyword terminator

  data.set(textBytes, offset);

  return {
    name: "iTXt",
    data,
  };
}

/**
 * Injects encrypted Suntraz envelope metadata into a PNG iTXt chunk.
 * @param {ArrayBuffer} pngArrayBuffer
 * @param {Record<string, unknown>} envelopeObj
 * @returns {ArrayBuffer}
 */
export function injectSuntrazChunk(pngArrayBuffer, envelopeObj) {
  const bytes = new Uint8Array(pngArrayBuffer);
  const chunks = extractChunks(bytes);
  const payload = JSON.stringify(envelopeObj);

  const suntrazChunk = buildITXtChunk("suntraz", payload);

  // Place text metadata before the first IDAT chunk to avoid
  // "Text/EXIF chunk(s) found after PNG IDAT" reader warnings.
  const idatIndex = chunks.findIndex((chunk) => chunk.name === "IDAT");
  const iendIndex = chunks.findIndex((chunk) => chunk.name === "IEND");
  const insertAt = idatIndex >= 0 ? idatIndex : iendIndex >= 0 ? iendIndex : chunks.length;
  chunks.splice(insertAt, 0, suntrazChunk);

  const encoded = encodeChunks(chunks);
  const out = encoded instanceof Uint8Array ? encoded : new Uint8Array(encoded);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}
