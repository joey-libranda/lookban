"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { LogoutDialog } from "@/components/auth/LogoutButton";

const ITEM = "block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-blue-50";

/** Account dropdown: outlined button; closes after any choice, on outside click and on Escape. */
export function AccountMenu({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [logout, setLogout] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border-2 border-blue px-3 py-1.5 text-blue transition hover:bg-blue-50">
        <UserRound className="size-5" aria-hidden />
        <span className="hidden text-sm font-semibold sm:inline">{name}</span>
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-50 mt-2 w-52 p-1.5 shadow-lg" onClick={() => setOpen(false)}>
          <Link role="menuitem" href="/account" className={ITEM}>My Account</Link>
          {isAdmin
            ? <Link role="menuitem" href="/admin" className={ITEM}>Admin Dashboard</Link>
            : <Link role="menuitem" href="/account/orders" className={ITEM}>My Orders</Link>}
          <button type="button" role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50" onClick={() => setLogout(true)}>Log Out</button>
        </div>
      )}
      <LogoutDialog open={logout} onClose={() => setLogout(false)} />
    </div>
  );
}
