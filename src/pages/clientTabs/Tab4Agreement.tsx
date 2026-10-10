/**
 * Tab 4 — Agreement (FEAT-007).
 *
 * The Build & Buy terms form. The admin fills in the deal terms (fixed price,
 * down-payment parts + dates, monthly amount/anchor/count/minimum, maintenance
 * amount/start, delivery targets, and the IP-transfer / no-refund flags). The
 * terms persist as JSON into Contract.terms with Contract.amount = the fixed
 * total. A signed contract PDF uploads to clients/{clientId}/contracts/* via
 * uploadContractPdf and stamps signedDocumentKey; a signed GET URL is resolved
 * via contractUrl (graceful "unavailable" fallback). Non-PDF files are rejected
 * client-side; amounts must be numeric and non-negative. Bottom action advances
 * to Payment Setup.
 *
 * The Contract hangs off a Project; by the time the deal reaches Agreement the
 * Project was created at quote-accept, so we resolve it via listProjectsByClient
 * and (idempotently) create one if missing.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FileUp, Save } from 'lucide-react';
import type { PanelProps } from './panelContract';
import { STAGE_LABELS } from './stageOrder';
import { listProjectsByClient, getContract, createContract, updateContract } from '../../utils/api';
import { createProjectForClient } from '../../projects/promoteQuote';
import { uploadContractPdf, contractUrl } from '../../contracts/contracts';

interface DownPart {
  label: string;
  amount: string;
  dueDate: string;
}

interface Terms {
  fixedPrice: string;
  downPayments: DownPart[];
  monthlyAmount: string;
  monthlyAnchorDay: string;
  monthlyCount: string;
  minimumAmount: string;
  maintenanceAmount: string;
  maintenanceStart: string;
  deliveryTarget: string;
  ipTransfersAtFullPayment: boolean;
  noRefund: boolean;
}

function blankTerms(): Terms {
  return {
    fixedPrice: '',
    downPayments: [{ label: 'Down payment 1', amount: '', dueDate: '' }],
    monthlyAmount: '',
    monthlyAnchorDay: '1',
    monthlyCount: '',
    minimumAmount: '',
    maintenanceAmount: '',
    maintenanceStart: '',
    deliveryTarget: '',
    ipTransfersAtFullPayment: true,
    noRefund: true,
  };
}

function fromTerms(raw: any): Terms {
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return blankTerms();
    }
  }
  if (!obj || typeof obj !== 'object') return blankTerms();
  const base = blankTerms();
  return {
    ...base,
    ...obj,
    downPayments:
      Array.isArray(obj.downPayments) && obj.downPayments.length
        ? obj.downPayments.map((d: any, i: number) => ({
            label: String(d?.label ?? `Down payment ${i + 1}`),
            amount: d?.amount != null ? String(d.amount) : '',
            dueDate: String(d?.dueDate ?? ''),
          }))
        : base.downPayments,
  };
}

/** Numeric + non-negative (empty string is allowed where optional). */
function nonNeg(v: string): boolean {
  if (v.trim() === '') return true;
  const n = Number(v);
  return !Number.isNaN(n) && n >= 0;
}

