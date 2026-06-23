import {
  Bell,
  FileText,
  LayoutDashboard,
  Lightbulb,
  type LucideIcon,
  Megaphone,
  Package,
  Plug,
  Receipt,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Single source for the left nav + mobile drawer (docs/11 §5 / docs/15 §2).
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Orders', href: '/orders', icon: ShoppingCart },
  { label: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Costs', href: '/costs', icon: Receipt },
  { label: 'Shipping', href: '/shipping', icon: Truck },
  { label: 'Integrations', href: '/integrations', icon: Plug },
  { label: 'AI', href: '/ai', icon: Sparkles },
  { label: 'Recommendations', href: '/recommendations', icon: Lightbulb },
  { label: 'Alerts', href: '/alerts', icon: Bell },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
];
