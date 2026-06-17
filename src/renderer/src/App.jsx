import React, { useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import Topbar from './components/Topbar.jsx';
import Library from './components/Library.jsx';
import Canvas from './components/Canvas.jsx';
import Inspector from './components/Inspector.jsx';
import ExecLog from './components/ExecLog.jsx';
import TemplateGallery from './components/TemplateGallery.jsx';
import AccountManager from './components/AccountManager.jsx';
import TempMailPanel from './components/TempMailPanel.jsx';
import StudioPanel from './components/StudioPanel.jsx';
import ToastStack from './components/ToastStack.jsx';
import { useStore } from './store.js';
import { useAccountStore } from './store/accountStore.js';
import { stopWorkflow } from './engine/executor.js';

export default function App() {
  const nodes = useStore(s => s.nodes);
  const [showGallery, setShowGallery] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showTempMail, setShowTempMail] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const loadAccounts = useAccountStore(s => s.load);

  useEffect(() => {
    // First run: show template gallery
    if (nodes.length === 0) setShowGallery(true);
    // Load saved accounts
    loadAccounts();
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (useStore.getState().running) {
        e.preventDefault();
        stopWorkflow();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app">
      <Topbar
        onNewWorkflow={() => setShowGallery(true)}
        onOpenAccounts={() => setShowAccounts(true)}
        onOpenTempMail={() => setShowTempMail(true)}
        onOpenStudio={() => setShowStudio(true)}
      />
      <Library />
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
      <Inspector />
      <ExecLog />

      {showGallery   && <TemplateGallery  onClose={() => setShowGallery(false)} />}
      {showAccounts  && <AccountManager   onClose={() => setShowAccounts(false)} />}
      {showTempMail  && <TempMailPanel    onClose={() => setShowTempMail(false)} />}
      {showStudio    && <StudioPanel      onClose={() => setShowStudio(false)} />}
      <ToastStack />
    </div>
  );
}
