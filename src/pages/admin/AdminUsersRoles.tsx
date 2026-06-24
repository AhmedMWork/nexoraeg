import { ShieldCheck, Users, LockKeyhole, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AdminHero, AdminMetricCard, AdminPageShell, AdminPanel, AdminStatusPill } from '@/components/admin/AdminCommandCenter';

const roles = [
  { name: 'Owner', scope: 'Full commerce OS access', permissions: ['Manage users', 'Edit settings', 'Export reports', 'Confirm payments', 'Edit orders', 'Manage products'] },
  { name: 'Manager', scope: 'Daily operations and catalog', permissions: ['Edit orders', 'Create shipments', 'Manage products', 'Manage reviews', 'View reports'] },
  { name: 'Orders Manager', scope: 'Customer orders and fulfillment', permissions: ['Edit orders', 'Mark paid', 'Create shipments', 'Add follow-ups', 'Print invoices'] },
  { name: 'Inventory Manager', scope: 'Catalog and stock control', permissions: ['Edit products', 'Adjust stock', 'Manage variants', 'View orders'] },
  { name: 'Marketing Manager', scope: 'Growth and storefront content', permissions: ['Manage campaigns', 'Manage coupons', 'Edit storefront', 'View analytics'] },
  { name: 'Viewer', scope: 'Read-only store visibility', permissions: ['View dashboard', 'View reports', 'View orders', 'View products'] },
];

export default function AdminUsersRoles() {
  return (
    <AdminPageShell>
      <AdminHero
        eyebrow="Access Control"
        title="Users & Roles"
        description="Role planning for NEXORA HQ. Existing admin access remains untouched; this page documents every permission group and prepares the project for multi-user access without removing current owner capabilities."
        actions={<button className="nexora-button-primary"><ShieldCheck className="h-4 w-4" /> Keep owner access active</button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Role presets" value={roles.length} helper="Structured access groups ready for rollout." icon={<Users className="h-4 w-4" />} tone="accent" />
        <AdminMetricCard label="Current owner permissions" value="Full" helper="No existing admin capability is removed." icon={<CheckCircle2 className="h-4 w-4" />} tone="good" />
        <AdminMetricCard label="Production note" value="Guarded" helper="Service secrets stay inside Supabase functions." icon={<LockKeyhole className="h-4 w-4" />} tone="info" />
      </div>

      <AdminPanel title="Role Matrix" description="These presets are additive. They organize what can be delegated later while keeping the current admin fully empowered.">
        <div className="grid gap-4 lg:grid-cols-2">
          {roles.map((role) => (
            <article key={role.name} className="rounded-[26px] border border-[#E4D6C5] bg-[#FAF5EE] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black tracking-[-0.04em] text-[#231916]">{role.name}</h2>
                  <p className="mt-1 text-xs leading-6 text-[#6F5D50]">{role.scope}</p>
                </div>
                <AdminStatusPill tone={role.name === 'Owner' ? 'good' : 'neutral'}>{role.name === 'Owner' ? 'Active' : 'Planned'}</AdminStatusPill>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {role.permissions.map((permission) => <span key={permission} className="rounded-full border border-[#D7C5B2] bg-[#FFFDF8] px-3 py-1 text-[10px] font-bold text-[#6F5D50]">{permission}</span>)}
              </div>
            </article>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel title="Implementation Guardrails" description="Permissions are prepared for expansion, but they should be enabled only after Supabase role policies are verified on staging.">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] p-4"><CheckCircle2 className="mb-3 h-5 w-5 text-emerald-600" /><p className="text-sm font-black">Keep all current admin actions</p><p className="mt-2 text-xs leading-6 text-[#6F5D50]">No button or permission is removed; future roles only limit delegated accounts.</p></div>
          <div className="rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] p-4"><LockKeyhole className="mb-3 h-5 w-5 text-[#9D7159]" /><p className="text-sm font-black">Protect sensitive operations</p><p className="mt-2 text-xs leading-6 text-[#6F5D50]">Payment confirmation, order edits and exports should be audited per user.</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><AlertTriangle className="mb-3 h-5 w-5 text-amber-600" /><p className="text-sm font-black">Deploy after staging test</p><p className="mt-2 text-xs leading-6 text-[#6F5D50]">Role enforcement requires database policy validation before production use.</p></div>
        </div>
      </AdminPanel>
    </AdminPageShell>
  );
}
