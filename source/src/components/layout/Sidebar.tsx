import { Fragment } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home, Users, Stethoscope, ClipboardList, FileBarChart2,
  ClipboardCheck, MailQuestion, Layers, ShieldCheck, BookOpen,
  Grid3x3, Sparkles, LogOut, UserCircle2, LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import type { SystemRole } from "@/data/types";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  roles: SystemRole[];
  /** Render a divider before this item for these roles. */
  dividerBefore?: SystemRole[];
}

function getNavItems(role: SystemRole, isUnitLeader: boolean): NavItem[] {
  const items: NavItem[] = [
    { to: "/",                  label: "Home",               icon: Home,          roles: ["Administrator", "Person"] },
    { to: "/my-competencies",   label: "My Competencies",    icon: UserCircle2,      roles: ["Preceptor", "UnitLeader"] },
    { to: "/dashboard",         label: "Dashboard",          icon: LayoutDashboard,  roles: ["UnitLeader"] },
    { to: "/my-orientees",      label: isUnitLeader ? "Unit Learners" : "My Learners", icon: Users, roles: ["Preceptor", "UnitLeader"] },
    { to: "/observe",           label: "Observe Steps",      icon: Stethoscope,   roles: ["Preceptor", "UnitLeader"] },
    { to: "/sign-off",          label: "Sign Off",           icon: ClipboardCheck,roles: ["Preceptor", "UnitLeader"] },
    { to: "/persons",           label: "Unit Roster",        icon: Users,         roles: ["UnitLeader"] },
    { to: "/competency-matrix", label: "Competency Matrix",  icon: Grid3x3,       roles: ["UnitLeader"] },
    { to: "/competencies",      label: "Search Competencies",icon: BookOpen,      roles: ["Administrator", "UnitLeader", "Preceptor", "Person"], dividerBefore: ["Preceptor", "UnitLeader"] },
    { to: "/groups",            label: "Manage Groups",      icon: Layers,        roles: ["Administrator"] },
    { to: "/assignments",       label: "Assignments",        icon: ClipboardList, roles: ["Administrator"] },
    { to: "/people",            label: "People",             icon: Users,         roles: ["Administrator"] },
    { to: "/requests",          label: "Change Requests",    icon: MailQuestion,  roles: ["Administrator", "Preceptor", "UnitLeader"] },
    { to: "/reports",           label: "Reports",            icon: FileBarChart2, roles: ["Administrator", "UnitLeader"] },
    { to: "/audit",             label: "Audit Log",          icon: ShieldCheck,   roles: ["Administrator"] },
  ];

  return items.filter((i) => i.roles.includes(role));
}

export function Sidebar() {
  const { currentLogin, signOut } = useAuth();
  const { units } = useData();
  const navigate = useNavigate();
  if (!currentLogin) return null;

  const isUnitLeader = currentLogin.systemRole === "UnitLeader";
  const navItems = getNavItems(currentLogin.systemRole, isUnitLeader);
  const homeUnit = currentLogin.unitIds?.[0] ? units.find((u) => u.id === currentLogin.unitIds![0]) : undefined;

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border min-h-screen">
      {/* Brand */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md insight-gradient flex items-center justify-center text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold">
              <span className="text-sidebar-foreground">Care</span>
              <span className="text-primary">Competencies</span>
            </div>
            <div className="text-[11px] text-muted-foreground tracking-normal">
              Part of CareOps — Integrated Healthcare Operations
            </div>
          </div>
        </div>
      </div>

      {/* Active session card */}
      <div className="mx-3 mb-3 px-3 py-2 rounded-md border border-sidebar-border bg-card/60">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Signed in</div>
        <div className="text-sm font-medium text-sidebar-foreground truncate">{currentLogin.displayName}</div>
        <div className="text-[11px] text-muted-foreground">{currentLogin.systemRole}{homeUnit ? ` · ${homeUnit.name}` : ""}</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => (
          <Fragment key={item.to}>
            {item.dividerBefore?.includes(currentLogin.systemRole) && (
              <div className="my-2 border-t border-sidebar-border" />
            )}
            <NavItemLink item={item} />
          </Fragment>
        ))}
        <div className="my-2 border-t border-sidebar-border" />
        <button
          type="button"
          onClick={() => { navigate("/"); signOut(); }}
          className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-sidebar-accent/60 inline-flex items-center gap-2 text-sidebar-foreground/85"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </nav>
    </aside>
  );
}

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/" || item.to === "/my-competencies"}
      className={({ isActive }) =>
        `flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60"
        }`
      }
    >
      <item.icon className="h-4 w-4" />
      <span>{item.label}</span>
    </NavLink>
  );
}
