import { redirect } from "next/navigation";

// Products moved into the single Catalog tab (owner spec). This index route
// only redirects so bookmarks and old links keep working — /admin/products/new
// and /admin/products/[id] (the deep editors + image workflow) still render.
export default function AdminProductsIndex() {
  redirect("/admin/catalog");
}
