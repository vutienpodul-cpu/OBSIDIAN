/**
 * Hướng dẫn chuyên sâu cho từng node type.
 * Hiển thị trong tab GUIDE của Inspector — dành cho người mới.
 */

export const NODE_GUIDES = {

  // ─────────────────────────────────────────────────────────────────────
  url_source: {
    summary: 'Cung cấp địa chỉ website để các node Bridge/Click Sequence biết cần mở trang nào.',
    when: 'Bắt đầu mọi workflow cần tương tác với web tool (Canva, Midjourney, Runway, Sora...).',
    inputs: [],
    outputs: [
      { node: 'Click Sequence', desc: 'URL Source → Click Sequence: truyền URL để mở trước khi bắt đầu click sequence' },
      { node: 'Image Gen / Video Gen', desc: 'URL Source → Gen node: mở tool AI trước khi chạy web task' },
      { node: 'Browser Bridge', desc: 'URL Source → Bridge: truyền URL vào embedded URL' },
    ],
    steps: [
      { title: 'Nhập URL đầy đủ', body: 'Ví dụ: https://www.canva.com/design/new hoặc https://www.midjourney.com/imagine. Phải bắt đầu bằng https://.' },
      { title: 'Thêm ghi chú', body: 'Ghi chú mục đích của URL này. Ví dụ: "Trang tạo design mới trên Canva — dùng cho campaign adidas SS26".' },
      { title: 'Nối sang Click Sequence', body: 'Kéo dây từ chấm phải của URL Source → chấm trái của Click Sequence node.' },
    ],
    usecases: [
      { title: 'Tự động hoá Canva', body: 'URL Source (canva.com/design/new) → Click Sequence (click chọn template → nhập text → export)' },
      { title: 'Batch Midjourney', body: 'URL Source (midjourney.com/imagine) → Click Sequence (click /imagine → paste prompt → send)' },
    ],
    tips: [
      'Mỗi URL Source tương ứng với 1 workflow cụ thể. Không dùng chung URL cho nhiều mục đích khác nhau.',
      'Nếu cần login, mở browser một lần qua Click Sequence → đăng nhập → session tự lưu lại.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  click_seq: {
    summary: 'Ghi lại từng thao tác click trên website theo thứ tự. Bạn tự click từng bước — app học và replay lại.',
    when: 'Khi cần tự động hóa thao tác lặp đi lặp lại trên web tool: nhập text, nhấn nút, chờ kết quả...',
    inputs: [
      { node: 'URL Source', desc: 'Nhận URL website để mở trước khi chạy sequence' },
      { node: 'Prompt Compiler', desc: 'Inject prompt text tự động vào bước "type" trong sequence' },
    ],
    outputs: [
      { node: 'Export', desc: 'Sau khi sequence chạy xong, kết quả được capture và gửi sang Export' },
      { node: 'Approval Gate', desc: 'Tạm dừng để review kết quả trước khi tiếp tục' },
    ],
    steps: [
      { title: 'Mở browser', body: 'Nhấn nút "🌐 OPEN BROWSER" để mở Chromium. Nếu có URL Source nối vào, trang đó sẽ tự mở. Đăng nhập vào website nếu cần — session được lưu mãi mãi.' },
      { title: 'Pick Click 1', body: 'Nhấn "📍 Pick Click 1". Trên browser, di chuột đến element bạn muốn click (nút, ô nhập, menu...) — sẽ thấy highlight đỏ. Click vào element đó.' },
      { title: 'Chọn loại step', body: 'App tự nhận diện: click thường (nút, link) hoặc type (ô nhập text). Với step type, điền giá trị cố định hoặc để "inject" (sẽ lấy từ node upstream).' },
      { title: 'Thêm bước tiếp theo', body: 'Nhấn "➕ Thêm bước" để pick Click 2, 3, 4... Mỗi bước là 1 thao tác. Thứ tự từ trên xuống dưới.' },
      { title: 'Test chạy thử', body: 'Nhấn "▶ RUN TEST" để replay toàn bộ sequence trên browser. Quan sát xem có bước nào lỗi không.' },
      { title: 'Điều chỉnh nếu cần', body: 'Nếu bước nào fail: xóa và pick lại, hoặc đổi type sang "wait" để đợi trang load, hoặc thêm delay.' },
    ],
    usecases: [
      { title: 'Canva: tạo design mới', body: 'Click "Create new" → Click template → Click text box → Type "{prompt}" → Click "Export" → Click "PNG" → Click "Download"' },
      { title: 'Midjourney: generate ảnh', body: 'Click ô chat → Type "/imagine {prompt}" → Press Enter → Wait 60s → Click upscale' },
      { title: 'Runway: tạo video', body: 'Click "New project" → Click "Image to Video" → Click upload → Type prompt → Click Generate → Wait 120s' },
    ],
    tips: [
      'Thêm step "⏳ Wait" (1000–3000ms) sau mỗi click quan trọng để trang kịp load.',
      'Step "type" với value trống = sẽ lấy text từ node Prompt Compiler nối vào.',
      'Selector được lưu lại — nếu website update giao diện, selector có thể fail. Pick lại bước đó.',
      'Session login được lưu trong userData/sessions/{sessionId} — xóa folder để reset login.',
      'Dùng "📋 Copy JSON" để backup sequence, dán lại nếu cần restore.',
    ],
    warning: 'Một số website phát hiện automation và block (Cloudflare, reCAPTCHA). Nếu bị block, thử tắt headless mode hoặc thêm wait dài hơn giữa các bước.',
  },

  // ─────────────────────────────────────────────────────────────────────
  imageGen: {
    summary: 'Web task tạo ảnh AI — ghi chuỗi click trên tool web (Flow AI, v.v.), inject prompt từ node Prompt upstream.',
    when: 'Sau khi import PF flow hoặc khi cần tự động tạo ảnh trên website thay vì gọi API.',
    inputs: [
      { node: 'Prompt', desc: 'Storyboard / ref prompt — inject vào step type khi chạy' },
      { node: 'URL Source', desc: 'URL tool tạo ảnh (optional nếu đã điền Tool URL trong props)' },
      { node: 'Image Upload / ref imageGen', desc: 'Ảnh ref qua upstream items (phase sau: upload step)' },
    ],
    outputs: [
      { node: 'Video Gen', desc: 'Ảnh storyboard → input cho video gen' },
      { node: 'Export', desc: 'Lưu file ảnh đã grab' },
    ],
    steps: [
      { title: 'Điền Tool URL', body: 'Tab props → Tool URL (hoặc nối URL Source). Ví dụ URL trang tạo ảnh trên Flow AI.' },
      { title: 'Tab clicks → Load preset (optional)', body: 'Chọn preset skeleton rồi Pick Click lại từng selector trên browser.' },
      { title: 'Pick Click các bước', body: 'OPEN BROWSER → Pick Click: paste prompt, chọn model, bấm Generate, chờ kết quả.' },
      { title: 'Cấu hình Grab', body: 'Tab props: Grab output from = selector ảnh kết quả. Wait stable nếu cần chờ render.' },
      { title: 'Chạy workflow', body: 'Ctrl+R — node inject prompt từ upstream và replay steps.' },
    ],
    usecases: [
      { title: 'PF ref sheet', body: 'Prompt (character sheet) → Image Gen → Export' },
      { title: 'PF storyboard', body: 'Prompt (grid) → Image Gen → Video Gen' },
    ],
    tips: [
      'Step type với value trống = inject prompt text từ node Prompt nối vào.',
      'Badge NEEDS SETUP = chưa có steps — mở tab clicks và Pick Click.',
      'Model / Aspect chỉ là metadata hiển thị — không gọi API.',
    ],
    warning: 'Phải có ít nhất 1 step trước khi chạy workflow — không còn chế độ manual paste.',
  },

  videoGen: {
    summary: 'Web task tạo video AI — ghi click sequence trên tool web, inject motion prompt từ upstream.',
    when: 'Mỗi shot PF cần gen video trên Flow AI hoặc tool tương tự qua UI.',
    inputs: [
      { node: 'Prompt', desc: 'Video motion prompt — inject vào step type' },
      { node: 'Image Gen', desc: 'Storyboard image qua edge ảnh → video (graph PF)' },
      { node: 'URL Source', desc: 'URL trang tạo video' },
    ],
    outputs: [
      { node: 'Stitcher / Export', desc: 'Clip video output' },
    ],
    steps: [
      { title: 'Tool URL + tab clicks', body: 'Giống Image Gen — ghi flow: upload ảnh, paste motion prompt, Generate, chờ render.' },
      { title: 'Grab video', body: 'Grab output from = selector video/src hoặc download button.' },
      { title: 'RUN TEST', body: 'Test trước khi chạy full workflow nhiều shot.' },
    ],
    usecases: [
      { title: 'PF shot pipeline', body: 'storyboard Image Gen → Video Gen → Stitcher' },
    ],
    tips: [
      'Duration trong props là metadata (4/6/8/10s) — chọn đúng trên UI tool khi Pick Click.',
      'Preset "Flow AI — Video Gen" là khung bước, cần Pick Click lại selector thật.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  brief: {
    summary: 'Nơi nhập yêu cầu thô từ khách hàng. Đây là điểm xuất phát của mọi workflow.',
    when: 'Dùng khi bạn nhận brief từ client hoặc muốn bắt đầu một project mới.',
    inputs: [],
    outputs: [
      { node: 'Merge', desc: 'Kết hợp brief với reference, moodboard → gửi sang Intelligence nodes' },
      { node: 'Prompt Compiler', desc: 'Nếu workflow đơn giản, brief có thể nối thẳng vào Compiler' },
      { node: 'Analyzer', desc: 'Để phân tích intent, tone, từ khoá từ brief' },
    ],
    steps: [
      { title: 'Điền Brief text', body: 'Dán toàn bộ yêu cầu của khách hàng vào đây. Càng chi tiết càng tốt — màu sắc, cảm xúc, đối tượng, nền tảng phát hành.' },
      { title: 'Thêm Tags', body: 'Tags giúp các node downstream lọc context. Ví dụ: "adidas, ss26, hero, instagram" — phân cách bằng dấu phẩy.' },
      { title: 'Nối sang Merge hoặc Analyzer', body: 'Kéo dây từ chấm tròn bên phải của Brief → chấm trái của Merge. Brief thường đi kèm Reference và Moodboard trước khi vào Intelligence.' },
    ],
    usecases: [
      { title: 'Social media campaign', body: 'Brief → Merge (+ Reference) → Analyzer → Compiler → Bridge (Canva) → Export' },
      { title: 'Workflow đơn giản', body: 'Brief → Prompt Compiler → Bridge (Midjourney) → Export' },
    ],
    tips: [
      'Mỗi project nên có 1 Brief node riêng — không dùng chung giữa các campaign.',
      'Viết brief bằng tiếng Anh nếu tool đầu ra là Midjourney/Sora (AI hiểu EN tốt hơn).',
      'Tags quan trọng: thương hiệu, năm, loại content, nền tảng (ig, tiktok, print...).',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  reference: {
    summary: 'Upload ảnh/video tham khảo từ client hoặc internet. Cung cấp visual direction cho workflow.',
    when: 'Khi client gửi mood reference, ảnh competitor, hoặc bạn muốn match style cụ thể.',
    inputs: [],
    outputs: [
      { node: 'Merge', desc: 'Kết hợp visual reference với Brief text' },
      { node: 'Analyzer', desc: 'Để extract màu sắc, style, đặc điểm từ ảnh' },
      { node: 'Moodboard', desc: 'Đưa reference vào moodboard để tổ chức palette' },
    ],
    steps: [
      { title: 'Upload files', body: 'Kéo thả ảnh/video vào ô "Files" — PNG, JPG, MP4 đều được.' },
      { title: 'Thêm ghi chú', body: 'Điền "Note" để giải thích tại sao reference này quan trọng. VD: "Client muốn tone tương tự ảnh #3 — dark moody, không flash".' },
      { title: 'Nối sang Merge', body: 'Reference → Merge → (cùng với Brief và Moodboard).' },
    ],
    usecases: [
      { title: 'Client có sẵn mood board', body: 'Reference (upload ảnh client) → Merge → Analyzer → Compiler → Bridge' },
    ],
    tips: [
      'Upload 3–8 ảnh reference là optimal — quá nhiều sẽ gây loãng direction.',
      'Ghi chú cụ thể: "Học theo màu sắc ảnh 1, bố cục ảnh 2, lighting ảnh 3".',
    ],
    warning: 'File upload chỉ lưu path trên máy. Nếu di chuyển project sang máy khác, cần re-upload.',
  },

  // ─────────────────────────────────────────────────────────────────────
  moodboard: {
    summary: 'Định nghĩa palette màu và mood tổng thể của project. Ảnh hưởng đến toàn bộ output.',
    when: 'Dùng cho mọi project có visual output — ảnh, video, design.',
    inputs: [
      { node: 'Reference', desc: 'Reference cung cấp ảnh nguồn để extract palette' },
    ],
    outputs: [
      { node: 'Merge', desc: 'Moodboard data kết hợp với Brief và Reference' },
      { node: 'Style Preset', desc: 'Moodboard → Style Preset → Compiler cho consistency cao' },
    ],
    steps: [
      { title: 'Palette hint', body: 'Mô tả palette bằng ngôn ngữ — "Earth · Mocha · Ivory" hoặc hex codes "#2D1B0E · #8B6B3F". Node downstream sẽ đưa palette này vào prompt.' },
      { title: 'Mood', body: 'Từ khoá cảm xúc: "Editorial · Aspirational" hoặc "Gritty · Urban · Raw". 2–3 từ là đủ.' },
    ],
    usecases: [
      { title: 'Brand consistency', body: 'Thêm 1 Moodboard node cho toàn bộ workflow của 1 brand. Tất cả output sẽ giữ màu nhất quán.' },
      { title: 'Seasonal campaign', body: 'Đổi Moodboard khi chuyển season — SS26 dùng "Warm Earth", FW26 dùng "Dark Forest".' },
    ],
    tips: [
      'Palette hint: ghi tên màu thay vì hex code nếu dùng với AI tools — AI hiểu "Warm Ivory" hơn "#F5ECD7".',
      'Mood = cảm xúc + phong cách. "Cinematic Dark" khác "Dark Moody" — càng cụ thể càng tốt.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  prompt: {
    summary: 'Nhập prompt nghệ thuật thủ công — style direction bằng ngôn ngữ kỹ thuật.',
    when: 'Khi bạn đã biết chính xác style muốn tạo, hoặc muốn override direction từ AI.',
    inputs: [
      { node: 'Brief', desc: 'Brief cung cấp context; Prompt node bổ sung style technique cụ thể' },
    ],
    outputs: [
      { node: 'Prompt Compiler', desc: 'Prompt text được Compiler format theo từng tool (MJ, Sora...)' },
      { node: 'Browser Bridge', desc: 'Nếu workflow đơn giản, nối thẳng Prompt → Bridge' },
    ],
    steps: [
      { title: 'Viết Prompt text', body: 'Dùng ngôn ngữ kỹ thuật của tool đích: "cinematic, 8K, golden hour, anamorphic lens, --ar 16:9 --v 6.1" cho Midjourney. "Slow zoom in, shallow DOF, film grain" cho video tools.' },
      { title: 'Chọn Language', body: 'Chọn EN nếu dùng Midjourney/Sora/Runway. Chọn VI nếu dùng các tool hỗ trợ tiếng Việt.' },
    ],
    usecases: [
      { title: 'Style lock', body: 'Có 1 Prompt node với style cố định → nối vào Compiler. Mọi output sẽ giữ style này dù brief thay đổi.' },
      { title: 'A/B test', body: 'Tạo 2 Prompt nodes với style khác nhau → 2 Compiler → 2 Bridge → Approval Gate để compare.' },
    ],
    tips: [
      'Midjourney keywords hiệu quả: "cinematic, volumetric light, shot on ARRI, anamorphic, --ar 16:9 --v 6.1 --style raw"',
      'Sora/Runway: mô tả camera movement cụ thể — "slow push in", "orbit left to right", "handheld shaky".',
      'Tách phong cách khỏi nội dung: Brief chứa nội dung (sản phẩm, brand), Prompt chứa style (kỹ thuật, ánh sáng).',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  style: {
    summary: 'Áp dụng preset style có sẵn — thay vì viết prompt từ đầu, chọn từ thư viện style đã được tối ưu.',
    when: 'Khi muốn đảm bảo consistency về visual style mà không cần viết prompt kỹ thuật.',
    inputs: [],
    outputs: [
      { node: 'Prompt Compiler', desc: 'Style data merge vào Compiler để build prompt hoàn chỉnh' },
      { node: 'Merge', desc: 'Kết hợp Style với Brief/Reference trước khi đến Intelligence' },
    ],
    steps: [
      { title: 'Chọn Preset', body: '"Tech-Noir Pro" = tối, cinematic, metallic. "Luxury Editorial" = clean, bright, high-fashion. "Brutalist" = raw, concrete, angular. "Cinematic" = film look, color grade. "Minimalist" = white space, simple.' },
      { title: 'Điều chỉnh Strength', body: '0.85 = style rất đậm. 0.5 = blend 50/50 với brief. 0.3 = style nhẹ, brief chiếm ưu thế. Bắt đầu với 0.75 và điều chỉnh.' },
    ],
    usecases: [
      { title: 'Brand kit', body: 'Lock Style Preset cho 1 brand → tất cả workflow của brand đó đều dùng chung Style node.' },
    ],
    tips: [
      'Strength > 0.9: output sẽ rất style-heavy, đôi khi mất nội dung brief. Giữ dưới 0.9 cho brand work.',
      'Combine 2 Style nodes bằng cách nối cả hai vào Merge → Compiler. Ví dụ: Tech-Noir (0.6) + Cinematic (0.4).',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  camera: {
    summary: 'Định nghĩa shot list và camera movement cho video content.',
    when: 'Chỉ dùng khi output là video — Sora, Runway, Kling, hoặc storyboard.',
    inputs: [],
    outputs: [
      { node: 'Prompt Compiler', desc: 'Camera script được compile thành video prompt kỹ thuật' },
      { node: 'Storyboard', desc: 'Camera → Storyboard để visualize shot list trước khi generate video' },
    ],
    steps: [
      { title: 'Số shots', body: 'Một video 30s thường cần 8–12 shots. Mỗi shot ~3–4 giây. TVC 15s = 5–6 shots.' },
      { title: 'Motion type', body: '"Pan" = quay ngang. "Orbit" = vòng quanh sản phẩm (tốt cho product shot). "Crane" = từ thấp lên cao (dramatic). "Tilt" = ngẩng/cúi máy. "Morph" = biến hình (dùng với Sora). "Static" = cố định (phù hợp dialog).' },
    ],
    usecases: [
      { title: 'Product hero video', body: 'Camera (Orbit, 8 shots) → Compiler → Bridge (Sora) → VFX → Export' },
      { title: 'Social reel', body: 'Camera (Pan, 5 shots) → Compiler → Bridge (Kling) → Export' },
    ],
    tips: [
      'Orbit motion + 4–6 shots = classic product video formula, hiệu quả nhất cho e-commerce.',
      'Morph chỉ hoạt động tốt với Sora — Runway và Kling không handle morph tốt.',
    ],
    warning: 'Camera node chỉ có tác dụng nếu downstream là Video Forge hoặc Storyboard. Với ảnh tĩnh, bỏ node này.',
  },

  // ─────────────────────────────────────────────────────────────────────
  merge: {
    summary: 'Gộp nhiều luồng dữ liệu thành 1 — như "nút giao" của workflow.',
    when: 'Khi cần kết hợp Brief + Reference + Moodboard trước khi đưa vào Intelligence nodes.',
    inputs: [
      { node: 'Brief', desc: 'Text yêu cầu từ client' },
      { node: 'Reference', desc: 'Visual references' },
      { node: 'Moodboard', desc: 'Palette và mood direction' },
      { node: 'Style Preset', desc: 'Style data' },
    ],
    outputs: [
      { node: 'Analyzer', desc: 'Merge → Analyzer để extract thêm thông tin từ combined context' },
      { node: 'Prompt Compiler', desc: 'Merge output có thể nối thẳng vào Compiler nếu không cần phân tích' },
    ],
    steps: [
      { title: 'Chọn Strategy', body: '"structured" = gộp thành JSON có cấu trúc (khuyên dùng). "concat" = nối text đơn giản. "priority" = ưu tiên input đầu tiên khi conflict.' },
      { title: 'Kết nối inputs', body: 'Kéo dây từ các node muốn merge VÀO chấm trái của Merge. Tối đa 4–5 inputs là optimal.' },
    ],
    usecases: [
      { title: 'Full campaign workflow', body: 'Brief + Reference + Moodboard + Style → Merge → Analyzer → Compiler' },
      { title: 'Merge 2 compiler outputs', body: 'Compiler A + Compiler B → Merge → Bridge (nếu tool nhận nhiều prompt)' },
    ],
    tips: [
      'Strategy "structured" tạo JSON — Compiler biết phân biệt brief_text vs reference_files vs palette.',
      'Không cần Merge nếu workflow chỉ có 1 luồng đơn — Brief → Compiler là đủ.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  analyzer: {
    summary: 'Phân tích context và extract thông tin — intent, tone, từ khoá, màu sắc, đặc điểm visual.',
    when: 'Dùng khi brief/reference phức tạp và cần "tiêu hoá" trước khi đưa vào Compiler.',
    inputs: [
      { node: 'Merge', desc: 'Toàn bộ context từ Brief + Reference + Moodboard sau khi được merge' },
      { node: 'Brief', desc: 'Nếu workflow đơn giản, Brief thẳng vào Analyzer' },
    ],
    outputs: [
      { node: 'Prompt Compiler', desc: 'Analyzer output cung cấp extracted data cho Compiler' },
    ],
    steps: [
      { title: 'Cấu hình Extract fields', body: 'Thêm/bớt fields cần extract: "intent" (mục tiêu campaign), "tone" (formal/playful/dark...), "keywords" (từ khoá mạnh), "color_palette" (màu detect từ reference), "target_audience" (đối tượng).' },
      { title: 'Đọc output', body: 'Sau khi chạy, click tab OUTPUT để xem Analyzer đã extract được gì. Nếu thiếu, thêm field rồi chạy lại.' },
    ],
    usecases: [
      { title: 'Phức tạp', body: 'Brief + Reference → Merge → Analyzer (extract 5 fields) → Compiler' },
      { title: 'Nhanh', body: 'Brief → Compiler (bỏ qua Analyzer nếu brief đã rõ ràng)' },
    ],
    tips: [
      'Fields hữu ích nhất: intent, tone, keywords, color_palette, target_audience.',
      'Nếu brief tiếng Việt: thêm field "translated_brief" để Analyzer convert sang EN trước khi Compiler xử lý.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  compiler: {
    summary: 'Trung tâm xử lý — nhận mọi context và build ra prompts tối ưu cho từng AI tool cụ thể.',
    when: 'Bắt buộc có trong mọi workflow có AI generation. Là "bộ não" của pipeline.',
    inputs: [
      { node: 'Brief', desc: 'Yêu cầu thô' },
      { node: 'Analyzer', desc: 'Extracted context đã phân tích' },
      { node: 'Merge', desc: 'Combined context từ nhiều sources' },
      { node: 'Prompt', desc: 'Style direction thủ công' },
      { node: 'Style Preset', desc: 'Style data' },
      { node: 'Camera Script', desc: 'Camera/motion direction (nếu output là video)' },
    ],
    outputs: [
      { node: 'Browser Bridge', desc: 'Compiled prompt được inject vào AI tool' },
      { node: 'Image Forge / Video Forge', desc: 'Generation nodes nhận prompt từ Compiler' },
    ],
    steps: [
      { title: 'Chọn Targets', body: 'Thêm tên các tool bạn sẽ dùng: "midjourney", "sora", "runway", "canva", "kling", "higgsfield". Compiler sẽ format prompt theo syntax của từng tool.' },
      { title: 'Số Variants', body: 'Mặc định 8 — tức là Compiler tạo 8 variation của prompt. Mỗi variation nhấn mạnh khía cạnh khác nhau. Với workflow nhanh: đặt 1–3.' },
    ],
    usecases: [
      { title: 'Multi-tool output', body: 'Compiler (targets: midjourney, sora, canva) → 3 Bridge nodes song song → Approval Gate' },
      { title: 'Batch generation', body: 'Compiler (8 variants) → Loop (8 iterations) → Bridge → Export' },
    ],
    tips: [
      'Targets ảnh hưởng lớn đến syntax output: Midjourney cần "--ar", "--v 6.1"; Sora cần mô tả temporal; Canva cần keywords ngắn.',
      'Variants = 1: Compiler chỉ tạo 1 prompt tốt nhất. Dùng khi đã tin tưởng vào brief.',
      'Variants = 8+: Compiler tạo nhiều góc nhìn — tốt để thử nghiệm và chọn lọc.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  bridge: {
    summary: 'Trái tim của OBSIDIAN — mở browser thật, record thao tác của bạn, rồi replay tự động với data từ upstream.',
    when: 'Khi cần tương tác với bất kỳ web tool nào: Canva, Midjourney, Runway, Sora, Kling, Higgsfield...',
    inputs: [
      { node: 'Prompt Compiler', desc: 'Compiled prompt được inject vào input field đã record' },
      { node: 'Storyboard', desc: 'Storyboard data → inject vào video tool' },
      { node: 'Brief/Prompt', desc: 'Text đơn giản → inject trực tiếp (workflow không cần Compiler)' },
    ],
    outputs: [
      { node: 'Approval Gate', desc: 'Output chờ review trước khi tiếp tục' },
      { node: 'Storyboard', desc: 'Ảnh output từ Midjourney → Storyboard để arrange' },
      { node: 'VFX Compositor', desc: 'Raw output → VFX để polish' },
      { node: 'Export', desc: 'Output → Export thẳng nếu không cần review' },
    ],
    steps: [
      { title: 'Bước 1 — Nhập URL', body: 'Tab PROPERTIES → "Embedded URL". Ví dụ: https://www.midjourney.com/imagine, https://www.canva.com/design/new, https://app.runway.com' },
      { title: 'Bước 2 — Mở Browser', body: 'Tab RECORDING → "OPEN BROWSER". Cửa sổ Chromium headful sẽ mở. Đây là browser thật — login bình thường. Session được lưu lại vĩnh viễn.' },
      { title: 'Bước 3 — Login', body: 'Đăng nhập tài khoản Google hoặc tài khoản tool. Chỉ cần làm 1 lần duy nhất.' },
      { title: 'Bước 4 — Record', body: 'Nhấn "START RECORDING" → thực hiện toàn bộ thao tác bình thường: điền prompt, click Generate, đợi xong, click Upscale, copy link... Nhấn "STOP RECORDING" khi xong.' },
      { title: 'Bước 5 — Cấu hình inject', body: 'Tab PROPERTIES → "Inject input into": nhập CSS selector của ô input trên website. Ví dụ: textarea[data-testid="prompt-input"] cho Midjourney. Đây là nơi workflow sẽ tự điền prompt.' },
      { title: 'Bước 6 — Cấu hình grab', body: '"Grab output from": CSS selector của ảnh/video kết quả. Ví dụ: .grid-result img cho Midjourney. "Grab attribute": chọn "src" để lấy URL ảnh.' },
      { title: 'Bước 7 — Test Replay', body: 'Nhấn "TEST REPLAY" để chạy thử với data mẫu. Nếu thấy browser tự thao tác đúng → workflow sẵn sàng.' },
    ],
    usecases: [
      { title: 'Midjourney automation', body: 'Inject prompt → tự click Imagine → đợi ảnh generate → tự Upscale → grab URL → pass sang Export.' },
      { title: 'Canva design batch', body: 'Mở template → inject text vào text field → thay màu → download PNG.' },
      { title: 'Runway video gen', body: 'Upload image → inject motion prompt → click Generate → đợi render → grab video URL.' },
    ],
    tips: [
      'CSS Selector quan trọng nhất: dùng DevTools (F12 → click element → Copy selector) để lấy selector chính xác.',
      'Selector không ổn định? Dùng XPath hoặc text-based: text="Generate" thay vì class.',
      'Nếu tool đổi giao diện: record lại — chỉ mất 2 phút.',
      'Replay mode "Hybrid" = app tự chạy nhưng dừng lại chờ bạn confirm những bước quan trọng. Tốt cho lần đầu.',
      'Tab ACCOUNTS: assign nhiều tài khoản để tự rotate khi hết credit.',
    ],
    warning: 'Một số website phát hiện automation và chặn. Nếu bị block: thêm delay giữa actions (trong recorded actions, edit thêm "wait" steps), hoặc dùng mode "Manual" lần đầu để xem website phản ứng.',
  },

  // ─────────────────────────────────────────────────────────────────────
  image_forge: {
    summary: 'Node generation ảnh pre-configured — wrapper của Bridge node dành riêng cho image tools.',
    when: 'Khi muốn generate ảnh nhanh mà không cần setup Bridge từ đầu. Engine phổ biến: Midjourney, Higgsfield.',
    inputs: [
      { node: 'Prompt Compiler', desc: 'Compiled prompt được đưa vào engine' },
      { node: 'Style Preset', desc: 'Style data ảnh hưởng đến output' },
    ],
    outputs: [
      { node: 'Approval Gate', desc: 'Ảnh chờ review' },
      { node: 'Storyboard', desc: 'Ảnh → arrange thành storyboard' },
      { node: 'VFX Compositor', desc: 'Ảnh → xử lý VFX' },
      { node: 'Export', desc: 'Ảnh → Export thẳng' },
    ],
    steps: [
      { title: 'Chọn Engine', body: 'Midjourney: chất lượng cao nhất, phổ biến nhất. Higgsfield: chuyên fashion/lifestyle. Flux: tốc độ nhanh. Stable Diffusion XL: local, không cần tài khoản.' },
      { title: 'Aspect ratio', body: '16:9 = landscape/YouTube. 9:16 = Reels/TikTok/Story. 1:1 = Instagram square. 2.39:1 = cinematic widescreen.' },
      { title: 'Variants', body: 'Số lượng ảnh generate mỗi lần chạy. 4 là default Midjourney. Tăng lên 8–16 nếu cần nhiều option để chọn.' },
    ],
    usecases: [
      { title: 'Product photography', body: 'Brief → Compiler → Image Forge (Midjourney, 16:9, 4 variants) → Approval → Export' },
    ],
    tips: [
      'Image Forge thực ra cần được paired với Browser Bridge để hoạt động — nó là shortcut để setup nhanh.',
      'Higgsfield đặc biệt tốt cho: người thật, thời trang, lifestyle — realism cao hơn MJ.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  storyboard: {
    summary: 'Sắp xếp ảnh thành sequence có cấu trúc — cơ sở để generate video coherent.',
    when: 'Bắt buộc dùng khi pipeline có video output. Storyboard → Video Forge đảm bảo video có narrative.',
    inputs: [
      { node: 'Image Forge / Browser Bridge', desc: 'Ảnh generated từ upstream làm nền cho từng panel' },
      { node: 'Camera Script', desc: 'Camera movement được áp dụng vào từng panel' },
    ],
    outputs: [
      { node: 'Video Forge / Browser Bridge (Sora/Runway)', desc: 'Storyboard sequence → generate video có nhân quả' },
      { node: 'Export', desc: 'Export storyboard PDF để present với client' },
    ],
    steps: [
      { title: 'Chọn Aspect ratio', body: '2.39:1 = cinematic widescreen (TVC). 16:9 = YouTube/landscape. 9:16 = vertical video (mobile).' },
      { title: 'Auto annotate', body: 'Bật ON để hệ thống tự thêm shot number, camera note, timing vào mỗi panel. Tắt nếu bạn muốn clean layout cho client presentation.' },
    ],
    usecases: [
      { title: 'TVC production', body: 'Image Forge (8 ảnh) → Storyboard → Approval (client review layout) → Video Forge → VFX → Export' },
      { title: 'Client presentation', body: 'Generate storyboard → Export (PPTX) → gửi client xem và approve trước khi render video tốn kém.' },
    ],
    tips: [
      'Luôn có Approval Gate sau Storyboard nếu workflow đắt tiền (video render mất nhiều credit). Client approve storyboard trước, tránh redo.',
      'Annotate OFF khi export cho client, ON khi dùng nội bộ để track shots.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  video_forge: {
    summary: 'Generate video từ prompt hoặc ảnh. Engine phổ biến: Sora, Runway, Kling.',
    when: 'Output cuối cùng là video — TVC, Reels, YouTube.',
    inputs: [
      { node: 'Storyboard', desc: 'Storyboard sequence → video có narrative' },
      { node: 'Prompt Compiler', desc: 'Compiled video prompt' },
      { node: 'Image Forge', desc: 'Ảnh key frame → video mở rộng từ ảnh đó' },
    ],
    outputs: [
      { node: 'VFX Compositor', desc: 'Raw video → thêm effects' },
      { node: 'Export', desc: 'Video → Export MP4/ProRes' },
      { node: 'Approval Gate', desc: 'Video chờ review' },
    ],
    steps: [
      { title: 'Chọn Engine', body: 'Sora: quality cao nhất (OpenAI), tốt cho cinematic. Runway Gen-3: reliable, UI tốt, dễ dùng. Kling: tốc độ nhanh, giá rẻ hơn. Hailuo: tốt cho realistic human motion.' },
      { title: 'Duration', body: '5 giây: mỗi clip Sora/Runway. Ghép nhiều clips để ra video dài hơn. Kling có thể gen 10 giây/clip.' },
    ],
    usecases: [
      { title: 'Hero film 30s', body: 'Camera (6 shots) → Compiler → Video Forge (Sora, 5s) → Loop (6) → VFX → Export (ProRes 4K)' },
      { title: 'Social reel 15s', body: 'Prompt → Video Forge (Kling, 5s) → Loop (3) → Export (MP4)' },
    ],
    tips: [
      'Sora: viết prompt mô tả chi tiết temporal — "camera slowly pushes in as subject turns, background bokeh intensifies".',
      'Runway: image-to-video tốt hơn text-to-video. Generate ảnh từ Midjourney trước, rồi dùng làm key frame cho Runway.',
      'Kling: "motion brush" feature rất mạnh — record vùng muốn move, phần còn lại static.',
    ],
    warning: 'Video generation tốn nhiều credit nhất. Luôn có Approval Gate sau Storyboard để client approve trước khi render.',
  },

  // ─────────────────────────────────────────────────────────────────────
  vfx: {
    summary: 'Thêm visual effects vào ảnh/video: particles, lens flare, camera motion blur, compositing.',
    when: 'Bước finish cuối cùng trước Export — để nâng cấp output từ "AI generated" lên "production ready".',
    inputs: [
      { node: 'Video Forge', desc: 'Raw AI video cần polish' },
      { node: 'Image Forge', desc: 'Ảnh AI cần VFX để thêm depth' },
      { node: 'Storyboard', desc: 'Composite nhiều panels' },
    ],
    outputs: [
      { node: 'Export', desc: 'VFX output → Export final' },
      { node: 'Approval Gate', desc: 'VFX version chờ final approval' },
    ],
    steps: [
      { title: 'Chọn Particles', body: 'Dust = organic, cinematic feel. Lens flare = dramatic, expensive look. Rain = mood, atmosphere. Snow = seasonal. Bokeh = shallow depth. Thêm nhiều particles bằng dấu phẩy.' },
      { title: 'Camera motion', body: 'Bật ON để thêm subtle camera shake + handheld feel vào video tĩnh. Làm cho AI video trông natural hơn.' },
    ],
    usecases: [
      { title: 'Cinematic product video', body: 'Video Forge → VFX (Dust + Lens flare, Camera motion ON) → Export (ProRes 4K)' },
    ],
    tips: [
      'Dust + Lens flare = combo kinh điển cho product video cao cấp.',
      'Camera motion ON quan trọng: AI video thường quá smooth/sterile. Thêm nhẹ camera shake → trông như quay thật.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  approval: {
    summary: 'Điểm dừng để review trước khi tiếp tục — tránh lãng phí tài nguyên vào output sai.',
    when: 'Đặt trước những bước tốn kém (video render, bulk generation) và khi cần client/team review.',
    inputs: [
      { node: 'Image Forge / Storyboard / Video Forge / Browser Bridge', desc: 'Bất kỳ output nào cần review' },
    ],
    outputs: [
      { node: 'Tiếp tục pipeline', desc: 'Sau khi approve, workflow tiếp tục xuống các node phía sau' },
    ],
    steps: [
      { title: 'Chọn Notify channel', body: '"None" = workflow tự dừng, bạn mở app để approve. "Slack" = gửi notification vào Slack khi cần review. "Email" = gửi email. "Both" = cả hai.' },
      { title: 'Cách approve', body: 'Khi workflow dừng tại Approval Gate: mở tab OUTPUT của node → xem kết quả → nhấn APPROVE hoặc REJECT. Reject sẽ loop lại node trước đó.' },
    ],
    usecases: [
      { title: 'Client approval flow', body: 'Storyboard → Approval Gate (Slack) → Video Forge — Khi storyboard xong, Slack nhắc team/client review. Video chỉ render sau khi được approve.' },
      { title: 'Internal QC', body: 'Image Forge → Approval Gate (None) → Export — Bạn tự check output trước khi export.' },
    ],
    tips: [
      'Approval Gate KHÔNG tốn thêm credit — chỉ là checkpoint logic.',
      'Đặt 2 Approval Gates trong workflow dài: 1 sau Storyboard (direction approval) + 1 sau Video (final approval).',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  loop: {
    summary: 'Chạy lặp lại một đoạn workflow nhiều lần — để batch generate nhiều variants.',
    when: 'Khi cần tạo nhiều phiên bản của cùng một output (8 ảnh, 4 video clips, 5 social posts...).',
    inputs: [
      { node: 'Bất kỳ node nào', desc: 'Nhận input từ node trước đó trong pipeline' },
    ],
    outputs: [
      { node: 'Browser Bridge', desc: 'Loop chạy Bridge node N lần với N prompt variants' },
      { node: 'Export', desc: 'Collect tất cả outputs sau N iterations' },
    ],
    steps: [
      { title: 'Số iterations', body: 'Đặt bằng số lượng output cần tạo. 4 = 4 ảnh. 8 = 8 ảnh. Mỗi iteration nhận prompt variant khác nhau từ Compiler (nếu Compiler tạo 8 variants thì Loop = 8).' },
    ],
    usecases: [
      { title: 'Batch 8 ảnh', body: 'Compiler (8 variants) → Loop (8) → Bridge (Midjourney) → collect 8 ảnh → Approval' },
      { title: '5 social posts', body: 'Compiler (5 variants) → Loop (5) → Bridge (Canva) → Export (5 PNG)' },
    ],
    tips: [
      'Loop count nên bằng với Compiler variants count để đảm bảo mỗi iteration có prompt riêng.',
      'Loop không chạy song song — tuần tự từng iteration. Không tăng tốc workflow, chỉ giúp tự động batch.',
    ],
    warning: 'Nhiều iterations = nhiều lần Bridge chạy = nhiều credit consumed. Tính toán credit trước khi đặt Loop count cao.',
  },

  // ─────────────────────────────────────────────────────────────────────
  condition: {
    summary: 'Rẽ nhánh logic — If/Else để workflow đi theo hướng khác nhau tùy điều kiện.',
    when: 'Khi cần xử lý các trường hợp khác nhau: output đạt tiêu chuẩn thì tiếp tục, không đạt thì redo.',
    inputs: [
      { node: 'Approval Gate', desc: 'Approve/Reject từ Gate kích hoạt Condition' },
      { node: 'Loop', desc: 'Condition check kết quả sau mỗi iteration' },
    ],
    outputs: [
      { node: 'True branch', desc: 'Nếu condition đúng → tiếp tục pipeline' },
      { node: 'False branch', desc: 'Nếu condition sai → redo, alternate path, hoặc kết thúc' },
    ],
    steps: [
      { title: 'Viết Expression', body: 'JavaScript expression return boolean. Ví dụ: output.length > 0 (có output), output[0].score > 0.8 (quality check), currentIteration < 3 (chạy tối đa 3 lần).' },
    ],
    usecases: [
      { title: 'Quality gate', body: 'Bridge → Condition (output.length >= 4) → True: Export | False: re-run Bridge' },
    ],
    tips: [
      'Condition node nâng cao — dùng sau khi đã quen với workflow cơ bản.',
      'Đơn giản nhất: output.length > 0 — kiểm tra xem có output không.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  export: {
    summary: 'Xuất output ra file — PNG, MP4, ProRes, PSD, PPTX, hoặc GLB (3D).',
    when: 'Cuối mọi workflow. Là điểm kết thúc của pipeline.',
    inputs: [
      { node: 'VFX Compositor', desc: 'Final polished output' },
      { node: 'Video Forge', desc: 'Raw video output' },
      { node: 'Storyboard', desc: 'Export storyboard PDF' },
      { node: 'Browser Bridge', desc: 'Bất kỳ output nào từ web tools' },
    ],
    outputs: [
      { node: 'Delivery', desc: 'Export → Delivery để gửi cho client' },
    ],
    steps: [
      { title: 'Chọn Format', body: '"PNG sequence" = ảnh riêng lẻ. "MP4 (H.265)" = video nén tốt cho web. "ProRes 4K" = video chất lượng cao cho post-production. "PSD" = Photoshop editable. "PPTX" = PowerPoint cho client deck. "GLB" = 3D asset.' },
      { title: 'Output folder', body: 'Nhập đường dẫn thư mục lưu. Ví dụ: C:\\Projects\\ClientName\\Deliverables. Để trống = app sẽ hỏi khi export.' },
    ],
    usecases: [
      { title: 'Ảnh cho web', body: '→ Export (PNG sequence, output/images/)' },
      { title: 'Video cho social', body: '→ Export (MP4 H.265)' },
      { title: 'Master file', body: '→ Export (ProRes 4K) cho editor xử lý tiếp' },
      { title: 'Client deck', body: '→ Export (PPTX) → Delivery (Email)' },
    ],
    tips: [
      'ProRes 4K: chỉ dùng khi cần edit sau. File size rất lớn (1–10GB). Web → dùng MP4 H.265.',
      'Nên có cả 2: Export (MP4) → Delivery (client) + Export (ProRes) → local backup.',
    ],
    warning: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  delivery: {
    summary: 'Gửi output cho client hoặc team — Google Drive, Dropbox, Email, Slack.',
    when: 'Cuối workflow sau Export. Tự động gửi deliverable mà không cần copy-paste thủ công.',
    inputs: [
      { node: 'Export', desc: 'File đã export sẵn sàng gửi đi' },
    ],
    outputs: [],
    steps: [
      { title: 'Chọn Target', body: '"Google Drive" = upload vào folder đã chỉ định. "Dropbox" = upload. "Email" = gửi email kèm link. "Slack" = post vào channel.' },
      { title: 'Message', body: 'Tin nhắn đi kèm deliverable. Ví dụ: "Hero film v1 đã sẵn sàng, anh/chị review và feedback trước thứ 6 nhé."' },
    ],
    usecases: [
      { title: 'Client delivery', body: 'Export → Delivery (Google Drive + Email): upload Drive, gửi email link cho client.' },
      { title: 'Team review', body: 'Export → Delivery (Slack): post lên channel #review để team xem và comment.' },
    ],
    tips: [
      'Delivery đến Google Drive cần setup Google auth lần đầu — tương tự Bridge node, chỉ login 1 lần.',
      'Message nên include: tên project, version number, deadline review.',
    ],
    warning: 'Chức năng Delivery đến cloud cần Browser Bridge setup riêng cho từng platform (Drive, Dropbox). Xem phần Bridge.',
  },
};

// ─── Fallback guide cho node chưa có guide ──────────────────────────────
export function getGuide(kind) {
  return NODE_GUIDES[kind] || {
    summary: `Node "${kind}" — xem Properties tab để cấu hình.`,
    when: 'Xem documentation hoặc liên hệ support để biết thêm về node này.',
    inputs: [],
    outputs: [],
    steps: [],
    usecases: [],
    tips: ['Kéo dây từ chấm tròn phải → nối với node downstream.'],
    warning: null,
  };
}
