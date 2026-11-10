import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useApiData } from "../api/useApiData.js";
import { useAppSettings } from "../components/AppSettings.jsx";
import ContactFields, { EMPTY_CONTACT, isValidSriLankanPhone } from "../components/ContactFields.jsx";
import { RiskBadge } from "../components/Badges.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import TankPicker from "../components/TankPicker.jsx";
import { CHANNEL_LABELS, LANGUAGE_LABELS, formatNumber, formatPercent } from "../components/format.js";

const STEPS = ["Organization", "Tank", "Paddy area", "Contacts", "Review"];

const EMPTY_FORM = {
  name: "",
  agrarian_service_centre: "",
  tank_id: "",
  tank_local_name: "",
  paddy_area_ha: "",
  contacts: [{ ...EMPTY_CONTACT }],
};

function formFromOrganization(organization) {
  return {
    name: organization.name,
    agrarian_service_centre: organization.agrarian_service_centre,
    tank_id: organization.tank_id,
    tank_local_name: "",
    paddy_area_ha: String(organization.paddy_area_ha),
    contacts: organization.contacts.map(({ name, phone, language, channel, opted_in }) => ({ name, phone, language, channel, opted_in })),
  };
}

function stepError(step, form, availableChannels, metaLoaded) {
  if (step === 0 && (!form.name.trim() || !form.agrarian_service_centre.trim())) {
    return "Enter the organization name and agrarian service centre";
  }
  if (step === 1 && !form.tank_id) {
    return "Select the tank this organization uses";
  }
  if (step === 2 && !(Number(form.paddy_area_ha) > 0)) {
    return "Enter the paddy area in hectares";
  }
  if (step === 3) {
    if (!metaLoaded) return "Messaging configuration is unavailable. Check that the backend is running.";
    if (!availableChannels.sms && !availableChannels.whatsapp) return "Configure SMS or WhatsApp in backend/.env and restart the backend.";
    if (form.contacts.some((contact) => !availableChannels[contact.channel])) return "Select a configured communication channel for each contact.";
    if (form.contacts.some((contact) => !contact.name.trim() || !isValidSriLankanPhone(contact.phone))) {
      return "Each contact needs a name and a phone number like +94771234567";
    }
    if (!form.contacts.some((contact) => contact.opted_in)) {
      return "At least one contact must give consent";
    }
  }
  return null;
}

function buildPayload(form) {
  return {
    ...form,
    paddy_area_ha: Number(form.paddy_area_ha),
    tank_local_name: form.tank_local_name.trim() || null,
    contacts: form.contacts.map((contact) => ({ ...contact, phone: contact.phone.replace(/[\s-]/g, "") })),
  };
}

function OrganizationStep({ form, update }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="label">Organization name</label>
        <input value={form.name} onChange={(event) => update({ name: event.target.value })} className="input" placeholder="e.g. Kudawewa Govi Sanvidhanaya" autoFocus />
      </div>
      <div>
        <label className="label">Agrarian service centre</label>
        <input value={form.agrarian_service_centre} onChange={(event) => update({ agrarian_service_centre: event.target.value })} className="input" placeholder="e.g. Thambuttegama" />
      </div>
    </div>
  );
}

