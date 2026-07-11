import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  ShoppingCart,
  Store,
  Truck,
  TrendingUp,
  UserPlus,
  Bell,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import DateRangeFilterBar from '@/components/admin/DateRangeFilterBar';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { fetchAnalyticsOverview, fetchAdminNotifications } from '../../services/dashboardApi';
import PageShell from '@/components/admin/PageShell';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import StatCard from '@/components/admin/StatCard';
import PanelCard from '@/components/admin/PanelCard';
import LoadingState from '@/components/admin/LoadingState';
import ErrorState from '@/components/admin/ErrorState';
import SegmentedControl from '@/components/admin/SegmentedControl';
import { chartTheme } from '@/lib/admin-theme';
import { chartTooltip, pieLegendFormatter } from '@/lib/chart-common';
import { useAuthStore } from '@/store/authStore';

interface AnalyticsData {
  totalUsers: number;
  totalMerchants: number;
  totalDeliveryPartners: number;
  totalCustomers: number;
  totalOrders: number;
  totalStores: number;
  newUsersLast30Days: number;
  roleBreakdown: Record<string, number>;
  ordersTrend: {
    daily: { date: string; count: number; revenue: number }[];
    weekly: { week: number; year: number; count: number; revenue: number }[];
    monthly: { month: string; count: number; revenue: number }[];
  };
  categoryWiseSales: { category: string; totalSold: number; totalRevenue: number }[];
  financials?: {
    totalOrders: number;
    revenue: number;
    deliveryFees: number;
    platformFees: number;
    storeEarnings: number;
    refunds: number;
    profit: number;
    loss: number;
  };
}

type TrendView = 'daily' | 'weekly' | 'monthly';

const ROLE_COLORS = ['#b45309', '#15803d', '#0369a1', '#7c3aed', '#c2410c', '#57534e'];
const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

