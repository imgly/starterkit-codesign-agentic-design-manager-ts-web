// The plugins of a tenant's sessions: the runner sends them with every session, and the editor applies the same list.

import {
  cesdkDemo,
  googleFonts,
  type EnginePluginModule
} from '@imgly/codesign-sdk';

/** Around the hosting's tenant sources: Google Fonts after them, so a brand family shadows Google's; CE.SDK's demo photos. */
export const sessionPlugins = (
  tenantPlugins: EnginePluginModule[]
): EnginePluginModule[] => [
  ...tenantPlugins,
  googleFonts(),
  cesdkDemo({ include: ['ly.img.image'] })
];
