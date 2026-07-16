import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchDeliveryPartners, fetchDeliveryStats, settleDeliveryPartnerCash } from '../../services/dashboardApi';
import { Truck, Wifi, WifiOff, Loader } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { chartTooltip, pieLegendFormatter } from '@/lib/chart-common';
import PageShell from '@/components/admin/PageShell';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PanelCard from '@/components/admin/PanelCard';
import LoadingState from '@/components/admin/LoadingState';
import ErrorState from '@/components/admin/ErrorState';
import EmptyState from '@/components/admin/EmptyState';
import SegmentedControl from '@/components/admin/SegmentedControl';
import PaginationBar from '@/components/admin/PaginationBar';
import { cn } from '@/lib/utils';

const PIE_COLORS = ['#c9a227', '#15803d', '#0369a1', '#a21caf', '#c2410c', '#57534e'];
const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

function StatusDot({ status }: { status: 'online' | 'busy' | 'offline' }) {
  const color =
    status === 'online'
      ? 'bg-emerald-500 shadow-emerald-500/40'
      : status === 'busy'
        ? 'bg-amber-500 shadow-amber-500/40'
        : 'bg-stone-400 shadow-stone-400/30';
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full shadow-[0_0_0_3px]', color)} />
      <span className="text-xs font-semibold capitalize text-stone-700">{status}</span>
    </div>
  );
}

function getPartnerStatus(p: any): 'online' | 'busy' | 'offline' {
  if (p.isBusy) return 'busy';
  if (p.isActive) return 'online';
  return 'offline';
}

