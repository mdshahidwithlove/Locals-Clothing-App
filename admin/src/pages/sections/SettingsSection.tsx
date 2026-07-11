import { useEffect, useState } from 'react';
import { fetchSettings, updateSettings } from '../../services/dashboardApi';
import PageShell from '@/components/admin/PageShell';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PanelCard from '@/components/admin/PanelCard';
import LoadingState from '@/components/admin/LoadingState';
import { Save, ShieldCheck, AlertCircle } from 'lucide-react';

interface SettingItem {
  _id: string;
  key: string;
  value: string;
  description: string;
  isEncrypted: boolean;
}

export default function SettingsSection() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    setError('');
    fetchSettings()
      .then((res) => {
        if (res.success && res.settings) {
          setSettings(res.settings);
          const initialValues: Record<string, string> = {};
          res.settings.forEach((s: SettingItem) => {
            initialValues[s.key] = s.value;
          });
          setFormValues(initialValues);
        } else {
          setError('Failed to fetch settings from server');
        }
      })
      .catch((e) => setError(e?.response?.data?.message || e.message || 'Failed to load settings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');

    const payload = Object.keys(formValues).map((key) => ({
      key,
      value: formValues[key]!,
    }));

    try {
      const res = await updateSettings(payload);
      if (res.success) {
        setSuccessMsg(res.message || 'Settings updated successfully!');
        // Reload settings to refresh masked representations
        load();
      } else {
        setError(res.message || 'Failed to save settings');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'An error occurred while saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading && settings.length === 0) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  // Group settings for nice section cards
  const getGroup = (groupType: 'razorpay' | 'maps' | 'sms' | 'storage' | 'platform') => {
    return settings.filter((s) => {
      const key = s.key.toLowerCase();
      if (groupType === 'razorpay') return key.includes('razorpay');
      if (groupType === 'maps') return key.includes('maps') || key.includes('google');
      if (groupType === 'sms') return key.includes('factor') || key.includes('sms');
      if (groupType === 'storage') return key.startsWith('r2_') || key.includes('bucket') || key.includes('s3') || key.includes('supabase');
      if (groupType === 'platform') return key.includes('platform');
      return false;
    });
  };

  const razorpayGroup = getGroup('razorpay');
  const mapsGroup = getGroup('maps');
  const smsGroup = getGroup('sms');
  const storageGroup = getGroup('storage');
  const platformGroup = getGroup('platform');

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <AdminPageHeader
          title="System Settings"
          description="Manage credentials, API keys, and third-party integrations dynamically."
        />

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="font-medium">{successMsg}</p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Razorpay Section */}
          {razorpayGroup.length > 0 && (
            <PanelCard
              title="Razorpay Payment Settings"
              description="Configure public and secret keys to accept payments inside the application."
            >
              <div className="mt-4 space-y-4">
                {razorpayGroup.map((s) => (
                  <div key={s.key} className="grid gap-2">
                    <label htmlFor={s.key} className="text-sm font-semibold text-stone-700">
                      {s.description || s.key}
                      <span className="ml-2 text-xs text-stone-400">({s.key})</span>
                    </label>
                    <input
                      id={s.key}
                      type={s.isEncrypted ? 'text' : 'text'}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm outline-none ring-offset-2 transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/40"
                      placeholder={s.isEncrypted ? 'Leave blank or enter new value' : 'Enter value'}
                      value={formValues[s.key] === '******' ? '' : formValues[s.key]}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                    />
                    {s.isEncrypted && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Encrypted Key: Current value is masked. Entering a new value will replace it.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

          {/* Google Maps Section */}
          {mapsGroup.length > 0 && (
            <PanelCard
              title="Google Maps Integrations"
              description="Geocoding address translations and delivery route computations."
            >
              <div className="mt-4 space-y-4">
                {mapsGroup.map((s) => (
                  <div key={s.key} className="grid gap-2">
                    <label htmlFor={s.key} className="text-sm font-semibold text-stone-700">
                      {s.description || s.key}
                      <span className="ml-2 text-xs text-stone-400">({s.key})</span>
                    </label>
                    <input
                      id={s.key}
                      type="text"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm outline-none ring-offset-2 transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/40"
                      value={formValues[s.key] === '******' ? '' : formValues[s.key]}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                    />
                    {s.isEncrypted && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Encrypted Key: Current value is masked. Entering a new value will replace it.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

          {/* SMS Config Section */}
          {smsGroup.length > 0 && (
            <PanelCard
              title="SMS OTP Gateway Config"
              description="2Factor.in gateway keys to authenticate users via dynamic mobile OTP verification."
            >
              <div className="mt-4 space-y-4">
                {smsGroup.map((s) => (
                  <div key={s.key} className="grid gap-2">
                    <label htmlFor={s.key} className="text-sm font-semibold text-stone-700">
                      {s.description || s.key}
                      <span className="ml-2 text-xs text-stone-400">({s.key})</span>
                    </label>
                    <input
                      id={s.key}
                      type="text"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm outline-none ring-offset-2 transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/40"
                      value={formValues[s.key] === '******' ? '' : formValues[s.key]}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                    />
                    {s.isEncrypted && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Encrypted Key: Current value is masked. Entering a new value will replace it.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

          {/* Supabase Storage Section */}
          {storageGroup.length > 0 && (
            <PanelCard
              title="Storage Bucket Settings (Supabase)"
              description="Save verified merchant documents and user profiles securely in your Supabase Storage bucket."
            >
              <div className="mt-4 space-y-4">
                {storageGroup.map((s) => (
                  <div key={s.key} className="grid gap-2">
                    <label htmlFor={s.key} className="text-sm font-semibold text-stone-700">
                      {s.description || s.key}
                      <span className="ml-2 text-xs text-stone-400">({s.key})</span>
                    </label>
                    <input
                      id={s.key}
                      type="text"
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm outline-none ring-offset-2 transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/40"
                      value={formValues[s.key] === '******' ? '' : formValues[s.key]}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                    />
                    {s.isEncrypted && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Encrypted Key: Current value is masked. Entering a new value will replace it.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

          {/* Platform Fee Settings */}
          {platformGroup.length > 0 && (
            <PanelCard
              title="Platform Fee Settings"
              description="Configure the platform fee type (flat rate or percentage) and its value."
            >
              <div className="mt-4 space-y-4">
                {platformGroup.map((s) => (
                  <div key={s.key} className="grid gap-2">
                    <label htmlFor={s.key} className="text-sm font-semibold text-stone-700">
                      {s.description || s.key}
                      <span className="ml-2 text-xs text-stone-400">({s.key})</span>
                    </label>
                    {s.key === "PLATFORM_FEE_TYPE" ? (
                      <select
                        id={s.key}
                        className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm outline-none ring-offset-2 transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/40"
                        value={formValues[s.key] || "flat"}
                        onChange={(e) => handleChange(s.key, e.target.value)}
                      >
                        <option value="flat">Flat Fee (INR)</option>
                        <option value="percentage">Percentage Fee (%)</option>
                      </select>
                    ) : (
                      <input
                        id={s.key}
                        type="text"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm outline-none ring-offset-2 transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/40"
                        value={formValues[s.key] || ""}
                        onChange={(e) => handleChange(s.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

          {/* Submit Actions */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-stone-900 shadow-md transition-all hover:bg-amber-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving changes...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
