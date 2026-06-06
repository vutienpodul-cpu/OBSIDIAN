/**
 * Workflow templates for OBSIDIAN.
 * Each template is a ready-to-use workflow the user can load from the gallery.
 */
import { defaultDataFor } from './data/nodeDefs.js';

const N = (id, kind, x, y, overrides = {}) => ({
  id, type: 'obsidian', position: { x, y },
  data: { ...defaultDataFor(kind), ...overrides }
});

const E = (s, t, animated = false) => ({ id: `e_${s}_${t}`, source: s, target: t, animated });

// ─── Template 1: Adidas Hero Film (original demo) ─────────────────────────
export function tplHeroFilm() {
  return {
    name: 'Adidas Spring Campaign — Hero Film',
    desc: 'Pipeline đầy đủ từ brief đến video final. Midjourney → Sora → VFX → Export.',
    tags: ['Video', 'Film', 'Advanced'],
    nodes: [
      N('n1',  'brief',       80,   120, { text: 'Adidas SS26 Hero film — Boost Pro running shoe launch. Target: youth athletes, urban Tokyo at dawn.', tags: ['adidas','ss26','hero'] }),
      N('n2',  'reference',   80,   340, { note: '12 references curated', files: [] }),
      N('n3',  'moodboard',   80,   560, { palette: 'Mocha · Earth · Brass', mood: 'Editorial · Aspirational' }),
      N('n4',  'prompt',      380,  120, { text: 'Hero film 30s, cinematic Tech-Noir aesthetic, slow motion morphing shots, product as protagonist.', lang: 'EN' }),
      N('n5',  'style',       380,  340, { preset: 'Tech-Noir Pro', strength: 0.85 }),
      N('n6',  'camera',      380,  560, { shots: 8, motion: 'Orbit' }),
      N('n7',  'merge',       680,  280, { strategy: 'structured' }),
      N('n8',  'analyzer',    680,  480, { extract: ['intent','tone','keywords','color_palette'] }),
      N('n9',  'compiler',    960,  380, { targets: ['midjourney','sora','runway'], variants: 8 }),
      N('n10', 'bridge',     1260,  200, {
        url: 'https://www.midjourney.com/imagine',
        mode: 'Hybrid',
        injectInto: "textarea[data-testid='prompt-input']",
        grabFrom: '.grid-result img.upscaled',
        grabAttr: 'src',
        waitFor: '.grid-result',
        timeout: 180,
      }),
      N('n11', 'approval',   1260,  440, { channel: 'Slack' }),
      N('n12', 'storyboard', 1560,  200, { aspect: '2.39:1', annotate: true }),
      N('n13', 'bridge',     1560,  440, {
        url: 'https://sora.com',
        mode: 'Hybrid',
        injectInto: "textarea[placeholder='Describe your video']",
        grabFrom: 'video source',
        grabAttr: 'src',
      }),
      N('n14', 'vfx',        1860,  320, { particles: ['Dust','Lens flare'], motion_cam: true }),
      N('n15', 'export',     2160,  240, { format: 'MP4 (H.265)', path: '' }),
      N('n16', 'delivery',   2160,  440, { target: 'Google Drive', message: 'Hero film v1 — please review.' }),
    ],
    edges: [
      E('n1','n7'), E('n2','n7'), E('n3','n7'),
      E('n4','n9'), E('n5','n9'), E('n6','n9'),
      E('n7','n9'), E('n8','n9'), E('n7','n8'),
      E('n9','n10'), E('n9','n11'), E('n10','n11'),
      E('n11','n12'), E('n11','n13'),
      E('n12','n14'), E('n13','n14'),
      E('n14','n15'), E('n15','n16'),
    ]
  };
}

