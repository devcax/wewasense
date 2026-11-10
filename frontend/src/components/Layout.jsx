import Sidebar from "./Sidebar.jsx";
import Header from "./Header.jsx";

export default function Layout({ children }) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
