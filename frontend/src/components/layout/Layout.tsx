import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="dashboard-layout">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <aside className="sidebar" aria-label="Main navigation">
        <h2>CrimeScope</h2>
        <nav>
          <ul>
            <li><a href="/">Overview</a></li>
            <li><a href="/regional-comparison">Regional Comparison</a></li>
            <li><a href="/trends">Trends</a></li>
            <li><a href="/data-quality">Data Quality</a></li>
            <li><a href="/pca">PCA</a></li>
            <li><a href="/clusters">Clusters</a></li>
            <li><a href="/anomalies">Unusual Changes</a></li>
            <li><a href="/association-rules">Association Rules</a></li>
            <li><a href="/methodology">Methodology</a></li>
          </ul>
        </nav>
      </aside>
      <main className="main-content" id="main-content">
        <header className="page-header">CrimeScope</header>
        <Outlet />
      </main>
    </div>
  );
}
