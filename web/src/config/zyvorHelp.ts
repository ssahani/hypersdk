// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { ZYVOR_COPY, ZYVOR_URL } from '../components/ZyvorBrand';

export { ZYVOR_URL, ZYVOR_COPY };

export const ZYVOR_HELP = {
  platform: ZYVOR_URL,
  docs: 'https://zyvor.dev/docs',
  docsIntro: 'https://zyvor.dev/docs/intro',
  products: 'https://zyvor.dev/docs/products',
  contact: 'https://zyvor.dev/contact',
  demo: 'https://zyvor.dev/demo',
  hypersdk: 'https://zyvor.dev/hypersdk',
  suite: 'https://zyvor.dev/docs/intro#suite-product-guides',
  sales: 'mailto:sales@zyvor.dev',
  info: 'mailto:info@zyvor.dev',
} as const;

export type ProductHelpMeta = {
  name: string;
  tagline: string;
  version: string;
  productUrl: string;
};

export type HelpDocLink = {
  label: string;
  href: string;
};

export const MACHINA_HELP: ProductHelpMeta = {
  name: 'Machina',
  tagline: 'Hypervisor control and Machina AI on the Zeus platform',
  version: '0.1.0',
  productUrl: 'https://zyvor.dev/machina',
};

export const ZEUS_OS_HELP: ProductHelpMeta = {
  name: 'Zeus',
  tagline: 'The enterprise virtualization operating system',
  version: '1.0',
  productUrl: 'https://zyvor.dev/zeus',
};

export const ZYVOR_PLATFORM_HELP: ProductHelpMeta = {
  name: 'Zyvor Platform',
  tagline: 'The power of KVM. The control of vCenter. The simplicity of macOS.',
  version: '1.0',
  productUrl: ZYVOR_URL,
};

export const ZYVOR_PLATFORM_TAGLINE =
  'Manage your entire virtual datacenter like a modern operating system — not like a pile of scripts.';

export const ZYVOR_PLATFORM_HELP_LINKS: HelpDocLink[] = [
  { label: 'Platform UX vision (in-repo)', href: 'https://github.com/ssahani/machina/blob/main/docs/platform-ux-vision.md' },
  { label: 'Platform architecture', href: 'https://github.com/ssahani/machina/blob/main/docs/platform.md' },
  { label: 'Platform roadmap', href: 'https://github.com/ssahani/machina/blob/main/docs/platform-roadmap.md' },
  { label: 'Support Assistant', href: '/platform/support' },
  { label: 'Zyvor documentation', href: ZYVOR_HELP.docs },
  { label: 'Contact Zyvor', href: ZYVOR_HELP.contact },
];
