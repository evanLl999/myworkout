import { useRef, useState } from 'react';
import * as api from '../db/api';
import type { BackupData } from '../types';
import { CopyIcon, DownloadIcon, UploadIcon } from './Icons';

export default function BackupPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [exported, setExported] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport(copyOnly: boolean) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api.exportAll();
      const json = JSON.stringify(data, null, 2);
      if (copyOnly) {
        await copyText(json);
        setMessage('备份内容已复制，可以粘贴到备忘录或聊天记录里保存。');
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const name = `myworkout-backup-${new Date().toISOString().slice(0, 10)}.json`;
        setExported({ url, name });
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setMessage(
          `备份已生成：${data.configs.length} 个动作、${data.sessions.length} 天记录。` +
          '如果手机没有弹出保存窗口，点下面的“保存备份文件”。'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('导入备份会覆盖当前手机上的所有训练计划、体重和膳食记录，确定继续吗？')) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;
      if (!data || data.app !== 'myworkout') throw new Error('这不是 MyWorkOut 的备份文件');
      await api.importAll(data);
      setMessage('导入成功，正在刷新...');
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败，请确认文件没有损坏');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="backup-card">
      <div className="backup-head">
        <div>
          <span className="eyebrow">DATA</span>
          <h2>数据与备份</h2>
        </div>
        <span className="backup-badge">LOCAL ONLY</span>
      </div>
      <p>
        记录只保存在这台手机的浏览器里。清理 Safari 数据、换手机或系统重装都会丢失，
        建议每隔一段时间导出一份备份。
      </p>
      <div className="backup-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => handleExport(false)}>
          <DownloadIcon className="btn-icon" />
          导出备份
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => handleExport(true)}>
          <CopyIcon className="btn-icon" />
          复制
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          <UploadIcon className="btn-icon" />
          导入
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImport}
        />
      </div>
      {exported && (
        <a className="btn btn-outline btn-sm backup-save-link" href={exported.url} download={exported.name}>
          保存备份文件
        </a>
      )}
      {message && <p className="backup-note">{message}</p>}
      {error && <p className="backup-error">{error}</p>}
    </section>
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Safari 有时会拒绝异步剪贴板，回退到 execCommand
    }
  }
  copyWithTextarea(text);
}

function copyWithTextarea(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  textarea.remove();
  if (!ok) throw new Error('复制失败，请改用“导出备份”');
}
