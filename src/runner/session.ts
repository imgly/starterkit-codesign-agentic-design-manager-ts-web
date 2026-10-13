// What the runner's message loop (`serve.ts`) needs from a tenant's assistant, which `assistant.ts` builds from what
// a hosting's `forTenant` gives.

import type {
  DesignContent,
  EnginePluginModule,
  Executors,
  GatewayOptions,
  StoredDesign
} from '@imgly/codesign-sdk';
import type {
  DesignAgent,
  DesignAgentOptions
} from '../../shared/src/runner/agent.js';

import type { AssetResult, TenantAPI } from '../brand/sources.js';
import type { ListedDesignStore } from '../store/designs.js';
import type {
  DesignCard,
  DesignSize,
  DownloadFormat,
  RunnerInit
} from '../protocol.js';

export interface RunnerSession {
  /** The agent loop over this session's tools, continuing `messages`. */
  agent(
    opts: Pick<DesignAgentOptions, 'model' | 'onEvent' | 'messages'>
  ): DesignAgent;
  /** The tenant's designs, most recently changed first. */
  designs(): Promise<DesignCard[]>;
  /** A render of `version` and its first page's size. */
  thumbnail(design: string, version: string): Promise<Thumbnail>;
  /** A download of `design`, named `name`: its bytes, or a link where the hosting kept it. */
  export(
    design: string,
    format: DownloadFormat,
    name: string
  ): Promise<{ bytes: Uint8Array } | { url: string }>;
  /** The stored design, as the SDK reads it at every call; `undefined` when there is none. */
  read(design: string): Promise<StoredDesign | undefined>;
  /** A person's save from the editor: compare-and-set on `ifMatch`; the new version, or `undefined` when it moved. */
  save(
    design: string,
    content: DesignContent<ArrayBuffer>,
    opts: { ifMatch: string; cesdkVersion: string }
  ): Promise<string | undefined>;
  /** Imports a file, named `name`, as a new design; its id. */
  upload(bytes: Uint8Array, name: string): Promise<string>;
  /** An image a person adds in the editor, kept and listed first in the tenant's image library. */
  keepImage(file: File): Promise<AssetResult>;
  /** This tenant's conversation with the agent, as pi keeps it. */
  history: TenantHosting['history'];
  keepPreview?: TenantHosting['keepPreview'];
}

/** A design's render and its first page's size: its bytes, or a link where the hosting keeps it. */
export type Thumbnail = { size: DesignSize } & (
  | { png: Uint8Array }
  | { url: string }
);

/** A file the agent exported, for the person: its bytes, or a link to where the hosting kept it. */
export type DeliveredFile = { name: string; mimeType: string } & (
  | { bytes: Uint8Array }
  | { url: string }
);

export interface SessionContext {
  init: RunnerInit;
  /** The signed-in person the runner server serves; absent where the runner serves only the page that started it. */
  user?: string;
  /** Where the page's token pays the gateway: that token, per request. */
  bearer: (opts?: { forceRefresh?: boolean }) => Promise<string | undefined>;
  /** Hands a file the agent exported to the person, in the chat. */
  deliver: (file: DeliveredFile) => void;
}

export type OpenSession = (ctx: SessionContext) => Promise<RunnerSession>;

/** What a hosting gives a tenant's sessions: where they run, what they keep, and who pays the gateway. */
export interface TenantHosting {
  /** Writes the brand's starter designs on its first visit. */
  seed(): Promise<void>;
  executors: Executors;
  designs: ListedDesignStore;
  /** The tenant's sources, as every engine of its sessions and its editor adds them. */
  plugins: EnginePluginModule[];
  /** Model calls and `asset_generate`: the gateway, and who pays it (on a runner server, the platform's key). */
  gateway: { baseURL: string; bearer: GatewayOptions['bearer'] };
  /** The tenant's files: people's uploads, imports, generated images. */
  files: TenantAPI;
  /** Keeps an export where the person can open it: its link, or `undefined` when its bytes go into the chat. */
  keepExport(file: {
    design: string;
    name: string;
    bytes: Uint8Array;
  }): Promise<string | undefined>;
  /** The render kept per design version. */
  thumbnails: {
    get(design: string, version: string): Promise<Thumbnail | undefined>;
    put(
      design: string,
      version: string,
      png: Uint8Array,
      size: DesignSize
    ): Promise<Thumbnail>;
  };
  /** Keeps an image the chat shows (a `data:` uri): its link. Absent: the chat shows the `data:` uri. */
  keepPreview?(uri: string): Promise<string>;
  history: {
    load(): Promise<unknown[]>;
    save(messages: readonly unknown[]): Promise<void>;
  };
}

/** A hosting's `forTenant`: the tenant's hosting, for the signed-in `user` of a runner server, or a page's `bearer`. */
export type ForTenant = (
  tenant: string,
  opts: {
    gatewayBaseURL: string;
    meteringBaseURL: string;
    bearer: GatewayOptions['bearer'];
    user?: string;
  }
) => Promise<TenantHosting>;
