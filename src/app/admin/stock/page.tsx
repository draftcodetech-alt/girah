import { redirect } from "next/navigation";

// The Stock tab and the stock concept itself were removed (owner spec).
// This route only redirects so an old bookmark lands somewhere sensible.
export default function AdminStockIndex() {
  redirect("/admin/catalog");
}
