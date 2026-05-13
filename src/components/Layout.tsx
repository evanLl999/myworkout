import { NavLink, Outlet } from 'react-router-dom';

const menuItems = [
  { path: '/workout', label: '健身记录', icon: '📋' },
  { path: '/profile', label: '我的', icon: '👤' },
];

export default function Layout() {
  return (
    <div className="app-layout">
      <header className="topbar">
        <span className="topbar-logo">MyWorkOut</span>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <nav className="bottom-bar">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `bottom-link${isActive ? ' active' : ''}`
            }
          >
            <span className="bottom-icon">{item.icon}</span>
            <span className="bottom-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
