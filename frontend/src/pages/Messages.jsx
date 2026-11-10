import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useApiData } from "../api/useApiData.js";
import { StatusBadge } from "../components/Badges.jsx";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import { CHANNEL_LABELS, formatDateTime } from "../components/format.js";

const POLL_INTERVAL_MS = 4000;

function MessageItem({ message, onResend, resending, onDelete, deleting }) {
  return (
    <li className="border-b border-slate-100 px-5 py-5 last:border-0 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{message.organization_name || "Contact unavailable"}</div>
          <div className="mt-1 text-sm text-slate-600">To: {message.contact_name || message.from_phone || "Contact unavailable"} · {CHANNEL_LABELS[message.channel] || message.channel}</div>
        </div>
        <time className="text-xs text-slate-500" dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
        <div className="text-xs font-medium text-slate-500">Message</div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{message.text}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
        <span>Delivery:</span><StatusBadge status={message.status} />
        {message.tank_id && <span>Tank: <Link to={`/tanks/${encodeURIComponent(message.tank_id)}`} className="font-medium text-wewa-700 hover:underline">{message.tank_name}</Link></span>}
        {message.season && <span>Linked plan: {message.season}</span>}
        <div className="ml-auto flex items-center gap-4">
          {message.contact_name && message.status !== "queued" && (
            <button onClick={() => onResend(message)} disabled={resending || deleting} className="text-sm font-medium text-wewa-700 hover:underline disabled:opacity-50">Resend</button>
          )}
          <button onClick={() => onDelete(message)} disabled={message.status === "queued" || deleting || resending} title={message.status === "queued" ? "Wait until the message finishes sending" : "Delete from message history"} aria-label={`Delete message to ${message.contact_name || "contact"}`} className="text-sm font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50">{deleting ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </li>
  );
}

export default function Messages() {
  const messagesData = useApiData(() => api.getMessages("outbound"), []);
  const [resending, setResending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => messagesData.reload(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [messagesData.reload]);

  const resend = async (message) => {
    setResending(true);
    try {
      await api.resendMessage(message.id);
      toast.success(`Resent to ${message.contact_name}`);
      await messagesData.reload(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setResending(false);
    }
  };
  const deleteMessage = async (message) => {
    if (!window.confirm("Delete this message from history? This will not remove it from the recipient's phone.")) return;
    setDeletingId(message.id);
    try {
      await api.deleteMessage(message.id);
      messagesData.setData((current) => current ? { ...current, messages: current.messages.filter((item) => item.id !== message.id) } : current);
      toast.success("Message deleted from history");
      await messagesData.reload(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeletingId(null);
    }
  };
  const messages = messagesData.data?.messages || [];

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <PageHeader title="Outgoing messages" description="View messages and their delivery status." />
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 text-xs text-slate-600 sm:px-6">Showing up to 500 messages across all seasons, newest first.</div>
        {messagesData.error && !messagesData.data ? (
          <div role="alert" className="p-5 text-sm text-red-700">Could not load messages: {messagesData.error}</div>
        ) : messagesData.loading && !messagesData.data ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : messages.length === 0 ? (
          <div className="p-6"><EmptyState title="No outgoing messages yet" description="Messages sent from season plans will appear here." /></div>
        ) : (
          <ul>{messages.map((message) => <MessageItem key={message.id} message={message} onResend={resend} resending={resending} onDelete={deleteMessage} deleting={deletingId === message.id} />)}</ul>
        )}
      </div>
    </div>
  );
}
