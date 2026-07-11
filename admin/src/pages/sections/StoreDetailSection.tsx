import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Store, RotateCcw } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { fetchStoreDetail, updateStoreStatus } from '../../services/dashboardApi';
import PageShell from '@/components/admin/PageShell';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PanelCard from '@/components/admin/PanelCard';
import LoadingState from '@/components/admin/LoadingState';
import ErrorState from '@/components/admin/ErrorState';
import { chartTheme } from '@/lib/admin-theme';
import { chartTooltip, pieLegendFormatter } from '@/lib/chart-common';
import { cn } from '@/lib/utils';
import StoreReviewCell from '@/components/admin/StoreReviewCell';
import {
  formatReviewDate,
  formatStoreRatingAverage,
  formatStoreReviewCount,
  hasStoreReviews,
  renderStarRating,
} from '@/lib/store-rating';

const STATUS_PIE_COLORS = [
  '#b45309',
  '#15803d',
  '#0369a1',
  '#7c3aed',
  '#c2410c',
  '#57534e',
  '#64748b',
  '#db2777',
];

function fmt(v: number) {
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function StoreDetailSection() {
  const { storeId } = useParams<{ storeId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);

  const load = () => {
    if (!storeId) return;
    setLoading(true);
    setError('');
    fetchStoreDetail(storeId)
      .then(setData)
      .catch(e =>
        setError(e?.response?.data?.message || e.message || 'Failed to load store'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [storeId]);

  const trendData = useMemo(() => {
    const rows = data?.ordersTrendDaily ?? [];
    return rows.map((r: any) => {
      let short = r.date?.slice(5) ?? r.date ?? '';
      let long = r.date ?? '';
      try {
        if (r.date && String(r.date).length >= 10) {
          const d = new Date(String(r.date));
          short = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
          long = d.toLocaleDateString('en-IN', {
            weekday: 'short',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
        }
      } catch {
        /* */
      }
      return {
        short,
        long,
        orders: r.orders,
        revenue: r.revenue,
      };
    });
  }, [data]);

  const statusPieData = useMemo(() => {
    const b = data?.orderStatusBreakdown ?? {};
    return Object.entries(b).map(([name, value]) => ({
      name,
      value: value as number,
    }));
  }, [data]);

  if (!storeId) {
    return (
      <PageShell>
        <ErrorState title="Missing store" message="Invalid link." />
      </PageShell>
    );
  }

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

  if (!data?.store) {
    return (
      <PageShell>
        <ErrorState title="Store unavailable" message="Could not load store data." onRetry={load} />
      </PageShell>
    );
  }

  const {
    store,
    orderStats,
    recentOrders,
    storeReviews = [],
    returnStats = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 },
    storeReturns = [],
  } = data;
  const dense = trendData.length > 14;

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          to="/dashboard/stores"
          className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900 hover:text-amber-950"
        >
          <ArrowLeft className="h-4 w-4" />
          All stores
        </Link>
      </div>

      <AdminPageHeader
        title={store.storeName}
        description={[
          store.owner?.name ? `Owner: ${store.owner.name}` : null,
          store.owner?.verificationStatus
            ? `Verification: ${String(store.owner.verificationStatus).replace(/_/g, ' ')}`
            : null,
          store.address ? String(store.address).slice(0, 120) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {store.owner?._id ? (
              <Link
                to={`/dashboard/verification/merchants/${store.owner._id}`}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                Merchant verification
              </Link>
            ) : null}
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset',
                store.isActive
                  ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/60'
                  : 'bg-red-100 text-red-800 ring-red-200/60',
              )}
            >
              {store.isActive ? 'Active' : 'Inactive'}
            </span>
            <button
              type="button"
              disabled={toggling}
              onClick={async () => {
                if (!storeId) return;
                try {
                  setToggling(true);
                  await updateStoreStatus(storeId, !store.isActive);
                  load();
                } catch (e: any) {
                  alert(e?.response?.data?.message || e.message || 'Failed to update store');
                } finally {
                  setToggling(false);
                }
              }}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-60"
            >
              {toggling ? 'Saving…' : store.isActive ? 'Deactivate store' : 'Activate store'}
            </button>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold',
                hasStoreReviews(store.rating?.totalReviews)
                  ? 'bg-amber-100 text-amber-950'
                  : 'bg-stone-100 text-stone-600',
              )}
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5',
                  hasStoreReviews(store.rating?.totalReviews)
                    ? 'fill-amber-500 text-amber-600'
                    : 'text-stone-400',
                )}
              />
              {hasStoreReviews(store.rating?.totalReviews) ? (
                <>
                  {formatStoreRatingAverage(store.rating?.average)}
                  <span className="font-normal text-amber-800">
                    ({formatStoreReviewCount(store.rating?.totalReviews)})
                  </span>
                </>
              ) : (
                <span className="font-medium">{formatStoreReviewCount(0)}</span>
              )}
            </span>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            <Store className="h-4 w-4" />
            Total orders
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {orderStats.totalOrders.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Gross revenue
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{fmt(orderStats.totalRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Delivered / cancelled
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-800">
            {orderStats.deliveredOrders}
            <span className="ml-2 text-base font-semibold text-red-700">
              / {orderStats.cancelledOrders}
            </span>
          </p>
          <p className="mt-1 text-xs text-stone-600">Cancel rate: {orderStats.returnRate}%</p>
        </div>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            <RotateCcw className="h-4 w-4" />
            Product returns
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-900">
            {returnStats?.total ?? 0}
          </p>
          <p className="mt-1 text-xs text-stone-600">
            {returnStats?.pending ?? 0} pending · {returnStats?.completed ?? 0} completed
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            <MapPin className="h-4 w-4" />
            Listed
          </div>
          <p className="mt-2 text-sm font-medium text-stone-800">
            {store.createdAt
              ? new Date(store.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—'}
          </p>
          {store.owner?.phone || store.owner?.email ? (
            <p className="mt-1 text-xs text-stone-600">
              {[store.owner.phone, store.owner.email].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      {/* Financial Settlement Summary */}
      <div className="mt-8">
        <PanelCard
          title="Financial Settlement Summary"
          description="Detailed breakdown of store sales, platform fees, COD cash collections, and outstanding settlement balance."
        >
          <div className="grid gap-6 md:grid-cols-4 mt-4">
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-200/50">
              <span className="text-xs font-semibold uppercase text-stone-500">Gross Sales (Delivered)</span>
              <p className="text-xl font-bold text-stone-900 mt-1">{fmt(orderStats.totalRevenue)}</p>
              <span className="text-[10px] text-stone-400">Total item sales from delivered orders</span>
            </div>
            
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-200/50">
              <span className="text-xs font-semibold uppercase text-stone-500">Platform Fees Charged</span>
              <p className="text-xl font-bold text-red-700 mt-1">{fmt(orderStats.totalPlatformFee || 0)}</p>
              <span className="text-[10px] text-stone-400">Commission collected by platform</span>
            </div>

            <div className="rounded-xl bg-stone-50 p-4 border border-stone-200/50">
              <span className="text-xs font-semibold uppercase text-stone-500">Store Net Earnings</span>
              <p className="text-xl font-bold text-emerald-800 mt-1">{fmt(orderStats.storeNetEarnings || 0)}</p>
              <span className="text-[10px] text-stone-400">Gross Sales - Platform Fees</span>
            </div>

            <div className="rounded-xl bg-stone-50 p-4 border border-stone-200/50">
              <span className="text-xs font-semibold uppercase text-stone-500">COD Cash Handed Over</span>
              <p className="text-xl font-bold text-stone-700 mt-1">{fmt(orderStats.codCollectedAndHandedOver || 0)}</p>
              <span className="text-[10px] text-stone-400">COD collected cash submitted to store</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between border-t border-stone-200/80 pt-6">
            <div>
              <span className="text-sm font-semibold text-stone-600">Online Sales (Settled by Platform)</span>
              <p className="text-lg font-bold text-stone-800 mt-0.5">{fmt(orderStats.onlineSales || 0)}</p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-4">
              <span className="text-sm font-bold text-stone-700">Settlement Balance:</span>
              {(orderStats.netBalance ?? 0) > 0 ? (
                <span className="rounded-xl bg-red-100 border border-red-200 px-4 py-2 text-red-800 text-lg font-bold">
                  Store owes Platform: {fmt(orderStats.netBalance)}
                </span>
              ) : (orderStats.netBalance ?? 0) < 0 ? (
                <span className="rounded-xl bg-emerald-100 border border-emerald-200 px-4 py-2 text-emerald-800 text-lg font-bold">
                  Platform owes Store: {fmt(Math.abs(orderStats.netBalance))}
                </span>
              ) : (
                <span className="rounded-xl bg-stone-100 border border-stone-200 px-4 py-2 text-stone-600 text-lg font-bold">
                  Fully Settled (₹0)
                </span>
              )}
            </div>
          </div>
        </PanelCard>
      </div>

      <div className="mt-8">
        <PanelCard
          title="Product returns"
          description={`${returnStats?.total ?? 0} total · ${returnStats?.pending ?? 0} pending · ${returnStats?.approved ?? 0} approved · ${returnStats?.rejected ?? 0} rejected · ${returnStats?.completed ?? 0} completed`}
        >
          {!storeReturns?.length ? (
            <p className="py-10 text-center text-sm text-stone-500">
              No return requests for this store yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    <th className="px-4 py-2">Order</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Reason</th>
                    <th className="px-4 py-2">Return status</th>
                    <th className="px-4 py-2">Refund</th>
                    <th className="px-4 py-2">Pickup status</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {storeReturns.map((ret: any) => (
                    <tr key={ret._id} className="hover:bg-stone-50/80">
                      <td className="px-4 py-2 font-semibold">
                        {ret.order?.orderNumber || ret.order?._id?.slice(-8) || '—'}
                      </td>
                      <td className="px-4 py-2 text-stone-600">
                        {ret.customer?.name || ret.customer?.phone || '—'}
                      </td>
                      <td className="px-4 py-2 text-stone-700">{ret.reason}</td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-bold',
                            ret.status === 'Pending' && 'bg-amber-100 text-amber-900',
                            ret.status === 'Approved' && 'bg-blue-100 text-blue-900',
                            ret.status === 'Rejected' && 'bg-red-100 text-red-900',
                            ret.status === 'Completed' && 'bg-emerald-100 text-emerald-900',
                          )}
                        >
                          {ret.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-stone-600">
                        {ret.refundStatus}
                        {ret.refundProofImage ? ' · proof ✓' : ''}
                      </td>
                      <td className="px-4 py-2 text-xs text-stone-600">
                        {ret.returnDelivery?.status === 'Delivered'
                          ? 'Delivered to merchant'
                          : ret.returnDelivery?.status || '—'}
                      </td>
                      <td className="px-4 py-2 font-bold tabular-nums">
                        {fmt(ret.order?.totalAmount ?? 0)}
                      </td>
                      <td className="px-4 py-2 text-xs text-stone-500">
                        {ret.createdAt
                          ? new Date(ret.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelCard>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <PanelCard
          className="lg:col-span-2"
          title="Daily orders & revenue"
          description="Last 90 days — hover for full date and amounts"
        >
          {trendData.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">No orders in this window yet.</p>
          ) : (
            <div className="h-[340px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 16, right: 20, left: 8, bottom: dense ? 52 : 36 }}
                >
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="short"
                    tick={{ fill: chartTheme.axis, fontSize: 10 }}
                    axisLine={{ stroke: '#d6d3d1' }}
                    tickLine={false}
                    interval={dense ? 'preserveStartEnd' : 0}
                    angle={dense ? -40 : 0}
                    textAnchor={dense ? 'end' : 'middle'}
                    height={dense ? 48 : 30}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: chartTheme.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    label={{
                      value: 'Orders',
                      angle: -90,
                      position: 'insideLeft',
                      fill: chartTheme.axis,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: chartTheme.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                    label={{
                      value: 'Revenue (₹)',
                      angle: 90,
                      position: 'insideRight',
                      fill: chartTheme.axis,
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    {...chartTooltip}
                    labelFormatter={(_l, p) =>
                      (p?.[0]?.payload as { long?: string })?.long ?? ''
                    }
                    formatter={(value: number, name: string) => {
                      if (name === 'orders' || name === 'Orders')
                        return [`${value.toLocaleString('en-IN')}`, 'Orders'];
                      return [fmt(value), 'Revenue'];
                    }}
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="orders"
                    name="Orders"
                    stroke={chartTheme.accent}
                    strokeWidth={2}
                    dot={{ r: 3, stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue (₹)"
                    stroke="#15803d"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelCard>

        <PanelCard
          title="Orders by status"
          description="Legend shows each status with order count"
        >
          {statusPieData.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">No status data.</p>
          ) : (
            <div className="h-[340px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, bottom: 8 }}>
                  <Pie
                    data={statusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="42%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {statusPieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]}
                        fillOpacity={0.9}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    {...chartTooltip}
                    formatter={(v: number, n: string) => [
                      `${v.toLocaleString('en-IN')} orders`,
                      n,
                    ]}
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: 11, maxHeight: 120, overflowY: 'auto' }}
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
          title="Customer store reviews"
          description={
            hasStoreReviews(store.rating?.totalReviews)
              ? `${formatStoreReviewCount(store.rating?.totalReviews)} · showing latest ${storeReviews.length}`
              : 'Reviews appear after customers rate delivered orders'
          }
        >
          {storeReviews.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-500">
              {hasStoreReviews(store.rating?.totalReviews)
                ? 'Reviews are recorded but could not be loaded. Try refreshing the page.'
                : 'No store reviews yet. Ratings are collected after successful delivery.'}
            </p>
          ) : (
            <div className="space-y-3">
              {storeReviews.map((review: any) => (
                <div
                  key={review._id}
                  className="rounded-xl border border-stone-200/90 bg-stone-50/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-stone-900">{review.userName}</p>
                      <p className="text-xs text-stone-500">
                        Order #{review.orderNumber || review._id?.slice(-8)}
                        {review.userPhone ? ` · ${review.userPhone}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tracking-wide text-amber-700">
                        {renderStarRating(review.rating)}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {formatReviewDate(review.ratedAt)}
                      </p>
                    </div>
                  </div>
                  {review.review?.trim() ? (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700">
                      {review.review.trim()}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm italic text-stone-500">No written feedback</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      <div className="mt-8">
        <PanelCard title="Recent orders" description="Newest 30 at this store">
          {!recentOrders?.length ? (
            <p className="py-10 text-center text-sm text-stone-500">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    <th className="px-4 py-2">Order</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Store review</th>
                    <th className="px-4 py-2">Payment</th>
                    <th className="px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {recentOrders.map((o: any) => (
                    <tr key={o._id} className="hover:bg-stone-50/80">
                      <td className="px-4 py-2 font-semibold">
                        {o.orderNumber || o._id?.slice(-8)}
                      </td>
                      <td className="px-4 py-2 text-stone-600">
                        {o.user?.name || o.user?.phone || '—'}
                      </td>
                      <td className="px-4 py-2 font-bold tabular-nums">
                        {fmt(o.totalAmount ?? 0)}
                      </td>
                      <td className="px-4 py-2 text-xs font-semibold text-stone-800">{o.status}</td>
                      <td className="px-4 py-2 text-xs text-stone-600">
                        <StoreReviewCell order={o} />
                      </td>
                      <td className="px-4 py-2 text-xs text-stone-600">
                        {o.paymentMethod} / {o.paymentStatus}
                      </td>
                      <td className="px-4 py-2 text-xs text-stone-500">
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                            })
                          : '—'}
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
