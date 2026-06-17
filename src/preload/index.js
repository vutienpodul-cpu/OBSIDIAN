/**
 * Preload — bridges renderer (sandboxed) to main process via contextBridge.
 */
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Workflow file I/O
  saveWorkflow: (workflow, filePath) => ipcRenderer.invoke('workflow:save', { workflow, filePath }),
  loadWorkflow: () => ipcRenderer.invoke('workflow:load'),
  saveOutput: (payload) => ipcRenderer.invoke('output:save', payload),
  openPath: (p) => ipcRenderer.invoke('shell:open-path', p),
  pickFolder: (defaultPath) => ipcRenderer.invoke('dialog:pick-folder', { defaultPath }),
  exportFiles: (payload) => ipcRenderer.invoke('export:write-files', payload),

  // AI BRIDGE (Playwright) — sessionId is optional, falls back to nodeId
  bridge: {
    open:          (nodeId, url, sessionId)           => ipcRenderer.invoke('bridge:open', { nodeId, url, sessionId }),
    recordStart:   (nodeId, sessionId)                => ipcRenderer.invoke('bridge:record-start', { nodeId, sessionId }),
    recordStop:    (nodeId, sessionId)                => ipcRenderer.invoke('bridge:record-stop', { nodeId, sessionId }),
    replay:        (nodeId, actions, params, sessionId) => ipcRenderer.invoke('bridge:replay', { nodeId, actions, params, sessionId }),
    grabOutput:    (nodeId, selector, attr, sessionId)  => ipcRenderer.invoke('bridge:grab-output', { nodeId, selector, attr, sessionId }),
    waitStable:    (nodeId, selector, timeout, sessionId) => ipcRenderer.invoke('bridge:wait-stable', { nodeId, selector, timeout, sessionId }),
    captureClick:  (nodeId, stepNumber, sessionId)     => ipcRenderer.invoke('bridge:capture-click', { nodeId, stepNumber, sessionId }),
    runSteps:      (nodeId, steps, injectMap, sessionId) => ipcRenderer.invoke('bridge:run-steps', { nodeId, steps, injectMap, sessionId }),
    abort:         (nodeId, sessionId)                => ipcRenderer.invoke('bridge:abort', { nodeId, sessionId }),
    abortAll:      ()                                 => ipcRenderer.invoke('bridge:abort-all'),
    checkSelector: (nodeId, selector, sessionId)      => ipcRenderer.invoke('bridge:check-selector', { nodeId, selector, sessionId }),
    checkSteps:    (nodeId, steps, sessionId)          => ipcRenderer.invoke('bridge:check-steps', { nodeId, steps, sessionId }),
    close:         (nodeId, sessionId)                => ipcRenderer.invoke('bridge:close', { nodeId, sessionId }),
    isOpen:        (nodeId, sessionId)                => ipcRenderer.invoke('bridge:is-open', { nodeId, sessionId }),
    onEvent:       (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on('bridge:event', handler);
      return () => ipcRenderer.off('bridge:event', handler);
    }
  },

  // ACCOUNTS
  accounts: {
    load:          ()          => ipcRenderer.invoke('accounts:load'),
    save:          (accounts)  => ipcRenderer.invoke('accounts:save', accounts),
    deleteSession: (accountId) => ipcRenderer.invoke('accounts:delete-session', accountId),
    sessionExists: (accountId) => ipcRenderer.invoke('accounts:session-exists', accountId),
  },

  // TEMP MAIL (GuerillaMail)
  tempmail: {
    newAddress:  ()                   => ipcRenderer.invoke('tempmail:new'),
    setAddress:  (user)               => ipcRenderer.invoke('tempmail:set-address', { user }),
    inbox:       (token, seq)         => ipcRenderer.invoke('tempmail:inbox', { token, seq }),
    read:        (emailId, token)     => ipcRenderer.invoke('tempmail:read', { emailId, token }),
    forget:      ()                   => ipcRenderer.invoke('tempmail:forget'),
  }
};

contextBridge.exposeInMainWorld('obsidian', api);
