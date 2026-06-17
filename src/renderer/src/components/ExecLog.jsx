import React from 'react';
import { useStore } from '../store.js';
import { runWorkflow, stopWorkflow } from '../engine/executor.js';

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

export default function ExecLog() {
  const running     = useStore(s => s.running);
  const runId       = useStore(s => s.runId);
  const progress    = useStore(s => s.progress);
  const currentStep = useStore(s => s.currentStep);
  const totalSteps  = useStore(s => s.totalSteps);
  const log         = useStore(s => s.log);
  const startTime   = useStore(s => s._startTime || 0);

  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(t);
  }, [running, startTime]);

  const latest = log[log.length - 1];

  return (
    <footer className="exec">
      <div className="exec-controls">
        <div
          className={`exec-btn run ${!running ? '' : 'disabled'}`}
          onClick={() => !running && runWorkflow()}
          title="Run"
        >▶</div>
        <div
          className={`exec-btn stop ${running ? 'active' : 'disabled'}`}
          onClick={() => running && stopWorkflow()}
          title={running ? 'Stop (Esc)' : 'Stop — chỉ dùng khi đang chạy'}
        >■</div>
      </div>
      <div className="exec-progress">
        <div className="exec-progress-bar" style={{ width: `${Math.max(0, Math.min(100, progress*100))}%` }} />
      </div>
      <div className="exec-stat">RUN <span className="v">#{String(runId).padStart(4,'0')}</span></div>
      <div className="exec-stat">STEP <span className="v">{currentStep}/{totalSteps}</span></div>
      <div className="exec-stat">ELAPSED <span className="v">{running ? formatTime(elapsed) : '—'}</span></div>
      <div className="exec-stat" style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis' }}>
        {running && latest ? `▸ ${latest.msg}` : 'Idle · ready'}
      </div>
    </footer>
  );
}
