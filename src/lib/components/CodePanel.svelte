<script lang="ts">
  // Coding Awareness config: point the pet at a git repo, and it quietly
  // reacts to your commits (and cheers the bug-fixes). Local-only; the path
  // is read by the Rust backend, nothing leaves this machine.
  import { untrack } from "svelte";

  interface Props {
    current: string;                 // currently-watched source ("" = none)
    isRemote: boolean;               // true = a GitHub URL, false = a local folder
    hasToken: boolean;               // a private-access token is saved
    onSave: (path: string) => void;
    onStop: () => void;
    onSaveToken: (token: string) => void;
    onClearToken: () => void;
    onTest: (message: string) => void;   // fire a fake commit to preview the reaction
    onClose: () => void;
  }
  let {
    current, isRemote, hasToken,
    onSave, onStop, onSaveToken, onClearToken, onTest, onClose
  }: Props = $props();

  // seed the input from the current path once (intentionally just the initial value)
  let path = $state(untrack(() => current));
  const dirty = $derived(path.trim() !== "" && path.trim() !== current);

  let showToken = $state(false);     // reveal the token field on demand
  let token = $state("");            // write-only; never pre-filled with the saved value

  // fire a test, then duck the panel out of the way so the reaction is visible
  let peeking = $state(false);
  let peekTimer: ReturnType<typeof setTimeout>;
  function fireTest(message: string) {
    onTest(message);
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
    Watch a project and I'll quietly notice commits — and cheer the bug-fixes.
    Give me a <strong>local folder</strong> (instant), a <strong>repo URL</strong>,
    or your whole <strong>GitHub account</strong> (catches pushes everywhere).
  </p>

  {#if current && isRemote}
    <div class="status">🌐 Tracking <code>{current}</code></div>
  {:else if current}
    <div class="status">👀 Watching <code>{current}</code></div>
  {:else}
    <div class="status off">Not watching anything yet.</div>
  {/if}

  <input
    class="path"
    type="text"
    spellcheck="false"
    placeholder="C:\\path\\to\\repo  ·  or  github.com/you  ·  or  github.com/you/repo"
    bind:value={path}
    onkeydown={(e) => e.key === "Enter" && dirty && onSave(path)}
  />

  <div class="row">
    <button class="save" disabled={!dirty} onclick={() => onSave(path)}>
      {current ? "Update" : "Watch this repo"}
    </button>
    {#if current}
      <button class="stop" onclick={onStop}>Stop watching</button>
    {/if}
  </div>

  <p class="hint">
    Local folder = the one with <code>.git</code> (reacts instantly). GitHub links
    are checked every few minutes.
  </p>

  <!-- ─── try the reaction now (no real commit needed) ─── -->
  <div class="testrow">
    <span class="testlbl">🧪 Try it</span>
    <button class="test" onclick={() => fireTest("tidy up the layout")}>Commit</button>
    <button class="test fix" onclick={() => fireTest("fix: squash the off-by-one bug")}>Bug-fix</button>
  </div>

  <!-- ─── private-repo access (optional token) ─── -->
  <div class="tokrow">
    <button
      class="toklink"
      onclick={() => (showToken = !showToken)}
      aria-expanded={showToken}
    >
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
      onkeydown={(e) => e.key === "Enter" && token.trim() && onSaveToken(token)}
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
    left: 10px;
    right: 10px;
    padding: 12px;
    border-radius: 16px;
    background: rgba(33, 28, 48, 0.96);
    border: 1px solid rgba(120, 108, 160, 0.45);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
    color: #ece6f7;
    display: flex;
    flex-direction: column;
    gap: 8px;
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
  .status {
    font-size: 11px;
    color: #c9bff0;
    background: rgba(120, 100, 180, 0.16);
    border-radius: 8px;
    padding: 5px 8px;
    word-break: break-all;
  }
  .status.off {
    color: #8d82ab;
    background: rgba(120, 108, 160, 0.1);
  }
  .status code,
  .hint code {
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
    padding: 7px 10px;
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
  .hint {
    font-size: 10px;
    color: #8d82ab;
    margin: 0;
  }
  .testrow {
    display: flex;
    align-items: center;
    gap: 6px;
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
</style>
