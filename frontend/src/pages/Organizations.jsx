import { AnimatePresence, motion } from "framer-motion";
import { Users } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useApiData } from "../api/useApiData.js";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import { CHANNEL_LABELS, LANGUAGE_LABELS, formatDate } from "../components/format.js";

function matchesSearch(organization, searchText) {
  const text = searchText.toLowerCase();
  return [organization.name, organization.tank_name, organization.tank_id, organization.agrarian_service_centre].some((value) =>
    value.toLowerCase().includes(text)
  );
}

function ContactChips({ contacts }) {
  return (
    <div className="flex flex-wrap gap-1">
      {contacts.map((contact) => (
        <span key={contact.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600" title={contact.phone}>
          {contact.name} · {LANGUAGE_LABELS[contact.language]} · {CHANNEL_LABELS[contact.channel]}
          {!contact.opted_in && " · no consent"}
        </span>
      ))}
    </div>
  );
}

function OrganizationRow({ organization, onDelete }) {
  return (
    <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800">{organization.name}</div>
        <div className="text-xs text-slate-500">{organization.agrarian_service_centre} ASC · added {formatDate(organization.created_at)}</div>
      </td>
      <td className="px-4 py-3">
        <Link to={`/tanks/${encodeURIComponent(organization.tank_id)}`} className="font-medium text-wewa-700 hover:underline">
          {organization.tank_name}
        </Link>
        <div className="font-mono text-[11px] text-slate-400">{organization.tank_id}</div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">{organization.paddy_area_ha} ha</td>
      <td className="px-4 py-3"><ContactChips contacts={organization.contacts} /></td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <Link to={`/organizations/${organization.id}/edit`} className="rounded-lg px-3 py-2 text-sm font-medium text-wewa-700 hover:bg-slate-100">
            Edit
          </Link>
          <button onClick={() => onDelete(organization)} className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
            Delete
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

export default function Organizations() {
  const organizations = useApiData(() => api.getOrganizations(), []);
  const [searchText, setSearchText] = useState("");

  const deleteOrganization = async (organization) => {
    if (!window.confirm(`Delete ${organization.name}? Its contacts and plans will also be removed.`)) {
      return;
    }
    try {
      await api.deleteOrganization(organization.id);
      organizations.setData((current) => current.filter((item) => item.id !== organization.id));
      toast.success("Organization deleted");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const visible = (organizations.data || []).filter((organization) => matchesSearch(organization, searchText));

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <PageHeader
        title="Farmer organizations"
        description="Manage organizations and their contacts."
        actions={
          <Link to="/organizations/new" className="btn-primary">
            Register organization
          </Link>
        }
      />
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-3">
          <div className="max-w-sm">
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} className="input" placeholder="Search organization, tank or ASC" aria-label="Search organizations" />
          </div>
        </div>
        {organizations.error && !organizations.data ? (
          <div role="alert" className="p-5 text-sm text-red-700">Could not load organizations: {organizations.error}</div>
        ) : organizations.loading ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : visible.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title={searchText ? "No organizations match your search" : "No organizations registered yet"}
              description={searchText ? "Try a different search." : "Register an organization to create season plans."}
              action={!searchText && <Link to="/organizations/new" className="btn-primary">Register organization</Link>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Organization</th>
                  <th className="px-4 py-2">Tank</th>
                  <th className="px-4 py-2">Paddy area</th>
                  <th className="px-4 py-2">Contacts</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {visible.map((organization) => (
                    <OrganizationRow key={organization.id} organization={organization} onDelete={deleteOrganization} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
