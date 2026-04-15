import LZString from "lz-string";

const HASH_PREFIX = "circuit=";

export function encodeCircuit(circuitJSON) {
  const json = JSON.stringify(circuitJSON);
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeCircuit(compressed) {
  const json = LZString.decompressFromEncodedURIComponent(compressed);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function buildShareURL(circuitJSON) {
  const compressed = encodeCircuit(circuitJSON);
  return `${window.location.origin}${window.location.pathname}#${HASH_PREFIX}${compressed}`;
}

export function readCircuitFromHash() {
  const hash = window.location.hash.slice(1); // remove #
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const compressed = hash.slice(HASH_PREFIX.length);
  return decodeCircuit(compressed);
}

export function clearHash() {
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}
