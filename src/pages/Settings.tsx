import { UserCog, Bell, DollarSign, Shield } from 'lucide-react';

export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6 max-w-2xl">
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
              <span className="badge badge-accepted">Owner</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Bell size={18} className="text-ace-cyan" /> Notifications
          </h2>
          <div className="space-y-3 text-sm">
            <label className="flex items-center justify-between">
              <span>New quote email</span>
              <input type="checkbox" defaultChecked className="accent-ace-purple w-4 h-4" />
            </label>
            <label className="flex items-center justify-between">
              <span>New quote SMS</span>
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
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-ace-cyan" /> Payment
          </h2>
          <p className="text-sm text-ace-muted mb-3">Connect Stripe to accept online payments and generate payment links for invoices.</p>
          <button className="btn-secondary text-sm">Connect Stripe</button>
        </div>

        <div className="card">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Shield size={18} className="text-ace-cyan" /> Team Access
          </h2>
          <p className="text-sm text-ace-muted mb-3">Manage who can access the admin portal and what they can see.</p>
          <button className="btn-secondary text-sm">Manage Team</button>
        </div>
      </div>
    </div>
  );
}
