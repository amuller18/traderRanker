/**
 * Vitest + React Testing Library tests for usePhantomAuth hook
 *
 * Run with: pnpm test __tests__/usePhantomAuth.test.tsx
 */

import { vi, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock supabase client before importing the hook
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      setSession: vi.fn().mockResolvedValue({}),
    },
  }),
}));

import { usePhantomAuth } from '@/hooks/usePhantomAuth';

function createMockPhantom() {
  return {
    isPhantom: true,
    publicKey: { toString: () => 'mockPublicKey123' },
    isConnected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signMessage: vi.fn(),
    on: vi.fn(),
  };
}

let mockPhantom: ReturnType<typeof createMockPhantom>;

describe('usePhantomAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    mockPhantom = createMockPhantom();
    // Set up phantom on the jsdom window
    (window as any).phantom = { solana: mockPhantom };
  });

  afterEach(() => {
    delete (window as any).phantom;
    delete (window as any).solana;
    vi.unstubAllGlobals();
  });

  describe('isPhantomInstalled', () => {
    it('should return true when Phantom is installed', () => {
      const { result } = renderHook(() => usePhantomAuth());
      expect(result.current.isPhantomInstalled()).toBe(true);
    });

    it('should return false when Phantom is not installed', () => {
      delete (window as any).phantom;
      const { result } = renderHook(() => usePhantomAuth());
      expect(result.current.isPhantomInstalled()).toBe(false);
    });
  });

  describe('connectWallet', () => {
    it('should connect to Phantom wallet successfully', async () => {
      mockPhantom.connect.mockResolvedValueOnce({
        publicKey: { toString: () => 'testPublicKey123' },
      });

      const { result } = renderHook(() => usePhantomAuth());

      let publicKey = '';
      await act(async () => {
        publicKey = await result.current.connectWallet();
      });

      expect(publicKey).toBe('testPublicKey123');
      expect(result.current.publicKey).toBe('testPublicKey123');
      expect(mockPhantom.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle connection error', async () => {
      mockPhantom.connect.mockRejectedValueOnce(
        new Error('User rejected connection')
      );

      const { result } = renderHook(() => usePhantomAuth());

      await act(async () => {
        try {
          await result.current.connectWallet();
        } catch (error: any) {
          expect(error.message).toContain('User rejected connection');
        }
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should throw error when Phantom is not installed', async () => {
      delete (window as any).phantom;

      const { result } = renderHook(() => usePhantomAuth());

      await act(async () => {
        try {
          await result.current.connectWallet();
        } catch (error: any) {
          expect(error.message).toContain('not installed');
        }
      });
    });
  });

  describe('requestNonce', () => {
    it('should request nonce from backend successfully', async () => {
      const mockNonceResponse = {
        nonce: 'mockNonce123',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNonceResponse,
      });

      const { result } = renderHook(() => usePhantomAuth());

      let response;
      await act(async () => {
        response = await result.current.requestNonce('testPublicKey');
      });

      expect(response).toEqual(mockNonceResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/wallet/nonce'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ public_key: 'testPublicKey' }),
        })
      );
    });

    it('should handle nonce request error', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Rate limit exceeded' }),
      });

      const { result } = renderHook(() => usePhantomAuth());

      await act(async () => {
        try {
          await result.current.requestNonce('testPublicKey');
        } catch (error: any) {
          expect(error.message).toContain('Rate limit exceeded');
        }
      });
    });
  });

  describe('signNonce', () => {
    it('should sign nonce with Phantom wallet', async () => {
      const mockSignature = new Uint8Array([1, 2, 3, 4, 5]);

      mockPhantom.signMessage.mockResolvedValueOnce({
        signature: mockSignature,
      });

      const { result } = renderHook(() => usePhantomAuth());

      let signature = '';
      await act(async () => {
        signature = await result.current.signNonce('testNonce');
      });

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(mockPhantom.signMessage).toHaveBeenCalledTimes(1);
      // Verify it was called with a typed array and 'utf8'
      const call = mockPhantom.signMessage.mock.calls[0];
      expect(ArrayBuffer.isView(call[0])).toBe(true);
      expect(call[1]).toBe('utf8');
    });

    it('should handle signature error', async () => {
      mockPhantom.signMessage.mockRejectedValueOnce(
        new Error('User rejected signature')
      );

      const { result } = renderHook(() => usePhantomAuth());

      await act(async () => {
        try {
          await result.current.signNonce('testNonce');
        } catch (error: any) {
          expect(error.message).toContain('User rejected signature');
        }
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('verifyAndSignIn', () => {
    it('should verify signature and sign in successfully', async () => {
      const mockVerifyResponse = {
        status: 'ok',
        created_new_user: false,
        linked_to_existing_session: false,
        user_id: 'user123',
        email: 'test@example.com',
      };

      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVerifyResponse,
      });

      const { result } = renderHook(() => usePhantomAuth());

      let response;
      await act(async () => {
        response = await result.current.verifyAndSignIn(
          'testPublicKey',
          'testSignature',
          'testNonce'
        );
      });

      expect(response).toEqual(mockVerifyResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/wallet/verify'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            public_key: 'testPublicKey',
            signature: 'testSignature',
            nonce: 'testNonce',
          }),
        })
      );
    });

    it('should handle verification error', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Invalid signature' }),
      });

      const { result } = renderHook(() => usePhantomAuth());

      await act(async () => {
        try {
          await result.current.verifyAndSignIn(
            'testPublicKey',
            'invalidSignature',
            'testNonce'
          );
        } catch (error: any) {
          expect(error.message).toContain('Invalid signature');
        }
      });
    });
  });

  describe('signInWithWallet - full flow', () => {
    it('should complete full sign-in flow successfully', async () => {
      // Mock successful wallet connection
      mockPhantom.connect.mockResolvedValueOnce({
        publicKey: { toString: () => 'testPublicKey123' },
      });

      // Mock successful nonce request
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nonce: 'mockNonce123',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }),
      });

      // Mock successful signature
      const mockSignature = new Uint8Array([1, 2, 3, 4, 5]);
      mockPhantom.signMessage.mockResolvedValueOnce({
        signature: mockSignature,
      });

      // Mock successful verification
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          created_new_user: true,
          linked_to_existing_session: false,
          user_id: 'newUser123',
          email: 'newuser@phantom.wallet',
        }),
      });

      const { result } = renderHook(() => usePhantomAuth());

      let response;
      await act(async () => {
        response = await result.current.signInWithWallet();
      });

      expect(response).toBeDefined();
      expect((response as any).status).toBe('ok');
      expect((response as any).user_id).toBe('newUser123');

      // Verify all steps were called
      expect(mockPhantom.connect).toHaveBeenCalled();
      expect(mockPhantom.signMessage).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(2); // nonce + verify
    });
  });

  describe('loading states', () => {
    it('should set isConnecting state during connection', async () => {
      mockPhantom.connect.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ publicKey: { toString: () => 'key' } }), 50)
          )
      );

      const { result } = renderHook(() => usePhantomAuth());

      let connectPromise: Promise<string>;
      act(() => {
        connectPromise = result.current.connectWallet();
      });

      // Should be connecting
      expect(result.current.isConnecting).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await connectPromise;
      });

      expect(result.current.isConnecting).toBe(false);
    });

    it('should set isSigning state during signing', async () => {
      mockPhantom.signMessage.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ signature: new Uint8Array([1]) }), 50)
          )
      );

      const { result } = renderHook(() => usePhantomAuth());

      let signPromise: Promise<string>;
      act(() => {
        signPromise = result.current.signNonce('test');
      });

      expect(result.current.isSigning).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await signPromise;
      });

      expect(result.current.isSigning).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should clear error state', () => {
      const { result } = renderHook(() => usePhantomAuth());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
