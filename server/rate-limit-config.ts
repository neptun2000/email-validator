import { EventEmitter } from 'events';

interface RateLimitConfig {
  requestsPerHour: number;
  maxBulkEmails: number;
  windowMs: number;
  blockDuration: number;
}

class RateLimitConfigStore extends EventEmitter {
  private config: RateLimitConfig;
  
  constructor() {
    super();
    this.config = {
      requestsPerHour: 100,
      maxBulkEmails: 100,
      windowMs: 3600000, // 1 hour
      blockDuration: 3600000 // 1 hour
    };
  }

  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<RateLimitConfig>): RateLimitConfig {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    // Emit change event for listeners
    this.emit('configChanged', this.config);
    return { ...this.config };
  }

  validateConfig(config: Partial<RateLimitConfig>): string | null {
    if (config.requestsPerHour !== undefined && (config.requestsPerHour < 1 || config.requestsPerHour > 1000)) {
      return 'Requests per hour must be between 1 and 1000';
    }
    
    if (config.maxBulkEmails !== undefined && (config.maxBulkEmails < 1 || config.maxBulkEmails > 500)) {
      return 'Max bulk emails must be between 1 and 500';
    }
    
    if (config.windowMs !== undefined && (config.windowMs < 60000 || config.windowMs > 86400000)) {
      return 'Window duration must be between 1 minute and 24 hours';
    }
    
    if (config.blockDuration !== undefined && (config.blockDuration < 300000 || config.blockDuration > 86400000)) {
      return 'Block duration must be between 5 minutes and 24 hours';
    }

    return null;
  }
}

export const rateLimitConfig = new RateLimitConfigStore();
