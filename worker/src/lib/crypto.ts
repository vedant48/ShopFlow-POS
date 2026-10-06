// Web Crypto PIN hashing & HS256 JWT utilities compatible with Cloudflare Workers

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

// --------------------------------------------------------------------------
// 1. PIN Hashing with PBKDF2 (SHA-256, 10,000 iterations)
// --------------------------------------------------------------------------
export async function hashPin(pin: string, customSaltHex?: string): Promise<string> {
  const enc = new TextEncoder();
  const pinData = enc.encode(pin);

  let saltBytes: Uint8Array;
  let saltHex: string;

  if (customSaltHex) {
    saltBytes = hexToBuffer(customSaltHex);
    saltHex = customSaltHex;
  } else {
    saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    saltHex = bufferToHex(saltBytes.buffer as ArrayBuffer);
  }

  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: 10000,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  const hashHex = bufferToHex(derivedBits);
  return `pbkdf2:${saltHex}:${hashHex}`;
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith('pbkdf2:')) {
    // Backwards compatibility for demo PIN 'pin_1234'
    if (storedHash === `pin_${pin}` || storedHash === pin) {
      return true;
    }
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;

  const saltHex = parts[1];
  const expectedHashHex = parts[2];

  const computed = await hashPin(pin, saltHex);
  const computedHashHex = computed.split(':')[2];

  return computedHashHex === expectedHashHex;
}

// --------------------------------------------------------------------------
// 2. JWT (HS256) Signing & Verification with Web Crypto
// --------------------------------------------------------------------------
async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(payload: Record<string, any>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const enc = new TextEncoder();
  const key = await getHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));

  // Convert binary ArrayBuffer to binary string then base64url
  const sigBytes = new Uint8Array(signatureBuffer);
  let binary = '';
  for (let i = 0; i < sigBytes.byteLength; i++) {
    binary += String.fromCharCode(sigBytes[i]);
  }
  const encodedSignature = base64UrlEncode(binary);

  return `${dataToSign}.${encodedSignature}`;
}

export async function verifyJwt<T = any>(token: string, secret: string): Promise<T | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;

    const enc = new TextEncoder();
    const key = await getHmacKey(secret);

    // Decode signature
    const binarySig = base64UrlDecode(encodedSignature);
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes.buffer as ArrayBuffer,
      enc.encode(dataToVerify)
    );

    if (!isValid) return null;

    const payload: any = JSON.parse(base64UrlDecode(encodedPayload));
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Check expiration if exp is present
    if (payload.exp && payload.exp < nowSeconds) {
      return null;
    }

    return payload as T;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// 3. Random token generator
// --------------------------------------------------------------------------
export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes.buffer);
}
