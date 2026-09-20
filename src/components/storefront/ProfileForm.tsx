"use client";

import { useState, useTransition } from "react";
import { updateProfile, changePassword } from "@/modules/accounts/actions";

type Profile = { name: string; email: string; phone: string | null };

export function ProfileForm({ profile }: { profile: Profile }) {
  const [isPending, startTransition] = useTransition();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({});
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  function handleProfileSubmit(formData: FormData) {
    setProfileError(null);
    setProfileFieldErrors({});
    setProfileSuccess(false);
    startTransition(async () => {
      const result = await updateProfile({
        name: formData.get("name") as string,
        email: formData.get("email") as string,
        phone: (formData.get("phone") as string) || "",
      });
      if (result.success) {
        setProfileSuccess(true);
      } else {
        setProfileError(result.error);
        setProfileFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  function handlePasswordSubmit(formData: FormData) {
    setPasswordError(null);
    setPasswordFieldErrors({});
    setPasswordSuccess(false);
    startPasswordTransition(async () => {
      const result = await changePassword({
        currentPassword: formData.get("currentPassword") as string,
        newPassword: formData.get("newPassword") as string,
        confirmNewPassword: formData.get("confirmNewPassword") as string,
      });
      if (result.success) {
        setPasswordSuccess(true);
        (document.getElementById("password-form") as HTMLFormElement)?.reset();
      } else {
        setPasswordError(result.error);
        setPasswordFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  const inputClass = (field: string, errors: Record<string, string>) =>
    `w-full h-12 rounded-[var(--radius-control)] border px-4 font-body text-body bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
      errors[field] ? "border-error" : "border-border"
    }`;

  return (
    <div className="max-w-[640px]">
      <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-4">
        Personal Information
      </h2>
      <form action={handleProfileSubmit} className="space-y-4">
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Name</label>
          <input name="name" defaultValue={profile.name} required className={inputClass("name", profileFieldErrors)} />
          {profileFieldErrors.name && <p className="text-small text-error mt-1">{profileFieldErrors.name}</p>}
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Email</label>
          <input name="email" type="email" defaultValue={profile.email} required className={inputClass("email", profileFieldErrors)} />
          {profileFieldErrors.email && <p className="text-small text-error mt-1">{profileFieldErrors.email}</p>}
        </div>
        <div>
          <label className="font-body text-small text-charcoal block mb-1.5">Phone Number</label>
          <input name="phone" defaultValue={profile.phone ?? ""} className={inputClass("phone", profileFieldErrors)} />
        </div>

        {profileError && <p className="font-body text-small text-error">{profileError}</p>}
        {profileSuccess && <p className="font-body text-small text-success">✓ Profile updated</p>}

        <button
          type="submit"
          disabled={isPending}
          className="h-12 px-6 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage text-cream disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <div className="mt-12 pt-8 border-t border-border">
        <h2 className="font-body text-label font-semibold tracking-[0.08em] uppercase text-sage mb-4">Security</h2>
        <form id="password-form" action={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="font-body text-small text-charcoal block mb-1.5">Current Password</label>
            <input name="currentPassword" type="password" required className={inputClass("currentPassword", passwordFieldErrors)} />
            {passwordFieldErrors.currentPassword && (
              <p className="text-small text-error mt-1">{passwordFieldErrors.currentPassword}</p>
            )}
          </div>
          <div>
            <label className="font-body text-small text-charcoal block mb-1.5">New Password</label>
            <input name="newPassword" type="password" required className={inputClass("newPassword", passwordFieldErrors)} />
            {passwordFieldErrors.newPassword && (
              <p className="text-small text-error mt-1">{passwordFieldErrors.newPassword}</p>
            )}
          </div>
          <div>
            <label className="font-body text-small text-charcoal block mb-1.5">Confirm New Password</label>
            <input name="confirmNewPassword" type="password" required className={inputClass("confirmNewPassword", passwordFieldErrors)} />
            {passwordFieldErrors.confirmNewPassword && (
              <p className="text-small text-error mt-1">{passwordFieldErrors.confirmNewPassword}</p>
            )}
          </div>

          {passwordError && <p className="font-body text-small text-error">{passwordError}</p>}
          {passwordSuccess && <p className="font-body text-small text-success">✓ Password changed</p>}

          <button
            type="submit"
            disabled={isPasswordPending}
            className="h-12 px-6 rounded-[var(--radius-control)] font-body text-button font-semibold bg-sage-light text-charcoal disabled:opacity-60"
          >
            {isPasswordPending ? "Changing…" : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
