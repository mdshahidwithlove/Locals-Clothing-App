import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  fetchStorePerformance, 
  fetchStoreSettlements, 
  createStoreSettlement, 
  updateStoreCommission 
} from '../../services/dashboardApi';
import { 
  Coins, 
  AlertTriangle,
  RefreshCw,
  Search,
  Briefcase,
  DollarSign,
  Edit2,
  Check,
  X
} from 'lucide-react';
import PageShell from '@/components/admin/PageShell';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PanelCard from '@/components/admin/PanelCard';
import LoadingState from '@/components/admin/LoadingState';
import ErrorState from '@/components/admin/ErrorState';
import EmptyState from '@/components/admin/EmptyState';
import PaginationBar from '@/components/admin/PaginationBar';
import { cn } from '@/lib/utils';

const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

export default function VendorSettlementSection() {
  const [stores, setStores] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Ledger Pagination
  const [ledgerPage, setLedgerPage] = useState(1);
  const [searchStore, setSearchStore] = useState('');

  // Inline Commission Editing State
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editRateValue, setEditRateValue] = useState<number>(5);
  const [savingRateId, setSavingRateId] = useState<string | null>(null);

  // Settlement Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<any | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementType, setSettlementType] = useState<'Payout' | 'Collection'>('Payout');
  const [paymentMethod, setPaymentMethod] = useState<'BankTransfer' | 'UPI' | 'Cash' | 'Other'>('BankTransfer');
  const [transactionRef, setTransactionRef] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [submittingSettlement, setSubmittingSettlement] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError('');
      // Fetch all stores performance stats (limit: 100 to get all registered stores)
      const storesRes = await fetchStorePerformance({ page: 1, limit: 100 });
      setStores(storesRes.stores || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load stores data');
    }
  }, []);

  const loadLedger = useCallback(async () => {
    try {
      const res = await fetchStoreSettlements({ page: ledgerPage, limit: 10 });
      setLedger(res);
    } catch (e) {
      console.error('Error loading settlements ledger:', e);
    }
  }, [ledgerPage]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadData(), loadLedger()]).finally(() => setLoading(false));
  }, [loadData, loadLedger]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const handleSaveCommissionRate = async (storeId: string) => {
    if (editRateValue < 0 || editRateValue > 100) {
      alert('Commission rate must be between 0% and 100%');
      return;
    }
    try {
      setSavingRateId(storeId);
      await updateStoreCommission(storeId, editRateValue);
      setEditingStoreId(null);
      await loadData();
    } catch (e: any) {
      alert(e?.response?.data?.message || e.message || 'Failed to update commission rate');
    } finally {
      setSavingRateId(null);
    }
  };

  const handleOpenSettlementModal = (store: any) => {
    setSelectedStore(store);
    // Autofill matching balance
    const balance = store.orderStats?.netBalance || 0;
    if (balance < 0) {
      setSettlementType('Payout'); // Platform owes Store -> We pay them (Payout)
      setSettlementAmount(Math.abs(balance).toString());
    } else if (balance > 0) {
      setSettlementType('Collection'); // Store owes Platform -> We collect (Collection)
      setSettlementAmount(balance.toString());
    } else {
      setSettlementType('Payout');
      setSettlementAmount('');
    }
    setTransactionRef('');
    setSettlementNotes('');
    setShowModal(true);
  };

  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !settlementAmount || isNaN(Number(settlementAmount)) || Number(settlementAmount) <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    try {
      setSubmittingSettlement(true);
      await createStoreSettlement(selectedStore._id, {
        amount: Number(settlementAmount),
        type: settlementType,
        paymentMethod,
        transactionReference: transactionRef || undefined,
        notes: settlementNotes || undefined
      });
      
      alert('Settlement recorded successfully!');
      setShowModal(false);
      await loadData();
      await loadLedger();
    } catch (e: any) {
      alert(e?.response?.data?.message || e.message || 'Failed to record settlement');
    } finally {
      setSubmittingSettlement(false);
    }
  };

  // Calculations
  const totalCommissionEarned = stores.reduce((sum, s) => sum + (s.orderStats?.totalPlatformFee || 0), 0);
  const platformOwesStores = stores.reduce((sum, s) => sum + (s.orderStats?.netBalance < 0 ? Math.abs(s.orderStats.netBalance) : 0), 0);
  const storesOwePlatform = stores.reduce((sum, s) => sum + (s.orderStats?.netBalance > 0 ? s.orderStats.netBalance : 0), 0);

  // Filter stores list by search query
  const filteredStores = stores.filter(s => 
    s.storeName?.toLowerCase().includes(searchStore.toLowerCase()) ||
    s.owner?.name?.toLowerCase().includes(searchStore.toLowerCase())
  );

  if (loading && stores.length === 0) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  if (error && stores.length === 0) {
    return (
      <PageShell>
        <ErrorState message={error} onRetry={() => {
          setLoading(true);
          Promise.all([loadData(), loadLedger()]).finally(() => setLoading(false));
        }} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AdminPageHeader
        title="Vendor Commissions & Settlements"
        description="Configure commission rates for each store, view payouts outstanding, and record cash collections/UPI bank settlements."
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Commissions Earned */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-800 border border-amber-200/50">
              <Coins className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Commissions Charged
            </p>
          </div>
          <p className="mt-4 text-2xl font-extrabold tabular-nums text-stone-900">
            {fmt(totalCommissionEarned)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Platform fee collected (Gross)
          </p>
        </div>

        {/* Card 2: Platform owes Store */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/20 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <DollarSign className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Platform owes Stores
            </p>
          </div>
          <p className="mt-4 text-2xl font-extrabold tabular-nums text-emerald-800">
            {fmt(platformOwesStores)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Outstanding payouts (Online orders)
          </p>
        </div>

        {/* Card 3: Stores owe Platform */}
        <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/20 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Stores owe Platform
            </p>
          </div>
          <p className="mt-4 text-2xl font-extrabold tabular-nums text-red-700">
            {fmt(storesOwePlatform)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Outstanding collections (Excess COD)
          </p>
        </div>

        {/* Card 4: Total Settlements Volume */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <Briefcase className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Active Stores
            </p>
          </div>
          <p className="mt-4 text-2xl font-extrabold tabular-nums text-stone-900">
            {stores.length}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Registered clothing partners
          </p>
        </div>
      </div>

      {/* Main Section */}
      <div className="mt-8 space-y-6">
        
        {/* Table of Stores Commissions & Balances */}
        <PanelCard
          title="Vendor Commissions & Account Balances"
          description="View sales, change commission rates, and execute settlements."
          action={
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search store name or owner..."
                value={searchStore}
                onChange={e => setSearchStore(e.target.value)}
                className="w-64 rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>
          }
        >
          {filteredStores.length === 0 ? (
            <div className="py-12">
              <EmptyState title="No stores match your query" />
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="min-w-[1000px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    <th className="px-5 py-3">Store</th>
                    <th className="px-5 py-3">Owner Details</th>
                    <th className="px-5 py-3">Commission Rate</th>
                    <th className="px-5 py-3">Gross Sales</th>
                    <th className="px-5 py-3">Platform Fees</th>
                    <th className="px-5 py-3">Net Earnings</th>
                    <th className="px-5 py-3">Current Balance</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredStores.map(s => {
                    const balance = s.orderStats?.netBalance || 0;
                    return (
                      <tr key={s._id} className="hover:bg-stone-50/50 transition-colors">
                        {/* Store name */}
                        <td className="px-5 py-4 font-semibold text-stone-950">
                          {s.storeName}
                        </td>
                        {/* Owner contact */}
                        <td className="px-5 py-4 text-stone-600">
                          <p className="font-semibold text-stone-900">{s.owner?.name || '—'}</p>
                          <p className="text-xs text-stone-500">{s.owner?.phone || s.owner?.email || ''}</p>
                        </td>
                        {/* Commission Rate Inline Editing */}
                        <td className="px-5 py-4">
                          {editingStoreId === s._id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={editRateValue}
                                onChange={e => setEditRateValue(Number(e.target.value))}
                                className="w-14 rounded border border-stone-300 px-1 py-1 text-xs font-bold text-stone-900 bg-white"
                              />
                              <span className="text-xs font-bold text-stone-700">%</span>
                              <button
                                onClick={() => handleSaveCommissionRate(s._id)}
                                disabled={savingRateId === s._id}
                                className="rounded bg-amber-600 p-1 text-white hover:bg-amber-700 disabled:bg-stone-300 transition-colors"
                              >
                                {savingRateId === s._id ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditingStoreId(null)}
                                className="rounded bg-stone-200 p-1 text-stone-700 hover:bg-stone-300 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-stone-900">{s.commissionRate ?? 5}%</span>
                              <button
                                onClick={() => {
                                  setEditRateValue(s.commissionRate ?? 5);
                                  setEditingStoreId(s._id);
                                }}
                                className="text-stone-400 hover:text-amber-800 transition-colors"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        {/* Gross Sales */}
                        <td className="px-5 py-4 font-semibold tabular-nums text-stone-805">
                          {fmt(s.orderStats?.totalRevenue || 0)}
                        </td>
                        {/* Platform Fees */}
                        <td className="px-5 py-4 font-bold tabular-nums text-red-700">
                          {fmt(s.orderStats?.totalPlatformFee || 0)}
                        </td>
                        {/* Net Earnings */}
                        <td className="px-5 py-4 font-bold tabular-nums text-emerald-800">
                          {fmt(s.orderStats?.storeNetEarnings || 0)}
                        </td>
                        {/* Current Balance */}
                        <td className="px-5 py-4">
                          {balance > 0 ? (
                            <span className="rounded-md bg-red-100 px-2.5 py-1 text-red-800 text-xs font-bold ring-1 ring-inset ring-red-200/50">
                              Owes: {fmt(balance)}
                            </span>
                          ) : balance < 0 ? (
                            <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-emerald-850 text-xs font-bold ring-1 ring-inset ring-emerald-250/40">
                              We owe: {fmt(Math.abs(balance))}
                            </span>
                          ) : (
                            <span className="text-stone-400 text-xs font-bold">Settled</span>
                          )}
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenSettlementModal(s)}
                              className="inline-flex items-center gap-1 rounded-lg bg-stone-900 hover:bg-stone-850 active:bg-black text-white px-3 py-1.5 text-xs font-bold transition-all shadow-sm"
                            >
                              Settle
                            </button>
                            <Link
                              to={`/dashboard/stores/${s._id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PanelCard>

        {/* Payout Settlements Ledger History */}
        <PanelCard
          title="Settlement History Log"
          description="Ledger of all payout transfers and cash collections."
          padded={false}
        >
          {!ledger?.settlements?.length ? (
            <div className="py-12">
              <EmptyState title="No settlement history found" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Store Name</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Method</th>
                      <th className="px-5 py-3">Reference ID</th>
                      <th className="px-5 py-3">Settled By (Admin)</th>
                      <th className="px-5 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {ledger.settlements.map((tx: any) => (
                      <tr key={tx._id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="whitespace-nowrap px-5 py-4 text-xs text-stone-500">
                          {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-5 py-4 font-semibold text-stone-900">
                          {tx.store?.storeName || '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                              tx.type === 'Payout'
                                ? 'bg-emerald-100 text-emerald-800 ring-emerald-250/30'
                                : 'bg-amber-100 text-amber-900 ring-amber-250/30',
                            )}
                          >
                            {tx.type === 'Payout' ? 'Platform Paid Store' : 'Collected from Store'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-bold tabular-nums text-stone-950">
                          {fmt(tx.amount)}
                        </td>
                        <td className="px-5 py-4 text-stone-600 text-xs">
                          {tx.paymentMethod}
                        </td>
                        <td className="px-5 py-4 text-stone-500 font-mono text-xs">
                          {tx.transactionReference || '—'}
                        </td>
                        <td className="px-5 py-4 text-stone-600 text-xs">
                          {tx.settledBy?.name || tx.settledBy?.username || 'Admin'}
                        </td>
                        <td className="px-5 py-4 text-xs text-stone-500 italic max-w-xs truncate">
                          {tx.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                page={ledger.pagination.page}
                totalPages={ledger.pagination.totalPages}
                disabledPrev={ledgerPage <= 1}
                disabledNext={ledgerPage >= ledger.pagination.totalPages}
                onPrev={() => setLedgerPage(p => Math.max(1, p - 1))}
                onNext={() => setLedgerPage(p => p + 1)}
              />
            </>
          )}
        </PanelCard>

      </div>

      {/* Record Settlement Modal Dialog */}
      {showModal && selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-955">Record Settlement Transaction</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSettlement} className="mt-4 space-y-4">
              {/* Store Name */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Store</label>
                <p className="mt-1 text-sm font-semibold text-stone-905 bg-stone-50 p-2 rounded-lg">{selectedStore.storeName}</p>
              </div>

              {/* Settlement Type */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setSettlementType('Payout')}
                    className={cn(
                      "py-2 px-3 text-xs font-bold rounded-lg border transition-all text-center",
                      settlementType === 'Payout'
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-650/10"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                    )}
                  >
                    Platform Pays Store (Payout)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementType('Collection')}
                    className={cn(
                      "py-2 px-3 text-xs font-bold rounded-lg border transition-all text-center",
                      settlementType === 'Collection'
                        ? "bg-amber-600 border-amber-600 text-white shadow-sm shadow-amber-650/10"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                    )}
                  >
                    Store Pays Platform (Collection)
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="Enter amount"
                  value={settlementAmount}
                  onChange={e => setSettlementAmount(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-500 bg-white font-semibold text-stone-900"
                />
              </div>

              {/* Method */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-500 bg-white font-semibold text-stone-900"
                >
                  <option value="BankTransfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Reference ID */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Transaction Ref ID (UTR/UPI txn)</label>
                <input
                  type="text"
                  placeholder="Optional reference ID"
                  value={transactionRef}
                  onChange={e => setTransactionRef(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-500 bg-white text-stone-900"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Internal Notes</label>
                <textarea
                  placeholder="Record any details about this settlement"
                  value={settlementNotes}
                  onChange={e => setSettlementNotes(e.target.value)}
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-500 bg-white text-stone-900"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg bg-stone-100 hover:bg-stone-200 px-4 py-2 text-xs font-bold text-stone-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSettlement}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white px-4 py-2 text-xs font-bold transition-all shadow-sm shadow-emerald-600/10 flex items-center gap-1.5"
                >
                  {submittingSettlement ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Record Settlement'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