// ─── Template 2: Social Media Content Machine ────────────────────────────
export function tplSocialMedia() {
  return {
    name: 'Social Media Content Machine',
    desc: 'Nhập brief của khách hàng → tự động tạo ảnh Canva hàng loạt → export và gửi.',
    tags: ['Social', 'Canva', 'Beginner'],
    nodes: [
      N('s1', 'brief',    80,  200, {
        text: 'Tạo 5 bài đăng Instagram cho thương hiệu cà phê. Tone: ấm áp, artisan. Màu chủ đạo: nâu đất và kem.',
        tags: ['social','instagram','cafe']
      }),
      N('s2', 'style',    80,  420, { preset: 'Luxury Editorial', strength: 0.75 }),
      N('s3', 'prompt',   380, 200, {
        text: 'Minimalist coffee flat lay, warm earth tones, ceramic mug, natural light, instagram square format',
        lang: 'EN'
      }),
      N('s4', 'compiler', 380, 420, { targets: ['midjourney','canva'], variants: 5 }),
      N('s5', 'bridge',   700, 200, {
        url: 'https://www.canva.com/design/new',
        mode: 'Hybrid',
        label: 'Canva Designer',
        injectInto: "input[data-placeholder='Search templates']",
        grabFrom: '.design-preview img',
        grabAttr: 'src',
        timeout: 120,
      }),
      N('s6', 'loop',     700, 420, { count: 5 }),
      N('s7', 'approval', 1000, 300, { channel: 'None' }),
      N('s8', 'export',   1300, 200, { format: 'PNG sequence', path: '' }),
      N('s9', 'delivery', 1300, 420, { target: 'Google Drive', message: 'Social content batch sẵn sàng review.' }),
    ],
    edges: [
      E('s1','s3'), E('s1','s4'), E('s2','s4'),
      E('s3','s4'), E('s4','s5'), E('s4','s6'),
      E('s5','s7'), E('s6','s7'),
      E('s7','s8'), E('s8','s9'),
    ]
  };
}

// ─── Template 3: Midjourney Batch Sprint ─────────────────────────────────
export function tplMidjourneyBatch() {
  return {
    name: 'Midjourney Image Sprint',
    desc: 'Workflow tối giản: nhập brief → sinh ảnh Midjourney hàng loạt → export.',
    tags: ['Image', 'Midjourney', 'Beginner'],
    nodes: [
      N('m1', 'brief',       80,  200, {
        text: 'Nhập brief / yêu cầu của khách hàng vào đây...',
        tags: []
      }),
      N('m2', 'prompt',      80,  420, {
        text: 'Nhập style prompt / hướng nghệ thuật...',
        lang: 'EN'
      }),
      N('m3', 'compiler',   380,  300, { targets: ['midjourney'], variants: 4 }),
      N('m4', 'bridge',     700,  200, {
        url: 'https://www.midjourney.com/imagine',
        mode: 'Hybrid',
        label: 'Midjourney',
        injectInto: "textarea[data-testid='prompt-input']",
        grabFrom: '.grid-result img',
        grabAttr: 'src',
        waitFor: '.grid-result',
        timeout: 180,
      }),
      N('m5', 'loop',       700,  420, { count: 4 }),
      N('m6', 'export',    1000,  300, { format: 'PNG sequence', path: '' }),
    ],
    edges: [
      E('m1','m3'), E('m2','m3'),
      E('m3','m4'), E('m3','m5'),
      E('m4','m6'), E('m5','m6'),
    ]
  };
}