export default function DeliverySection() {
  const [stats, setStats] = useState<any>(null);
  const [partnersData, setPartnersData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadInitial = () => {
    setLoading(true);
    setError('');
    Promise.all([fetchDeliveryStats(), fetchDeliveryPartners({ page: 1, limit: 15 })])
      .then(([s, p]) => {
        setStats(s);
        setPartnersData(p);
      })
      .catch(e => setError(e?.response?.data?.message || e.message || 'Failed to load delivery data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInitial();
  }, []);

  const loadPartners = useCallback(() => {
    fetchDeliveryPartners({
      page,
      limit: 15,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    })
      .then(setPartnersData)
      .catch(() => {});
  }, [page, statusFilter]);

  useEffect(() => {
    if (stats) loadPartners();
  }, [loadPartners, stats]);

  const pieData = Object.entries(stats?.deliveryStatusBreakdown ?? {}).map(([name, value]) => ({
    name,
    value: value as number,
  }));

  if (loading && !stats) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  if (error && !stats) {
    return (
      <PageShell>
        <ErrorState message={error} onRetry={loadInitial} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AdminPageHeader
        title="Delivery partners"
        description="Live availability, assignment load, and delivery job outcomes."
      />

      {stats ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2">
            {[
              { icon: Truck, label: 'Total partners', value: stats.totalPartners, wrap: 'bg-violet-100 text-violet-800' },
              { icon: Wifi, label: 'Active now', value: stats.activePartners, wrap: 'bg-emerald-100 text-emerald-800' },
              { icon: Loader, label: 'Busy', value: stats.busyPartners, wrap: 'bg-amber-100 text-amber-900' },
              { icon: WifiOff, label: 'Offline', value: stats.offlinePartners, wrap: 'bg-stone-200 text-stone-800' },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl',
                        c.wrap,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                      {c.label}
                    </p>
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums">{c.value}</p>
                </div>
              );
            })}
            {stats.avgDeliveryRating != null ? (
              <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Average partner rating
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-amber-900">
                  {stats.avgDeliveryRating}
                  <span className="ml-1 text-lg">★</span>
                </p>
              </div>
            ) : null}
          </div>

          <PanelCard title="Delivery job status" description="All-time mix">
            {pieData.length === 0 ? (
              <p className="py-10 text-center text-sm text-stone-500">No delivery records.</p>
            ) : (
              <div className="h-[300px] w-full min-w-0 sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="40%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                          fillOpacity={0.9}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      {...chartTooltip}
                      formatter={(v: number, name: string) => [
                        `${v.toLocaleString('en-IN')} jobs`,
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
      ) : null}

      <div className="mt-8">
        <SegmentedControl
          value={statusFilter}
          onChange={v => {
            setStatusFilter(v);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'online', label: 'Online' },
            { value: 'busy', label: 'Busy' },
            { value: 'offline', label: 'Offline' },
          ]}
        />
      </div>

      <div className="mt-6">
        <PanelCard padded={false}>
          {!partnersData?.partners?.length ? (
            <EmptyState title="No partners match this filter" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      <th className="px-4 py-3 sm:px-6">Name</th>
                      <th className="px-4 py-3 sm:px-6">Phone</th>
                      <th className="px-4 py-3 sm:px-6">Status</th>
                      <th className="px-4 py-3 sm:px-6">Current order</th>
                      <th className="px-4 py-3 sm:px-6">Deliveries</th>
                      <th className="px-4 py-3 sm:px-6">Completed</th>
                      <th className="px-4 py-3 sm:px-6">Earnings</th>
                      <th className="px-4 py-3 sm:px-6">Cash In Hand (Owed)</th>
                      <th className="px-4 py-3 sm:px-6">Rating</th>
                      <th className="px-4 py-3 sm:px-6">Verification</th>
                      <th className="px-4 py-3 sm:px-6">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {partnersData.partners.map((p: any) => (
                      <tr key={p._id} className="hover:bg-stone-50/80">
                        <td className="px-4 py-3 font-semibold text-stone-900 sm:px-6">
                          {p.name || '—'}
                        </td>
                        <td className="px-4 py-3 text-stone-600 sm:px-6">{p.phone || '—'}</td>
                        <td className="px-4 py-3 sm:px-6">
                          <StatusDot status={getPartnerStatus(p)} />
                        </td>
                        <td className="px-4 py-3 sm:px-6">
                          {p.currentOrder ? (
                            <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                              {p.currentOrder.orderNumber || p.currentOrder._id?.slice(-6)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums sm:px-6">
                          {p.deliveryStats?.totalDeliveries || 0}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-700 tabular-nums sm:px-6">
                          {p.deliveryStats?.completedDeliveries || 0}
                        </td>
                        <td className="px-4 py-3 font-bold text-stone-850 tabular-nums sm:px-6">
                          {fmt(p.deliveryStats?.totalEarnings || 0)}
                        </td>
                        <td className="px-4 py-3 font-bold text-red-700 tabular-nums sm:px-6">
                          <div className="flex items-center gap-2">
                            <span>{fmt(p.deliveryStats?.cashInHand || 0)}</span>
                            {(p.deliveryStats?.cashInHand || 0) > 0 ? (
                              <button
                                onClick={async () => {
                                  if (window.confirm(`Are you sure you want to mark ₹${Math.round(p.deliveryStats.cashInHand)} cash collected by ${p.name || 'this rider'} as settled?`)) {
                                    try {
                                      await settleDeliveryPartnerCash(p._id);
                                      loadInitial();
                                    } catch (e: any) {
                                      alert(e?.response?.data?.message || e.message || 'Failed to settle cash');
                                    }
                                  }
                                }}
                                className="rounded bg-emerald-650 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
                              >
                                Settle
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-amber-900 sm:px-6">
                          {p.deliveryStats?.avgRating
                            ? `${p.deliveryStats.avgRating} ★`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 sm:px-6">
                          <span className="mr-2 text-xs capitalize text-stone-600">
                            {(p.verificationStatus || 'unknown').replace(/_/g, ' ')}
                          </span>
                          <Link
                            to={`/dashboard/verification/delivery/${p._id}`}
                            className="text-xs font-semibold text-amber-700 hover:text-amber-900"
                          >
                            Review
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-500 sm:px-6">
                          {new Date(p.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {partnersData?.pagination && partnersData.pagination.totalPages > 1 ? (
                <PaginationBar
                  page={partnersData.pagination.page}
                  totalPages={partnersData.pagination.totalPages}
                  disabledPrev={page <= 1}
                  disabledNext={page >= partnersData.pagination.totalPages}
                  onPrev={() => setPage(p => Math.max(1, p - 1))}
                  onNext={() => setPage(p => p + 1)}
                />
              ) : null}
            </>
          )}
        </PanelCard>
      </div>
    </PageShell>
  );
}
