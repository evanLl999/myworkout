import DayConfig from '../components/DayConfig';
import BackupPanel from '../components/BackupPanel';

export default function MyProfile() {
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">PROGRAM</span>
          <h1 className="page-title">我的计划</h1>
        </div>
        <span className="page-date">每周循环</span>
      </header>
      <DayConfig />
      <BackupPanel />
    </div>
  );
}
