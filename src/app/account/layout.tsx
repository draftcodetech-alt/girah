import Link from "next/link";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { AccountNav } from "@/components/storefront/AccountNav";
import { logout } from "@/modules/accounts/actions";
import { auth } from "@/lib/auth";

// Initials for the sidebar avatar — first letters of the name words, never
// more than two, and a guest glyph when the session carries no usable name
// (the layout renders before redirect guards fire on child pages, so an
// anonymous request must not crash or render "undefined").
function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "G";
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Design-only data for the sidebar mini profile — same session the pages
  // already read; falls back to neutral text when nothing is signed in.
  const session = await auth();
  const rawName = session?.user?.name?.trim() ?? "";
  const displayName = rawName || "My Account";
  const email = session?.user?.email?.trim() ?? "Girah customer";

  return (
    <>
      <Header />
      {/* Cream console surface for the whole customer dashboard — the shop
          Header / Footer and the shared nav below stay exactly as they were. */}
      <main id="main-content" className="flex-1">
        <div className="acct-shell">
          <div className="acct-frame">
            <aside className="acct-sidebar">
              {/* Mini profile card — display only, no editable state here. */}
              <div className="acct-mini">
                <span className="acct-avatar" aria-hidden="true">
                  {initialsOf(rawName)}
                </span>
                <div className="acct-mini-copy">
                  <strong>{displayName}</strong>
                  <span>{email}</span>
                </div>
              </div>

              <AccountNav />

              {/* Same server action the dashboard Log Out block uses — simply
                  reachable from every account page now, like the reference
                  sidebar. */}
              <form action={logout} className="acct-logout">
                <button type="submit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
                    <path d="M10 17l5-5-5-5" />
                    <path d="M15 12H3" />
                  </svg>
                  <span>Log Out</span>
                </button>
              </form>

              <div className="acct-support">
                <div className="acct-support-top">
                  <span className="acct-support-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                      <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
                      <rect x="3" y="12" width="4" height="7" rx="2" />
                      <rect x="17" y="12" width="4" height="7" rx="2" />
                      <path d="M17 19a5 5 0 0 1-5 3h-1" />
                    </svg>
                  </span>
                  <strong>Need Help?</strong>
                </div>
                <p>We&apos;re here with sizing, orders and anything handmade.</p>
                <Link href="/contact" className="acct-support-btn">
                  Contact us <span aria-hidden="true">→</span>
                </Link>
              </div>
            </aside>

            <div className="acct-main">{children}</div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
