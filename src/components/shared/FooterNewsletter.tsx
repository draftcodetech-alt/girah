"use client";

import { useRef, useState } from "react";

// Client-side-only newsletter (per product decision): validates and
// acknowledges in place — no backend, no fake network round-trip.
export function FooterNewsletter() {
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMsg("Please enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    if (!agree) {
      setMsg("Please tick the box to agree to updates.");
      return;
    }
    setMsg("Thank you! You’re in the loop 🌻");
    setEmail("");
    setAgree(false);
  }

  return (
    <>
      <form className="ft-form" onSubmit={onSubmit} noValidate>
        <input
          ref={emailRef}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email address"
          aria-label="Email address"
          required
        />
        <button type="submit" aria-label="Subscribe">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12h16M14 6l6 6-6 6" />
          </svg>
        </button>
      </form>
      <label className="ft-agree">
        <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
        I agree to receive updates from Girah.
      </label>
      <div className="ft-msg" role="status">
        {msg}
      </div>
    </>
  );
}
