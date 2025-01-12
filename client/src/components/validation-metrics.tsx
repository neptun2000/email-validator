import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, CheckCircle, XCircle } from "lucide-react";
import { PerformanceCharts } from "./dashboard/performance-charts";

interface TimeSeriesMetric {
  timestamp: number;
  validations: number;
  successRate: number;
  averageTime: number;
}

interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  hourlyMetrics: TimeSeriesMetric[];
  dailyMetrics: TimeSeriesMetric[];
}

export function ValidationMetrics() {
  const { data: metrics } = useQuery<ValidationMetrics>({
    queryKey: ["/api/metrics"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (!metrics) {
    return null;
  }

  const successRate = metrics.totalValidations > 0
    ? ((metrics.successfulValidations / metrics.totalValidations) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Validations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalValidations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageValidationTime}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Validations</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.failedValidations}</div>
          </CardContent>
        </Card>
      </div>

      <PerformanceCharts metrics={metrics} />
    </div>
  );
}