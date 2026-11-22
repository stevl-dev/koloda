const IPV4 = /^(\d+)\.(\d+)\.\d+\.\d+$/;

// WHY: the URL parser has already normalized the host (IPv4 to dotted decimal, IPv6 to compressed lowercase in
// brackets), so plain string and prefix checks are enough. These hosts are this machine or a private network,
// where self-hosted servers such as Ollama are reached over plain http on purpose (AI-PROVIDERS.md §Plain HTTP).
function isLocalOrPrivateHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return true;

  if (hostname.startsWith("[")) {
    const address = hostname.slice(1, -1);
    const firstGroup = Number.parseInt(address.split(":")[0] || "0", 16);
    const isUniqueLocal = (firstGroup & 0xfe00) === 0xfc00;
    const isLinkLocal = (firstGroup & 0xffc0) === 0xfe80;
    return address === "::1" || isUniqueLocal || isLinkLocal;
  }

  const ipv4 = IPV4.exec(hostname);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return (
    a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
  );
}

export function isPlainHttpToPublicHost(baseUrl: string): boolean {
  if (!URL.canParse(baseUrl)) return false;
  const { protocol, hostname } = new URL(baseUrl);
  return protocol === "http:" && !isLocalOrPrivateHost(hostname);
}
