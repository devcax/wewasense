export default function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  );
}
