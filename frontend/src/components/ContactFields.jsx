export const EMPTY_CONTACT = { name: "", phone: "+94", language: "si", channel: "", opted_in: false };

export function isValidSriLankanPhone(phone) {
  return /^\+94\d{9}$/.test(phone.replace(/[\s-]/g, ""));
}

export default function ContactFields({ contact, index, onChange, onRemove, canRemove, availableChannels }) {
  const update = (field, value) => onChange(index, { ...contact, [field]: value });
  const phoneInvalid = contact.phone.length > 3 && !isValidSriLankanPhone(contact.phone);

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Contact {index + 1}</span>
        {canRemove && (
          <button type="button" onClick={() => onRemove(index)} className="rounded-lg px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50" aria-label={`Remove contact ${index + 1}`}>
            Remove
          </button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input value={contact.name} onChange={(event) => update("name", event.target.value)} className="input" placeholder="e.g. K. M. Herath" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input value={contact.phone} onChange={(event) => update("phone", event.target.value)} className={`input ${phoneInvalid ? "border-red-400" : ""}`} placeholder="+94771234567" />
          {phoneInvalid && <div className="mt-1 text-xs text-red-600">Use the format +94 followed by 9 digits</div>}
        </div>
        <div>
          <label className="label">Language</label>
          <select value={contact.language} onChange={(event) => update("language", event.target.value)} className="input">
            <option value="si">Sinhala</option>
            <option value="ta">Tamil</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="label">Channel</label>
          <div className="flex gap-2">
            {[["sms", "SMS"], ["whatsapp", "WhatsApp"]].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => update("channel", value)}
                disabled={!availableChannels[value]}
                aria-pressed={contact.channel === value}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  contact.channel === value ? "border-wewa-500 bg-wewa-50 text-wewa-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}{!availableChannels[value] && " (not configured)"}
              </button>
            ))}
          </div>
          {contact.channel && !availableChannels[contact.channel] && <p className="mt-1 text-xs text-red-700">This channel is not configured. Select an available channel before saving.</p>}
        </div>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={contact.opted_in} onChange={(event) => update("opted_in", event.target.checked)} className="mt-0.5 h-4 w-4 accent-paddy-600" />
        This person agreed to receive season plans and alerts{contact.channel ? ` by ${contact.channel === "sms" ? "SMS" : "WhatsApp"}` : ""} and can reply to them.
      </label>
    </div>
  );
}
