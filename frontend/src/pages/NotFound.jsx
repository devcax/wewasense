import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";

export default function NotFound() {
  return (
    <div className="p-6">
      <EmptyState title="Page not found" description="This page does not exist." action={<Link to="/" className="btn-primary">Go to map</Link>} />
    </div>
  );
}