export default function AnalyticsSection() {
  const { admin } = useAuthStore();
  const displayName = admin?.username?.trim() || 'there';

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendView, setTrendView] = useState<TrendView>('daily');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const load = (df = dateFrom, dt = dateTo) => {
    setLoading(true);
    setError('');
    const params = df || dt ? { dateFrom: df, dateTo: dt } : undefined;
    Promise.all([fetchAnalyticsOverview(params), fetchAdminNotifications()])
      .then(([overviewData, notificationData]) => {
        setData(overviewData);
        setNotifications(notificationData || []);
      })
      .catch(e =>
        setError(e?.response?.data?.message || e.message || 'Failed to load analytics'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleApply = () => {
    load(dateFrom, dateTo);
  };

  const handleClear = () => {
    setDateFrom('');
    setDateTo('');
    load('', '');
  };

  const handlePresetDays = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days + 1);
    
    const toStr = to.toISOString().split('T')[0];
    const fromStr = from.toISOString().split('T')[0];
    
    setDateFrom(fromStr);
    setDateTo(toStr);
    load(fromStr, toStr);
  };

  const trendChartData = useMemo(() => {
    if (!data) return [];
    const raw =
      trendView === 'daily'
        ? data.ordersTrend.daily
        : trendView === 'weekly'
          ? data.ordersTrend.weekly
          : data.ordersTrend.monthly;
    return raw.map((item: any) => {
      let periodLabel: string;
      let detailName: string;
      if (trendView === 'daily') {
        periodLabel = item.date?.slice(5) ?? '';
        detailName = item.date ?? periodLabel;
      } else if (trendView === 'weekly') {
        periodLabel = `W${item.week} · ${item.year ?? ''}`.trim();
        detailName = `Week ${item.week}, ${item.year ?? ''}`;
      } else {
        periodLabel = item.month ?? '';
        detailName = item.month ?? '';
        try {
          if (item.month && item.month.length >= 7) {
            const d = new Date(item.month + '-01');
            periodLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
            detailName = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
          }
        } catch {
          /* keep raw */
        }
      }
      return {
        periodLabel,
        detailName,
        orders: item.count,
        revenue: item.revenue ?? 0,
      };
    });
  }, [data, trendView]);

  const rolePieData = useMemo(() => {
    if (!data?.roleBreakdown) return [];
    return Object.entries(data.roleBreakdown).map(([name, value]) => ({
      name: name || 'Unknown',
      value,
    }));
  }, [data]);

  const categoryChartData = useMemo(() => {
    if (!data?.categoryWiseSales?.length) return [];
    return data.categoryWiseSales.slice(0, 12).map(c => {
      const raw = c.category != null ? String(c.category) : 'Unknown';
      return {
        name: raw,
        revenue: c.totalRevenue,
        sold: c.totalSold,
      };
    });
  }, [data]);

  if (loading && !data) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  if (error && !data) {
    return (
      <PageShell>
        <ErrorState message={error} onRetry={load} />
      </PageShell>
    );
  }

  if (!data) return null;

  const denseTrend = trendChartData.length > 12;

  return (
    <PageShell>
      <AdminPageHeader
        title={`${greeting}, ${displayName}`}
        description="Platform snapshot — order cadence, role mix, and category revenue. Names and counts appear in chart legends and tooltips."
      />

      <div className="mb-6">
        <DateRangeFilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onApply={handleApply}
          onClear={handleClear}
          onPresetDays={handlePresetDays}
          disabled={loading}
        />
      </div>

      {/* Range-based Financial Summary */}
      {data.financials && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-amber-700" />
            Financial Performance Summary (Selected Period)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <ShoppingCart className="h-4 w-4 text-sky-700" />
                Gross Sales (GMV)
              </div>
              <p className="mt-2 text-2xl font-bold text-stone-900 tabular-nums">
                {fmt(data.financials.revenue)}
              </p>
              <span className="text-[10px] text-stone-400 mt-1 block">
                {data.financials.totalOrders} non-cancelled orders in period
              </span>
            </div>

            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <ArrowUpRight className="h-4 w-4 text-emerald-700" />
                Net Profit (Platform Commission)
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-800 tabular-nums">
                {fmt(data.financials.profit)}
              </p>
              <span className="text-[10px] text-stone-400 mt-1 block">
                Total commissions collected
              </span>
            </div>

            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <ArrowDownRight className="h-4 w-4 text-red-700" />
                Net Loss (Refunds)
              </div>
              <p className="mt-2 text-2xl font-bold text-red-800 tabular-nums">
                {fmt(data.financials.loss)}
              </p>
              <span className="text-[10px] text-stone-400 mt-1 block">
                Total refund transactions processed
              </span>
            </div>

            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <Users className="h-4 w-4 text-stone-500" />
                Settlement & Delivery Shares
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500">Stores:</span>
                  <span className="font-semibold text-stone-800">{fmt(data.financials.storeEarnings)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-500">Riders:</span>
                  <span className="font-semibold text-stone-800">{fmt(data.financials.deliveryFees)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration & Directory Overview */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-sky-700" />
          Registrations & Directory Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={Users}
            label="Total users"
            value={data.totalUsers}
            hint={`+${data.newUsersLast30Days.toLocaleString('en-IN')} in selected period`}
            iconClassName="bg-sky-100 text-sky-800"
          />
          <StatCard
            icon={ShoppingCart}
            label="Orders"
            value={data.totalOrders}
            iconClassName="bg-amber-100 text-amber-900"
          />
          <StatCard
            icon={Store}
            label="Stores"
            value={data.totalStores}
            iconClassName="bg-emerald-100 text-emerald-800"
          />
          <StatCard
            icon={Truck}
            label="Delivery partners"
            value={data.totalDeliveryPartners}
            iconClassName="bg-violet-100 text-violet-800"
          />
          <StatCard
            icon={UserPlus}
            label="Customers"
            value={data.totalCustomers}
            iconClassName="bg-rose-100 text-rose-800"
          />
          <StatCard
            icon={Users}
            label="Merchants"
            value={data.totalMerchants}
            iconClassName="bg-orange-100 text-orange-900"
          />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <PanelCard
          className="lg:col-span-2"
          title="Order volume"
          description="Orders per period — point + line (not a solid block)"
          action={
            <SegmentedControl
              value={trendView}
              onChange={setTrendView}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          }
        >
          {trendChartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">No trend data yet.</p>
          ) : (
            <div className="h-[340px] w-full min-w-0 sm:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendChartData}
                  margin={{ top: 16, right: 20, left: 8, bottom: denseTrend ? 52 : 32 }}
                >
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="periodLabel"
                    tick={{ fill: chartTheme.axis, fontSize: 11 }}
                    axisLine={{ stroke: '#d6d3d1' }}
                    tickLine={false}
                    interval={denseTrend ? 'preserveStartEnd' : 0}
                    angle={denseTrend ? -40 : 0}
                    textAnchor={denseTrend ? 'end' : 'middle'}
                    height={denseTrend ? 48 : 28}
                  />
                  <YAxis
                    tick={{ fill: chartTheme.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    label={{
                      value: 'Orders',
                      angle: -90,
                      position: 'insideLeft',
                      fill: chartTheme.axis,
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    {...chartTooltip}
                    labelFormatter={(_l, payload) =>
                      (payload?.[0]?.payload as { detailName?: string })?.detailName ?? ''
                    }
                    formatter={(value: number) => [
                      `${value.toLocaleString('en-IN')} orders`,
                      'Volume',
                    ]}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name="Orders"
                    stroke={chartTheme.accent}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: chartTheme.accent, stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelCard>

        <PanelCard
          title="Users by role"
          description="Each slice is labeled in the legend with role name and count"
        >
          {rolePieData.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">No role data.</p>
          ) : (
            <div className="h-[360px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={rolePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="42%"
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {rolePieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={ROLE_COLORS[i % ROLE_COLORS.length]}
                        fillOpacity={0.92}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    {...chartTooltip}
                    formatter={(v: number, name: string) => [
                      `${v.toLocaleString('en-IN')} users`,
                      name,
                    ]}
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={pieLegendFormatter}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelCard>
      </div>

      <div className="mt-8">
        <PanelCard
          title="Category revenue"
          description="Category names on the left; bar ends at revenue (₹)"
          action={
            <span className="hidden items-center gap-1 text-xs font-medium text-stone-500 sm:inline-flex">
              <TrendingUp className="h-3.5 w-3.5" />
              Non-cancelled order lines
            </span>
          }
        >
          {categoryChartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">No category sales yet.</p>
          ) : (
            <div className="h-[380px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryChartData}
                  layout="vertical"
                  margin={{ top: 12, right: 28, left: 8, bottom: 12 }}
                >
                  <defs>
                    <linearGradient id="catBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#15803d" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#15803d" stopOpacity={0.95} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: chartTheme.axis, fontSize: 11 }}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                    axisLine={{ stroke: '#d6d3d1' }}
                    tickLine={false}
                    label={{
                      value: 'Revenue (₹)',
                      position: 'insideBottomRight',
                      offset: -4,
                      fill: chartTheme.axis,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={148}
                    tick={{ fill: chartTheme.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <Tooltip
                    {...chartTooltip}
                    formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']}
                    labelFormatter={(_l, p) => (p?.[0]?.payload as { name?: string })?.name ?? ''}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="url(#catBar)"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelCard>
      </div>

      {/* Recent System Notifications / Activities */}
      <div className="mt-8 mb-6">
        <PanelCard
          title="Recent system notifications & activities"
          description="Real-time events, user logins, and registrations in the system"
          action={
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <Bell className="h-3.5 w-3.5 animate-bounce" />
              Live Activities
            </span>
          }
        >
          {notifications.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">No recent activities logged.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-stone-700">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 font-semibold text-stone-900">
                    <th className="px-4 py-3">Event Type</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {notifications.map((n, i) => (
                    <tr key={n._id || i} className="hover:bg-stone-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-medium whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${
                          n.title.toLowerCase().includes('login')
                            ? 'bg-sky-50 text-sky-800 ring-sky-200/50'
                            : n.title.toLowerCase().includes('register')
                            ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/50'
                            : 'bg-stone-50 text-stone-700 ring-stone-200/60'
                        }`}>
                          {n.title.toLowerCase().includes('login') ? 'Login' : n.title.toLowerCase().includes('register') ? 'Register' : 'System'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-stone-900">{n.title}</td>
                      <td className="px-4 py-3.5 text-stone-600">{n.message}</td>
                      <td className="px-4 py-3.5 text-right text-stone-400 font-mono text-xs whitespace-nowrap">
                        {new Date(n.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })} · {new Date(n.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelCard>
      </div>
    </PageShell>
  );
}
