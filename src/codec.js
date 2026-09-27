export function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeJson(token) {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function makeProxyId(sourceType, sourceId) {
  return `nsh.${encodeJson({ t: sourceType, i: sourceId })}`;
}

export function parseProxyId(id) {
  if (!id?.startsWith("nsh.")) return null;
  return decodeJson(id.slice(4));
}
