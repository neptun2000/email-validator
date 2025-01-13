import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, Loader2, X, Upload, Download, Eye, EyeOff } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { z } from "zod";
import { isValidEmailFormat } from "@/lib/validation";

const PREDEFINED_EMAILS = [
  'ashleybhorton@meta.com',
  'michael.naumov@teva.co.il',
  'janerose@google.com',
  'michael@ringsize.ru',
  'neptun2000@yandex.ru',
  'vkroz@amazon.com',
  'mark.maalouf@tevapharm.com',
  'smquadrat@gmail.com'
];

const formSchema = z.object({
  emailList: z.string()
    .min(1, "Please enter at least one email address")
    .transform(value => value.split(/[\n,]/).map(email => email.trim()).filter(Boolean))
});

type FormData = z.infer<typeof formSchema>;

interface ValidationResult {
  email: string;
  status: string;
  subStatus: string | null;
  freeEmail: string;
  didYouMean: string;
  account: string;
  domain: string;
  domainAgeDays: string;
  smtpProvider: string;
  mxFound: string;
  mxRecord: string | null;
  firstName: string;
  lastName: string;
  message: string;
  isValid: boolean;
}

interface PreviewEmail {
  email: string;
  isValid: boolean;
  error?: string;
}

interface BatchJob {
  id: number;
  status: string;
  totalEmails: number;
  processedEmails: number;
  error?: string;
}

export function BulkEmailValidator() {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewEmails, setPreviewEmails] = useState<PreviewEmail[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      emailList: ""
    }
  });

  // Query for batch job status
  const { data: jobStatus, refetch: refetchJobStatus } = useQuery({
    queryKey: ['validationJob', activeJobId],
    queryFn: async () => {
      if (!activeJobId) return null;
      const response = await fetch(`/api/validate-emails/batch/${activeJobId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch job status');
      }
      return response.json();
    },
    enabled: !!activeJobId,
    refetchInterval: (data) => {
      if (!data || ['completed', 'failed'].includes(data.job.status)) {
        return false;
      }
      return 2000; // Poll every 2 seconds for active jobs
    },
    onSuccess: (data) => {
      if (data && ['completed', 'failed'].includes(data.job.status)) {
        if (data.job.status === 'completed') {
          setResults(data.results);
          toast({
            title: "Validation Complete",
            description: `Successfully validated ${data.results.length} emails`,
          });
        } else {
          toast({
            title: "Validation Failed",
            description: data.job.error || "An error occurred during validation",
            variant: "destructive",
          });
        }
        setActiveJobId(null);
      }
    },
  });

  const validateEmails = useMutation({
    mutationFn: async (data: { emailList: string[] }) => {
      const response = await fetch("/api/validate-emails/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: data.emailList }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const result = await response.json();

      // If it's a batch job
      if (result.jobId) {
        setActiveJobId(result.jobId);
        return null;
      }

      return result;
    },
    onSuccess: (data) => {
      if (data) {
        setResults(data);
        toast({
          title: "Validation Complete",
          description: `Successfully validated ${data.length} email${data.length === 1 ? '' : 's'}`,
        });
      }
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
    setActiveJobId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadPredefinedEmails = () => {
    form.setValue('emailList', PREDEFINED_EMAILS.join('\n'));
    updatePreview(PREDEFINED_EMAILS);
  };

  const updatePreview = (emails: string[]) => {
    const preview = emails.map(email => ({
      email,
      isValid: isValidEmailFormat(email),
      error: isValidEmailFormat(email) ? undefined : 'Invalid email format'
    }));
    setPreviewEmails(preview);
    setShowPreview(true);
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
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

      if (lines.length === 0) {
        setFileError('CSV file is empty');
        return;
      }

      // Extract emails from the first column
      const emails = lines.map(line => line.split(',')[0].trim())
        .filter(Boolean);

      if (emails.length === 0) {
        setFileError('No email addresses found in the CSV');
        return;
      }

      // Update preview before setting the form value
      updatePreview(emails);
      form.setValue('emailList', emails.join('\n'));
    } catch (error) {
      setFileError('Error reading CSV file');
      console.error('CSV parsing error:', error);
    }
  };

  const downloadResults = () => {
    if (results.length === 0) return;

    const csvContent = [
      ['Email', 'Status', 'Message', 'Domain', 'MX Record', 'Is Valid'].join(','),
      ...results.map(result => [
        result.email,
        result.status,
        result.message.replace(/,/g, ';'),
        result.domain,
        result.mxRecord || 'None',
        result.isValid
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email-validation-results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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
                onClick={loadPredefinedEmails}
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
              {results.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadResults}
                  className="text-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Results
                </Button>
              )}
            </div>

            {fileError && (
              <Alert variant="destructive">
                <AlertDescription>{fileError}</AlertDescription>
              </Alert>
            )}

            {showPreview && previewEmails.length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewEmails.map((preview, index) => (
                      <TableRow key={index}>
                        <TableCell>{preview.email}</TableCell>
                        <TableCell className={preview.isValid ? "text-green-600" : "text-red-600"}>
                          {preview.isValid ? "Valid Format" : preview.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {activeJobId && jobStatus?.job && (
              <Alert>
                <AlertTitle>Processing {jobStatus.job.totalEmails} emails</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2">
                    <Progress value={(jobStatus.job.processedEmails / jobStatus.job.totalEmails) * 100} />
                    <p className="text-sm text-muted-foreground">
                      Processed {jobStatus.job.processedEmails} of {jobStatus.job.totalEmails} emails
                    </p>
                  </div>
                </AlertDescription>
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
                        className="min-h-[100px] pl-10 pr-8"
                        disabled={validateEmails.isPending || !!activeJobId}
                      />
                      <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                      {field.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-2 h-5 w-5 p-0"
                          onClick={clearForm}
                          disabled={validateEmails.isPending || !!activeJobId}
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
              disabled={validateEmails.isPending || !!activeJobId}
            >
              {validateEmails.isPending || activeJobId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {activeJobId ? "Processing..." : "Validating emails..."}
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