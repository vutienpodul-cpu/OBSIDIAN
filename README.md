# OBSIDIAN

**Creative Director's Workflow Engine** — Node-based visual automation cho production sáng tạo, với cơ chế **AI Bridge record/replay** để tự động hóa mọi web tool (Midjourney, Sora, Runway, Higgsfield...) mà không cần API bên thứ ba.

```
 BRIEF + REFERENCE ──┐
                     ├─► MERGE ─► ANALYZER ─► COMPILER ─► [BRIDGE → Midjourney]
 PROMPT + STYLE ─────┘                                        │
                                                              ▼
                                            APPROVAL ─► STORYBOARD ─► [BRIDGE → Sora] ─► VFX ─► EXPORT
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Desktop shell | Electron 31 |
| Renderer | React 18 + React Flow 11 |
| State | Zustand |
| Build | electron-vite + electron-builder |
| Browser automation | Playwright (Chromium headed mode) |
| Styling | Pure CSS, Inter + JetBrains Mono |

---

## Setup (Windows / macOS / Linux)

### 1. Cài Node.js 18+

Download tại https://nodejs.org

### 2. Install dependencies

```bash
cd obsidian
npm install
```

Lệnh này sẽ tự động `npm install` toàn bộ deps **và** chạy `playwright install chromium` để tải browser engine cho AI Bridge.

### 3. Chạy dev mode

```bash
npm run dev
```

App mở ra với canvas đã nạp sẵn workflow mẫu 16 nodes (Adidas Spring Campaign). DevTools mở kèm để debug.

### 4. Build production

```bash
# Windows installer (.exe NSIS)
npm run build:win

# macOS DMG
npm run build:mac
```

Output nằm trong `release/`.

---

## Cấu trúc project

```
obsidian/
├── package.json
├── electron.vite.config.mjs
├── src/
│   ├── main/                     ← Electron main process
│   │   ├── index.js              · IPC handlers, window lifecycle
│   │   └── bridge.js             · Playwright controller (record/replay)
│   ├── preload/
│   │   └── index.js              · contextBridge.exposeInMainWorld
│   └── renderer/                 ← React app
│       ├── index.html
│       └── src/
│           ├── main.jsx
│           ├── App.jsx
│           ├── store.js          · Zustand workflow state
│           ├── seed.js           · Sample workflow
│           ├── data/nodeDefs.js  · 20+ node type definitions
│           ├── engine/executor.js · Topological executor
│           ├── components/
│           │   ├── Topbar.jsx
│           │   ├── Library.jsx
│           │   ├── Canvas.jsx
│           │   ├── Inspector.jsx
│           │   ├── ExecLog.jsx
│           │   └── nodes/ObsidianNode.jsx
│           └── styles/global.css · Tech-Noir design system
```

---

## AI Bridge — Cơ chế cốt lõi

Đây là phần khác biệt hoàn toàn so với mọi tool khác.

### Workflow:

1. **OPEN BROWSER** — Bridge node launch Playwright Chromium (headed mode), navigate tới URL anh nhập (ví dụ `midjourney.com/imagine`). Session lưu persistent tại `userData/sessions/<nodeId>` — anh chỉ cần login 1 lần.

2. **START RECORDING** — Một content script được inject vào page, lắng nghe mọi `click`, `input`, `keydown` của anh. Mỗi action lưu thành JSON với CSS selector + value:
   ```json
   { "type": "input", "selector": "textarea[data-testid='prompt-input']", "value": "..." }
   { "type": "click", "selector": "button:nth-of-type(2)", "text": "Imagine" }
   ```

3. **STOP RECORDING** — actions array được lưu vào node data, hiện trên timeline trong Inspector.

4. **RUN WORKFLOW** — Executor đến node Bridge, sẽ:
   - Mở lại browser session (re-use login)
   - **Inject params** — thay value của field đầu vào bằng output từ upstream node (ví dụ prompt từ Compiler)
   - **Replay** từng action theo thứ tự, dùng `page.click()`, `page.fill()`, `page.press()` của Playwright
   - **Wait for stable** — quan sát DOM mutation, đợi 2s không thay đổi = sinh xong
   - **Grab output** — `page.$$eval` lấy `src` của images/videos kết quả
   - Pass output xuống node tiếp theo

### Cách dùng node Bridge lần đầu:

1. Kéo node `Browser Bridge` (đỏ rượu) vào canvas.
2. Click chọn node → Inspector panel phải → tab `RECORDING`.
3. Sửa URL ở tab `PROPERTIES`, ví dụ `https://www.midjourney.com/imagine`.
4. Bấm `OPEN BROWSER` → cửa sổ Playwright Chromium mở ra → login Midjourney (chỉ 1 lần).
5. Bấm `● START RECORDING` → thao tác bình thường: nhập prompt, bấm Imagine, đợi xong, click upscale...
6. Bấm `■ STOP RECORDING` → actions hiện trong timeline.
7. Sửa các trường `Inject input into` (CSS selector của ô prompt) + `Grab output from` (CSS selector của image kết quả).
8. Bấm `▶ TEST REPLAY` để chạy thử lại với data từ upstream.
9. Save workflow → lần sau chỉ cần `RUN WORKFLOW`, không cần đụng tay.

---

## Node Categories (20+ node types)

| Nhóm | Màu | Nodes |
|---|---|---|
| **INPUT** | Xanh dương | Brief · Reference · Moodboard |
| **DIRECTION** | Hồng-cam | Prompt · Style Preset · Camera Script |
| **INTELLIGENCE** | Tím | Merge · Analyzer · Prompt Compiler |
| **AI BRIDGE** | Đỏ rượu | Browser Bridge (record/replay) |
| **GENERATION** | Ngọc | Image Forge · Storyboard · Video Forge · VFX Compositor |
| **ORCHESTRATION** | Bạc | Approval Gate · Loop · Condition · Export · Delivery |

Mở `src/renderer/src/data/nodeDefs.js` để thêm node tùy biến.

---

## Roadmap

**Đã có (MVP v0.1):**
- Electron + React Flow canvas, drag/drop từ library
- 20+ node types với inspector form đầy đủ
- Playwright record/replay end-to-end
- Topological executor với progress + log realtime
- Save/load workflow JSON

**Phase 2 (sắp tới):**
- Director AI chat (local LLM qua Ollama) gợi ý workflow optimization
- Multi-output sockets (named ports) để branch logic phức tạp
- Variant Generator node — chạy parallel batch
- Visual diff cho output detection ổn định hơn
- Marketplace template workflow chia sẻ giữa team

**Phase 3:**
- Multi-user collaboration realtime
- Self-healing replay (AI rebind selector khi UI web tool đổi)
- Plugin SDK cho node custom

---

## Phím tắt

| Key | Action |
|---|---|
| `Space + drag` | Pan canvas |
| `Scroll` | Zoom |
| `Ctrl+S` | Save workflow |
| `Ctrl+O` | Open workflow |
| `Ctrl+R` | Run workflow |
| `Delete` | Xóa node được chọn |
| `Double-click project name` | Rename project |

---

## Troubleshooting

**Playwright báo không có chromium**
```bash
npx playwright install chromium
```

**Cửa sổ browser không hiện**
Check Windows Defender / antivirus không chặn — Playwright cần spawn process chrome.

**Action recorder không capture được click**
Một số site dùng Shadow DOM hoặc iframe — cần thêm logic vào `RECORDER_SCRIPT` trong `src/main/bridge.js`. PR welcome.

---

## License

MIT — Vũ Tiến Minh, 2026.
