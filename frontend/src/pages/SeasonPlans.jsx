import { motion } from "framer-motion";
import { Sprout } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useApiData } from "../api/useApiData.js";
import { useAppSettings } from "../components/AppSettings.jsx";
import { RiskBadge, StatusBadge } from "../components/Badges.jsx";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import PlanPreview, { planDisplayStatus } from "../components/PlanPreview.jsx";
import SeasonSelector from "../components/SeasonSelector.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import { CHANNEL_LABELS, formatPercent } from "../components/format.js";

const POLL_INTERVAL_MS = 2000;

function countByStatus(plans) {
  const counts = { draft: 0, approved: 0, sending: 0, sent: 0, failed: 0 };
  plans.forEach((plan) => {
    counts[planDisplayStatus(plan)] += 1;
  });
  return counts;
}

function StatusSummary({ plans }) {
  const counts = countByStatus(plans);
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(counts).map(([status, count]) => (
        <span key={status} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs shadow-sm ring-1 ring-slate-200">
          <StatusBadge status={status} /> <span className="font-semibold text-slate-700">{count}</span>
        </span>
      ))}
    </div>
  );
}

function PlanRow({ plan, isSelected, onSelect, index }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={() => onSelect(plan.id)}
      className={`cursor-pointer border-b border-slate-100 transition last:border-0 ${isSelected ? "bg-wewa-50" : "hover:bg-slate-50"}`}
    >
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800">{plan.organization_name}</div>
        <div className="text-[11px] text-slate-500">{plan.paddy_area_ha} ha paddy</div>
      </td>
      <td className="px-4 py-3 text-sm">
        <Link to={`/tanks/${encodeURIComponent(plan.tank_id)}`} onClick={(event) => event.stopPropagation()} className="text-wewa-700 hover:underline">
          {plan.tank_name}
        </Link>
      </td>
      <td className="px-4 py-3"><RiskBadge level={plan.risk_level} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-paddy-500" style={{ width: `${plan.percent_to_cultivate}%` }} />
          </div>
          <span className="text-sm font-semibold text-slate-700">{formatPercent(plan.percent_to_cultivate)}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{CHANNEL_LABELS[plan.channel] || "–"}</td>
      <td className="px-4 py-3">
        <motion.div key={planDisplayStatus(plan)} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <StatusBadge status={planDisplayStatus(plan)} />
        </motion.div>
      </td>
    </motion.tr>
  );
}

function PlansTable({ plans, selectedPlanId, onSelect }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[700px] text-left [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Organization</th>
            <th className="px-4 py-2">Tank</th>
            <th className="px-4 py-2">Risk</th>
            <th className="px-4 py-2">Cultivate</th>
            <th className="px-4 py-2">Channel</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan, index) => (
            <PlanRow key={plan.id} plan={plan} index={index} isSelected={plan.id === selectedPlanId} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SeasonPlans() {
  const { seasonKey, selectedSeason } = useAppSettings();
  const plansData = useApiData(() => api.getPlans(seasonKey), [seasonKey]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => plansData.reload(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [plansData.reload]);

  useEffect(() => {
    setSelectedPlanId(null);
  }, [seasonKey]);

  const plans = plansData.data?.plans || [];
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null;
  const approvedCount = plans.filter((plan) => plan.status === "approved" && !plan.is_sending).length;

  const runAction = async (action, successMessage) => {
    setBusy(true);
    try {
      const result = await action();
      await plansData.reload(false);
      toast.success(typeof successMessage === "function" ? successMessage(result) : successMessage);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const saveTextIfNeeded = async (plan, text) => {
    if (text !== null && text !== undefined) {
      await api.updatePlanText(plan.id, text);
    }
  };

  const handlers = {
    busy,
    onSaveText: (plan, text) => runAction(() => api.updatePlanText(plan.id, text), "Message text saved"),
    onApprove: (plan, text) =>
      runAction(async () => {
        await saveTextIfNeeded(plan, text);
        return api.approvePlan(plan.id);
      }, "Plan approved"),
    onApproveAndSend: (plan, text) =>
      runAction(async () => {
        await saveTextIfNeeded(plan, text);
        if (plan.status === "draft") {
          await api.approvePlan(plan.id);
        }
        return api.sendPlan(plan.id);
      }, plan.status === "sent" ? "Plan resent" : "Plan approved and sending"),
    onDelete: (plan) => {
      if (!window.confirm(`Delete the ${plan.season} plan for ${plan.organization_name}? Sent messages stay in the message history.`)) {
        return;
      }
      setSelectedPlanId(null);
      runAction(() => api.deletePlan(plan.id), "Plan deleted");
    },
    onResendMessage: (message) => runAction(() => api.resendMessage(message.id), `Resent to ${message.contact_name}`),
  };

  const generate = () =>
    runAction(() => api.generatePlans(seasonKey), (result) => `${result.created} created, ${result.updated} refreshed, ${result.skipped} kept (already approved or sent)`);
  const sendAllApproved = () => runAction(() => api.sendApprovedPlans(seasonKey), (result) => `Sending ${result.sent} approved plans`);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <PageHeader
        title="Season plans and alerts"
        description="Generate, review and send season plans."
        actions={
          <>
            <SeasonSelector />
            <button onClick={generate} disabled={busy} className="btn-secondary">
              Generate plans
            </button>
            <button onClick={sendAllApproved} disabled={busy || approvedCount === 0} className="btn-primary">
              Send approved ({approvedCount})
            </button>
          </>
        }
      />
      {plansData.error && !plansData.data ? (
        <div role="alert" className="card p-5 text-sm text-red-700">Could not load plans: {plansData.error}</div>
      ) : plansData.loading && !plansData.data ? (
        <div className="card p-4"><SkeletonRows rows={6} /></div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title={`No plans for ${selectedSeason?.label} yet`}
          description="Generate plans for registered organizations."
          action={<button onClick={generate} disabled={busy} className="btn-primary">Generate plans</button>}
        />
      ) : (
        <div className="space-y-4">
          <StatusSummary plans={plans} />
          <div className={`grid gap-4 ${selectedPlan ? "2xl:grid-cols-2" : ""}`}>
            <PlansTable plans={plans} selectedPlanId={selectedPlanId} onSelect={setSelectedPlanId} />
            <PlanPreview plan={selectedPlan} onClose={() => setSelectedPlanId(null)} {...handlers} />
          </div>
          {!selectedPlan && <p className="text-sm text-slate-500">Select a plan to review its message.</p>}
        </div>
      )}
    </div>
  );
}
