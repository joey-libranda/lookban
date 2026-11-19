import { getSocialLinks } from "@/server/queries/site";

const PATHS: Record<string, React.ReactNode> = {
  facebook: <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3z" fill="currentColor" stroke="none" />,
  instagram: <><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.6" /><circle cx="16.9" cy="7.1" r="0.9" fill="currentColor" stroke="none" /></>,
  tiktok: <path d="M14 4v10.2a3.2 3.2 0 1 1-3.2-3.2M14 4c.3 2.4 1.9 4 4.2 4.2" />,
};

export async function SocialLinks({ className = "" }: { className?: string }) {
  const links = (await getSocialLinks()).filter((l) => l.visible);
  if (links.length === 0) return null;
  return (
    <ul className={`flex gap-2.5 ${className}`}>
      {links.map((s) => (
        <li key={s.key}>
          <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`LOOKBAN on ${s.label}`}
             className="pop flex size-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-yellow hover:text-navy">
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {PATHS[s.key]}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
