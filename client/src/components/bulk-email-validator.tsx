import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Mail, Loader2, X } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { isValidEmailFormat } from "@/lib/validation";

interface FormData {
  emails: string;
}

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
  const [validating, setValidating] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
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
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      setResults(data);
      setValidating(false);
      toast({
        title: "Validation Complete",
        description: `Validated ${data.length} email addresses`,
      });
    },
    onError: (error) => {
      setValidating(false);
      setResults([]);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    const emailList = data.emails
      .split(/[\n,]/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emailList.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one email address",
        variant: "destructive",
      });
      return;
    }

    const invalidEmails = emailList.filter(email => !isValidEmailFormat(email));
    if (invalidEmails.length > 0) {
      toast({
        title: "Error",
        description: `Invalid email format: ${invalidEmails.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setValidating(true);
    validateEmails.mutate(emailList);
  };

  const clearForm = () => {
    form.reset();
    setResults([]);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              disabled={validating}
            >
              {validating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
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
