import Link from "next/link";

export default function Sidebar({ brand, links, activeHref, footer }) {
  return (
    <aside className="w-60 shrink-0 min-h-screen bg-sidebar text-white flex flex-col sticky top-0 h-screen">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center font-bold">M</div>
        <div className="font-bold text-lg">{brand}</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => {
          const isActive = activeHref === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-primary text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      {footer && <div className="px-3 py-4 border-t border-white/10">{footer}</div>}
    </aside>
  );
}
