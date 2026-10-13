// The brand kit in the sidebar: the tenant switcher, colours, and each typeface drawn in its own fonts.

import {
  BRAND_TYPEFACES,
  TENANT_LOGOS,
  TENANT_PROFILES
} from '../brand/tenants.js';

const TENANT_KEY = 'codesign-tab.tenant';
const WEIGHTS: Record<string, string> = { normal: '400', bold: '700' };

export const TENANTS = TENANT_PROFILES;

/** The brand chosen in this browser, kept across reloads. */
export function chosenTenant(): string {
  try {
    const kept = localStorage.getItem(TENANT_KEY);
    if (TENANTS.some((t) => t.tenantId === kept)) return kept as string;
  } catch {
    // Storage blocked: the first brand.
  }
  return TENANTS[0].tenantId;
}

const svgURL = (svg: string) =>
  URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== '') node.className = className;
  node.append(...children);
  return node;
}

export function showBrand(tenantId: string): void {
  const profile = TENANTS.find((t) => t.tenantId === tenantId) ?? TENANTS[0];
  const select = document.getElementById('tenant') as HTMLSelectElement;
  for (const t of TENANTS) select.add(new Option(t.tenantName, t.tenantId));
  select.value = profile.tenantId;
  // A brand is a separate tenant: its own designs, conversation and executor.
  select.addEventListener('change', () => {
    try {
      localStorage.setItem(TENANT_KEY, select.value);
    } catch {
      // Storage blocked: the reload shows the first brand again.
    }
    location.reload();
  });

  const logo = TENANT_LOGOS[profile.tenantId]?.[0];
  const img = document.getElementById('tenant-logo') as HTMLImageElement;
  if (logo !== undefined) img.src = svgURL(logo.svg);
  (document.getElementById('tagline') as HTMLElement).textContent =
    profile.tagline;

  const colors = document.getElementById('colors') as HTMLUListElement;
  colors.replaceChildren(
    ...profile.colors.map(({ name, hex }) => {
      const chip = el('span', 'chip');
      chip.style.background = hex;
      const row = el('li', '', chip, el('span', '', name));
      row.title = hex;
      return row;
    })
  );

  const typefaces = document.getElementById('typefaces') as HTMLUListElement;
  typefaces.replaceChildren(
    ...(BRAND_TYPEFACES[profile.tenantId] ?? []).map(
      ({ name, role, fonts }) => {
        const family = `brand ${name}`;
        for (const font of fonts) {
          const face = new FontFace(family, `url(${font.uri})`, {
            weight: WEIGHTS[font.weight ?? 'normal'] ?? '400',
            style: font.style ?? 'normal'
          });
          document.fonts.add(face);
          void face.load().catch(() => undefined);
        }
        // The family's name, drawn in the family itself; its weights are listed on hover.
        const shown = el('span', '', name);
        shown.style.fontFamily = `'${family}', sans-serif`;
        const row = el('li', 'name', shown, el('span', 'role', role));
        row.title = fonts.map((f) => f.subFamily).join(', ');
        return row;
      }
    )
  );
}
