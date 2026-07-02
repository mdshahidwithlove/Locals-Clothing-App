import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LogOut,
  Users,
  Truck,
  ChevronRight,
  BarChart3,
  DollarSign,
  ClipboardList,
  Store,
  ShieldCheck,
  X,
  Settings,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import LocalsLogo from '@/components/admin/LocalsLogo';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const HOME = '/dashboard/analytics';

const MENU_ITEMS: MenuItem[] = [
  { icon: BarChart3, label: 'Analytics', href: HOME },
  { icon: DollarSign, label: 'Revenue', href: '/dashboard/revenue' },
  { icon: ClipboardList, label: 'Orders', href: '/dashboard/orders' },
  { icon: Users, label: 'Users', href: '/dashboard/users' },
  { icon: Truck, label: 'Delivery', href: '/dashboard/delivery' },
  { icon: Store, label: 'Stores', href: '/dashboard/stores' },
  { icon: ShieldCheck, label: 'Merchant verify', href: '/dashboard/verification/merchants' },
  { icon: ShieldCheck, label: 'Delivery verify', href: '/dashboard/verification/delivery' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

function NavItem({
  item,
  isActive,
  onNavigate,
}: {
  item: MenuItem;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      className={cn(
        'group mb-0.5 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-amber-400/90 text-stone-900 shadow-sm shadow-amber-500/20'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            isActive ? 'bg-stone-900/10' : 'bg-stone-100 group-hover:bg-stone-200/80',
          )}
        >
          <Icon className={cn('h-4 w-4', isActive ? 'text-stone-900' : 'text-stone-500')} />
        </span>
        <span>{item.label}</span>
      </span>
      {isActive ? <ChevronRight className="h-4 w-4 text-stone-700" /> : null}
    </Link>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-900 font-['Fraunces',serif] text-xs font-bold text-white",
      )}
    >
      {initials || 'A'}
    </div>
  );
}

type SidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { admin, logout } = useAuthStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const currentPath = location.pathname;

  const isActiveHref = (href: string) => {
    if (href === HOME) {
      return currentPath === HOME || currentPath === '/dashboard';
    }
    if (currentPath === href) return true;
    if (href === '/dashboard/stores' && currentPath.startsWith('/dashboard/stores/')) {
      return true;
    }
    if (href === '/dashboard/verification/merchants' && currentPath.startsWith('/dashboard/verification/merchants')) {
      return true;
    }
    if (href === '/dashboard/verification/delivery' && currentPath.startsWith('/dashboard/verification/delivery')) {
      return true;
    }
    return false;
  };

  return (
    <>
      <aside
        id="admin-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(280px,88vw)] flex-col border-r border-stone-200/80 bg-white shadow-xl shadow-stone-900/5 transition-transform duration-200 ease-out lg:static lg:z-auto lg:h-dvh lg:max-h-dvh lg:w-[260px] lg:shrink-0 lg:overflow-y-auto lg:overscroll-y-contain lg:shadow-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-5 lg:px-5">
          <Link
            to={HOME}
            onClick={onMobileClose}
            className="flex items-center gap-3 rounded-xl outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <LocalsLogo size={48} subtitle="Admin" />
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 lg:hidden"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 lg:px-4">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">
            Menu
          </p>
          {MENU_ITEMS.map(item => (
            <NavItem
              key={item.href}
              item={item}
              isActive={isActiveHref(item.href)}
              onNavigate={onMobileClose}
            />
          ))}
        </nav>

        <div className="border-t border-stone-100 p-3 lg:p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={admin?.username ?? 'Admin'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-900">
                {admin?.username ?? 'Admin'}
              </p>
              <p className="truncate text-xs text-stone-500">{admin?.email ?? ''}</p>
            </div>
          </div>

          {!showLogoutConfirm ? (
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          ) : (
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
              <p className="text-xs font-semibold text-red-800">Sign out?</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={logout}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 rounded-lg border border-stone-200 bg-white py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
