<script lang="ts">
  import { fly, fade } from "svelte/transition";
  let { text }: { text: string } = $props();
</script>

{#if text}
  <div class="bubble" in:fly={{ y: 8, duration: 280 }} out:fade={{ duration: 450 }}>
    {text}
  </div>
{/if}

<style>
  .bubble {
    max-width: 230px;
    padding: 8px 12px;
    border-radius: 14px;
    border-bottom-right-radius: 4px;
    background: rgba(33, 28, 48, 0.94);
    border: 1px solid rgba(120, 108, 160, 0.45);
    color: #ece6f7;
    font-size: 13px;
    line-height: 1.45;
    text-align: center;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  }
</style>
