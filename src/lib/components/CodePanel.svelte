<script lang="ts">
  // Coding Awareness config. Two independent watchers can run at once:
  //   • a LOCAL folder  → instant reactions (Rust reflog watcher)
  //   • a GitHub URL    → repo or whole account, polled every few minutes
  // Plus an optional read-only token (private repos) and instant test buttons.
  import { untrack } from "svelte";

  interface Props {
    localPath: string;   // currently-watched local folder ("" = off)
    remoteUrl: string;   // currently-tracked GitHub url   ("" = off)
    hasToken: boolean;
    onSetLocal: (path: string) => void;
    onStopLocal: () => void;
    onSetRemote: (url: string) => void;
    onStopRemote: () => void;
    onSaveToken: (token: string) => void;
    onClearToken: () => void;
    onTest: (kind: "commit" | "fix" | "pr" | "release" | "repo" | "milestone") => void;
    onShowcase: () => void;
    onCard: () => void;
    onClose: () => void;
    // Training awareness
    trainAware: boolean;
    onToggleTrain: (on: boolean) => void;
    flowAware: boolean;
    onToggleFlow: (on: boolean) => void;
    logPath: string; // watched log file/folder ("" = off)
    trainStatus: string; // live "running · epoch 12 · loss 0.34" / "watching…"
    onSetLog: (path: string) => void;
    onStopLog: () => void;
    onTestTrain: () => void;
    onTestCrash: () => void;
    gpuAvailable: boolean; // optional bonus readout when an NVIDIA GPU is present
    gpu: { available: boolean; util: number; mem_used: number; mem_total: number; temp: number; procs: number } | null;
  }
  let {
    localPath, remoteUrl, hasToken,
    onSetLocal, onStopLocal, onSetRemote, onStopRemote,
    onSaveToken, onClearToken, onTest, onShowcase, onCard, onClose,
    trainAware, onToggleTrain, flowAware, onToggleFlow, logPath, trainStatus, onSetLog, onStopLog,
    onTestTrain, onTestCrash, gpuAvailable, gpu
  }: Props = $props();

  let logIn = $state(untrack(() => logPath));
  const logDirty = $derived(logIn.trim() !== "" && logIn.trim() !== logPath);

  // seed inputs from current values once (initial value only — intentional)
  let local = $state(untrack(() => localPath));
  let remote = $state(untrack(() => remoteUrl));
  const localDirty = $derived(local.trim() !== "" && local.trim() !== localPath);
  const remoteDirty = $derived(remote.trim() !== "" && remote.trim() !== remoteUrl);

  let showToken = $state(false);
  let token = $state(""); // write-only; never pre-filled

  type Kind = "commit" | "fix" | "pr" | "release" | "repo" | "milestone";
  const tests: { kind: Kind; label: string }[] = [
    { kind: "commit", label: "Commit" },
    { kind: "fix", label: "Bug-fix" },
    { kind: "pr", label: "PR merged" },
    { kind: "release", label: "Release" },
    { kind: "repo", label: "New repo" },
    { kind: "milestone", label: "Milestone" }
  ];

  // fire a test, then duck the panel so the reaction is visible
  let peeking = $state(false);
  let peekTimer: ReturnType<typeof setTimeout>;
  function fireTest(kind: Kind) {
    onTest(kind);
    peeking = true;
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => (peeking = false), 4200);
  }
</script>

