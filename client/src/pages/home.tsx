import { EmailValidator } from "@/components/email-validator";
import { BulkEmailValidator } from "@/components/bulk-email-validator";
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

        <Tabs defaultValue="validation" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Check</TabsTrigger>
          </TabsList>

          <TabsContent value="validation">
            <EmailValidator />
          </TabsContent>

          <TabsContent value="bulk">
            <BulkEmailValidator />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}