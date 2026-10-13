# Agentic Design Manager — a CoDesign starter kit

A design platform with a design agent: two fictional brands (Nordwind Coffee,
a roastery, and Tidewell Botanics, an online skincare shop) with their brand
kits, a grid of each brand's designs, CE.SDK's editor, and a chat where you
ask for a design and the agent makes or changes it, in the brand. The page
runs in the browser; the agent, the design engine and the storage run on
servers you start with Docker Compose. A long reply keeps running when the
person closes the tab, and reopening it shows the whole chat.

Use it as a starting point: copy the repo, keep what fits your product,
replace the rest. The guide for this kit is
[Agentic Design Manager](https://img.ly/docs/cesdk/codesign/starter-kits/agentic-design-manager-cdsadm/).

Terms used below: **CE.SDK** is IMG.LY's design engine and editor. A
**design** is a CE.SDK scene, saved as an `.imgly` file. The **CoDesign SDK**
(`@imgly/codesign-sdk`) gives an AI model the tools to find, read, change,
preview and export designs. The **executor** is where those tools run a
CE.SDK engine: IMG.LY's published Docker image,
`imgly/codesign-executor:1.83.0`, which you run unchanged. The
**runner** is your server that runs the agent loop with those tools
(`src/hosting/cloud/runner/`, a Node server). The **store** keeps designs and
files and serves them by URL.

## What you need

- Node.js 22 or newer, Docker with Compose, and a desktop browser (the page is
  tested in desktop Chrome).
- A **CE.SDK license key** for the editor in the page, the kind a CE.SDK web
  editor uses. A 30-day trial key works for local development
  ([CE.SDK licensing](https://img.ly/docs/cesdk/js/licensing-8aa063/#trial-license-key)).
  It goes in `VITE_CESDK_LICENSE`.
- A **CoDesign license key**, which pays for model calls, generated images and
  exports. To get one, [contact sales](https://img.ly/forms/contact-sales/).
  It goes in `.env` twice, under two names: `IMGLY_GATEWAY_API_KEY`, which the
  runner sends to IMG.LY's AI gateway, and `IMGLY_CESDK_LICENSE`, which the
  executors start with. It is not the CE.SDK key in `VITE_CESDK_LICENSE`.

## Run it

```sh
npm install
cat .env.template src/hosting/cloud/.env.template > .env
```

Fill in `.env`:

| Variable                                          | Value                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `VITE_CESDK_LICENSE`                              | the CE.SDK license key                                                      |
| `IMGLY_GATEWAY_API_KEY` and `IMGLY_CESDK_LICENSE` | the CoDesign license key, in both                                           |
| `STORE_TOKEN`                                     | any string of letters and digits: the store's write token                   |
| `EXECUTOR_TOKEN`                                  | any string: the token nginx adds to every request to the executors          |
| `RUNNER_DEV_USER`                                 | any id, for example `me`: on your machine, every request is this one person |

The other variables have working defaults for this machine. Then start the
containers (two executors, and nginx with the store), the runner and the page:

```sh
docker compose -f src/hosting/cloud/compose.yaml --env-file .env up -d
npx vite-node src/hosting/cloud/runner/serve.ts   # the runner, http://127.0.0.1:8792
npm run dev                                       # the page, http://localhost:5190
```

With pnpm: `pnpm install`, `pnpm exec vite-node …` and `pnpm dev`. Ask for one
design in the chat and open the PNG link: that export and the model calls are
charged to your CoDesign license key.

Other scripts: `npm run check` (type-check), `npm run build:site` (the page
as a static site in `dist/`), `npm run preview` (serve that build),
`npm run build:runner` (the runner as one file, `dist/runner/serve.mjs`, see
below), `npm run generate:plugin` (after you change
`src/hosting/cloud/tenant.plugin.ts`: it rebuilds
`tenant-plugin.generated.ts` beside it, the module the executors receive).

To run the runner in Compose too, run `npm run build:runner`, then add
`--profile runner` to the `docker compose` command: it starts the bundle in a
Node container beside the executors (your own server, not IMG.LY's image).
That runner listens on all addresses, and it refuses `RUNNER_DEV_USER` unless
it listens on a loopback address, so this path needs your sign-in's
`TOKEN_ISSUERS` (below).

## Read `src/runner/assistant.ts` first

```ts
const hosting = await forTenant(init.tenant, { gatewayBaseURL, bearer, user });
const codesign = prepareCoDesign({
  conversation: init.conversation,
  executors: hosting.executors, // the executor containers
  designs: hosting.designs, // where designs are kept: the store
  plugins: sessionPlugins(hosting.plugins), // the brand's fonts, colours, images, files
  gateway: hosting.gateway, // generated images, paid as the model calls are
  uploadExport // the agent's exports: kept in the store, a link in the chat
});
createDesignAgent({
  tools: codesign.tools,
  instructions: codesign.instructions /* + the brand rule */
});
```

## How it fits together

| Piece             | Here                                                                                      | In your product                                |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| The page          | `src/page/` and `index.html`, talking only to the runner                                  | your web app                                   |
| The runner        | `src/hosting/cloud/runner/`, a Node server: one chat per signed-in person and brand       | your server, in any agent framework            |
| The model         | IMG.LY's AI gateway, called from the runner with `IMGLY_GATEWAY_API_KEY`                  | the same gateway, from your server             |
| The tools         | `prepareCoDesign` in `src/runner/assistant.ts`                                            | the same call on your server                   |
| The executor      | the published image, two containers in `src/hosting/cloud/compose.yaml`                   | the same image, one container per conversation |
| Designs and files | an HTTP store that answers `GET`, `PUT` and `DELETE` by path (nginx with a Docker volume) | your bucket and CDN                            |
| Brand kits        | data in `src/brand/`, served by the tenant's asset sources (`src/brand/sources.ts`)       | your brand kits, behind the same sources       |
| Sign-in           | a JWT whose issuer is in `TOKEN_ISSUERS`, or `RUNNER_DEV_USER` on your machine            | your sign-in                                   |

The agent is `src/runner/`; where it runs and what it keeps is
`src/hosting/cloud/`. What every design and file is kept as (designs,
thumbnails, the chat and the tenant's files over a `node:fs`-shaped store) is
`src/store/`. Then come `src/page/` (the UI) and the editor dialog in
`shared/`.

`shared/` is code this kit shares with the other CoDesign starter kit: the
page's session, the agent loop, the executor pool, the editor dialog and the
base styles. It is part of your copy; change it like the rest.

The page talks to the runner with the messages in `src/protocol.ts`, as
`POST /messages` and one stream of JSON lines (`GET /stream`). Every message
of the chat carries a number; a page that reconnects sends the last one it got
and receives what came after, and a new tab receives the whole chat.

`src/hosting/cloud/README.md` lists what this hosting guarantees, such as
every image, file, thumbnail and export the page shows being a link into the
store. Keep those rules when you change it.

## Plug in your own sign-in

The page has no sign-in of its own, and the runner learns who calls from a
token. Two places change:

- **The page** sends the token that `startSession()` returns from `getToken`,
  in `shared/src/page/session.ts`. Return your sign-in's JWT there, a fresh one
  per call.
- **The runner** checks it in `src/hosting/cloud/runner/auth.ts`: a JWT whose
  issuer is in `TOKEN_ISSUERS`, with its keys at
  `<issuer>/.well-known/jwks.json` (or `JWKS_URL`; optional `TOKEN_AUDIENCE`,
  and `TOKEN_HEADER` when the token is not sent as `Authorization: Bearer`).
  The user it names keys the chat. The token is only for identity: the
  platform's key on the runner pays the model, not the person.

`RUNNER_DEV_USER` stands in for a sign-in on your machine. Set it or
`TOKEN_ISSUERS`, not both.

**Reuse what you have:** your sign-in and your API backend stay. The runner
needs your sign-in's issuer, to check its tokens, and the page needs to hand
it a token.

## What to know before you build on it

- **The executors need your CoDesign license key** (`IMGLY_CESDK_LICENSE`):
  they activate it when they start and charge every export to it
  ([billing](https://img.ly/docs/cesdk/codesign/deploy/host-the-executor-cdshst/#billing)).
- **Only the runner reaches the executors.** nginx adds their token
  (`EXECUTOR_TOKEN`) and answers no CORS for them, so no page can call them.
  It keeps the store in a Docker volume, answers CORS for reading it, and
  refuses writes without `STORE_TOKEN`, which the runner and the executors
  hold (the model's code can read it from the plugin options; an online store
  should take a token scoped to one tenant). The page never writes: a person's
  image from the editor goes up through the runner.
- **One URL for each file, on all sides.** A design names its images by URL,
  so the browser, the runner and the executors must all open it:
  `http://store.localhost:8790/store/…` works on this machine (Chrome sends
  `*.localhost` here) and in the containers (Compose gives nginx that name).
  Online, it is your store's `https` address.
- **Each executor serves one conversation** (a chat, here), exits about 3½
  minutes after its last call and restarts empty. Two executors are two chats
  at a time; a third waits up to 60 s, then fails with a message. Add services
  to `compose.yaml` and URLs to `EXECUTOR_URLS` for more.
- **The runner keeps chats in memory.** The conversation is saved to the store
  after every turn (`tenants/<brand>/chats/<user>.json`), but a turn running
  when the runner restarts is lost, and a tab then shows the chat as it was
  saved.

## Deploy it

IMG.LY does not host this for you. To put it online:

- **The page** is a static site: set `VITE_RUNNER_URL` and `VITE_STORE_URL` to
  their public `https` addresses, run `npm run build:site` and serve `dist/`.
  `VITE_CESDK_LICENSE` is built into the page, as in any CE.SDK web editor, so
  anyone who opens the site can read it.
- **The runner** is your server: `npm run build:runner` and run
  `node dist/runner/serve.mjs` with the runner's variables
  (`src/hosting/cloud/.env.template`), `TOKEN_ISSUERS` set, and
  `ALLOWED_ORIGINS` listing your page's origin.
- **The executors** are IMG.LY's image, unchanged. In production, start a
  container per conversation and restrict its network, as
  [Host the Executor](https://img.ly/docs/cesdk/codesign/deploy/host-the-executor-cdshst/)
  describes; the executors here can reach the whole internet.
- **The store** is any HTTP store with the routes above, or your bucket behind
  a CDN; replace `src/hosting/cloud/http-files.ts` if yours speaks another API.

**Reuse what you have:** your bucket and CDN, your container platform and your
sign-in. The kit needs a URL for each file that the browser and the executors
can both open, containers of IMG.LY's image, and your sign-in's issuer.

## What it costs

- **Model calls and generated images** are paid in IMG.LY AI credits on the
  key the runner holds (`IMGLY_GATEWAY_API_KEY`). The chat shows the list
  price of each reply.
- **Exports** (PNG and PDF; the `.imgly` design file, saving, editing and
  previews are free) are charged to the CoDesign license key the executors run
  with: the executor counts every file it exports and charges it before it is
  delivered
  ([billing](https://img.ly/docs/cesdk/codesign/deploy/host-the-executor-cdshst/#billing)).
  What one export costs is set by your license agreement with IMG.LY.

## The same tools as an MCP server

`src/hosting/cloud/mcp/` serves the design tools to people's own AI
assistants (Claude, ChatGPT, Cursor) as a remote MCP server over Streamable
HTTP, on the same executors and store. It is a server process beside the kit:
the page never imports it, and deleting the folder leaves the kit as it was.
The guide that walks through it, with this code, is
[Serve the design tools as an MCP server](https://img.ly/docs/cesdk/codesign/guides/serve-tools-as-an-mcp-server-cdsmcp/).

With the containers above running, set `MCP_TOKENS=nordwind=<a long random string>`
in `.env`, then:

```sh
npx vite-node src/hosting/cloud/mcp/serve.ts      # http://127.0.0.1:8791/mcp
claude mcp add --transport http design http://127.0.0.1:8791/mcp \
  --header "Authorization: Bearer <the same string>"
```

Exports are charged to the containers' key, as in the page; the assistant's
own tool approval is the confirmation.

## License

IMG.LY's license, the same as the CoDesign SDK's: see `LICENSE.md`.
