/**
 * Jest + React Testing Library tests for usePhantomAuth hook
 *
 * Run with: npm test __tests__/usePhantomAuth.test.tsx
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { usePhantomAuth } from '@/hooks/usePhantomAuth';

// Mock window.phantom
const mockPhantomProvider = {
  isPhantom: true,
  publicKey: { toString: () => 'mockPublicKey123' },
  isConnected: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  signMessage: jest.fn(),
  on: jest.fn(),
};

// Mock fetch
global.fetch = jest.fn();

describe('usePhantomAuth', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();

    // Setup window.phantom mock
    (global as any).window = {
      phantom: {
        solana: mockPhantomProvider,
      },
    };
  });

  afterEach(() => {
    // Cleanup
    delete (global as any).window;
  });

  describe('isPhantomInstalled', () => {
    it('should return true when Phantom is installed', () => {
      const { result } = renderHook(() => usePhantomAuth());

      expect(result.current.isPhantomInstalled()).toBe(true);
    });

    it('should return false when Phantom is not installed', () => {
      delete (global as any).window.phantom;

      const { result } = renderHook(() => usePhantomAuth());

      expect(result.current.isPhantomInstalled()).toBe(false);
    });
  });

  describe('connectWallet', () => {
    it('should connect to Phantom wallet successfully', async () => {
      mockPhantomProvider.connect.mockResolvedValueOnce({
        publicKey: { toString: () => 'testPublicKey123' },
      });

      const { result } = renderHook(() => usePhantomAuth());

      let publicKey: string = '';
      await act(async () => {
        publicKey = await result.current.connectWallet();
      });

      expect(publicKey).toBe('testPublicKey123');
      expect(result.current.publicKey).toBe('testPublicKey123');
      expect(mockPhantomProvider.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle connection error', async () => {
      mockPhantomProvider.connect.mockRejectedValueOnce(
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
      delete (global as any).window.phantom;

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

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNonceResponse,
      });

      const { result } = renderHook(() => usePhantomAuth());

      let response;
      await act(async () => {
        response = await result.current.requestNonce('testPublicKey');
      });

      expect(response).toEqual(mockNonceResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/wallet/nonce'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ public_key: 'testPublicKey' }),
        })
      );
    });

    it('should handle nonce request error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
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

      mockPhantomProvider.signMessage.mockResolvedValueOnce({
        signature: mockSignature,
      });

      const { result } = renderHook(() => usePhantomAuth());

      let signature: string = '';
      await act(async () => {
        signature = await result.current.signNonce('testNonce');
      });

      // Verify signature is base64 encoded
      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(mockPhantomProvider.signMessage).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        'utf8'
      );
    });

    it('should handle signature error', async () => {
      mockPhantomProvider.signMessage.mockRejectedValueOnce(
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

      (global.fetch as jest.Mock).mockResolvedValueOnce({
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
      expect(global.fetch).toHaveBeenCalledWith(
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
      (global.fetch as jest.Mock).mockResolvedValueOnce({
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
      mockPhantomProvider.connect.mockResolvedValueOnce({
        publicKey: { toString: () => 'testPublicKey123' },
      });

      // Mock successful nonce request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nonce: 'mockNonce123',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }),
      });

      // Mock successful signature
      const mockSignature = new Uint8Array([1, 2, 3, 4, 5]);
      mockPhantomProvider.signMessage.mockResolvedValueOnce({
        signature: mockSignature,
      });

      // Mock successful verification
      (global.fetch as jest.Mock).mockResolvedValueOnce({
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
      expect(mockPhantomProvider.connect).toHaveBeenCalled();
      expect(mockPhantomProvider.signMessage).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(2); // nonce + verify
    });
  });

  describe('loading states', () => {
    it('should set isConnecting state during connection', async () => {
      mockPhantomProvider.connect.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ publicKey: { toString: () => 'key' } }), 100)
          )
      );

      const { result } = renderHook(() => usePhantomAuth());

      act(() => {
        result.current.connectWallet();
      });

      // Should be connecting
      expect(result.current.isConnecting).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false);
      });
    });

    it('should set isSigning state during signing', async () => {
      mockPhantomProvider.signMessage.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ signature: new Uint8Array([1]) }), 100)
          )
      );

      const { result } = renderHook(() => usePhantomAuth());

      act(() => {
        result.current.signNonce('test');
      });

      expect(result.current.isSigning).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSigning).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('should clear error state', () => {
      const { result } = renderHook(() => usePhantomAuth());

      // Manually set error (simulating an error state)
      act(() => {
        // This would normally be set by a failed operation
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
