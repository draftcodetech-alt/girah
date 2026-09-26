import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { AccountNav } from "@/components/storefront/AccountNav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Shared section nav — every account page sits under this wrapper. */}
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 pt-8">
          <AccountNav />
        </div>
        {children}
      </main>
      <Footer />
    </>
  );
}
