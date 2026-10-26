import { redirect } from "next/navigation";

// Categories moved into the single Catalog tab (owner spec) — this route
// only redirects so bookmarks and old links keep working.
export default function AdminCategoriesIndex() {
  redirect("/admin/catalog");
}
