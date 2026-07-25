import { useState } from 'react';
import { UserCog, Bell, DollarSign, Shield, Plus, Check, AlertCircle } from 'lucide-react';
import { createPortalUser } from '../utils/createPortalUser';

const roleOptions = [
  { value: 'manager', label: 'Manager', description: 'Full access to quotes, gigs, clients, invoices, crew' },
  { value: 'crew', label: 'Crew', description: 'Can see assigned gigs, update checklists, view equipment' },
  { value: 'performer', label: 'Performer', description: 'Can see assigned gigs and event details' },
];

export default function Settings() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', phone: '', role: 'crew' });
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setResult(null);

    const res = await createPortalUser({
      action: 'createTeamMember',
      email: memberForm.email,
      name: memberForm.name,
      phone: memberForm.phone || undefined,
      role: memberForm.role as any,
    });

    setResult(res);
    setCreating(false);

    if (res.success) {
      setMemberForm({ name: '', email: '', phone: '', role: 'crew' });
      setTimeout(() => setResult(null), 5000);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        {/* Team Access */}
        <div className="card">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Shield size={18} className="text-ace-cyan" /> Team Access
          </h2>
          <p className="text-sm text-ace-muted mb-4">
            Add team members to the admin portal. They'll receive an email with login credentials and see only what their role allows.
          </p>

          {!showAddMember ? (
            <button onClick={() => setShowAddMember(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus size={16} /> Add Team Member
            </button>
          ) : (
            <form onSubmit={handleAddMember} className="space-y-4 border border-ace-border rounded-lg p-4">
              <h3 className="font-medium text-sm">New Team Member</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ace-muted block mb-1">Full Name *</label>
                  <input
                    className="input text-sm"
                    value={memberForm.name}
                    onChange={e => setMemberForm({ ...memberForm, name: e.target.value })}
                    placeholder="Their full name"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-ace-muted block mb-1">Email *</label>
                  <input
                    className="input text-sm"
                    type="email"
                    value={memberForm.email}
                    onChange={e => setMemberForm({ ...memberForm, email: e.target.value })}
                    placeholder="their@email.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ace-muted block mb-1">Phone (optional)</label>
                  <input
                    className="input text-sm"
                    type="tel"
                    value={memberForm.phone}
                    onChange={e => setMemberForm({ ...memberForm, phone: e.target.value })}
                    placeholder="+14045551234"
                  />
                </div>
                <div>
                  <label className="text-xs text-ace-muted block mb-1">Role *</label>
                  <select
                    className="input text-sm"
                    value={memberForm.role}
                    onChange={e => setMemberForm({ ...memberForm, role: e.target.value })}
                  >
                    {roleOptions.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role descriptions */}
              <div className="text-xs text-ace-muted bg-[#0e0e0e] rounded-lg p-3">
                {roleOptions.find(r => r.value === memberForm.role)?.description}
              </div>

              {/* Result message */}
              {result && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
                  result.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {result.success ? <Check size={16} /> : <AlertCircle size={16} />}
                  {result.message}
                </div>
              )}

              <div className="flex gap-3">
                <button type="submit" disabled={creating} className="btn-primary text-sm">
                  {creating ? 'Creating...' : 'Create Account & Send Invite'}
                </button>
                <button type="button" onClick={() => { setShowAddMember(false); setResult(null); }} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Account */}
        <div className="card">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <UserCog size={18} className="text-ace-cyan" /> Account
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ace-muted">Email</span>
              <span>wilson.danny@me.com</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ace-muted">Role</span>
              <span className="badge bg-green-500/20 text-green-400">Owner</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Bell size={18} className="text-ace-cyan" /> Notifications
          </h2>
          <div className="space-y-3 text-sm">
            <label className="flex items-center justify-between">
              <span>New quote SMS</span>
              <input type="checkbox" defaultChecked className="accent-ace-purple w-4 h-4" />
            </label>
            <label className="flex items-center justify-between">
              <span>New quote email</span>
              <input type="checkbox" defaultChecked className="accent-ace-purple w-4 h-4" />
            </label>
            <label className="flex items-center justify-between">
              <span>Payment received</span>
              <input type="checkbox" defaultChecked className="accent-ace-purple w-4 h-4" />
            </label>
            <label className="flex items-center justify-between">
              <span>Gig reminders (24hr before)</span>
              <input type="checkbox" defaultChecked className="accent-ace-purple w-4 h-4" />
            </label>
            <label className="flex items-center justify-between">
              <span>Customer messages</span>
              <input type="checkbox" defaultChecked className="accent-ace-purple w-4 h-4" />
            </label>
          </div>
        </div>

        {/* Payment */}
        <div className="card">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-ace-cyan" /> Payment Integration
          </h2>
          <p className="text-sm text-ace-muted mb-3">Connect Stripe to accept online payments. Payment links will be added to invoices automatically.</p>
          <button className="btn-secondary text-sm">Connect Stripe</button>
        </div>
      </div>
    </div>
  );
}