// ─── Template 4: Client Brand Package ────────────────────────────────────
export function tplBrandPackage() {
  return {
    name: 'Client Brand Package',
    desc: 'Full branding workflow: moodboard → key visual → storyboard → PDF deliverable gửi client.',
    tags: ['Branding', 'Client', 'Advanced'],
    nodes: [
      N('b1',  'brief',      80,  80,  { text: 'Brand identity package cho startup fintech. Target: young professionals. Values: trust, innovation, clean.', tags: ['brand','fintech'] }),
      N('b2',  'reference',  80,  280, { note: 'Collect competitor logos and color palettes', files: [] }),
      N('b3',  'moodboard',  80,  480, { palette: 'Navy · Gold · White', mood: 'Professional · Trustworthy' }),
      N('b4',  'style',      380, 80,  { preset: 'Minimalist', strength: 0.9 }),
      N('b5',  'prompt',     380, 280, { text: 'Clean fintech brand identity, geometric logo marks, professional typography, navy and gold palette', lang: 'EN' }),
      N('b6',  'merge',      680, 280, { strategy: 'structured' }),
      N('b7',  'analyzer',   680, 480, { extract: ['brand_values','target_audience','color_palette','typography'] }),
      N('b8',  'compiler',   960, 380, { targets: ['midjourney','canva'], variants: 6 }),
      N('b9',  'bridge',    1260, 200, {
        url: 'https://www.midjourney.com/imagine',
        mode: 'Hybrid',
        label: 'Key Visual Generator',
        injectInto: "textarea[data-testid='prompt-input']",
        grabFrom: '.grid-result img',
        grabAttr: 'src',
        waitFor: '.grid-result',
        timeout: 180,
      }),
      N('b10', 'approval',  1260, 440, { channel: 'None' }),
      N('b11', 'storyboard',1560, 200, { aspect: '1:1', annotate: true }),
      N('b12', 'bridge',    1560, 440, {
        url: 'https://www.canva.com/design/new',
        mode: 'Hybrid',
        label: 'Canva — Brand Deck',
        injectInto: "input[placeholder='Search templates']",
        grabFrom: '.design-preview img',
        grabAttr: 'src',
        timeout: 120,
      }),
      N('b13', 'export',    1860, 320, { format: 'PPTX', path: '' }),
      N('b14', 'delivery',  2160, 320, { target: 'Email', message: 'Brand package v1 đã sẵn sàng. Xin vui lòng review và feedback.' }),
    ],
    edges: [
      E('b1','b6'), E('b2','b6'), E('b3','b6'),
      E('b4','b8'), E('b5','b8'),
      E('b6','b7'), E('b7','b8'), E('b6','b8'),
      E('b8','b9'), E('b8','b10'),
      E('b9','b10'),
      E('b10','b11'), E('b10','b12'),
      E('b11','b13'), E('b12','b13'),
      E('b13','b14'),
    ]
  };
}

// ─── Template 5: Quick Canva Automation ──────────────────────────────────
export function tplCanvaAuto() {
  return {
    name: 'Canva Quick Automation',
    desc: 'Record thao tác Canva 1 lần → replay tự động cho mọi project sau. Tiết kiệm 90% thời gian.',
    tags: ['Canva', 'Automation', 'Beginner'],
    nodes: [
      N('c1', 'brief',   80,  200, {
        text: 'Mô tả design cần tạo: loại template, kích thước, màu chủ đạo, text cần điền...',
        tags: ['canva']
      }),
      N('c2', 'bridge',  400, 200, {
        url: 'https://www.canva.com/design/new',
        mode: 'Manual',
        label: 'Canva Automation',
        injectInto: '',
        grabFrom: '',
        grabAttr: 'src',
        timeout: 300,
        actions: [],
      }),
      N('c3', 'export',  700, 200, { format: 'PNG sequence', path: '' }),
    ],
    edges: [
      E('c1','c2'),
      E('c2','c3'),
    ]
  };
}

// ─── Gallery export ───────────────────────────────────────────────────────
export const TEMPLATES = [
  { id: 'canva_auto',    fn: tplCanvaAuto,      icon: '◈', color: '#7C5CBF' },
  { id: 'mj_batch',     fn: tplMidjourneyBatch, icon: '◇', color: '#14B8A6' },
  { id: 'social_media', fn: tplSocialMedia,     icon: '▦', color: '#E8B4A0' },
  { id: 'brand_pkg',    fn: tplBrandPackage,    icon: 'B',  color: '#D4A574' },
  { id: 'hero_film',    fn: tplHeroFilm,        icon: '▷', color: '#DC2855' },
];

// Legacy export for App.jsx first-run seeding
export function seedSampleWorkflow() { return tplHeroFilm(); }
