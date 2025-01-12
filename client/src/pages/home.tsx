import { EmailValidator } from "@/components/email-validator";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Email Validator</h1>
          <p className="text-muted-foreground mt-2">
            Check if an email address is valid and exists
          </p>
        </div>
        <EmailValidator />
      </div>
    </div>
  );
}
