"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";

const STYLES = {
  menu: "block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50",
  button: "btn border-2 border-red-700 text-red-700 hover:bg-red-50",
  nav: "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50",
} as const;

/** The "Log out?" confirmation. Controlled, so a menu can close itself while the dialog is open. */
export function LogoutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby="logout-title" onClose={onClose} className="m-auto w-[min(92vw,24rem)] rounded-xl text-left p-6 shadow-xl backdrop:bg-black/40">
      <h2 id="logout-title" className="text-2xl">Log out?</h2>
      <p className="mt-2 text-sm text-muted">You&apos;ll need to log in again to see your account.</p>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className="btn-outline !py-2" onClick={onClose}>Stay Logged In</button>
        <form action={logoutAction}><button type="submit" className="btn bg-red-700 !py-2 text-white hover:bg-red-800">Log Out</button></form>
      </div>
    </dialog>
  );
}

/** Red "Log Out" that asks for confirmation first (so nobody logs out by accident). */
export function LogoutButton({ variant = "button" }: { variant?: keyof typeof STYLES }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={STYLES[variant]} onClick={() => setOpen(true)}>
        {variant === "nav" && <LogOut className="size-4" aria-hidden />} Log out
      </button>
      <LogoutDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
