export function safeUrl(value, fallback = '') {
  if (typeof value !== 'string' || value.length > 2048) return fallback;
  const raw = value.trim();
  if (!raw || [...raw].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127 || char === '\\')) return fallback;
  const internal = (raw.startsWith('/') && !raw.startsWith('//')) || raw.startsWith('#');
  if (!internal && !/^https?:\/\//i.test(raw)) return fallback;
  try {
    const url = new URL(raw, 'https://local.invalid');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return fallback;
    return raw;
  } catch {
    return fallback;
  }
}
