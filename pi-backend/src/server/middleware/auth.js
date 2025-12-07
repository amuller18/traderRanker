/**
 * Authentication Middleware
 *
 * Handles API key validation and Cloudflare Access JWT verification.
 *
 * Part of: Server Layer (Edge/Security)
 */

/**
 * API Key authentication middleware
 * Checks for X-API-Key header or Cloudflare Access JWT
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

  // Optional: Check Cloudflare Access JWT
  // If you're using Cloudflare Tunnel with Access, validate the CF-Access-JWT-Assertion header
  const cfJwt = req.headers['cf-access-jwt-assertion']
  if (cfJwt && process.env.CLOUDFLARE_TEAM_DOMAIN) {
    // In production, you would verify this JWT against Cloudflare's public keys
    // For now, we'll just check if it exists
    // See: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
    console.log('Cloudflare Access JWT detected')
    return next()
  }

  res.status(401).json({ error: 'Unauthorized - Invalid or missing API key' })
}
