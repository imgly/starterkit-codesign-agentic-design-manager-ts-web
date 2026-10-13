// What the assistant's tool calls are called in the chat: verbs, not tool ids.

type State = 'running' | 'done' | 'failed';

const VERBS: Record<string, [running: string, done: string, failed: string]> = {
  edit: ['Editing', 'Edited', 'Edit failed'],
  preview: ['Rendering a preview', 'Rendered a preview', 'Preview failed'],
  asset_generate: [
    'Generating an image',
    'Generated an image',
    'Image generation failed'
  ],
  asset_search: ['Searching the brand', 'Searched the brand', 'Search failed'],
  designs: [
    'Looking through the designs',
    'Looked through the designs',
    'Design list failed'
  ],
  export: ['Exporting', 'Exported', 'Export failed'],
  skill: ['Reading the guide', 'Read the guide', 'Guide failed']
};

export function stepVerb(tool: string, args: unknown, state: State): string {
  const copy = typeof (args as { from?: unknown } | null)?.from === 'string';
  const verbs =
    tool === 'import'
      ? copy
        ? (['Copying a design', 'Copied a design', 'Copy failed'] as const)
        : (['Starting a design', 'Started a design', 'Import failed'] as const)
      : VERBS[tool];
  if (verbs === undefined) return tool;
  const [running, done, failed] = verbs;
  return state === 'running' ? `${running}…` : state === 'done' ? done : failed;
}

const list = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export function turnSummary(steps: number, designs: readonly string[]): string {
  const count = `${steps} ${steps === 1 ? 'step' : 'steps'}`;
  return designs.length === 0
    ? count
    : `Worked on ${list.format(designs).replace(/, and /, ' and ')} · ${count}`;
}
