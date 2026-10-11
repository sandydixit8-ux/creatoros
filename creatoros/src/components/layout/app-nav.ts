import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  Mail,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
  UsersRound,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export interface AppNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const APP_NAV: AppNavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/bio", label: "Bio Pages", icon: Link2 },
  { href: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/app/community", label: "Community", icon: UsersRound },
  { href: "/app/store", label: "Store", icon: ShoppingBag },
  { href: "/app/courses", label: "Courses", icon: GraduationCap },
  { href: "/app/learn", label: "My Learning", icon: BookOpen },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/email", label: "Email", icon: Mail },
  { href: "/app/booking", label: "Booking", icon: CalendarCheck },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/coach", label: "AI Coach", icon: Wand2 },
  { href: "/app/billing", label: "Billing", icon: Sparkles },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function appNavActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/app" && pathname.startsWith(href));
}