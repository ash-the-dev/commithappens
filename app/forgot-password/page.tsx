import Link from "next/link";
import { CommitHappensMark } from "@/components/brand/CommitHappensMark";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CommitHappensMark href="/" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Forgot password</h1>
          <p className="text-sm text-white/60">
            Enter your account email and we will generate a secure reset link.
          </p>
          <p className="text-sm text-white/60">
            Remembered it?{" "}
            <Link className="text-brand hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

