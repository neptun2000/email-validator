import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface RateLimitConfig {
  requestsPerHour: number;
  maxBulkEmails: number;
  windowMs: number;
  blockDuration: number;
}

export function RateLimitWizard() {
  const { toast } = useToast();
  const [config, setConfig] = useState<RateLimitConfig | null>(null);

  const { data, isLoading } = useQuery<RateLimitConfig>({
    queryKey: ['/api/rate-limit-config'],
    onSuccess: (data) => {
      if (!config) {
        setConfig(data);
      }
    }
  });

  const updateConfig = useMutation({
    mutationFn: async (newConfig: Partial<RateLimitConfig>) => {
      const response = await fetch('/api/rate-limit-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      setConfig(data.config);
      toast({
        title: "Success",
        description: "Rate limit configuration updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const handleSave = () => {
    if (config) {
      updateConfig.mutate(config);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate Limit Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label>Requests per Hour</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[config.requestsPerHour]}
                min={1}
                max={1000}
                step={1}
                onValueChange={([value]) => setConfig(prev => prev ? { ...prev, requestsPerHour: value } : null)}
              />
              <Input
                type="number"
                value={config.requestsPerHour}
                onChange={(e) => setConfig(prev => prev ? { ...prev, requestsPerHour: parseInt(e.target.value) } : null)}
                className="w-20"
              />
            </div>
          </div>

          <div>
            <Label>Max Bulk Emails</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[config.maxBulkEmails]}
                min={1}
                max={500}
                step={1}
                onValueChange={([value]) => setConfig(prev => prev ? { ...prev, maxBulkEmails: value } : null)}
              />
              <Input
                type="number"
                value={config.maxBulkEmails}
                onChange={(e) => setConfig(prev => prev ? { ...prev, maxBulkEmails: parseInt(e.target.value) } : null)}
                className="w-20"
              />
            </div>
          </div>

          <div>
            <Label>Window Duration (minutes)</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[config.windowMs / 60000]} // Convert ms to minutes
                min={1}
                max={1440} // 24 hours in minutes
                step={1}
                onValueChange={([value]) => setConfig(prev => prev ? { ...prev, windowMs: value * 60000 } : null)}
              />
              <Input
                type="number"
                value={config.windowMs / 60000}
                onChange={(e) => setConfig(prev => prev ? { ...prev, windowMs: parseInt(e.target.value) * 60000 } : null)}
                className="w-20"
              />
            </div>
          </div>

          <div>
            <Label>Block Duration (minutes)</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[config.blockDuration / 60000]}
                min={5}
                max={1440}
                step={1}
                onValueChange={([value]) => setConfig(prev => prev ? { ...prev, blockDuration: value * 60000 } : null)}
              />
              <Input
                type="number"
                value={config.blockDuration / 60000}
                onChange={(e) => setConfig(prev => prev ? { ...prev, blockDuration: parseInt(e.target.value) * 60000 } : null)}
                className="w-20"
              />
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          className="w-full"
          disabled={updateConfig.isPending}
        >
          {updateConfig.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Configuration"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
