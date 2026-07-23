import { useEffect, useState, useCallback } from 'react';
import { 
  CheckCircle2, 
  Search,
  Check,
  X
} from 'lucide-react';
import { 
  fetchAdminWithdrawals, 
  processAdminWithdrawal 
} from '../../services/dashboardApi';
import PageShell from '@/components/admin/PageShell';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PanelCard from '@/components/admin/PanelCard';
import LoadingState from '@/components/admin/LoadingState';
import ErrorState from '@/components/admin/ErrorState';
import EmptyState from '@/components/admin/EmptyState';
import SegmentedControl from '@/components/admin/SegmentedControl';
import { cn } from '@/lib/utils';

const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

export default function WithdrawalsSection() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('Pending'); // Pending, Approved, Rejected, all
  const [roleFilter, setRoleFilter] = useState('all'); // all, Delivery (Rider), Merchant (Vendor)
  const [periodFilter, setPeriodFilter] = useState('all'); // all, today, weekly, monthly
  const [searchUser, setSearchUser] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const data = await fetchAdminWithdrawals();
      setRequests(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load withdrawals data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (id: string, status: 'Approved' | 'Rejected') => {
    const actionName = status === 'Approved' ? 'approve' : 'reject';
    const notes = window.prompt(`Enter optional transaction reference or reason to ${actionName} this request:`);
    if (notes === null) return; // User cancelled prompt

    try {
      setProcessingId(id);
      await processAdminWithdrawal(id, { status, statusNotes: notes });
      alert(`Withdrawal request ${actionName}d successfully!`);
      await loadData();
    } catch (e: any) {
      alert(e?.response?.data?.message || e.message || `Failed to ${actionName} withdrawal`);
    } finally {
      setProcessingId(null);
    }
  };

  // Helper date function for period filtering
  const isWithinPeriod = (dateStr: string, period: string) => {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();

    if (period === 'today') {
      return date.toDateString() === now.toDateString();
    }

    if (period === 'weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return date >= startOfWeek;
    }

    if (period === 'monthly') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }

    return true;
  };

  // Calculations for summary stats
  const riderPending = requests.filter(r => r.status === 'Pending' && r.user?.role === 'Delivery');
  const vendorPending = requests.filter(r => r.status === 'Pending' && r.user?.role === 'Merchant');
  const approvedRequests = requests.filter(r => r.status === 'Approved');

  const riderPendingAmt = riderPending.reduce((sum, r) => sum + (r.amount || 0), 0);
  const vendorPendingAmt = vendorPending.reduce((sum, r) => sum + (r.amount || 0), 0);
  const approvedAmt = approvedRequests.reduce((sum, r) => sum + (r.amount || 0), 0);

  // Apply filters
  const filteredRequests = requests.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesRole = roleFilter === 'all' || r.user?.role === roleFilter;
    const matchesPeriod = isWithinPeriod(r.createdAt, periodFilter);
    const matchesSearch = 
      !searchUser || 
      r.user?.name?.toLowerCase().includes(searchUser.toLowerCase()) || 
      r.user?.phone?.includes(searchUser) ||
      r.user?.email?.toLowerCase().includes(searchUser.toLowerCase());
    return matchesStatus && matchesRole && matchesPeriod && matchesSearch;
  });

  if (loading && requests.length === 0) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  if (error && requests.length === 0) {
    return (
      <PageShell>
        <ErrorState message={error} onRetry={loadData} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AdminPageHeader
        title="Withdrawal & Payout Requests"
        description="Verify and approve payout requests submitted by vendors (sellers) and riders (delivery partners)."
      />

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Card 1: Rider Pending */}
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/40 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 font-bold text-lg">
              🏍️
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Rider Pending Payouts
              </p>
              <p className="text-2xl font-extrabold tabular-nums text-sky-800">
                {fmt(riderPendingAmt)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-stone-500 font-medium">
            {riderPending.length} delivery partner request(s) pending
          </p>
        </div>

        {/* Card 2: Vendor Pending */}
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/40 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-bold text-lg">
              🏪
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Vendor Pending Payouts
              </p>
              <p className="text-2xl font-extrabold tabular-nums text-amber-800">
                {fmt(vendorPendingAmt)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-stone-500 font-medium">
            {vendorPending.length} store merchant request(s) pending
          </p>
        </div>

        {/* Card 3: Settled Total */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Total Approved & Settled
              </p>
              <p className="text-2xl font-extrabold tabular-nums text-emerald-800">
                {fmt(approvedAmt)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-stone-500 font-medium">
            {approvedRequests.length} payout(s) processed
          </p>
        </div>
      </div>

      <PanelCard 
        title="Payout Requests Ledger" 
        description="Filter requests by User Role (Rider/Vendor), Time Period (Today/Weekly/Monthly), and Status."
        action={
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search user..."
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                className="w-40 rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center rounded-lg border border-stone-200 bg-stone-100 p-0.5">
              {[
                { value: 'all', label: 'All Users' },
                { value: 'Delivery', label: '🏍️ Rider' },
                { value: 'Merchant', label: '🏪 Vendor' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRoleFilter(opt.value)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
                    roleFilter === opt.value
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Period Filter Tabs */}
            <div className="flex items-center rounded-lg border border-stone-200 bg-stone-100 p-0.5">
              {[
                { value: 'all', label: 'All Time' },
                { value: 'today', label: '📅 Today' },
                { value: 'weekly', label: '🗓️ This Week' },
                { value: 'monthly', label: '📆 This Month' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPeriodFilter(opt.value)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
                    periodFilter === opt.value
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <SegmentedControl
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'Pending', label: 'Pending' },
                { value: 'Approved', label: 'Approved' },
                { value: 'Rejected', label: 'Rejected' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
        }
      >
        {filteredRequests.length === 0 ? (
          <div className="py-12">
            <EmptyState title="No withdrawal requests found matching selected filters" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="px-4 py-3">User & Role</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment Details</th>
                  <th className="px-4 py-3">Requested On</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRequests.map((r: any) => {
                  const isRider = r.user?.role === 'Delivery';
                  const isVendor = r.user?.role === 'Merchant';
                  return (
                    <tr key={r._id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{isRider ? '🏍️' : isVendor ? '🏪' : '👤'}</span>
                          <div>
                            <p className="font-semibold text-stone-900">{r.user?.name || 'User'}</p>
                            <span className={cn(
                              'inline-block px-1.5 py-0.2 text-[10px] font-bold rounded uppercase',
                              isRider ? 'bg-sky-100 text-sky-800' : isVendor ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-700'
                            )}>
                              {isRider ? 'Rider (Delivery)' : isVendor ? 'Vendor (Merchant)' : r.user?.role || 'User'}
                            </span>
                            <p className="text-xs text-stone-500">{r.user?.phone || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-stone-900">
                        {fmt(r.amount)}
                      </td>
                      <td className="px-4 py-3 text-stone-600 max-w-[280px]">
                        {r.paymentDetails?.method === 'UPI' ? (
                          <div className="text-xs">
                            <span className="font-semibold text-stone-700">UPI: </span>
                            <span className="bg-stone-100 px-1.5 py-0.5 rounded font-mono select-all">{r.paymentDetails.upiId}</span>
                          </div>
                        ) : (
                          <div className="text-xs space-y-0.5">
                            <p><span className="font-semibold text-stone-700">Bank: </span>{r.paymentDetails?.bankName}</p>
                            <p><span className="font-semibold text-stone-700">A/c Name: </span>{r.paymentDetails?.accountHolderName}</p>
                            <p><span className="font-semibold text-stone-700">A/c No: </span><span className="bg-stone-100 px-1 py-0.5 rounded font-mono select-all">{r.paymentDetails?.accountNumber}</span></p>
                            <p><span className="font-semibold text-stone-700">IFSC: </span><span className="bg-stone-100 px-1 py-0.5 rounded font-mono select-all">{r.paymentDetails?.ifscCode}</span></p>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-500">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                            r.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/50'
                              : r.status === 'Rejected'
                              ? 'bg-red-100 text-red-800 ring-red-200/40'
                              : 'bg-amber-100 text-amber-800 ring-amber-200/50',
                          )}
                        >
                          {r.status}
                        </span>
                        {r.statusNotes && (
                          <p className="text-[10px] text-stone-400 mt-1 max-w-[150px] truncate" title={r.statusNotes}>
                            Note: {r.statusNotes}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {r.status === 'Pending' ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleAction(r._id, 'Approved')}
                              disabled={processingId === r._id}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white p-1.5 text-xs font-bold transition-all shadow-sm"
                              title="Approve & Settlement Record"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleAction(r._id, 'Rejected')}
                              disabled={processingId === r._id}
                              className="rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white p-1.5 text-xs font-bold transition-all shadow-sm"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-xs italic">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>
    </PageShell>
  );
}
