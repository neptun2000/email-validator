interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  validationTimes: number[];
}

class MetricsTracker {
  private metrics: ValidationMetrics = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    averageValidationTime: 0,
    validationTimes: [],
  };

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
    // Keep only the last 100 validation times
    if (this.metrics.validationTimes.length > 100) {
      this.metrics.validationTimes.shift();
    }

    this.metrics.averageValidationTime = 
      this.metrics.validationTimes.reduce((a, b) => a + b, 0) / this.metrics.validationTimes.length;
  }

  getMetrics(): ValidationMetrics {
    return {
      ...this.metrics,
      averageValidationTime: Math.round(this.metrics.averageValidationTime),
    };
  }

  reset() {
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      validationTimes: [],
    };
  }
}

export const metricsTracker = new MetricsTracker();
