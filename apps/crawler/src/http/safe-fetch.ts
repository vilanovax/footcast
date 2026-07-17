import { lookup } from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (!version) return true;

  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fe80:')) return true; // link-local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice('::ffff:'.length);
      if (net.isIPv4(mapped)) return isPrivateIp(mapped);
    }
    return false;
  }

  const parts = ip.split('.').map(Number);
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http/https allowed');
  }
  if (BLOCKED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Blocked host');
  }
  if (net.isIP(url.hostname) && isPrivateIp(url.hostname)) {
    throw new Error('Private IP blocked');
  }
  if (!net.isIP(url.hostname)) {
    const records = await lookup(url.hostname, { all: true });
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        throw new Error('Resolved private IP blocked');
      }
    }
  }
  return url;
}

export async function safeFetch(
  rawUrl: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const url = await assertSafeUrl(rawUrl);
  const timeoutMs = init?.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url.toString(), {
      ...init,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'FootballNewsroomCrawler/0.1 (+https://football-newsroom.local)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*',
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
