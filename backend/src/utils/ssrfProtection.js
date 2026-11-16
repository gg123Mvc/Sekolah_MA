import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data',
]);

const PRIVATE_IP_REGEXES = [
  /^127\./,                          // Loopback (127.0.0.0/8)
  /^10\./,                           // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private Class B (172.16.0.0/12)
  /^192\.168\./,                     // Private Class C (192.168.0.0/16)
  /^169\.254\./,                     // Link-local / Cloud metadata (169.254.0.0/16)
  /^0\./,                            // Current network (0.0.0.0/8)
];

/**
 * Memvalidasi apakah URL aman dari serangan SSRF
 * @param {string} urlString - URL yang akan diperiksa
 * @returns {Promise<URL>} URL object yang valid
 */
export async function validateWebhookUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('URL webhook tidak boleh kosong');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(urlString.trim());
  } catch {
    throw new Error('Format URL tidak valid');
  }

  // Protokol harus HTTP atau HTTPS
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Hanya protokol HTTP atau HTTPS yang diizinkan');
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Cek daftar hostname yang diblokir
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error(`Hostname '${hostname}' tidak diizinkan karena mengarah ke alamat internal/lokal`);
  }

  // Cek apakah hostname adalah IP private langsung
  for (const regex of PRIVATE_IP_REGEXES) {
    if (regex.test(hostname)) {
      throw new Error(`Alamat IP '${hostname}' termasuk dalam rentang jaringan privat (private network) yang diblokir`);
    }
  }

  // Resolusi DNS untuk mendeteksi domain yang menunjuk ke IP internal (DNS rebinding)
  try {
    const addresses = await resolve4(hostname);
    for (const ip of addresses) {
      for (const regex of PRIVATE_IP_REGEXES) {
        if (regex.test(ip)) {
          throw new Error(`Domain '${hostname}' meresolusi ke IP privat (${ip}) yang diblokir demi keamanan`);
        }
      }
    }
  } catch (dnsErr) {
    // Jika bukan error pemblokiran kita, dan hostname bukan nama domain valid (misal offline/gagal resolve)
    if (dnsErr.message.includes('diblokir')) {
      throw dnsErr;
    }
    // Jika DNS gagal di environment tanpa internet/offline, biarkan jika format URL sudah lolos cek dasar
  }

  return parsedUrl;
}
