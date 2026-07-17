import { useEffect, useState, useCallback } from 'react';
import { 
  Coins, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Search
} from 'lucide-react';
import { 
  fetchDeliveryPartners, 
  fetchTransactions, 
  settleDeliveryPartnerCash,
  fetchFinanceSummary
} from '../../services/dashboardApi';
import PageShell from '@/components/admin/PageShell';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PanelCard from '@/components/admin/PanelCard';
import LoadingState from '@/components/admin/LoadingState';
import ErrorState from '@/components/admin/ErrorState';
import EmptyState from '@/components/admin/EmptyState';
import SegmentedControl from '@/components/admin/SegmentedControl';
import PaginationBar from '@/components/admin/PaginationBar';
import DateRangeFilterBar from '@/components/admin/DateRangeFilterBar';
import { dateRangePresetDays } from '@/lib/admin-date';
import { cn } from '@/lib/utils';

const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

export default function CodSection() {
  const [partners, setPartners] = useState<any[]>([]);
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [txns, setTxns] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settlingId, setSettlingId] = useState<string | null>(null);

  // Pagination & Filters for Transactions
  const [txPage, setTxPage] = useState(1);
  const [txFilter, setTxFilter] = useState('all'); // all, pending, completed (settled)
  const [searchRider, setSearchRider] = useState('');

  // Date range filters
  const [dateDraftFrom, setDateDraftFrom] = useState('');
  const [dateDraftTo, setDateDraftTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');
      // Fetch all riders (with large limit to calculate total outstanding cash)
      const partnersRes = await fetchDeliveryPartners({ page: 1, limit: 100 });
      setPartners(partnersRes.partners || []);
      
      const finSummary = await fetchFinanceSummary();
      setFinanceSummary(finSummary);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load COD data');
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      // Map frontend tab status to Mongoose paymentStatus or codSubmittedToStore logic
      // backend api uses: status = 'all' | 'Completed' | 'Pending' | 'Failed' | 'Refunded'
      // To see only COD, we force method='COD'
      const statusParam = txFilter === 'all' ? undefined : txFilter;
      const res = await fetchTransactions({
        page: txPage,
        limit: 15,
        method: 'COD',
        status: statusParam,
        dateFrom: appliedDateFrom || undefined,
        dateTo: appliedDateTo || undefined,
      });
      setTxns(res);
    } catch (e) {
      console.error('Error loading COD transactions:', e);
    }
  }, [txPage, txFilter, appliedDateFrom, appliedDateTo]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleSettle = async (partnerId: string, partnerName: string, amount: number) => {
    if (window.confirm(`Are you sure you want to mark ₹${Math.round(amount)} COD cash collected by ${partnerName} as settled?`)) {
      try {
        setSettlingId(partnerId);
        await settleDeliveryPartnerCash(partnerId);
        alert(`Successfully settled ₹${Math.round(amount)} for ${partnerName}`);
        await loadData();
        await loadTransactions();
      } catch (e: any) {
        alert(e?.response?.data?.message || e.message || 'Failed to settle cash');
      } finally {
        setSettlingId(null);
      }
    }
  };

  if (loading && partners.length === 0) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  if (error && partners.length === 0) {
    return (
      <PageShell>
        <ErrorState message={error} onRetry={() => {
          setLoading(true);
          loadData().finally(() => setLoading(false));
        }} />
      </PageShell>
    );
  }

  // Calculations
  const ridersWithCash = partners.filter(p => (p.deliveryStats?.cashInHand || 0) > 0);
  const totalOutstandingCash = partners.reduce((sum, p) => sum + (p.deliveryStats?.cashInHand || 0), 0);
  
  // Total COD volume from Finance Summary (all completed COD transactions)
  const codBreakdown = financeSummary?.paymentMethodBreakdown?.COD || { count: 0, total: 0 };
  const totalCodVolume = codBreakdown.total || 0;
  const totalCodCount = codBreakdown.count || 0;
  const totalSettledCash = Math.max(0, totalCodVolume - totalOutstandingCash);

  // Filter riders list by search query
  const filteredRidersWithCash = ridersWithCash.filter(p => 
    p.name?.toLowerCase().includes(searchRider.toLowerCase()) || 
    p.phone?.includes(searchRider)
  );

  return (
    <PageShell>
      <AdminPageHeader
        title="Cash on Delivery (COD) Management"
        description="Track rider cash-in-hand balances, verify store hand-overs, and settle outstanding COD accounts."
      />

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Outstanding Rider Cash */}
        <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/50 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Owed Rider Cash-in-Hand
            </p>
          </div>
          <p className="mt-4 text-3xl font-extrabold tabular-nums text-red-700">
            {fmt(totalOutstandingCash)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Held by {ridersWithCash.length} active delivery partner(s)
          </p>
        </div>

        {/* Card 2: Settled/Submitted COD */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/30 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Settled COD Cash
            </p>
          </div>
          <p className="mt-4 text-3xl font-extrabold tabular-nums text-emerald-800">
            {fmt(totalSettledCash)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Successfully submitted to stores / settled by admin
          </p>
        </div>

        {/* Card 3: Total COD Transactions */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <Coins className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total COD Transactions
            </p>
          </div>
          <p className="mt-4 text-3xl font-extrabold tabular-nums text-stone-900">
            {totalCodCount}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Aggregate COD order count (Volume: {fmt(totalCodVolume)})
          </p>
        </div>
      </div>

      {/* Main Section */}
      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        
        {/* Left Side: Rider Cash Owed List */}
        <div className="lg:col-span-2">
          <PanelCard 
            title="Rider Balances" 
            description="Delivery partners holding unsubmitted COD cash."
            action={
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search rider..."
                  value={searchRider}
                  onChange={e => setSearchRider(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>
            }
          >
            {filteredRidersWithCash.length === 0 ? (
              <div className="py-8">
                <EmptyState title={searchRider ? "No matching riders holding cash" : "All riders are fully settled"} />
              </div>
            ) : (
              <div className="divide-y divide-stone-100 max-h-[480px] overflow-y-auto pr-1">
                {filteredRidersWithCash.map((p) => (
                  <div key={p._id} className="flex items-center justify-between py-3 hover:bg-stone-50/50 rounded-lg px-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-955">{p.name || 'Rider'}</p>
                      <p className="text-xs text-stone-500">{p.phone || 'No phone'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-red-650 tabular-nums">
                        {fmt(p.deliveryStats?.cashInHand || 0)}
                      </span>
                      <button
                        onClick={() => handleSettle(p._id, p.name || 'Rider', p.deliveryStats.cashInHand)}
                        disabled={settlingId === p._id}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-stone-300 text-white px-3 py-1.5 text-xs font-bold transition-all shadow-sm shadow-emerald-600/10"
                      >
                        {settlingId === p._id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          'Settle'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>
        </div>

        {/* Right Side: COD Ledger */}
        <div className="lg:col-span-3">
          <div className="space-y-4">
            <DateRangeFilterBar
              dateFrom={dateDraftFrom}
              dateTo={dateDraftTo}
              onDateFromChange={setDateDraftFrom}
              onDateToChange={setDateDraftTo}
              onApply={() => {
                setAppliedDateFrom(dateDraftFrom);
                setAppliedDateTo(dateDraftTo);
                setTxPage(1);
              }}
              onClear={() => {
                setDateDraftFrom('');
                setDateDraftTo('');
                setAppliedDateFrom('');
                setAppliedDateTo('');
                setTxPage(1);
              }}
              onPresetDays={days => {
                const { from, to } = dateRangePresetDays(days);
                setDateDraftFrom(from);
                setDateDraftTo(to);
                setAppliedDateFrom(from);
                setAppliedDateTo(to);
                setTxPage(1);
              }}
            />

            <PanelCard
              title="COD Ledger & Submission History"
              description="Newest transactions first — filter by collection status."
              padded={false}
              action={
                <SegmentedControl
                  value={txFilter}
                  onChange={v => {
                    setTxFilter(v);
                    setTxPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'All COD' },
                    { value: 'Completed', label: 'Completed' },
                    { value: 'Pending', label: 'Pending' },
                  ]}
                />
              }
            >
              {!txns?.transactions?.length ? (
                <div className="py-12">
                  <EmptyState title="No COD payments match this filter" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-[650px] w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                          <th className="px-4 py-3 sm:px-6">Order</th>
                          <th className="px-4 py-3 sm:px-6">Rider (Collected By)</th>
                          <th className="px-4 py-3 sm:px-6">Store</th>
                          <th className="px-4 py-3 sm:px-6">Amount</th>
                          <th className="px-4 py-3 sm:px-6">Submission Status</th>
                          <th className="px-4 py-3 sm:px-6">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {txns.transactions.map((t: any) => {
                          return (
                            <tr key={t._id} className="hover:bg-stone-50/80 transition-colors">
                              <td className="whitespace-nowrap px-4 py-3 font-semibold text-stone-900 sm:px-6">
                                {t.order?.orderNumber || t.order?._id?.slice(-6) || '—'}
                              </td>
                              <td className="px-4 py-3 sm:px-6">
                                {t.codCollectedBy ? (
                                  <div>
                                    <p className="font-semibold text-stone-900">{t.codCollectedBy.name || 'Rider'}</p>
                                    <p className="text-[10px] text-stone-500">{t.codCollectedBy.phone || ''}</p>
                                  </div>
                                ) : (
                                  <span className="text-stone-400 italic">Not collected</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-stone-600 sm:px-6">
                                {t.store?.storeName || '—'}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-stone-900 sm:px-6">
                                {fmt(t.amount)}
                              </td>
                              <td className="px-4 py-3 sm:px-6">
                                <span
                                  className={cn(
                                    'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                                    t.codSubmittedToStore
                                      ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/50'
                                      : 'bg-red-100 text-red-800 ring-red-200/40',
                                  )}
                                >
                                  {t.codSubmittedToStore ? 'Submitted / Settled' : 'Pending Rider Submission'}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-500 sm:px-6">
                                {new Date(t.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <PaginationBar
                    page={txns.pagination.page}
                    totalPages={txns.pagination.totalPages}
                    disabledPrev={txPage <= 1}
                    disabledNext={txPage >= txns.pagination.totalPages}
                    onPrev={() => setTxPage(p => Math.max(1, p - 1))}
                    onNext={() => setTxPage(p => p + 1)}
                  />
                </>
              )}
            </PanelCard>
          </div>
        </div>

      </div>
    </PageShell>
  );
}
