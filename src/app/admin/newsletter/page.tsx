import { getNewsletterSubscribers } from "@/modules/newsletter";
import { NewsletterRow } from "@/components/admin/NewsletterRow";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Newsletter" };

export default async function AdminNewsletterPage() {
  const subscribers = await getNewsletterSubscribers();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-h1 text-charcoal mb-1">Newsletter</h1>
      <p className="font-body text-small text-muted mb-8">
        {subscribers.length === 0
          ? "No subscribers yet — signups land here from the footer form."
          : `${subscribers.length} ${subscribers.length === 1 ? "subscriber" : "subscribers"}`}
      </p>

      {subscribers.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {subscribers.map((s) => (
            <NewsletterRow key={s.id} id={s.id} email={s.email} date={formatDate(s.createdAt)} />
          ))}
        </ul>
      )}
    </div>
  );
}
