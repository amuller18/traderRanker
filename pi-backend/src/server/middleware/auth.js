/**
 * Authentication Middleware
 *
 * Handles API key validation and Cloudflare Access JWT verification.
 * JWT verification validates the token signature against Cloudflare's
 * public keys (JWKS), plus issuer, audience, and expiration checks.
 *
 * Part of: Server Layer (Edge/Security)
 */

// Cache for Cloudflare public keys (1 hour TTL)
let cfKeysCache = null
let cfKeysFetchedAt = 0
const CF_KEY_CACHE_TTL = 60 * 60 * 1000

/**
 * Fetch Cloudflare Access public keys from the JWKS endpoint
 */
async function fetchCfPublicKeys() {
  const teamDomain = process.env.CLOUDFLARE_TEAM_DOMAIN
  if (!teamDomain) return null

  const now = Date.now()
  if (cfKeysCache && (now - cfKeysFetchedAt) < CF_KEY_CACHE_TTL) {
    return cfKeysCache
  }

  try {
    const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`)
    if (!res.ok) return null

    const data = await res.json()
    cfKeysCache = data.keys
    cfKeysFetchedAt = now
    return data.keys
  } catch (err) {
    console.error('Failed to fetch Cloudflare public keys:', err.message)
    return null
  }
}

/**
 * Base64url decode (RFC 4648)
 */
function base64urlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

/**
 * Validate a Cloudflare Access JWT token.
 * Verifies signature against Cloudflare's JWKS, plus issuer, audience, and expiration.
 * Returns the payload on success, or null on failure.
 */
async function validateCfJwt(token) {
  const teamDomain = process.env.CLOUDFLARE_TEAM_DOMAIN
  const audience = process.env.CLOUDFLARE_AUD

  if (!teamDomain || !audience) return null

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const header = JSON.parse(base64urlDecode(parts[0]).toString('utf8'))
    const payload = JSON.parse(base64urlDecode(parts[1]).toString('utf8'))

    // Fetch and find matching key by kid
    const keys = await fetchCfPublicKeys()
    if (!keys) return null

    const matchingKey = keys.find(k => k.kid === header.kid)
    if (!matchingKey) return null

    // Import the RSA public key and verify the signature
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: matchingKey.kty,
        n: matchingKey.n,
        e: matchingKey.e,
        alg: matchingKey.alg,
        use: matchingKey.use,
      },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const signedContent = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    const signature = base64urlDecode(parts[2])

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature,
      signedContent
    )

    if (!isValid) return null

    // Verify issuer matches team domain
    if (payload.iss !== `https://${teamDomain}`) return null

    // Verify audience contains our app's AUD tag
    if (!payload.aud || !payload.aud.includes(audience)) return null

    // Verify token is not expired
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) return null

    return payload
  } catch (err) {
    console.error('CF JWT validation error:', err.message)
    return null
  }
}

/**
 * API Key authentication middleware
 * Checks for X-API-Key header or validates Cloudflare Access JWT
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware function
 */
export function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key']
  const expectedApiKey = process.env.API_KEY

  // Check API key
  if (apiKey && apiKey === expectedApiKey) {
    return next()
  }

  // Validate Cloudflare Access JWT (signature, issuer, audience, expiration)
  const cfJwt = req.headers['cf-access-jwt-assertion']
  if (cfJwt && process.env.CLOUDFLARE_TEAM_DOMAIN && process.env.CLOUDFLARE_AUD) {
    validateCfJwt(cfJwt)
      .then(payload => {
        if (payload) {
          req.cfUser = payload
          return next()
        }
        res.status(401).json({ error: 'Unauthorized - Invalid Cloudflare Access token' })
      })
      .catch(() => {
        res.status(401).json({ error: 'Unauthorized - JWT validation failed' })
      })
    return
  }

  res.status(401).json({ error: 'Unauthorized - Invalid or missing API key' })
}
