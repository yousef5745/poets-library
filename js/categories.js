// Content categories. Supabase table `categories` overrides this list; these are the
// defaults used before the table exists or when offline. A story without a category
// belongs to 'poets'. Names are per-locale objects so more languages can be added later.
export const DEFAULT_CATEGORY = 'poets';
export const CATEGORIES = [
  { slug: 'poets', name: { ar: 'شعراء' }, description: { ar: 'حكايات من سِيَر الشعراء، بأبياتهم الثابتة في دواوينهم.' }, sort_order: 1, icon: 'quill', cover: 'camp', accent: 'poets', ornament: 'lozenge', published: true, no_character_images: false, kid_friendly: false, min_age: null },
  { slug: 'kids', name: { ar: 'قصص أطفال' }, description: { ar: 'حكايات قصيرة بلغة سهلة، تُقرأ مع الصغار أو يقرؤونها وحدهم.' }, sort_order: 2, icon: 'heart', cover: null, accent: 'kids', ornament: 'circles', published: true, no_character_images: false, kid_friendly: true, min_age: 6 },
  { slug: 'prophets', name: { ar: 'قصص الأنبياء' }, description: { ar: 'تُروى من القرآن الكريم وكتب التفسير والسيرة، دون تصوير للأنبياء أو لأيّ شخصية.' }, sort_order: 3, icon: 'book', cover: null, accent: 'prophets', ornament: 'star8', published: true, no_character_images: true, kid_friendly: false, min_age: null },
  { slug: 'novels', name: { ar: 'روايات' }, description: { ar: 'روايات تفاعلية أطول، بفصولٍ ونهاياتٍ متعدّدة.' }, sort_order: 4, icon: 'flag', cover: null, accent: 'novels', ornament: 'rule', published: true, no_character_images: false, kid_friendly: false, min_age: null },
];
export const ALL_CATEGORIES = CATEGORIES.slice();   // admin view, includes hidden ones

const loc = (o, l = document.documentElement.lang || 'ar') => (o && (o[l] || o.ar || Object.values(o)[0])) || '';
export const catName = (c) => loc(c && c.name);
export const catDesc = (c) => loc(c && c.description);
export const category = (slug) => ALL_CATEGORIES.find((c) => c.slug === slug) || null;

export function setCategories(rows) {
  const list = (rows && rows.length ? rows : ALL_CATEGORIES).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  ALL_CATEGORIES.splice(0, ALL_CATEGORIES.length, ...list);
  CATEGORIES.splice(0, CATEGORIES.length, ...list.filter((c) => c.published !== false));
}

// Visual identity (spec 4.2): one of four tested accents and one ornament per category.
export const ACCENTS = [['poets', '#9b2f20'], ['kids', '#a84a12'], ['prophets', '#2f5d4a'], ['novels', '#2e4a6b']];
export const ORNAMENT_KEYS = ['lozenge', 'circles', 'star8', 'rule'];
export const accentOf = (c) => (c && ACCENTS.some(([k]) => k === c.accent) ? c.accent : (c && ACCENTS.some(([k]) => k === c.slug) ? c.slug : 'poets'));
const ORN = {
  lozenge: '<svg class="orn2" viewBox="0 0 180 14" aria-hidden="true"><path d="M0 7h70M110 7h70" stroke="currentColor" stroke-width="1"/><g fill="currentColor"><path d="M80 7l4-4 4 4-4 4z"/><path d="M86 7l4-4 4 4-4 4z"/><path d="M92 7l4-4 4 4-4 4z"/></g></svg>',
  circles: '<svg class="orn2" viewBox="0 0 150 14" aria-hidden="true"><path d="M0 7q7-5 14 0t14 0 14 0 14 0M94 7q7-5 14 0t14 0 14 0 14 0" fill="none" stroke="currentColor" stroke-width="1.2"/><g fill="currentColor"><circle cx="66" cy="7" r="3"/><circle cx="75" cy="7" r="4"/><circle cx="84" cy="7" r="3"/></g></svg>',
  star8: '<svg class="orn2" viewBox="0 0 150 14" aria-hidden="true"><path d="M0 7h62M88 7h62" stroke="currentColor" stroke-width="1"/><g fill="none" stroke="currentColor" stroke-width="1.2"><rect x="69" y="1" width="12" height="12"/><rect x="69" y="1" width="12" height="12" transform="rotate(45 75 7)"/></g></svg>',
  rule: '<svg class="orn2" viewBox="0 0 150 14" aria-hidden="true"><path d="M0 5.5h68M82 5.5h68M0 8.5h68M82 8.5h68" stroke="currentColor" stroke-width=".8"/><circle cx="75" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
};
export const ornamentSvg = (c) => ORN[(c && c.ornament) || 'lozenge'] || ORN.lozenge;
let patN = 0;
// Eight-point-star pattern for imagery-free covers (prophets and any no-images category).
export const PATTERN = () => { const id = 'g8_' + (++patN); return `<svg class="pat" aria-hidden="true"><defs><pattern id="${id}" width="36" height="36" patternUnits="userSpaceOnUse"><g fill="none" stroke="currentColor" stroke-width=".9"><rect x="10" y="10" width="16" height="16"/><rect x="10" y="10" width="16" height="16" transform="rotate(45 18 18)"/><path d="M0 18h4.7M31.3 18H36M18 0v4.7M18 31.3V36"/></g></pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>`; };
