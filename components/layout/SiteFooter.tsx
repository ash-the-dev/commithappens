import Link from "next/link";

const legalLinks = [
  { href: "/about", label: "About" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/billing", label: "Billing & Refunds" },
  { href: "/acceptable-use", label: "Acceptable Use" },
];

const supportEmail = "commithappens@gmail.com";

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-black/35 px-6 py-8 text-sm text-white/62 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="font-semibold text-white">© 2026 Commit Happens. All rights reserved.</p>
          <p>Your site changed. We brought receipts.</p>
          <p>
            Support:{" "}
            <a className="font-semibold text-brand hover:text-brand-muted" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 md:justify-end">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-brand">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
