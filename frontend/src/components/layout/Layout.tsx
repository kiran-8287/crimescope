import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="dashboard-layout">
      <aside className="sidebar">CrimeScope</aside>
      <main className="main-content">
        <header className="page-header">CrimeScope</header>
        <Outlet />
      </main>
    </div>
  );
}