export default function Tab4Agreement({ client, quote, advanceStage }: PanelProps) {
  const [terms, setTerms] = useState<Terms>(blankTerms());
  const [projectId, setProjectId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [signedKey, setSignedKey] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [docUnavailable, setDocUnavailable] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const contractQuery = useQuery({
    queryKey: ['tab4-contract', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const projects = await listProjectsByClient(client.id);
      const project = (projects || [])[0] || null;
      if (!project) return { project: null, contract: null };
      const contracts = await getContract(project.id);
      return { project, contract: (contracts || [])[0] || null };
    },
  });

  useEffect(() => {
    const data = contractQuery.data;
    if (!data) return;
    setProjectId(data.project?.id ?? null);
    if (data.contract) {
      setContractId(data.contract.id);
      if (data.contract.terms) setTerms(fromTerms(data.contract.terms));
      if (data.contract.signedDocumentKey) setSignedKey(data.contract.signedDocumentKey);
    }
  }, [contractQuery.data]);

  // Resolve a signed GET URL for the stored PDF (graceful fallback on failure).
  useEffect(() => {
    let active = true;
    if (!signedKey) {
      setSignedUrl(null);
      setDocUnavailable(false);
      return;
    }
    contractUrl(signedKey).then((url) => {
      if (!active) return;
      if (url) {
        setSignedUrl(url);
        setDocUnavailable(false);
      } else {
        setSignedUrl(null);
        setDocUnavailable(true);
      }
    });
    return () => {
      active = false;
    };
  }, [signedKey]);

  const setT = <K extends keyof Terms>(k: K, v: Terms[K]) => {
    setTerms((t) => ({ ...t, [k]: v }));
    setSaved(false);
  };
  const setDown = (i: number, patch: Partial<DownPart>) => {
    setTerms((t) => ({
      ...t,
      downPayments: t.downPayments.map((d, j) => (j === i ? { ...d, ...patch } : d)),
    }));
    setSaved(false);
  };
  const addDown = () =>
    setTerms((t) => ({
      ...t,
      downPayments: [
        ...t.downPayments,
        { label: `Down payment ${t.downPayments.length + 1}`, amount: '', dueDate: '' },
      ],
    }));
  const removeDown = (i: number) =>
    setTerms((t) => ({ ...t, downPayments: t.downPayments.filter((_, j) => j !== i) }));

  async function ensureProject(): Promise<string | null> {
    if (projectId) return projectId;
    const projects = await listProjectsByClient(client.id);
    if (projects && projects.length > 0) {
      setProjectId(projects[0].id);
      return projects[0].id;
    }
    if (!quote?.id) {
      setError('No linked quote — cannot create the project this contract needs. Link a quote in Tab 1 first.');
      return null;
    }
    const { projectId: created } = await createProjectForClient(client, quote);
    setProjectId(created);
    return created;
  }

  function validate(): boolean {
    const numericFields = [
      terms.fixedPrice,
      terms.monthlyAmount,
      terms.monthlyCount,
      terms.minimumAmount,
      terms.maintenanceAmount,
      ...terms.downPayments.map((d) => d.amount),
    ];
    if (!numericFields.every(nonNeg)) {
      setError('All amounts must be numeric and non-negative.');
      return false;
    }
    return true;
  }

  async function persistContract(extra?: Record<string, any>) {
    const pid = await ensureProject();
    if (!pid) return null;
    const amount = terms.fixedPrice.trim() === '' ? null : Number(terms.fixedPrice);
    if (contractId) {
      return updateContract({ id: contractId, terms, amount, ...extra });
    }
    const created = await createContract({
      projectId: pid,
      clientId: client.id,
      status: 'draft',
      provider: 'manual_upload',
      terms,
      amount,
      ...extra,
    });
    if (created?.id) setContractId(created.id);
    return created;
  }

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    if (!validate()) return;
    setSaving(true);
    try {
      await persistContract();
      setSaved(true);
      await contractQuery.refetch();
    } catch (err: any) {
      console.error('Tab4 save failed:', err);
      setError('Could not save the agreement terms: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    setError(null);
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted for the signed contract.');
      return;
    }
    setUploading(true);
    try {
      // Make sure a Contract row + terms exist before stamping the key.
      await persistContract();
      const key = await uploadContractPdf(client.id, file, 'contract');
      await persistContract({ signedDocumentKey: key, status: 'signed', signedAt: new Date().toISOString() });
      setSignedKey(key);
      await contractQuery.refetch();
    } catch (err: any) {
      console.error('Tab4 PDF upload failed:', err);
      setError('Could not upload the contract PDF: ' + (err?.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await advanceStage('payment_setup');
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">Build &amp; Buy Agreement</h2>
        <p className="text-sm text-ace-muted">
          Capture the deal terms, then upload the signed contract PDF.
        </p>
      </div>

      {/* Price + minimum */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold">Price</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-ace-muted block mb-1">Fixed price (total to own)</label>
            <input className="input text-sm py-1 w-full" value={terms.fixedPrice} onChange={(e) => setT('fixedPrice', e.target.value)} placeholder="50000" />
          </div>
          <div>
            <label className="text-xs text-ace-muted block mb-1">Minimum amount owed</label>
            <input className="input text-sm py-1 w-full" value={terms.minimumAmount} onChange={(e) => setT('minimumAmount', e.target.value)} placeholder="20000" />
          </div>
          <div>
            <label className="text-xs text-ace-muted block mb-1">Delivery target date</label>
            <input type="date" className="input text-sm py-1 w-full" value={terms.deliveryTarget} onChange={(e) => setT('deliveryTarget', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Down payments */}
      <div className="card space-y-2">
        <h3 className="text-sm font-semibold">Down payments</h3>
        {terms.downPayments.map((d, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <input className="input text-xs py-1 flex-1 min-w-[120px]" placeholder="Label" value={d.label} onChange={(e) => setDown(i, { label: e.target.value })} />
            <input className="input text-xs py-1 w-24" placeholder="Amount" value={d.amount} onChange={(e) => setDown(i, { amount: e.target.value })} />
            <input type="date" className="input text-xs py-1 w-36" value={d.dueDate} onChange={(e) => setDown(i, { dueDate: e.target.value })} />
            <button type="button" onClick={() => removeDown(i)} className="text-ace-muted hover:text-red-400 text-xs">Remove</button>
          </div>
        ))}
        <button type="button" onClick={addDown} className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] w-fit">+ Add down payment</button>
      </div>

      {/* Monthly */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold">Monthly schedule</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-ace-muted block mb-1">Monthly amount</label>
            <input className="input text-sm py-1 w-full" value={terms.monthlyAmount} onChange={(e) => setT('monthlyAmount', e.target.value)} placeholder="1250" />
          </div>
          <div>
            <label className="text-xs text-ace-muted block mb-1">Anchor day (1–28)</label>
            <input className="input text-sm py-1 w-full" value={terms.monthlyAnchorDay} onChange={(e) => setT('monthlyAnchorDay', e.target.value)} placeholder="1" />
          </div>
          <div>
            <label className="text-xs text-ace-muted block mb-1">Number of payments</label>
            <input className="input text-sm py-1 w-full" value={terms.monthlyCount} onChange={(e) => setT('monthlyCount', e.target.value)} placeholder="36" />
          </div>
        </div>
      </div>

      {/* Maintenance */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold">Maintenance (optional)</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-ace-muted block mb-1">Monthly maintenance amount</label>
            <input className="input text-sm py-1 w-full" value={terms.maintenanceAmount} onChange={(e) => setT('maintenanceAmount', e.target.value)} placeholder="500" />
          </div>
          <div>
            <label className="text-xs text-ace-muted block mb-1">Maintenance start date</label>
            <input type="date" className="input text-sm py-1 w-full" value={terms.maintenanceStart} onChange={(e) => setT('maintenanceStart', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="card space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={terms.ipTransfersAtFullPayment} onChange={(e) => setT('ipTransfersAtFullPayment', e.target.checked)} />
          IP transfers only at full payment
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={terms.noRefund} onChange={(e) => setT('noRefund', e.target.checked)} />
          Payments are non-refundable
        </label>
      </div>

      {/* PDF upload */}
      <div className="card space-y-2">
        <h3 className="text-sm font-semibold">Signed contract PDF</h3>
        {signedKey ? (
          signedUrl ? (
            <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-ace-cyan underline">
              View uploaded contract
            </a>
          ) : docUnavailable ? (
            <p className="text-xs text-ace-muted italic">
              A signed contract is on file, but the document is currently unavailable to preview.
            </p>
          ) : (
            <p className="text-xs text-ace-muted">Resolving document link…</p>
          )
        ) : (
          <p className="text-xs text-ace-muted">No signed contract uploaded yet.</p>
        )}
        <label className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] flex items-center gap-1 cursor-pointer w-fit">
          <FileUp size={12} />
          {uploading ? 'Uploading…' : signedKey ? 'Replace PDF' : 'Upload signed PDF'}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={uploading || !client?.id}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {/* Save + status */}
      <div className="card">
        {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
        {saved && !error && <p className="text-xs text-green-400 mb-2">Saved.</p>}
        <div className="flex items-center justify-end">
          <button onClick={handleSave} disabled={saving || !client?.id} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
            <Save size={14} />
            {saving ? 'Saving…' : 'Save terms'}
          </button>
        </div>
      </div>

      {/* Bottom action */}
      <div className="flex justify-end">
        <button onClick={handleAdvance} disabled={advancing} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
          Advance to {STAGE_LABELS.payment_setup}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
