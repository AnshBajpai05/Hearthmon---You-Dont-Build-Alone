<script lang="ts">
  // Quiet reminders — small personal nudges (tea time, breakfast, brush again) the companion
  // surfaces gently at the time you choose. Plus your birthday, so it can be remembered.
  // Soul: a nudge, never an alarm; no guilt if missed; everything optional.
  import { onMount } from "svelte";
  import { getReminders, setReminders, getMeta, setMeta, type Reminder } from "../db";

  interface Props {
    onClose: () => void;
  }
  let { onClose }: Props = $props();

  let reminders = $state<Reminder[]>([]);
  let birthday = $state("");
  let savedBirthday = $state("");
  let loaded = $state(false);

  // add-form state
  let newText = $state("");
  let newTime = $state("");
  let newRepeat = $state<"daily" | "once">("daily");

  const todayISO = new Date().toISOString().slice(0, 10);

  onMount(async () => {
    reminders = await sortByTime(await getReminders());
    savedBirthday = (await getMeta("user_birthday")) ?? "";
    birthday = savedBirthday;
    loaded = true;
  });

  async function sortByTime(list: Reminder[]): Promise<Reminder[]> {
    return [...list].sort((a, b) => a.time.localeCompare(b.time));
  }

  function pretty(time: string): string {
    const [hStr, m] = time.split(":");
    let h = Number(hStr);
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  async function addReminder() {
    const text = newText.trim();
    if (!text || !newTime) return;
    const r: Reminder = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      time: newTime,
      repeat: newRepeat
    };
    reminders = await sortByTime([...reminders, r]);
    await setReminders(reminders);
    newText = "";
    newTime = "";
    newRepeat = "daily";
  }

  async function removeReminder(id: string) {
    reminders = reminders.filter((r) => r.id !== id);
    await setReminders(reminders);
  }

  async function saveBirthday() {
    await setMeta("user_birthday", birthday);
    savedBirthday = birthday;
  }
</script>

<div class="panel">
  <div class="head">
    <span>Quiet reminders</span>
    <button class="x" onclick={onClose} aria-label="Close">✕</button>
  </div>

  <div class="scroll">
    <!-- Birthday -->
    <h3>Your birthday</h3>
    <div class="bday">
      <input type="date" bind:value={birthday} max={todayISO} />
      <button class="mini" disabled={birthday === savedBirthday} onclick={saveBirthday}>
        {savedBirthday && birthday === savedBirthday ? "saved" : "save"}
      </button>
    </div>

    <!-- Add a reminder -->
    <h3>Add a reminder</h3>
    <div class="add">
      <input class="text" type="text" maxlength="60" placeholder="e.g. tea time, brush again…" bind:value={newText} />
      <div class="add-row">
        <input class="time" type="time" bind:value={newTime} />
        <select bind:value={newRepeat}>
          <option value="daily">every day</option>
          <option value="once">once</option>
        </select>
        <button class="mini add-btn" disabled={!newText.trim() || !newTime} onclick={addReminder}>＋</button>
      </div>
    </div>

    <!-- List -->
    {#if loaded && reminders.length}
      <h3>Set</h3>
      <div class="list">
        {#each reminders as r (r.id)}
          <div class="item">
            <span class="time-chip">{pretty(r.time)}</span>
            <span class="rtext">{r.text}</span>
            <span class="repeat">{r.repeat === "daily" ? "daily" : "once"}</span>
            <button class="del" onclick={() => removeReminder(r.id)} aria-label="Delete">✕</button>
          </div>
        {/each}
      </div>
    {:else if loaded}
      <p class="empty">No reminders yet. Add one above — I'll nudge you, gently.</p>
    {/if}

    <p class="note">
      I'll mention these softly at the time you pick — no alarms, no guilt if a day slips.
      <br />(Reminders only fire while I'm running.)
    </p>
  </div>
</div>

<style>
  .panel {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    max-height: 300px;
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
  .scroll {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-right: 4px;
  }
  .scroll::-webkit-scrollbar {
    width: 5px;
  }
  .scroll::-webkit-scrollbar-thumb {
    background: rgba(120, 108, 160, 0.4);
    border-radius: 3px;
  }
  h3 {
    margin: 8px 0 2px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #9d92bd;
  }
  input,
  select {
    border-radius: 9px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(0, 0, 0, 0.25);
    color: #ece6f7;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    padding: 6px 8px;
    color-scheme: dark;
  }
  .bday {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .add {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .add .text {
    width: 100%;
  }
  .add-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .add-row .time {
    flex: 0 0 auto;
  }
  .add-row select {
    flex: 1 1 auto;
  }
  .mini {
    padding: 6px 10px;
    border-radius: 9px;
    border: none;
    background: #f0b66a;
    color: #2b2138;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
  }
  .mini:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .add-btn {
    font-size: 15px;
    line-height: 1;
    padding: 5px 11px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 8px;
    border-radius: 10px;
    background: rgba(120, 108, 160, 0.12);
    border: 1px solid rgba(150, 130, 210, 0.25);
  }
  .time-chip {
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 700;
    color: #f0b66a;
    background: rgba(240, 182, 106, 0.12);
    border-radius: 6px;
    padding: 2px 6px;
    white-space: nowrap;
  }
  .rtext {
    flex: 1 1 auto;
    font-size: 12px;
    color: #f3eefc;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .repeat {
    flex: 0 0 auto;
    font-size: 9px;
    color: #8d82ab;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .del {
    flex: 0 0 auto;
    background: none;
    border: none;
    color: #8d82ab;
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
  }
  .del:hover {
    color: #f08a8a;
  }
  .empty {
    font-size: 12px;
    line-height: 1.5;
    color: #b6acce;
    text-align: center;
    margin: 8px 4px;
  }
  .note {
    margin: 8px 2px 2px;
    font-size: 10px;
    line-height: 1.5;
    color: #7d7398;
    text-align: center;
  }
</style>
