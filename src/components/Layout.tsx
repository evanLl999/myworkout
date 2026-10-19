import { NavLink, Outlet } from 'react-router-dom';
import ColorPickerBtn from './ColorPicker';
import { DumbbellIcon, SlidersIcon } from './Icons';

const menuItems = [
  { path: '/workout', label: '训练记录', icon: DumbbellIcon },
  { path: '/profile', label: '我的计划', icon: SlidersIcon },
];

export default function Layout() {
  return (
    <div className="app-layout">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><DumbbellIcon /></span>
          <span className="brand-text">
            <span className="brand-name">MYWORKOUT</span>
            <span className="brand-sub">训练日志</span>
          </span>
        </div>
        <div className="topbar-actions">
          <ColorPickerBtn />
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <nav className="bottom-bar" aria-label="主导航">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `bottom-link${isActive ? ' active' : ''}`}
            >
              <span className="bottom-icon"><Icon /></span>
              <span className="bottom-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
