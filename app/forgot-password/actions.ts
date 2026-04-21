"use server";

import { createPasswordResetToken } from "@/lib/db/users";
import { redirect } from "next/navigation";

export type ForgotPasswordState =
  | { error: string }
  | { success: string }
  | null;

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }

  const result = await createPasswordResetToken(email);
  if (!result.ok) {
    if (result.reason === "user_not_found") {
      return {
        success:
          "If that email exists, a reset link would be sent. For now, ask an admin to verify the account.",
      };
    }
    return { error: "Could not create a reset token. Try again." };
  }

  redirect(`/reset-password?token=${encodeURIComponent(result.token)}`);
}

