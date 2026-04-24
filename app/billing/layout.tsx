import type { Metadata } from "next";

/** Billing is account-only; do not compete with marketing pages in search. */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
