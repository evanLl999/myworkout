import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import MyProfile from './pages/MyProfile';
import WorkoutLog from './pages/WorkoutLog';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/workout" replace />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="workout" element={<WorkoutLog />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
