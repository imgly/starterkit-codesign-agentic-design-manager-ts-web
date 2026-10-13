// The messages between the page and the runner, wherever the hosting runs it; what every demo's agent turn shows is
// @imgly/demo-shared's.

import type { AssetResult } from './brand/sources.js';
import type {
  AgentEvent,
  MessageEndpoint,
  TokenRequest,
  TokenResponse,
  TurnReport
} from '../shared/src/protocol.js';

export type {
  AgentEvent,
  MessageEndpoint,
  TurnReport
} from '../shared/src/protocol.js';

export interface RunnerInit {
  /** The session's gateway: IMG.LY's, or a `/gateway` route that adds the key. */
  gatewayBaseURL: string;
  /** The session's route to IMG.LY's Metering, for a hosting that charges exports through the page's session. */
  meteringBaseURL: string;
  /** A gateway model id; default `DEFAULT_MODEL_ID`. */
  model?: string;
  /** One id per chat: every design of it opens in one executor. */
  conversation: string;
  /** Whose brand, designs and conversation this is. */
  tenant: string;
}

/** One design as the designs home shows it. */
export interface DesignCard {
  id: string;
  title: string;
  version: string;
  updatedAt: number;
}

/** A design's first page: its size in the design's unit. */
export interface DesignSize {
  width: number;
  height: number;
  unit: string;
}

export type PageToRunner =
  | { type: 'init'; init: RunnerInit }
  /** `model`: a gateway model id for this turn and the next; default the one before. */
  | { type: 'prompt'; turn: string; text: string; model?: string }
  | { type: 'abort' }
  /** Forget this brand's conversation: the saved one and the agent's; the designs stay. */
  | { type: 'chat.clear'; id: string }
  | TokenResponse
  | { type: 'designs.list'; id: string }
  /** A small render and the size of `version`, cached per version. */
  | { type: 'design.thumbnail'; id: string; design: string; version: string }
  /** `name`: the file's, as the person downloads it. */
  | {
      type: 'design.export';
      id: string;
      design: string;
      format: DownloadFormat;
      name: string;
    }
  /** A file to import as a new design: `.imgly`, Photoshop, InDesign, PDF or PowerPoint. */
  | { type: 'design.upload'; id: string; bytes: ArrayBuffer; name: string }
  /** The stored design, for the editor. */
  | { type: 'design.read'; id: string; design: string }
  /** An image a person adds in the editor: kept among the tenant's files and listed first in its image library. */
  | {
      type: 'image.upload';
      id: string;
      bytes: ArrayBuffer;
      name: string;
      mimeType: string;
    }
  /** The editor's save: only while the design is still at `ifMatch`. */
  | ({
      type: 'design.save';
      id: string;
      design: string;
      ifMatch: string;
      cesdkVersion: string;
    } & DesignBytes);

/** What the design view downloads. */
export type DownloadFormat = 'png' | 'pdf' | 'imgly';

/** A design's content between the page and the runner: a scene string, or an archive's bytes (transferred). */
export type DesignBytes = { scene: string } | { archive: ArrayBuffer };

/** The page's runner, as the hosting connects it: on the cloud hosting, a client of the runner server. */
export type RunnerEndpoint = MessageEndpoint<PageToRunner, RunnerToPage>;

/** What a page that opens later replays: the chat's messages, numbered in order (`seq`). */
export type LoggedMessage =
  /** The saved conversation, when the runner opened it. */
  | { type: 'history'; seq: number; events: AgentEvent[] }
  | { type: 'event'; seq: number; turn: string; event: AgentEvent }
  | { type: 'turn.end'; seq: number; turn: string; report: TurnReport }
  /** A file the agent exported for the person, during `turn`: its bytes, or a link to it. */
  | ({
      type: 'file';
      seq: number;
      turn: string;
      name: string;
      mimeType: string;
    } & ({ bytes: ArrayBuffer } | { url: string }))
  | { type: 'chat.cleared'; seq: number; id: string };

export type RunnerToPage =
  | { type: 'ready' }
  | TokenRequest
  | LoggedMessage
  | { type: 'designs'; id: string; designs: DesignCard[] }
  /** A render of `version`: its bytes, or a link where the hosting keeps it. */
  | ({
      type: 'design.thumbnail';
      id: string;
      design: string;
      version: string;
      size: DesignSize;
    } & ({ png: ArrayBuffer } | { url: string }))
  /** A download: its bytes, or a link where the hosting kept it. */
  | ({ type: 'design.file'; id: string } & (
      | { bytes: ArrayBuffer }
      | { url: string }
    ))
  | { type: 'design.loaded'; id: string; design: string }
  | { type: 'image.kept'; id: string; asset: AssetResult }
  | ({
      type: 'design.content';
      id: string;
      design: string;
      version: string;
      /** The CE.SDK that saved it; `null` when unknown (a record older than the field). */
      cesdkVersion: string | null;
    } & DesignBytes)
  /** `version`: the new one; `null` when the design moved since `ifMatch`, and nothing was written. */
  | { type: 'design.saved'; id: string; design: string; version: string | null }
  | { type: 'design.failed'; id: string; error: string };