<div class="panel" class:peeking>
  <div class="head">
    <span>Coding awareness</span>
    <button class="x" onclick={onClose} aria-label="Close">✕</button>
  </div>

  <p class="blurb">
    I'll quietly notice commits — and cheer the bug-fixes. Use either or
    <strong>both</strong>: a local folder for instant reactions, a GitHub link for pushes.
  </p>

  <!-- ─── LOCAL folder (instant) ─── -->
  <h3>Local folder · instant</h3>
  {#if localPath}
    <div class="status">👀 <code>{localPath}</code></div>
  {/if}
  <input
    class="path"
    type="text"
    spellcheck="false"
    placeholder="C:\\path\\to\\repo  (the folder with .git)"
    bind:value={local}
    onkeydown={(e) => e.key === "Enter" && localDirty && onSetLocal(local)}
  />
  <div class="row">
    <button class="save" disabled={!localDirty} onclick={() => onSetLocal(local)}>
      {localPath ? "Update" : "Watch folder"}
    </button>
    {#if localPath}
      <button class="stop" onclick={onStopLocal}>Stop</button>
    {/if}
  </div>

  <!-- ─── GitHub (repo or account) ─── -->
  <h3>GitHub · every few min</h3>
  {#if remoteUrl}
    <div class="status">🌐 <code>{remoteUrl}</code></div>
  {/if}
  <input
    class="path"
    type="text"
    spellcheck="false"
    placeholder="github.com/you   ·   or   github.com/you/repo"
    bind:value={remote}
    onkeydown={(e) => e.key === "Enter" && remoteDirty && onSetRemote(remote)}
  />
  <div class="row">
    <button class="save" disabled={!remoteDirty} onclick={() => onSetRemote(remote)}>
      {remoteUrl ? "Update" : "Track GitHub"}
    </button>
    {#if remoteUrl}
      <button class="stop" onclick={onStopRemote}>Stop</button>
    {/if}
  </div>

  <!-- ─── try each reaction now (pet speaks + sound + visual) ─── -->
  <div class="testrow">
    <span class="testlbl">🧪 Try</span>
    {#each tests as t (t.kind)}
      <button class="test" class:fix={t.kind === "fix"} onclick={() => fireTest(t.kind)}>{t.label}</button>
    {/each}
  </div>

  <!-- ─── training awareness (log-watch: epoch / loss / done / crash) ─── -->
  <h3>Training awareness</h3>
  <label class="gpurow">
    <input type="checkbox" checked={trainAware} onchange={(e) => onToggleTrain((e.target as HTMLInputElement).checked)} />
    <span>React to training runs</span>
  </label>
  {#if trainAware}
    <p class="blurb">
      Point me at a training <strong>log file</strong> or a <strong>folder</strong> (I follow the
      newest file). I'll cheer epochs, notice the loss drop, celebrate a clean finish, and sit with
      you if it crashes. Works wherever you train — laptop, server, or Colab synced to a folder.
    </p>
    {#if logPath}
      <div class="status">📜 <code>{logPath}</code>{#if trainStatus} — {trainStatus}{/if}</div>
    {/if}
    <input
      class="path"
      type="text"
      spellcheck="false"
      placeholder="C:\\path\\to\\train.log   ·   or a logs\\ folder"
      bind:value={logIn}
      onkeydown={(e) => e.key === "Enter" && logDirty && onSetLog(logIn)}
    />
    <div class="row">
      <button class="save" disabled={!logDirty} onclick={() => onSetLog(logIn)}>
        {logPath ? "Update" : "Watch log"}
      </button>
      {#if logPath}
        <button class="stop" onclick={onStopLog}>Stop</button>
      {/if}
    </div>
    <div class="testrow">
      <span class="testlbl">🧪 Try</span>
      <button class="test" onclick={onTestTrain}>Run finished</button>
      <button class="test" onclick={onTestCrash}>Crash</button>
    </div>
    {#if gpu && gpuAvailable}
      <div class="status gpu">
        🎮 GPU <strong>{gpu.util}%</strong>
        · {(gpu.mem_used / 1024).toFixed(1)}/{(gpu.mem_total / 1024).toFixed(0)} GB
        · {gpu.temp}°C · {gpu.procs} proc{gpu.procs === 1 ? "" : "s"}
      </div>
    {/if}
  {/if}

  <!-- ─── flow / focus sensing (privacy-safe: app NAMES only) ─── -->
  <h3>Flow sensing</h3>
  <label class="gpurow">
    <input type="checkbox" checked={flowAware} onchange={(e) => onToggleFlow((e.target as HTMLInputElement).checked)} />
    <span>Notice when I'm in flow vs. stuck</span>
  </label>
  <p class="hint">
    Reads only the <strong>foreground app's name</strong> + your repo's save rhythm — never window
    titles, keystrokes, or content. Stays quiet during deep focus; a rare gentle line when you've
    clearly been grinding. All local.
  </p>

  <!-- ─── shareable showcase card ─── -->
  <button class="showcase" onclick={onShowcase}>📣 Showcase card — share your journey</button>
  <button class="showcase" onclick={onCard}>🖼️ README card — live status SVG for your repo</button>

  <!-- ─── private-repo access (optional token, applies to GitHub) ─── -->
  <div class="tokrow">
    <button class="toklink" onclick={() => (showToken = !showToken)} aria-expanded={showToken}>
      {hasToken ? "🔑 token saved" : "🔒 private repos?"}
      <span class="chev">{showToken ? "▾" : "▸"}</span>
    </button>
  </div>
  {#if showToken}
    <input
      class="path"
      type="password"
      autocomplete="off"
      spellcheck="false"
      placeholder={hasToken ? "•••••• (saved) — paste a new one to replace" : "ghp_… / github_pat_…"}
      bind:value={token}
      onkeydown={(e) => e.key === "Enter" && token.trim() && (onSaveToken(token), (token = ""))}
    />
    <div class="row">
      <button class="save" disabled={!token.trim()} onclick={() => { onSaveToken(token); token = ""; }}>
        Save token
      </button>
      {#if hasToken}
        <button class="stop" onclick={() => { onClearToken(); token = ""; }}>Remove</button>
      {/if}
    </div>
    <p class="hint">
      Use a <strong>fine-grained</strong>, read-only token (Contents + Metadata: Read).
      Stored only on this PC; sent only to GitHub over HTTPS.
    </p>
  {/if}
</div>

<style>
  .panel {
    position: absolute;
    top: 10px;
    bottom: 10px;        /* anchor to the window so it never spills off-screen */
    left: 10px;
    right: 10px;
    overflow-y: auto;    /* taller content scrolls inside the window */
    overscroll-behavior: contain;
    padding: 12px;
    border-radius: 16px;
    background: rgba(33, 28, 48, 0.96);
    border: 1px solid rgba(120, 108, 160, 0.45);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
    color: #ece6f7;
    display: flex;
    flex-direction: column;
    gap: 7px;
    z-index: 5;
    transition: opacity 0.18s ease;
  }
  /* ducked out of the way while a test reaction plays, so the pet is visible */
  .panel.peeking {
    opacity: 0;
    pointer-events: none;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: #f0b66a;
  }
  .x {
    background: none;
    border: none;
    color: #8d82ab;
    cursor: pointer;
    font-size: 12px;
  }
  .blurb {
    font-size: 11.5px;
    line-height: 1.5;
    color: #b6acce;
    margin: 0;
  }
  h3 {
    margin: 6px 0 1px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9d92bd;
  }
  .status {
    font-size: 11px;
    color: #c9bff0;
    background: rgba(120, 100, 180, 0.16);
    border-radius: 8px;
    padding: 4px 8px;
    word-break: break-all;
  }
  .status code {
    color: #f0cfa0;
    font-size: 10.5px;
  }
  .path {
    width: 100%;
    box-sizing: border-box;
    padding: 7px 9px;
    border-radius: 9px;
    border: 1px solid rgba(120, 108, 160, 0.45);
    background: rgba(22, 17, 36, 0.9);
    color: #ece6f7;
    font-size: 11.5px;
    font-family: inherit;
  }
  .path:focus {
    outline: none;
    border-color: #f0b66a;
  }
  .row {
    display: flex;
    gap: 7px;
  }
  .save,
  .stop {
    flex: 1;
    padding: 6px 10px;
    border-radius: 9px;
    border: 1px solid rgba(120, 108, 160, 0.45);
    background: rgba(48, 38, 68, 0.92);
    color: #ece6f7;
    font-size: 11.5px;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.16s, background 0.16s, opacity 0.16s;
  }
  .save:hover:not(:disabled),
  .stop:hover {
    border-color: #f0b66a;
    background: rgba(60, 46, 82, 0.96);
  }
  .save:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .stop {
    flex: 0 0 auto;
    color: #d9a0a0;
  }
  .testrow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin-top: 4px;
  }
  .testlbl {
    font-size: 10.5px;
    color: #9d92bd;
    margin-right: 2px;
  }
  .test {
    padding: 4px 10px;
    border-radius: 8px;
    border: 1px solid rgba(120, 108, 160, 0.45);
    background: rgba(40, 32, 58, 0.9);
    color: #ddd5ee;
    font-size: 10.5px;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.16s, background 0.16s;
  }
  .test:hover {
    border-color: #f0b66a;
    background: rgba(56, 44, 78, 0.96);
  }
  .test.fix:hover {
    border-color: #8fd6a0;
  }
  .showcase {
    margin-top: 4px;
    padding: 7px 10px;
    border-radius: 9px;
    border: 1px solid rgba(240, 182, 106, 0.4);
    background: rgba(240, 182, 106, 0.12);
    color: #f0d9a6;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.16s;
  }
  .showcase:hover {
    background: rgba(240, 182, 106, 0.22);
  }
  .tokrow {
    display: flex;
    margin-top: 2px;
  }
  .toklink {
    background: none;
    border: none;
    color: #9d92bd;
    font-size: 10.5px;
    font-family: inherit;
    cursor: pointer;
    padding: 2px 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .toklink:hover {
    color: #f0b66a;
  }
  .chev {
    font-size: 8px;
    opacity: 0.8;
  }
  .hint {
    font-size: 10px;
    color: #8d82ab;
    margin: 0;
  }
  .gpurow {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11.5px;
    color: #ddd5ee;
    cursor: pointer;
  }
  .gpurow input {
    accent-color: #f0b66a;
    cursor: pointer;
  }
  .status.gpu strong {
    color: #f0cfa0;
  }
</style>
