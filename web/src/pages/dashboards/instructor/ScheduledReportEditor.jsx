// file path: web/src/pages/dashboards/instructor/ScheduledReportEditor.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const DEFAULT = {
  name: '', course_id: null, frequency: 'weekly', schedule_spec: '', format: 'csv', include_pii: false, recipients: [], status: 'active'
};

export default function ScheduledReportEditor({ open, initial = null, onClose, onSaved }) {
  const [form, setForm] = useState(DEFAULT);
  useEffect(() => { setForm(initial ? { ...initial, recipients: initial.recipients || [] } : DEFAULT); }, [initial]);

  if (!open) return null;

  const save = async () => {
    try {
      const payload = { ...form, recipients: Array.isArray(form.recipients) ? form.recipients : String(form.recipients || '').split(',').map(s => s.trim()).filter(Boolean) };
      if (initial && initial.id) {
        await axios.put(`${API_URL}/api/instructor/reports/${initial.id}`, payload);
        toast.success('Report updated');
      } else {
        await axios.post(`${API_URL}/api/instructor/reports`, payload);
        toast.success('Report created');
      }
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || 'Failed to save report');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-2xl p-6">
        <h3 className="text-lg font-semibold ink mb-2">{initial?.id ? 'Edit' : 'Create'} Scheduled Report</h3>
        <p className="text-sm ink-muted mb-4">Configure automatic analytics exports for this course or cohort.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs ink-muted">Name</label>
            <input className="w-full px-3 py-2 border rounded mt-1 bg-white dark:bg-zinc-800" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
          </div>
          <div>
            <label className="text-xs ink-muted">Format</label>
            <select className="w-full px-3 py-2 border rounded mt-1 bg-white dark:bg-zinc-800" value={form.format} onChange={(e) => setForm({...form, format: e.target.value})}>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div>
            <label className="text-xs ink-muted">Frequency</label>
            <select className="w-full px-3 py-2 border rounded mt-1 bg-white dark:bg-zinc-800" value={form.frequency} onChange={(e) => setForm({...form, frequency: e.target.value})}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="cron">Custom (cron)</option>
            </select>
          </div>
          <div>
            <label className="text-xs ink-muted">Schedule spec</label>
            <input className="w-full px-3 py-2 border rounded mt-1 bg-white dark:bg-zinc-800" placeholder="e.g. Mon or 07:00 or 0 7 * * *" value={form.schedule_spec || ''} onChange={(e) => setForm({...form, schedule_spec: e.target.value})} />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs ink-muted">Recipients (comma separated emails)</label>
            <input className="w-full px-3 py-2 border rounded mt-1 bg-white dark:bg-zinc-800" value={(form.recipients || []).join(', ')} onChange={(e) => setForm({...form, recipients: e.target.value.split(',').map(s=>s.trim())})} />
          </div>

          <div>
            <label className="text-xs ink-muted">Include PII</label>
            <div className="mt-2">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!form.include_pii} onChange={(e) => setForm({...form, include_pii: e.target.checked})} />
                <span className="text-xs ink-muted">Include student names/emails</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs ink-muted">Status</label>
            <select className="w-full px-3 py-2 border rounded mt-1 bg-white dark:bg-zinc-800" value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 rounded" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 bg-[#04510e] text-white rounded" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
