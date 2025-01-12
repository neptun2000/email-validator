import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Mail, Loader2, X } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { isValidEmailFormat } from "@/lib/validation";
import { cn } from "@/lib/utils";

interface FormData {
  email: string;
}

interface ValidationResult {
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

type ValidationStatus = "idle" | "invalid" | "valid" | "checking";

export function EmailValidator() {
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    defaultValues: {
      email: "",
    },
  });

  const validateEmail = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch("/api/validate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      setStatus(data.isValid ? "valid" : "invalid");
      setResult(data);
      toast({
        title: data.isValid ? "Valid Email" : "Invalid Email",
        description: data.message,
        variant: data.isValid ? "default" : "destructive",
      });
    },
    onError: (error) => {
      setStatus("invalid");
      setResult(null);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!isValidEmailFormat(data.email)) {
      setStatus("invalid");
      setResult(null);
      return;
    }

    setStatus("checking");
    validateEmail.mutate(data.email);
  };

  const clearForm = () => {
    form.reset();
    setStatus("idle");
    setResult(null);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        placeholder="Enter email address"
                        className={cn(
                          "pl-10 pr-10",
                          status === "valid" && "border-green-500 focus-visible:ring-green-500",
                          status === "invalid" && "border-red-500 focus-visible:ring-red-500"
                        )}
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
              disabled={status === "checking"}
            >
              {status === "checking" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Validate Email"
              )}
            </Button>
          </form>
        </Form>

        {result && (
          <div className="mt-6 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="font-semibold">Status:</div>
              <div className={result.isValid ? "text-green-600" : "text-red-600"}>
                {result.status.toUpperCase()}
              </div>

              <div className="font-semibold">Sub-Status:</div>
              <div>{result.subStatus || "None"}</div>

              <div className="font-semibold">Free Email:</div>
              <div>{result.freeEmail}</div>

              <div className="font-semibold">Did You Mean:</div>
              <div>{result.didYouMean}</div>

              <div className="font-semibold">Account:</div>
              <div>{result.account}</div>

              <div className="font-semibold">Domain:</div>
              <div>{result.domain}</div>

              <div className="font-semibold">Domain Age Days:</div>
              <div>{result.domainAgeDays}</div>

              <div className="font-semibold">SMTP Provider:</div>
              <div>{result.smtpProvider}</div>

              <div className="font-semibold">MX Found:</div>
              <div>{result.mxFound}</div>

              <div className="font-semibold">MX Record:</div>
              <div>{result.mxRecord || "None"}</div>

              <div className="font-semibold">First Name:</div>
              <div>{result.firstName}</div>

              <div className="font-semibold">Last Name:</div>
              <div>{result.lastName}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}