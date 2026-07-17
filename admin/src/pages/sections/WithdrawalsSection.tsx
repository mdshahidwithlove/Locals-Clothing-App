import { useEffect, useState, useCallback } from 'react';
import { 
  Coins, 
  CheckCircle2, 
  AlertTriangle,
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

  // Calculations for summary stats
  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const pendingAmount = requests.filter(r => r.status === 'Pending').reduce((sum, r) => sum + r.amount, 0);
  const approvedCount = requests.filter(r => r.status === 'Approved').length;
  const approvedAmount = requests.filter(r => r.status === 'Approved').reduce((sum, r) => sum + r.amount, 0);

  // Apply filters
  const filteredRequests = requests.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = 
      !searchUser || 
      r.user?.name?.toLowerCase().includes(searchUser.toLowerCase()) || 
      r.user?.phone?.includes(searchUser) ||
      r.user?.email?.toLowerCase().includes(searchUser.toLowerCase());
    return matchesStatus && matchesSearch;
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
        description="Verify and approve withdrawal requests submitted by merchants (sellers) and delivery partners (riders)."
      />

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Card 1: Pending Requests */}
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/30 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Pending Withdrawals
            </p>
          </div>
          <p className="mt-4 text-3xl font-extrabold tabular-nums text-amber-700">
            {fmt(pendingAmount)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {pendingCount} request(s) awaiting approval
          </p>
        </div>

        {/* Card 2: Settled/Approved Requests */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/30 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Approved / Settled
            </p>
          </div>
          <p className="mt-4 text-3xl font-extrabold tabular-nums text-emerald-800">
            {fmt(approvedAmount)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {approvedCount} request(s) processed
          </p>
        </div>

        {/* Card 3: Total Requests Count */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <Coins className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Request Count
            </p>
          </div>
          <p className="mt-4 text-3xl font-extrabold tabular-nums text-stone-900">
            {requests.length}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Cumulative withdrawal history
          </p>
        </div>
      </div>

      <PanelCard 
        title="Payout Requests Ledger" 
        description="Verify user bank accounts and UPI IDs before sending money and clicking Approve."
        action={
          <div className="flex gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search user..."
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                className="w-48 rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>
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
            <EmptyState title="No withdrawal requests found matching filters" />
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
                  return (
                    <tr key={r._id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-stone-900">{r.user?.name || 'User'}</p>
                          <p className="text-xs text-stone-500 capitalize">{r.user?.role || ''} • {r.user?.phone || ''}</p>
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
                              className="rounded-lg bg-red-650 hover:bg-red-750 active:bg-red-800 text-white p-1.5 text-xs font-bold transition-all shadow-sm"
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
