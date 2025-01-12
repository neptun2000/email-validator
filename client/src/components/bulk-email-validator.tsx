import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Mail, Loader2, X } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
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
].join('\n');

const formSchema = z.object({
  emails: z.string()
    .min(1, "Please enter at least one email address")
    .transform(value => value.split(/[\n,]/).map(email => email.trim()).filter(Boolean))
    .refine(
      emails => emails.length > 0,
      "Please enter at least one valid email address"
    )
    .refine(
      emails => emails.length <= 100,
      "Maximum 100 emails allowed per request"
    )
    .refine(
      emails => emails.every(email => isValidEmailFormat(email)),
      "One or more email addresses are invalid"
    )
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

export function BulkEmailValidator() {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      emails: "",
    },
  });

  const validateEmails = useMutation({
    mutationFn: async (emails: string[]) => {
      const response = await fetch("/api/validate-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return response.json() as Promise<ValidationResult[]>;
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

  const onSubmit = async (data: FormData) => {
    validateEmails.mutate(data.emails);
  };

  const clearForm = () => {
    form.reset();
    setResults([]);
  };

  const loadPredefinedEmails = () => {
    form.setValue('emails', PREDEFINED_EMAILS);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex justify-end mb-2">
              <Button
                type="button"
                variant="outline"
                onClick={loadPredefinedEmails}
                className="text-sm"
              >
                Load Test Emails
              </Button>
            </div>
            <FormField
              control={form.control}
              name="emails"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Textarea
                        {...field}
                        placeholder="Enter email addresses (one per line or comma-separated)"
                        className="min-h-[100px] pl-10 pr-8"
                        disabled={validateEmails.isPending}
                      />
                      <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                      {field.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-2 h-5 w-5 p-0"
                          onClick={clearForm}
                          disabled={validateEmails.isPending}
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
                  Validating {form.getValues().emails.split(/[\n,]/).filter(Boolean).length} emails...
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
                      {result.status.toUpperCase()}
                      {result.subStatus && ` (${result.subStatus})`}
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