function TankStep({ form, update, tanks, selectedTank }) {
  return (
    <div className="space-y-4">
      <TankPicker tanks={tanks} selectedTank={selectedTank} onSelect={(tank) => update({ tank_id: tank.tank_id, tank_local_name: "" })} />
      {selectedTank && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-slate-800">{selectedTank.name}</div>
              <div className="text-xs text-slate-500">{selectedTank.tank_id} · {formatNumber(selectedTank.area_ha, 1)} ha · current fill {formatPercent(selectedTank.current_fill_percent)}</div>
            </div>
            <RiskBadge level={selectedTank.risk_level} />
          </div>
          {!selectedTank.local_name && (
            <div className="mt-3">
              <label className="label">Local name for this tank (optional)</label>
              <input value={form.tank_local_name} onChange={(event) => update({ tank_local_name: event.target.value })} className="input bg-white" placeholder="e.g. Ihala Kumbukwewa" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaddyAreaStep({ form, update, selectedTank }) {
  return (
    <div className="max-w-sm">
      <label className="label">Paddy area (hectares)</label>
      <input type="number" min="0" step="0.1" value={form.paddy_area_ha} onChange={(event) => update({ paddy_area_ha: event.target.value })} className="input text-lg" placeholder="e.g. 40" autoFocus />
      <p className="mt-2 text-xs text-slate-500">
        Total paddy land under this tank that the organization cultivates.
        {selectedTank && ` The tank water area is ${formatNumber(selectedTank.area_ha, 1)} ha.`}
      </p>
    </div>
  );
}

function ContactsStep({ form, update, availableChannels, metaLoaded }) {
  const changeContact = (index, contact) => update({ contacts: form.contacts.map((item, position) => (position === index ? contact : item)) });
  const removeContact = (index) => update({ contacts: form.contacts.filter((_, position) => position !== index) });
  return (
    <div className="space-y-3">
      {!metaLoaded ? <p role="status" className="text-sm text-slate-600">Checking messaging configuration…</p> : !availableChannels.sms && !availableChannels.whatsapp ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No messaging channel is configured. Add Twilio or WhatsApp credentials to backend/.env, restart the backend, and refresh this page.</p> : null}
      {form.contacts.map((contact, index) => (
        <ContactFields key={index} contact={contact} index={index} onChange={changeContact} onRemove={removeContact} canRemove={form.contacts.length > 1} availableChannels={availableChannels} />
      ))}
      <button type="button" onClick={() => update({ contacts: [...form.contacts, { ...EMPTY_CONTACT }] })} className="btn-outline">
        Add another contact
      </button>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function ReviewStep({ form, selectedTank }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 p-4">
        <ReviewRow label="Organization" value={form.name} />
        <ReviewRow label="Agrarian service centre" value={form.agrarian_service_centre} />
        <ReviewRow label="Tank" value={form.tank_local_name || selectedTank?.name} />
        <ReviewRow label="Tank ID" value={form.tank_id} />
        <ReviewRow label="Paddy area" value={`${form.paddy_area_ha} ha`} />
      </div>
      <div className="space-y-2">
        {form.contacts.map((contact, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 p-4 text-sm">
            <div className="font-semibold text-slate-800">{contact.name}</div>
            <div className="text-slate-500">{contact.phone} · {LANGUAGE_LABELS[contact.language]} · {CHANNEL_LABELS[contact.channel]}</div>
            <div className={`mt-1 text-xs font-medium ${contact.opted_in ? "text-paddy-600" : "text-amber-600"}`}>
              {contact.opted_in ? "Consent given" : "No consent, will not receive messages"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessView({ organization, isEdit }) {
  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold text-slate-900">{isEdit ? "Organization updated" : "Organization registered"}</h2>
      <p className="mt-2 text-sm text-slate-600">{organization.name} is linked to {organization.tank_name}.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to={`/tanks/${encodeURIComponent(organization.tank_id)}`} className="btn-primary">View tank page</Link>
        <Link to="/organizations" className="btn-outline">All organizations</Link>
      </div>
    </div>
  );
}

function StepContent(props) {
  const { step } = props;
  if (step === 0) return <OrganizationStep {...props} />;
  if (step === 1) return <TankStep {...props} />;
  if (step === 2) return <PaddyAreaStep {...props} />;
  if (step === 3) return <ContactsStep {...props} />;
  return <ReviewStep {...props} />;
}

export default function RegisterOrganization() {
  const { organizationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { seasonKey, meta, backendError } = useAppSettings();
  const isEdit = Boolean(organizationId);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...EMPTY_FORM, tank_id: searchParams.get("tank") || "" });
  const [saving, setSaving] = useState(false);
  const [savedOrganization, setSavedOrganization] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const tanksData = useApiData(() => api.getTanks(seasonKey, "forecast"), [seasonKey]);

  useEffect(() => {
    if (!isEdit) return;
    api
      .getOrganization(organizationId)
      .then((organization) => setForm(formFromOrganization(organization)))
      .catch((error) => {
        toast.error(error.message);
        navigate("/organizations");
      })
      .finally(() => setLoadingExisting(false));
  }, [organizationId]);

  const tanks = tanksData.data?.tanks || [];
  const availableChannels = {
    sms: meta?.messaging_providers?.sms === "twilio_sms",
    whatsapp: meta?.messaging_providers?.whatsapp === "whatsapp_cloud",
  };
  const selectedTank = tanks.find((tank) => tank.tank_id === form.tank_id);
  const update = (changes) => setForm((current) => ({ ...current, ...changes }));

  const goTo = (nextStep) => {
    setStep(nextStep);
  };

  const goNext = () => {
    const error = stepError(step, form, availableChannels, Boolean(meta));
    if (error) {
      toast.error(error);
      return;
    }
    goTo(step + 1);
  };

  const save = async () => {
    const error = stepError(3, form, availableChannels, Boolean(meta));
    if (error) {
      toast.error(error);
      goTo(3);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      const organization = isEdit ? await api.updateOrganization(organizationId, payload) : await api.createOrganization(payload);
      setSavedOrganization(organization);
      toast.success(isEdit ? "Organization updated" : "Organization registered");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (savedOrganization) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <SuccessView organization={savedOrganization} isEdit={isEdit} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <Link to="/organizations" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-wewa-600 hover:underline">
        Organizations
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{isEdit ? "Edit farmer organization" : "Register farmer organization"}</h1>
      <p className="mb-6 text-sm text-slate-600">Enter the organization’s details and contacts.</p>
      <div className="card p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-800">{STEPS[step]}</h2>
          <span className="text-sm text-slate-500">Step {step + 1} of {STEPS.length}</span>
        </div>
        {loadingExisting || (step === 1 && tanksData.loading && !tanksData.data) ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <div className="min-h-[220px]">
            {step === 3 && backendError && !meta ? <p role="alert" className="mb-3 text-sm text-red-700">Cannot check messaging configuration. Check the backend connection and refresh the page.</p> : null}
            <StepContent step={step} form={form} update={update} tanks={tanks} selectedTank={selectedTank} availableChannels={availableChannels} metaLoaded={Boolean(meta)} />
          </div>
        )}
        <div className="mt-6 flex justify-between border-t border-slate-100 pt-4">
          <button type="button" onClick={() => goTo(step - 1)} disabled={step === 0} className="btn-outline">
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={goNext} className="btn-primary">
              Next
            </button>
          ) : (
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              {saving ? "Saving..." : isEdit ? "Save changes" : "Confirm and register"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
