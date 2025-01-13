import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Mail, Loader2, X, Upload, Eye, EyeOff } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";

const formSchema = z.object({
  emailList: z.string()
    .min(1, "Please enter at least one email address")
    .transform(str => str.split(/[\n,]/).map(email => email.trim()).filter(Boolean))
});

type FormData = z.infer<typeof formSchema>;

interface ValidationResult {
  email: string;
  status: string;
  subStatus: string | null;
  confidence: number;
  freeEmail: string;
  didYouMean: string;
  account: string;
  domain: string;
  domainAgeDays: string;
  smtpProvider: string;
  mxFound: string;
  mxRecord: string | null;
  message: string;
  isValid: boolean;
}

interface PreviewEmail {
  email: string;
  isValid: boolean;
  error?: string;
}

export function BulkEmailValidator() {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewEmails, setPreviewEmails] = useState<PreviewEmail[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      emailList: ""
    }
  });

  const validateEmails = useMutation({
    mutationFn: async (data: { emailList: string[] }) => {
      const response = await fetch("/api/validate-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: data.emailList }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return response.json();
    },
    onSuccess: (data) => {
      setResults(data);
      toast({
        title: "Validation Complete",
        description: `Successfully validated ${data.length} email${data.length === 1 ? '' : 's'}`,
      });
    },
    onError: (error: Error) => {
      setResults([]);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    validateEmails.mutate({ emailList: data.emailList });
  };

  const clearForm = () => {
    form.reset();
    setResults([]);
    setFileError(null);
    setPreviewEmails([]);
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setPreviewEmails([]);
    setShowPreview(false);

    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Please upload a CSV file');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/validate-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        setFileError(error);
        return;
      }

      const results = await response.json();
      setResults(results);
      toast({
        title: "Validation Complete",
        description: `Successfully validated ${results.length} email${results.length === 1 ? '' : 's'}`,
      });
    } catch (error) {
      setFileError('Error processing CSV file');
      console.error('CSV processing error:', error);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex justify-end gap-2 mb-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const testEmails = [
                    'test@example.com',
                    'user@google.com',
                    'invalid.email',
                    'employee@microsoft.com',
                  ].join('\n');
                  form.setValue('emailList', testEmails);
                  setShowPreview(true);
                }}
                className="text-sm"
              >
                Load Test Emails
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="hidden"
                  id="csv-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV
                </Button>
              </div>
              {previewEmails.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm"
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide Preview
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Show Preview
                    </>
                  )}
                </Button>
              )}
            </div>

            {fileError && (
              <Alert variant="destructive">
                <AlertDescription>{fileError}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="emailList"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Textarea
                        {...field}
                        placeholder="Enter email addresses (one per line) or upload a CSV file"
                        className="min-h-[100px] pl-10"
                      />
                      <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                      {field.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-2 h-5 w-5 p-0"
                          onClick={clearForm}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full"
              disabled={validateEmails.isPending}
            >
              {validateEmails.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating emails...
                </>
              ) : (
                "Validate Emails"
              )}
            </Button>
          </form>
        </Form>

        {results.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>MX Record</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>{result.email}</TableCell>
                    <TableCell className={result.isValid ? "text-green-600" : "text-red-600"}>
                      {result.status}
                    </TableCell>
                    <TableCell>{result.message}</TableCell>
                    <TableCell>{result.domain}</TableCell>
                    <TableCell>{result.mxRecord || "None"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}