import { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, GripVertical, Plus, Save, Trash2, Workflow } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { DEFAULT_FOLLOWUP_TYPES, DEFAULT_ORDER_WORKFLOW_STATUSES, normalizeFollowupTypes, normalizeOrderWorkflow, type FollowupTypeConfig, type WorkflowStatus } from '@/lib/workflow';

const statusColors = ['amber', 'blue', 'purple', 'indigo', 'cyan', 'sky', 'green', 'red', 'stone', 'gold'];
const followupColors = ['green', 'amber', 'emerald', 'blue', 'cyan', 'red', 'purple', 'orange', 'gold', 'stone'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#9a8461]">{label}{children}</label>;
}

function makeKey(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `custom_${Date.now()}`;
}

export default function AdminWorkflow() {
  const [statuses, setStatuses] = useState<WorkflowStatus[]>(DEFAULT_ORDER_WORKFLOW_STATUSES);
  const [followupTypes, setFollowupTypes] = useState<FollowupTypeConfig[]>(DEFAULT_FOLLOWUP_TYPES);
  const [activeTab, setActiveTab] = useState<'statuses' | 'followups'>('statuses');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const activeStatuses = useMemo(() => statuses.filter((status) => status.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder), [statuses]);
  const quickFollowups = useMemo(() => followupTypes.filter((type) => type.isActive !== false && type.isQuickAction).sort((a, b) => a.sortOrder - b.sortOrder), [followupTypes]);

  const load = async () => {
    setIsLoading(true);
    try {
      const { getAdminWorkflow } = await import('@/lib/supabase/db');
      const workflow = await getAdminWorkflow();
      setStatuses(normalizeOrderWorkflow(workflow.statuses));
      setFollowupTypes(normalizeFollowupTypes(workflow.followupTypes));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load workflow settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    setIsSaving(true);
    try {
      const { saveAdminWorkflow } = await import('@/lib/supabase/db');
      await saveAdminWorkflow({ statuses, followupTypes });
      toast.success('Workflow settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save workflow settings');
    } finally {
      setIsSaving(false);
    }
  };

  const addStatus = () => {
    const label = 'Custom Status';
    setStatuses((current) => [...current, { key: makeKey(`${label} ${current.length}`), label, color: 'stone', sortOrder: (current.length + 1) * 10, isActive: true, isFinal: false }]);
  };

  const updateStatus = (index: number, patch: Partial<WorkflowStatus>) => setStatuses((current) => current.map((item, i) => i === index ? { ...item, ...patch, key: patch.label && !item.id ? makeKey(patch.label) : item.key } : item));
  const removeStatus = (index: number) => setStatuses((current) => current.map((item, i) => i === index ? { ...item, isActive: false } : item));

  const addFollowup = () => {
    const label = 'Custom Follow-up';
    setFollowupTypes((current) => [...current, { key: makeKey(`${label} ${current.length}`), label, color: 'stone', icon: 'StickyNote', sortOrder: (current.length + 1) * 10, isActive: true, isQuickAction: true, templateText: '' }]);
  };

  const updateFollowup = (index: number, patch: Partial<FollowupTypeConfig>) => setFollowupTypes((current) => current.map((item, i) => i === index ? { ...item, ...patch, key: patch.label && !item.id ? makeKey(patch.label) : item.key } : item));
  const removeFollowup = (index: number) => setFollowupTypes((current) => current.map((item, i) => i === index ? { ...item, isActive: false } : item));

  return (
    <div className="space-y-6 text-[#2b211d]" dir="ltr">
      <AdminPageHeader
        title="Workflow Control"
        description="Manage order statuses, next actions, and follow-up quick actions without changing code. Used statuses are hidden instead of hard-deleted to protect old orders."
        actions={<div className="flex gap-2"><button onClick={load} className="nexora-button" disabled={isLoading}>Refresh</button><button onClick={save} className="nexora-button-primary" disabled={isSaving}><Save className="h-4 w-4" />{isSaving ? 'Saving...' : 'Save Workflow'}</button></div>}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-[26px] border border-[#e6ded1] bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a8461]">Active Statuses</p><p className="mt-3 text-3xl font-black">{activeStatuses.length}</p></div>
        <div className="rounded-[26px] border border-[#e6ded1] bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a8461]">Quick Follow-ups</p><p className="mt-3 text-3xl font-black">{quickFollowups.length}</p></div>
        <div className="rounded-[26px] border border-[#e6ded1] bg-white p-4 md:col-span-2"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a8461]">Preview</p><div className="mt-3 flex flex-wrap gap-2">{activeStatuses.slice(0, 8).map((status) => <span key={status.key} className="rounded-full border border-[#e6ded1] bg-[#faf7f1] px-3 py-1 text-[10px] font-bold uppercase text-[#5f584f]">{status.label}</span>)}</div></div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-[24px] border border-[#e6ded1] bg-white p-2">
        <button onClick={() => setActiveTab('statuses')} className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] ${activeTab === 'statuses' ? 'bg-[#2b211d] text-white' : 'text-[#5f584f] hover:bg-[#faf7f1]'}`}><Workflow className="h-4 w-4" /> Order Statuses</button>
        <button onClick={() => setActiveTab('followups')} className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] ${activeTab === 'followups' ? 'bg-[#2b211d] text-white' : 'text-[#5f584f] hover:bg-[#faf7f1]'}`}><Bell className="h-4 w-4" /> Follow-up Types</button>
      </div>

      {activeTab === 'statuses' && (
        <section className="rounded-[30px] border border-[#e6ded1] bg-white p-5 shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-black uppercase tracking-[0.18em]">Order Statuses</h2><p className="mt-1 text-xs text-[#8a8175]">Add, hide, reorder, and set the default next action for order workflow chips.</p></div><button onClick={addStatus} className="nexora-button-primary"><Plus className="h-4 w-4" /> Add Status</button></div>
          <div className="space-y-3">
            {statuses.map((status, index) => (
              <div key={`${status.key}-${index}`} className={`grid gap-3 rounded-3xl border p-4 md:grid-cols-[auto_1fr_1fr_120px_120px_100px_auto] md:items-center ${status.isActive === false ? 'border-red-100 bg-red-50/50 opacity-70' : 'border-[#efe8dc] bg-[#faf7f1]'}`}>
                <GripVertical className="h-4 w-4 text-[#9a8461]" />
                <Field label="Label"><input className="studio-input" value={status.label} onChange={(e) => updateStatus(index, { label: e.target.value })} /></Field>
                <Field label="Key"><input className="studio-input" value={status.key} onChange={(e) => updateStatus(index, { key: e.target.value })} /></Field>
                <Field label="Color"><select className="studio-input" value={status.color || 'stone'} onChange={(e) => updateStatus(index, { color: e.target.value })}>{statusColors.map((color) => <option key={color} value={color}>{color}</option>)}</select></Field>
                <Field label="Sort"><input className="studio-input" type="number" value={status.sortOrder} onChange={(e) => updateStatus(index, { sortOrder: Number(e.target.value) })} /></Field>
                <label className="flex items-center gap-2 text-xs font-semibold text-[#5f584f]"><input type="checkbox" checked={status.isFinal || false} onChange={(e) => updateStatus(index, { isFinal: e.target.checked })} /> Final</label>
                <button onClick={() => removeStatus(index)} className="nexora-button justify-center text-red-700"><Trash2 className="h-4 w-4" /> Hide</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'followups' && (
        <section className="rounded-[30px] border border-[#e6ded1] bg-white p-5 shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-black uppercase tracking-[0.18em]">Follow-up Types</h2><p className="mt-1 text-xs text-[#8a8175]">Control the follow-up dropdown and quick action chips in Order Details.</p></div><button onClick={addFollowup} className="nexora-button-primary"><Plus className="h-4 w-4" /> Add Follow-up</button></div>
          <div className="space-y-3">
            {followupTypes.map((type, index) => (
              <div key={`${type.key}-${index}`} className={`grid gap-3 rounded-3xl border p-4 md:grid-cols-[auto_1fr_1fr_120px_100px_110px_auto] md:items-center ${type.isActive === false ? 'border-red-100 bg-red-50/50 opacity-70' : 'border-[#efe8dc] bg-[#faf7f1]'}`}>
                <Activity className="h-4 w-4 text-[#9a8461]" />
                <Field label="Label"><input className="studio-input" value={type.label} onChange={(e) => updateFollowup(index, { label: e.target.value })} /></Field>
                <Field label="Key"><input className="studio-input" value={type.key} onChange={(e) => updateFollowup(index, { key: e.target.value })} /></Field>
                <Field label="Color"><select className="studio-input" value={type.color || 'stone'} onChange={(e) => updateFollowup(index, { color: e.target.value })}>{followupColors.map((color) => <option key={color} value={color}>{color}</option>)}</select></Field>
                <Field label="Sort"><input className="studio-input" type="number" value={type.sortOrder} onChange={(e) => updateFollowup(index, { sortOrder: Number(e.target.value) })} /></Field>
                <label className="flex items-center gap-2 text-xs font-semibold text-[#5f584f]"><input type="checkbox" checked={type.isQuickAction} onChange={(e) => updateFollowup(index, { isQuickAction: e.target.checked })} /> Quick</label>
                <button onClick={() => removeFollowup(index)} className="nexora-button justify-center text-red-700"><Trash2 className="h-4 w-4" /> Hide</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
