import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

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

interface ChartProps {
  data: TimeSeriesMetric[];
  timeFormat: string;
}

function SuccessRateChart({ data, timeFormat }: ChartProps) {
  const formattedData = useMemo(() => 
    data.map(d => ({
      ...d,
      time: format(new Date(d.timestamp), timeFormat),
      successRate: Number(d.successRate.toFixed(1))
    })),
    [data, timeFormat]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Success Rate Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="successRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="successRate"
                stroke="#10B981"
                fillOpacity={1}
                fill="url(#successRate)"
                unit="%"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function ValidationTimeChart({ data, timeFormat }: ChartProps) {
  const formattedData = useMemo(() => 
    data.map(d => ({
      ...d,
      time: format(new Date(d.timestamp), timeFormat),
      averageTime: Math.round(d.averageTime)
    })),
    [data, timeFormat]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Average Validation Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="averageTime"
                stroke="#6366F1"
                unit="ms"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function ValidationVolumeChart({ data, timeFormat }: ChartProps) {
  const formattedData = useMemo(() => 
    data.map(d => ({
      ...d,
      time: format(new Date(d.timestamp), timeFormat)
    })),
    [data, timeFormat]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validation Volume</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="validations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="validations"
                stroke="#6366F1"
                fillOpacity={1}
                fill="url(#validations)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function PerformanceCharts({ metrics }: { metrics: ValidationMetrics }) {
  return (
    <Tabs defaultValue="hourly" className="space-y-4">
      <TabsList>
        <TabsTrigger value="hourly">Hourly</TabsTrigger>
        <TabsTrigger value="daily">Daily</TabsTrigger>
      </TabsList>

      <TabsContent value="hourly" className="space-y-4">
        <SuccessRateChart data={metrics.hourlyMetrics} timeFormat="HH:mm" />
        <ValidationTimeChart data={metrics.hourlyMetrics} timeFormat="HH:mm" />
        <ValidationVolumeChart data={metrics.hourlyMetrics} timeFormat="HH:mm" />
      </TabsContent>

      <TabsContent value="daily" className="space-y-4">
        <SuccessRateChart data={metrics.dailyMetrics} timeFormat="MMM dd" />
        <ValidationTimeChart data={metrics.dailyMetrics} timeFormat="MMM dd" />
        <ValidationVolumeChart data={metrics.dailyMetrics} timeFormat="MMM dd" />
      </TabsContent>
    </Tabs>
  );
}
