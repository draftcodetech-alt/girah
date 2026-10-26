import { getNewsletterSubscribers } from "@/modules/newsletter";
import { NewsletterRow } from "@/components/admin/NewsletterRow";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Newsletter" };

export default async function AdminNewsletterPage() {
  const subscribers = await getNewsletterSubscribers();

  return (
    <div>
      <div className="ax-heading">
        <div>
          <p className="ax-eyebrow">
            <span className="ax-eyebrow-line" aria-hidden="true" />
            AUDIENCE · SIGNUPS
          </p>
          <h1 className="ax-title">
            Newsletter<span className="ax-period">.</span>
          </h1>
          <p className="ax-sub">
            {subscribers.length === 0
              ? "No subscribers yet — signups land here from the footer form."
              : `${subscribers.length} ${subscribers.length === 1 ? "subscriber" : "subscribers"}`}
          </p>
        </div>
      </div>

      {subscribers.length > 0 && (
        <section className="ax-panel ax-panel--body">
          <div className="ax-section-label">
            <div>
              <p className="ax-kicker">SUBSCRIBERS</p>
              <h2>On the list</h2>
            </div>
          </div>
          <ul className="ax-rows">
            {subscribers.map((s) => (
              <NewsletterRow key={s.id} id={s.id} email={s.email} date={formatDate(s.createdAt)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
