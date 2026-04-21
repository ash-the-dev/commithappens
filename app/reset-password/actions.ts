"use server";

import { resetPasswordWithToken } from "@/lib/db/users";
import { redirect } from "next/navigation";

export type ResetPasswordState = { error: string } | null;

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "Missing reset token." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const result = await resetPasswordWithToken(token, password);
  if (!result.ok) {
    switch (result.reason) {
      case "invalid_token":
        return { error: "Invalid reset link. Generate a new one." };
      case "expired":
        return { error: "This reset link expired. Generate a new one." };
      case "weak_password":
        return { error: "Password must be at least 8 characters." };
      default:
        return { error: "Could not reset password. Try again." };
    }
  }

  redirect("/login?reset=1");
}

