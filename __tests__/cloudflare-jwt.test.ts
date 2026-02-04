/**
 * Unit tests for @/lib/cloudflare-jwt.ts
 *
 * Tests cover:
 * 1. isCfAccessConfigured returns false when env vars are missing
 * 2. isCfAccessConfigured returns true when both env vars are set
 * 3. getCfJwtFromRequest extracts the header correctly
 * 4. getCfJwtFromRequest returns null when header is missing
 * 5. validateCfJwt returns null when env vars not set
 * 6. validateCfJwt returns null for invalid JWT format (not 3 parts)
 * 7. validateCfJwt returns null when public key fetch fails
 * 8. validateCfJwt returns null when no matching kid found
 * 9. clearKeyCache clears the cache without error
 */

import { vi, beforeEach, afterEach } from 'vitest'

/**
 * Helper: create a fake base64url-encoded JWT with 3 dot-separated parts.
 * The header and payload are valid JSON; the signature is a dummy string.
 */
function makeFakeJwt(
  header: Record<string, unknown> = { alg: 'RS256', kid: 'test-kid', typ: 'JWT' },
  payload: Record<string, unknown> = { sub: 'test' }
): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${encode(header)}.${encode(payload)}.fake-signature`
}

describe('cloudflare-jwt', () => {
  beforeEach(() => {
    vi.resetModules()
    // Ensure CF env vars are clean before each test
    delete process.env.CLOUDFLARE_TEAM_DOMAIN
    delete process.env.CLOUDFLARE_AUD
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // isCfAccessConfigured
  // ==========================================================================

  describe('isCfAccessConfigured', () => {
    it('returns false when both env vars are missing', async () => {
      const { isCfAccessConfigured } = await import('@/lib/cloudflare-jwt')
      expect(isCfAccessConfigured()).toBe(false)
    })

    it('returns false when only CLOUDFLARE_TEAM_DOMAIN is set', async () => {
      vi.stubEnv('CLOUDFLARE_TEAM_DOMAIN', 'myteam.cloudflareaccess.com')
      const { isCfAccessConfigured } = await import('@/lib/cloudflare-jwt')
      expect(isCfAccessConfigured()).toBe(false)
    })

    it('returns false when only CLOUDFLARE_AUD is set', async () => {
      vi.stubEnv('CLOUDFLARE_AUD', 'test-audience-tag')
      const { isCfAccessConfigured } = await import('@/lib/cloudflare-jwt')
      expect(isCfAccessConfigured()).toBe(false)
    })

    it('returns true when both env vars are set', async () => {
      vi.stubEnv('CLOUDFLARE_TEAM_DOMAIN', 'myteam.cloudflareaccess.com')
      vi.stubEnv('CLOUDFLARE_AUD', 'test-audience-tag')
      const { isCfAccessConfigured } = await import('@/lib/cloudflare-jwt')
      expect(isCfAccessConfigured()).toBe(true)
    })
  })

  // ==========================================================================
  // getCfJwtFromRequest
  // ==========================================================================

  describe('getCfJwtFromRequest', () => {
    it('extracts the cf-access-jwt-assertion header correctly', async () => {
      const { getCfJwtFromRequest } = await import('@/lib/cloudflare-jwt')
      const headers = new Headers({
        'cf-access-jwt-assertion': 'my-jwt-token-value',
      })
      expect(getCfJwtFromRequest(headers)).toBe('my-jwt-token-value')
    })

    it('returns null when the header is missing', async () => {
      const { getCfJwtFromRequest } = await import('@/lib/cloudflare-jwt')
      const headers = new Headers()
      expect(getCfJwtFromRequest(headers)).toBeNull()
    })

    it('returns null when headers contain other keys but not the JWT header', async () => {
      const { getCfJwtFromRequest } = await import('@/lib/cloudflare-jwt')
      const headers = new Headers({
        authorization: 'Bearer some-other-token',
        'content-type': 'application/json',
      })
      expect(getCfJwtFromRequest(headers)).toBeNull()
    })
  })

  // ==========================================================================
  // validateCfJwt
  // ==========================================================================

  describe('validateCfJwt', () => {
    it('returns null when env vars are not set', async () => {
      // Neither CLOUDFLARE_TEAM_DOMAIN nor CLOUDFLARE_AUD is set
      const { validateCfJwt } = await import('@/lib/cloudflare-jwt')
      const result = await validateCfJwt('some.jwt.token')
      expect(result).toBeNull()
    })

    it('returns null for invalid JWT format (not 3 parts)', async () => {
      vi.stubEnv('CLOUDFLARE_TEAM_DOMAIN', 'myteam.cloudflareaccess.com')
      vi.stubEnv('CLOUDFLARE_AUD', 'test-audience-tag')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { validateCfJwt } = await import('@/lib/cloudflare-jwt')

      const result = await validateCfJwt('only-one-part')
      expect(result).toBeNull()

      consoleSpy.mockRestore()
    })

    it('returns null for JWT with two parts', async () => {
      vi.stubEnv('CLOUDFLARE_TEAM_DOMAIN', 'myteam.cloudflareaccess.com')
      vi.stubEnv('CLOUDFLARE_AUD', 'test-audience-tag')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { validateCfJwt } = await import('@/lib/cloudflare-jwt')

      const result = await validateCfJwt('part1.part2')
      expect(result).toBeNull()

      consoleSpy.mockRestore()
    })

    it('returns null when public key fetch fails', async () => {
      vi.stubEnv('CLOUDFLARE_TEAM_DOMAIN', 'myteam.cloudflareaccess.com')
      vi.stubEnv('CLOUDFLARE_AUD', 'test-audience-tag')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error'))
      )
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { validateCfJwt } = await import('@/lib/cloudflare-jwt')

      const token = makeFakeJwt()
      const result = await validateCfJwt(token)
      expect(result).toBeNull()

      consoleSpy.mockRestore()
    })

    it('returns null when fetch returns non-ok response', async () => {
      vi.stubEnv('CLOUDFLARE_TEAM_DOMAIN', 'myteam.cloudflareaccess.com')
      vi.stubEnv('CLOUDFLARE_AUD', 'test-audience-tag')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500 })
      )
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { validateCfJwt } = await import('@/lib/cloudflare-jwt')

      const token = makeFakeJwt()
      const result = await validateCfJwt(token)
      expect(result).toBeNull()

      consoleSpy.mockRestore()
    })

    it('returns null when no matching kid is found in public keys', async () => {
      vi.stubEnv('CLOUDFLARE_TEAM_DOMAIN', 'myteam.cloudflareaccess.com')
      vi.stubEnv('CLOUDFLARE_AUD', 'test-audience-tag')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            keys: [
              {
                kid: 'different-kid',
                kty: 'RSA',
                alg: 'RS256',
                use: 'sig',
                n: 'abc',
                e: 'AQAB',
              },
            ],
          }),
        })
      )
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { validateCfJwt } = await import('@/lib/cloudflare-jwt')

      // JWT header has kid: 'test-kid' which won't match 'different-kid'
      const token = makeFakeJwt({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' })
      const result = await validateCfJwt(token)
      expect(result).toBeNull()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No matching key'),
        'test-kid'
      )

      consoleSpy.mockRestore()
    })

    it('fetches keys from the correct certs URL', async () => {
      vi.stubEnv('CLOUDFLARE_TEAM_DOMAIN', 'myteam.cloudflareaccess.com')
      vi.stubEnv('CLOUDFLARE_AUD', 'test-audience-tag')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ keys: [] }),
      })
      vi.stubGlobal('fetch', mockFetch)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { validateCfJwt } = await import('@/lib/cloudflare-jwt')

      const token = makeFakeJwt()
      await validateCfJwt(token)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://myteam.cloudflareaccess.com/cdn-cgi/access/certs'
      )

      consoleSpy.mockRestore()
    })
  })

  // ==========================================================================
  // clearKeyCache
  // ==========================================================================

  describe('clearKeyCache', () => {
    it('clears the cache without error', async () => {
      const { clearKeyCache } = await import('@/lib/cloudflare-jwt')
      expect(() => clearKeyCache()).not.toThrow()
    })

    it('can be called multiple times without error', async () => {
      const { clearKeyCache } = await import('@/lib/cloudflare-jwt')
      expect(() => {
        clearKeyCache()
        clearKeyCache()
        clearKeyCache()
      }).not.toThrow()
    })
  })
})
