<script lang="ts">
  // Raycast-for-emotions: a tiny global command bar (Alt+Space). Type a quick
  // line, hit Enter, the pet reacts. Zero clicks. Verbs are optional.
  interface Props {
    onRun: (text: string) => void;
    onClose: () => void;
  }
  let { onRun, onClose }: Props = $props();

  let value = $state("");
  let input = $state<HTMLInputElement | null>(null);

  // autofocus when mounted
  $effect(() => {
    input?.focus();
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      onRun(value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }
</script>

<!-- click-away closes -->
<div class="cmd-backdrop" onclick={onClose} aria-hidden="true"></div>

<div class="cmd" role="dialog" aria-label="Quick log">
  <input
    bind:this={input}
    bind:value
    class="cmd-input"
    type="text"
    spellcheck="false"
    placeholder="finally fixed the websocket bug…"
    onkeydown={onKey}
  />
  <div class="hints">
    <span><b>win</b> / <b>fix</b> · <b>learned</b> · <b>survived</b> · <b>mood</b> low · <b>praise</b></span>
    <span class="enter">↵ to log · esc</span>
  </div>
</div>

<style>
  .cmd-backdrop {
    position: absolute;
    inset: 0;
    z-index: 19;
  }
  .cmd {
    position: absolute;
    top: 14px;
    left: 12px;
    right: 12px;
    z-index: 20;
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(26, 21, 40, 0.98);
    border: 1px solid rgba(240, 182, 106, 0.4);
    box-shadow: 0 10px 34px rgba(0, 0, 0, 0.55), 0 0 22px rgba(240, 182, 106, 0.12);
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: pop 0.16s cubic-bezier(0.34, 1.4, 0.6, 1);
  }
  @keyframes pop {
    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .cmd-input {
    width: 100%;
    box-sizing: border-box;
    background: transparent;
    border: none;
    outline: none;
    color: #f6f1ff;
    font-size: 14px;
    font-family: inherit;
  }
  .cmd-input::placeholder {
    color: #7d7299;
  }
  .hints {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 9.5px;
    color: #8d82ab;
  }
  .hints b {
    color: #c4b5f0;
    font-weight: 600;
  }
  .enter {
    white-space: nowrap;
    color: #f0b66a;
  }
  @media (prefers-reduced-motion: reduce) {
    .cmd { animation: none; }
  }
</style>
