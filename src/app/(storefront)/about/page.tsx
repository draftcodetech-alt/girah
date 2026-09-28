import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentHeading } from "@/components/shared/ContentPage";

export const metadata: Metadata = {
  title: "About",
  description: "Girah — handmade crochet bouquets and keychains, crocheted by hand in small batches.",
};

export default function AboutPage() {
  return (
    <ContentPage title="About">
      <p>
        Girah is a handmade crochet studio. Every bouquet and keychain is crocheted
        by hand, made to order, and finished in small batches — no two pieces are
        ever exactly alike.
      </p>

      <ContentHeading>What we make</ContentHeading>
      <p>
        Crochet bouquets that never wilt and small crochet companions for bags and
        keys. The full range lives in the{" "}
        <Link href="/shop" className="underline text-sage hover:text-charcoal">
          shop
        </Link>
        , with each piece photographed as it ships.
      </p>

      <ContentHeading>How it works</ContentHeading>
      <p>
        You order, we crochet. Orders are prepared by hand after they are placed,
        then packed and sent. You can pay on delivery or online (cards, JazzCash,
        and EasyPaisa via Safepay).
      </p>

      <ContentHeading>Our story</ContentHeading>
      <p>
        [placeholder — the founder’s story, studio location, and the year Girah
        started belong here in the owner’s own words.]
      </p>
    </ContentPage>
  );
}
