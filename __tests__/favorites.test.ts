/**
 * Unit tests for @/lib/favorites.ts
 *
 * Tests cover:
 * 1. isFavorited() - Check if an item is in the favorites list
 * 2. getFavorite() - Retrieve a specific favorite by item ID and type
 * 3. filterByType() - Filter favorites by type (trader or token)
 */

import { describe, it, expect } from 'vitest';
import {
  isFavorited,
  getFavorite,
  filterByType,
  type Favorite,
  type FavoriteType,
} from '@/lib/favorites';

// ============================================================================
// Shared test data
// ============================================================================

const makeFavorite = (
  overrides: Partial<Favorite> & { item_id: string; type: FavoriteType }
): Favorite => ({
  id: `fav-${overrides.item_id}`,
  user_id: 'user-1',
  name: undefined,
  notes: undefined,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

const sampleFavorites: Favorite[] = [
  makeFavorite({ item_id: 'trader-1', type: 'trader', name: 'Alpha Trader' }),
  makeFavorite({ item_id: 'trader-2', type: 'trader', name: 'Beta Trader' }),
  makeFavorite({ item_id: 'token-1', type: 'token', name: 'Solana' }),
  makeFavorite({ item_id: 'token-2', type: 'token', name: 'Ethereum' }),
  makeFavorite({ item_id: 'token-3', type: 'token', name: 'Bitcoin' }),
];

// ============================================================================
// isFavorited() tests
// ============================================================================

describe('isFavorited', () => {
  it('should return true when a trader favorite exists', () => {
    expect(isFavorited(sampleFavorites, 'trader-1', 'trader')).toBe(true);
  });

  it('should return true when a token favorite exists', () => {
    expect(isFavorited(sampleFavorites, 'token-1', 'token')).toBe(true);
  });

  it('should return false when item_id does not exist', () => {
    expect(isFavorited(sampleFavorites, 'nonexistent', 'trader')).toBe(false);
  });

  it('should return false when item_id exists but type does not match', () => {
    // trader-1 exists as 'trader', but querying as 'token' should return false
    expect(isFavorited(sampleFavorites, 'trader-1', 'token')).toBe(false);
  });

  it('should return false for an empty favorites array', () => {
    expect(isFavorited([], 'trader-1', 'trader')).toBe(false);
  });

  it('should return false when item_id is an empty string', () => {
    expect(isFavorited(sampleFavorites, '', 'trader')).toBe(false);
  });

  it('should handle duplicate item_ids with different types', () => {
    const favoritesWithSharedId: Favorite[] = [
      makeFavorite({ item_id: 'shared-id', type: 'trader' }),
      makeFavorite({ item_id: 'shared-id', type: 'token' }),
    ];
    expect(isFavorited(favoritesWithSharedId, 'shared-id', 'trader')).toBe(true);
    expect(isFavorited(favoritesWithSharedId, 'shared-id', 'token')).toBe(true);
  });

  it('should be case-sensitive for item_id', () => {
    expect(isFavorited(sampleFavorites, 'Trader-1', 'trader')).toBe(false);
  });
});

// ============================================================================
// getFavorite() tests
// ============================================================================

describe('getFavorite', () => {
  it('should return the matching trader favorite', () => {
    const result = getFavorite(sampleFavorites, 'trader-1', 'trader');
    expect(result).toBeDefined();
    expect(result!.item_id).toBe('trader-1');
    expect(result!.type).toBe('trader');
    expect(result!.name).toBe('Alpha Trader');
  });

  it('should return the matching token favorite', () => {
    const result = getFavorite(sampleFavorites, 'token-2', 'token');
    expect(result).toBeDefined();
    expect(result!.item_id).toBe('token-2');
    expect(result!.name).toBe('Ethereum');
  });

  it('should return undefined when item_id does not exist', () => {
    const result = getFavorite(sampleFavorites, 'nonexistent', 'trader');
    expect(result).toBeUndefined();
  });

  it('should return undefined when type does not match', () => {
    const result = getFavorite(sampleFavorites, 'trader-1', 'token');
    expect(result).toBeUndefined();
  });

  it('should return undefined for an empty array', () => {
    const result = getFavorite([], 'trader-1', 'trader');
    expect(result).toBeUndefined();
  });

  it('should return the first match when duplicates exist', () => {
    const duplicates: Favorite[] = [
      makeFavorite({ item_id: 'dup', type: 'trader', name: 'First' }),
      makeFavorite({ item_id: 'dup', type: 'trader', name: 'Second' }),
    ];
    const result = getFavorite(duplicates, 'dup', 'trader');
    expect(result).toBeDefined();
    expect(result!.name).toBe('First');
  });

  it('should return the full Favorite object with all properties', () => {
    const favorites: Favorite[] = [
      makeFavorite({
        id: 'custom-id',
        item_id: 'item-99',
        type: 'token',
        user_id: 'user-42',
        name: 'Custom Token',
        notes: 'Some notes here',
        created_at: '2025-06-01T10:00:00Z',
      }),
    ];
    const result = getFavorite(favorites, 'item-99', 'token');
    expect(result).toEqual({
      id: 'custom-id',
      item_id: 'item-99',
      type: 'token',
      user_id: 'user-42',
      name: 'Custom Token',
      notes: 'Some notes here',
      created_at: '2025-06-01T10:00:00Z',
    });
  });

  it('should return undefined for empty string item_id', () => {
    const result = getFavorite(sampleFavorites, '', 'trader');
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// filterByType() tests
// ============================================================================

describe('filterByType', () => {
  it('should return only trader favorites', () => {
    const result = filterByType(sampleFavorites, 'trader');
    expect(result).toHaveLength(2);
    result.forEach((f) => {
      expect(f.type).toBe('trader');
    });
  });

  it('should return only token favorites', () => {
    const result = filterByType(sampleFavorites, 'token');
    expect(result).toHaveLength(3);
    result.forEach((f) => {
      expect(f.type).toBe('token');
    });
  });

  it('should return an empty array when no favorites match the type', () => {
    const tradersOnly: Favorite[] = [
      makeFavorite({ item_id: 'trader-1', type: 'trader' }),
    ];
    const result = filterByType(tradersOnly, 'token');
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should return an empty array for an empty input', () => {
    const result = filterByType([], 'trader');
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should preserve the original order of favorites', () => {
    const result = filterByType(sampleFavorites, 'token');
    expect(result[0].item_id).toBe('token-1');
    expect(result[1].item_id).toBe('token-2');
    expect(result[2].item_id).toBe('token-3');
  });

  it('should return all items when all match the requested type', () => {
    const allTraders: Favorite[] = [
      makeFavorite({ item_id: 't1', type: 'trader' }),
      makeFavorite({ item_id: 't2', type: 'trader' }),
      makeFavorite({ item_id: 't3', type: 'trader' }),
    ];
    const result = filterByType(allTraders, 'trader');
    expect(result).toHaveLength(3);
  });

  it('should not mutate the original array', () => {
    const original = [...sampleFavorites];
    filterByType(sampleFavorites, 'trader');
    expect(sampleFavorites).toEqual(original);
  });

  it('should return a new array (not a reference to the input)', () => {
    const result = filterByType(sampleFavorites, 'trader');
    expect(result).not.toBe(sampleFavorites);
  });

  it('should include all properties of filtered favorites', () => {
    const result = filterByType(sampleFavorites, 'trader');
    const first = result[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('user_id');
    expect(first).toHaveProperty('type');
    expect(first).toHaveProperty('item_id');
    expect(first).toHaveProperty('created_at');
  });
});
