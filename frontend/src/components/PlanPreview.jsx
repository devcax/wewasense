import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RiskBadge, StatusBadge } from "./Badges.jsx";
import PhoneMockup from "./PhoneMockup.jsx";
import { CHANNEL_LABELS, LANGUAGE_LABELS, formatPercent } from "./format.js";

export function planDisplayStatus(plan) {
  return plan.is_sending ? "sending" : plan.status;
}

function sendButtonLabel(plan) {
  if (plan.status === "sent") {
    return "Resend to all";
  }
  return plan.status === "failed" ? "Retry send" : "Approve and send";
}

function ContactTabs({ previews, selectedIndex, onSelect }) {
  return (
    <div className="flex flex-wrap gap-1">
      {previews.map((preview, index) => (
        <button
          key={preview.contact_id}
          onClick={() => onSelect(index)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            index === selectedIndex ? "bg-wewa-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {preview.contact_name} · {LANGUAGE_LABELS[preview.language]} · {CHANNEL_LABELS[preview.channel]}
        </button>
      ))}
    </div>
  );
}

function DeliveryList({ messages, onResendMessage, busy }) {
  if (!messages.length) {
    return null;
  }
  return (
    <div className="space-y-1">
      <div className="label">Delivery</div>
      {messages.map((message) => (
        <div key={message.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
          <span className="text-slate-600">{message.contact_name || "Removed contact"} · {CHANNEL_LABELS[message.channel]}</span>
          <span className="flex items-center gap-2">
            <StatusBadge status={message.status} />
            {message.contact_name && message.status !== "queued" && (
              <button onClick={() => onResendMessage(message)} disabled={busy} className="font-medium text-wewa-700 hover:underline disabled:opacity-50">
                Resend
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function PreviewBody({ plan, onSaveText, onApprove, onApproveAndSend, onResendMessage, onDelete, busy }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [draftText, setDraftText] = useState(plan.message_text);
  const previews = plan.previews.length ? plan.previews : [{ contact_id: 0, contact_name: "No contact", language: plan.message_language, channel: "sms", uses_edited_text: true, text: plan.message_text }];
  const preview = previews[Math.min(selectedIndex, previews.length - 1)];
  const isLocked = plan.status === "sent" || plan.is_sending;
  const isDirty = draftText !== plan.message_text;
  const phoneText = preview.uses_edited_text ? draftText : preview.text;

  useEffect(() => {
    setDraftText(plan.message_text);
  }, [plan.id, plan.message_text]);

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
      <PhoneMockup channel={preview.channel} contactName={preview.contact_name} text={phoneText} />
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={plan.risk_level} />
          <StatusBadge status={planDisplayStatus(plan)} />
          <span className="text-xs text-slate-500">Cultivate {formatPercent(plan.percent_to_cultivate)} · safe area {plan.safe_area_ha} ha · bethma {plan.bethma ? "yes" : "no"}</span>
        </div>
        <ContactTabs previews={previews} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        <div>
          <label className="label">Message text ({LANGUAGE_LABELS[plan.message_language]})</label>
          <textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} disabled={isLocked} rows={7} className="input resize-y leading-relaxed" />
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>{preview.uses_edited_text ? "This contact receives the text above." : `This contact receives the generated ${LANGUAGE_LABELS[preview.language]} version shown on the phone.`}</span>
            <span>{draftText.length} characters</span>
          </div>
          {plan.message_language !== "en" && (
            <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">Sinhala and Tamil texts are placeholder translations. Please review before sending.</div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onSaveText(plan, draftText)} disabled={!isDirty || isLocked || busy} className="btn-outline">
            Save text
          </button>
          <button onClick={() => onApprove(plan, isDirty ? draftText : null)} disabled={plan.status !== "draft" || busy} className="btn-secondary">
            Approve
          </button>
          <button onClick={() => onApproveAndSend(plan, isDirty ? draftText : null)} disabled={plan.is_sending || busy} className="btn-primary">
            {sendButtonLabel(plan)}
          </button>
          <button onClick={() => onDelete(plan)} disabled={plan.is_sending || busy} className="btn-outline ml-auto text-red-600 hover:bg-red-50">
            Delete plan
          </button>
        </div>
        <DeliveryList messages={plan.messages} onResendMessage={onResendMessage} busy={busy} />
      </div>
    </div>
  );
}

export default function PlanPreview({ plan, onClose, ...handlers }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (plan && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [plan?.id]);

  return (
    <AnimatePresence>
      {plan && (
        <motion.div
          key="plan-preview"
          ref={panelRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="card p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-wewa-600">Message preview · {plan.season}</div>
              <h2 className="font-semibold text-slate-900">{plan.organization_name}</h2>
              <div className="text-xs text-slate-500">{plan.tank_name}</div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close preview">
              <X size={18} />
            </button>
          </div>
          <PreviewBody key={plan.id} plan={plan} {...handlers} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
