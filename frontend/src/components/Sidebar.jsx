import { Activity, Map, MessageSquareText, Sprout, Users } from "lucide-react";
import { NavLink } from "react-router-dom";

const NAVIGATION_ITEMS = [
  { to: "/", label: "Map", icon: Map, end: true },
  { to: "/plans", label: "Plans and Alerts", icon: Sprout },
  { to: "/organizations", label: "Organizations", icon: Users },
  { to: "/messages", label: "Messages", icon: MessageSquareText },
  { to: "/data-health", label: "Data Health", icon: Activity },
];

function navigationClass({ isActive }) {
  const base = "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors";
  return isActive
    ? `${base} bg-white/15 text-white`
    : `${base} text-paddy-100/80 hover:bg-white/10 hover:text-white`;
}

export default function Sidebar() {
  return (
    <aside className="flex w-[72px] shrink-0 flex-col bg-gradient-to-b from-paddy-800 via-paddy-800 to-wewa-900 px-3 py-5 xl:w-60">
      <div className="mb-8 flex items-center gap-3 px-1">
        <span className="text-lg font-bold text-white xl:hidden" aria-label="WewaSense">W</span>
        <div className="hidden xl:block">
          <div className="text-lg font-bold leading-tight text-white">WewaSense</div>
          <div className="text-[11px] text-paddy-200/80">Anuradhapura tanks</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAVIGATION_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navigationClass} title={label}>
            <Icon size={20} className="shrink-0" />
            <span className="hidden xl:inline">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
