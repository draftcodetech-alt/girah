import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { AnnouncementBar } from "@/components/shared/AnnouncementBar";
import { BackToTop } from "@/components/shared/BackToTop";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
      <BackToTop />
    </>
  );
}
