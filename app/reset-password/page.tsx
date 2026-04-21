import Link from "next/link";
import { CommitHappensMark } from "@/components/brand/CommitHappensMark";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const token = params.token?.trim() ?? "";

  if (!token) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-semibold text-white">Reset link missing</h1>
          <p className="text-sm text-white/60">
            Open the full link from the forgot-password flow.
          </p>
          <Link className="text-brand hover:underline" href="/forgot-password">
            Generate a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CommitHappensMark href="/" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Reset password</h1>
          <p className="text-sm text-white/60">
            Set a new password for your account.
          </p>
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}

