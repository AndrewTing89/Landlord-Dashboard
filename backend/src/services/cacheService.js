/**
 * Simple in-memory cache service with TTL support
 * For production, consider using Redis
 */
class CacheService {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  /**
   * Get a value from cache
   */
  get(key) {
    if (this.cache.has(key)) {
      this.stats.hits++;
      const item = this.cache.get(key);
      return item.value;
    }
    this.stats.misses++;
    return null;
  }

  /**
   * Set a value in cache with optional TTL (in seconds)
   */
  set(key, value, ttl = 300) { // Default 5 minutes
    this.stats.sets++;
    
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Store the value
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });

    // Set expiration timer
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl * 1000);
      this.timers.set(key, timer);
    }

    return value;
  }

  /**
   * Delete a value from cache
   */
  delete(key) {
    this.stats.deletes++;
    
    // Clear timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.timers.clear();
    
    return true;
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.delete(key);
    }
    
    return keysToDelete.length;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  /**
   * Middleware for Express routes
   */
  middleware(keyGenerator, ttl = 300) {
    return async (req, res, next) => {
      // Generate cache key
      const key = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : `${req.method}:${req.originalUrl}`;
      
      // Check cache
      const cached = this.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }
      
      // Store original json method
      const originalJson = res.json.bind(res);
      
      // Override json method to cache the response
      res.json = (data) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.set(key, data, ttl);
        }
        res.setHeader('X-Cache', 'MISS');
        return originalJson(data);
      };
      
      next();
    };
  }

  /**
   * Cache wrapper for async functions
   */
  async wrap(key, fn, ttl = 300) {
    // Check cache first
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    // Execute function and cache result
    const result = await fn();
    this.set(key, result, ttl);
    return result;
  }
}

// Singleton instance
const cache = new CacheService();

// Cache invalidation rules
const invalidationRules = {
  // When payment requests change, invalidate related caches
  'payment_requests': [
    'api:payment-requests',
    'api:summary',
    'api:health-status'
  ],
  // When transactions change, invalidate related caches
  'transactions': [
    'api:transactions',
    'api:summary',
    'api:monthly-comparison',
    'api:ledger'
  ],
  // When income changes, invalidate related caches
  'income': [
    'api:income',
    'api:summary',
    'api:monthly-comparison',
    'api:ledger'
  ]
};

/**
 * Invalidate related caches when data changes
 */
function invalidateRelatedCaches(tableName) {
  const patterns = invalidationRules[tableName];
  if (patterns) {
    for (const pattern of patterns) {
      cache.invalidatePattern(pattern);
    }
  }
}

module.exports = {
  cache,
  invalidateRelatedCaches
};