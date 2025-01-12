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
import { z } from "zod";

const formSchema = z.object({
  emailList: z.string()
    .min(1, "Please enter at least one email address")
    .transform(value => value.split(/[\n,]/).map(email => email.trim()).filter(Boolean))
    .refine(
      emails => emails.length > 0,
      "Please enter at least one valid email address"
    )
});

type FormData = z.infer<typeof formSchema>;

interface TestResult {
  email: string;
  status: string;
  message: string;
  isValid: boolean;
  mxRecord: string | null;
  domain: string;
}

export function CustomEmailTester() {
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const form = useForm<FormData>({
    defaultValues: {
      emailList: "",
    },
  });

  const testEmails = useMutation({
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

      return response.json() as Promise<TestResult[]>;
    },
    onSuccess: (data) => {
      setResults(data);
      toast({
        title: "Testing Complete",
        description: `Successfully tested ${data.length} email${data.length === 1 ? '' : 's'}`,
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
    testEmails.mutate(data.emailList);
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
              name="emailList"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Textarea
                        {...field}
                        placeholder="Enter email addresses to test (one per line or comma-separated)"
                        className="min-h-[150px] pl-10 pr-8"
                        disabled={testEmails.isPending}
                      />
                      <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                      {field.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-2 h-5 w-5 p-0"
                          onClick={clearForm}
                          disabled={testEmails.isPending}
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
              disabled={testEmails.isPending}
            >
              {testEmails.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing {form.getValues().emailList.split(/[\n,]/).filter(Boolean).length} emails...
                </>
              ) : (
                "Run Tests"
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
