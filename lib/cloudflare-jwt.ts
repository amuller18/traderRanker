/**
 * Cloudflare Access JWT Validation
 *
 * Validates CF-Access-JWT-Assertion tokens against Cloudflare's public keys.
 * See: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */

const CF_TEAM_DOMAIN = process.env.CLOUDFLARE_TEAM_DOMAIN
const CF_AUD = process.env.CLOUDFLARE_AUD

interface CfJwtPayload {
  aud: string[]
  email: string
  exp: number
  iat: number
  iss: string
  sub: string
  type: string
  identity_nonce: string
  country: string
}

interface JwkKey {
  kid: string
  kty: string
  alg: string
  use: string
  n: string
  e: string
}

interface JwksResponse {
  keys: JwkKey[]
}

// Cache public keys for 1 hour to avoid fetching on every request
let cachedKeys: { keys: JwkKey[]; fetchedAt: number } | null = null
const KEY_CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Check if Cloudflare Access is configured
 */
export function isCfAccessConfigured(): boolean {
  return !!(CF_TEAM_DOMAIN && CF_AUD)
}

/**
 * Fetch Cloudflare Access public keys (JWKS endpoint)
 */
async function fetchPublicKeys(): Promise<JwkKey[]> {
  if (cachedKeys && (Date.now() - cachedKeys.fetchedAt) < KEY_CACHE_TTL) {
    return cachedKeys.keys
  }

  if (!CF_TEAM_DOMAIN) {
    throw new Error('CLOUDFLARE_TEAM_DOMAIN is not configured')
  }

  const certsUrl = `https://${CF_TEAM_DOMAIN}/cdn-cgi/access/certs`
  const response = await fetch(certsUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch Cloudflare public keys: ${response.status}`)
  }

  const data: JwksResponse = await response.json()
  cachedKeys = { keys: data.keys, fetchedAt: Date.now() }
  return data.keys
}

/**
 * Base64url decode (RFC 4648)
 */
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

/**
 * Import a JWK RSA public key for verification
 */
async function importKey(jwk: JwkKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: jwk.alg,
      use: jwk.use,
    },
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify']
  )
}

/**
 * Decode a JWT without verifying (to extract header/payload for key lookup)
 */
function decodeJwt(token: string): {
  header: { alg: string; kid: string; typ: string }
  payload: CfJwtPayload
  signatureBytes: Uint8Array
  signedContent: string
} {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }

  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])))
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])))
  const signatureBytes = base64urlDecode(parts[2])
  const signedContent = `${parts[0]}.${parts[1]}`

  return { header, payload, signatureBytes, signedContent }
}

/**
 * Validate a Cloudflare Access JWT
 *
 * Returns the JWT payload if valid, or null if invalid/expired.
 */
export async function validateCfJwt(token: string): Promise<CfJwtPayload | null> {
  if (!CF_TEAM_DOMAIN || !CF_AUD) {
    return null
  }

  try {
    const { header, payload, signatureBytes, signedContent } = decodeJwt(token)

    // 1. Fetch public keys and find the matching key
    const keys = await fetchPublicKeys()
    const matchingKey = keys.find(k => k.kid === header.kid)

    if (!matchingKey) {
      console.error('CF JWT: No matching key found for kid:', header.kid)
      return null
    }

    // 2. Verify the signature
    const cryptoKey = await importKey(matchingKey)
    const data = new TextEncoder().encode(signedContent)

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes,
      data
    )

    if (!isValid) {
      console.error('CF JWT: Signature verification failed')
      return null
    }

    // 3. Verify the issuer
    const expectedIssuer = `https://${CF_TEAM_DOMAIN}`
    if (payload.iss !== expectedIssuer) {
      console.error('CF JWT: Invalid issuer:', payload.iss)
      return null
    }

    // 4. Verify the audience
    if (!payload.aud || !payload.aud.includes(CF_AUD)) {
      console.error('CF JWT: Invalid audience')
      return null
    }

    // 5. Verify expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      console.error('CF JWT: Token expired')
      return null
    }

    // 6. Verify not before (iat)
    if (payload.iat > now + 60) {
      // Allow 60s clock skew
      console.error('CF JWT: Token used before issued')
      return null
    }

    return payload
  } catch (error) {
    console.error('CF JWT validation error:', error)
    return null
  }
}

/**
 * Extract the CF-Access-JWT-Assertion header from a request
 */
export function getCfJwtFromRequest(headers: Headers): string | null {
  return headers.get('cf-access-jwt-assertion')
}

/**
 * Clear the cached public keys (useful for testing or key rotation)
 */
export function clearKeyCache(): void {
  cachedKeys = null
}
