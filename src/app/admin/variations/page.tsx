import { redirect } from "next/navigation";

// Variations moved into the single Catalog tab (owner spec) — this route
// only redirects so bookmarks and old links keep working.
export default function AdminVariationsIndex() {
  redirect("/admin/catalog");
}
