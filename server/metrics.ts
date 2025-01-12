interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  validationTimes: number[];
  // New metrics for time series
  hourlyMetrics: {
    timestamp: number;
    validations: number;
    successRate: number;
    averageTime: number;
  }[];
  dailyMetrics: {
    timestamp: number;
    validations: number;
    successRate: number;
    averageTime: number;
  }[];
}

class MetricsTracker {
  private metrics: ValidationMetrics = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    averageValidationTime: 0,
    validationTimes: [],
    hourlyMetrics: [],
    dailyMetrics: []
  };

  private readonly MAX_HOURLY_DATAPOINTS = 24; // Last 24 hours
  private readonly MAX_DAILY_DATAPOINTS = 30; // Last 30 days

  recordValidation(startTime: number, isValid: boolean) {
    const endTime = Date.now();
    const validationTime = endTime - startTime;

    this.metrics.totalValidations++;
    if (isValid) {
      this.metrics.successfulValidations++;
    } else {
      this.metrics.failedValidations++;
    }

    this.metrics.validationTimes.push(validationTime);
    if (this.metrics.validationTimes.length > 100) {
      this.metrics.validationTimes.shift();
    }

    this.metrics.averageValidationTime = 
      this.metrics.validationTimes.reduce((a, b) => a + b, 0) / this.metrics.validationTimes.length;

    // Update time series data
    this.updateTimeSeriesMetrics();
  }

  private updateTimeSeriesMetrics() {
    const now = Date.now();
    const currentHour = new Date(now).setMinutes(0, 0, 0);
    const currentDay = new Date(now).setHours(0, 0, 0, 0);

    // Update hourly metrics
    let hourlyMetric = this.metrics.hourlyMetrics.find(m => m.timestamp === currentHour);
    if (!hourlyMetric) {
      hourlyMetric = {
        timestamp: currentHour,
        validations: 0,
        successRate: 0,
        averageTime: 0
      };
      this.metrics.hourlyMetrics.push(hourlyMetric);

      // Keep only last 24 hours
      if (this.metrics.hourlyMetrics.length > this.MAX_HOURLY_DATAPOINTS) {
        this.metrics.hourlyMetrics = this.metrics.hourlyMetrics
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.MAX_HOURLY_DATAPOINTS);
      }
    }

    // Update daily metrics
    let dailyMetric = this.metrics.dailyMetrics.find(m => m.timestamp === currentDay);
    if (!dailyMetric) {
      dailyMetric = {
        timestamp: currentDay,
        validations: 0,
        successRate: 0,
        averageTime: 0
      };
      this.metrics.dailyMetrics.push(dailyMetric);

      // Keep only last 30 days
      if (this.metrics.dailyMetrics.length > this.MAX_DAILY_DATAPOINTS) {
        this.metrics.dailyMetrics = this.metrics.dailyMetrics
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.MAX_DAILY_DATAPOINTS);
      }
    }

    // Update metrics
    hourlyMetric.validations++;
    dailyMetric.validations++;

    const hourlySuccessRate = this.metrics.successfulValidations / this.metrics.totalValidations * 100;
    const dailySuccessRate = hourlySuccessRate; // For simplicity, using same success rate

    hourlyMetric.successRate = hourlySuccessRate;
    dailyMetric.successRate = dailySuccessRate;

    hourlyMetric.averageTime = this.metrics.averageValidationTime;
    dailyMetric.averageTime = this.metrics.averageValidationTime;
  }

  getMetrics(): ValidationMetrics {
    return {
      ...this.metrics,
      averageValidationTime: Math.round(this.metrics.averageValidationTime),
      hourlyMetrics: [...this.metrics.hourlyMetrics].sort((a, b) => a.timestamp - b.timestamp),
      dailyMetrics: [...this.metrics.dailyMetrics].sort((a, b) => a.timestamp - b.timestamp)
    };
  }

  reset() {
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      validationTimes: [],
      hourlyMetrics: [],
      dailyMetrics: []
    };
  }
}

export const metricsTracker = new MetricsTracker();