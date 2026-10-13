# Cloud hosting: what it guarantees

This folder runs the demo with everything but the page on your servers: the
runner (`runner/`), the executors (IMG.LY's published image) and a store
(`compose.yaml`). The demo's README says how to start it. Whatever you change
here, keep these rules, because a product built on this shape depends on them.

## Every link is a store URL

Every image, file, font, thumbnail, export and design the page shows, the
runner keeps, the model reads or a saved design references is an `https` URL
into the store, or the CDN in front of it:

| What                                                   | Where it lives in the store                       |
| ------------------------------------------------------ | ------------------------------------------------- |
| A person’s upload, an import, a starter design’s image | `tenants/<brand>/files/<sha256>.<ext>`            |
| A design's thumbnail                                   | `tenants/<brand>/thumbnails/<id>.png?v=<version>` |
| A preview in the chat                                  | `tenants/<brand>/previews/<sha256>.<ext>`         |
| An export, from the chat or the design view            | `tenants/<brand>/exports/<design>/<uuid>/<name>`  |

Never a `blob:` or `data:` URI and never anything kept only in the browser:
those exist only in one tab. After a reload they show a broken image
or a dead link, kept in a chat or a design they are broken for everyone else,
and the runner and the executors cannot fetch them at all.

The page may still turn bytes it already holds into a `blob:` URL to display
them, such as the brand logo bundled with it, but never as a value it stores,
sends or links. The model's own conversation keeps its images as bytes,
because the model provider needs them; only what the page shows is a link. A
`.imgly` design embeds its images as bytes, not links.

## The agent works on the runner

- **The agent loop runs on the runner, never in the page.** The page prepares
  no tools, runs no engine and calls no model; the platform's key pays the
  model on the runner.
- **A chat survives a reload and a closed tab.** The runner keeps a turn
  running while no tab is open, and a tab that opens later gets the whole
  chat, with its previews and file links.
- **Uploads go through the runner.** It keeps a file in the store and answers
  its store URL; the editor never keeps an upload in the page.
- **Every source the engines read exists from a tenant's first visit,**
  seeded empty where the tenant has nothing yet, so the first load shows no
  404s.
