import type { Metadata } from "next";
import { ContentPage, ContentHeading, PlaceholderNote } from "@/components/shared/ContentPage";

export const metadata: Metadata = {
  title: "Shipping & Delivery",
  description: "How Girah orders are prepared, shipped, and delivered — free shipping, cash on delivery available.",
};

export default function ShippingPage() {
  return (
    <ContentPage title="Shipping & Delivery">
      <p>
        Because every piece is made by hand after you order, preparation happens
        first — then your parcel is handed to our delivery partner.
      </p>

      <ContentHeading>Shipping cost</ContentHeading>
      <p>Shipping is free on all orders. The total you see at checkout is what you pay.</p>

      <ContentHeading>Payment on delivery</ContentHeading>
      <p>
        Cash on delivery is available everywhere we deliver. Prefer to pay online
        up front? Cards, JazzCash, and EasyPaisa are accepted through Safepay at
        checkout.
      </p>

      <ContentHeading>Preparation & delivery times</ContentHeading>
      <PlaceholderNote>
        [placeholder — the owner must fill in: how long handmade preparation takes
        (ready-made vs made-to-order), the delivery window per city/region, and
        any cut-off times.]
      </PlaceholderNote>

      <ContentHeading>Where we deliver</ContentHeading>
      <PlaceholderNote>
        [placeholder — delivery coverage (which cities/regions, nationwide or not)
        and the courier partner belong here.]
      </PlaceholderNote>

      <ContentHeading>Tracking your order</ContentHeading>
      <p>
        Every order gets an order number. Signed-in customers can follow status
        changes under{" "}
        <span className="underline">Account → Orders</span>; guest orders can be
        opened from the confirmation link issued when the order was placed.
      </p>
    </ContentPage>
  );
}
