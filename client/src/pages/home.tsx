import { EmailValidator } from "@/components/email-validator";
import { BulkEmailValidator } from "@/components/bulk-email-validator";
import { ValidationMetrics } from "@/components/validation-metrics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Email Validator</h1>
          <p className="text-muted-foreground mt-2">
            Check if email addresses are valid and exist
          </p>
        </div>

        <ValidationMetrics />

        <div className="mt-8">
          <Tabs defaultValue="single">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="single">Single Email</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Validation</TabsTrigger>
            </TabsList>
            <TabsContent value="single">
              <EmailValidator />
            </TabsContent>
            <TabsContent value="bulk">
              <BulkEmailValidator />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}