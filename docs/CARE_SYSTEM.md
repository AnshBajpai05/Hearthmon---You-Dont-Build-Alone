# CARE_SYSTEM.md — optional care, soul-aligned

> The question is **not** "how do we make users feed the pet?" It is
> **"what creates voluntary attachment over months?"** Hearthmon peaks at month six.
> Read [SOUL.md](../SOUL.md) first. When this doc and SOUL.md disagree, SOUL.md wins.

---

## The keystone doctrine

> **Care may create rewards. Care may never prevent penalties.**

Every mechanic below is a *pull* (act → something warm happens / is revealed / lasts), never a
*push* (act → or a bad thing happens). The moment a mechanic punishes absence or inactivity, it has
left Hearthmon.

A corollary we learned the hard way: **interaction must build warmth, never spend it.** "Energy
drains from interaction → feed" is backwards — it teaches *interaction = maintenance debt*. We teach
*interaction = relationship*.

```
User A: played → pet hungry → must feed     →  interaction = obligation
User B: played → pet cozy, remembers it,    →  interaction = attachment
        habitat warms a little
```

---

## The model: A + B + a little D

### A — Moods as Invitations *(the daily-variation engine)*
The pet drifts through transient states — sleepy, playful, curious, **treat-curious**, cozy,
restless — shaped by time of day, recent activity, weather, type, and bond. Each state gently
**invites** a fitting interaction (a look toward the jar, a playful bounce, an ambient cue), and
**never demands** one. Engage → an extra-warm, state-specific moment. Ignore → the mood passes on
its own, content. No cost, ever.

*Without A, the pet is the same every day → wallpaper.*

### B — Keepsakes / warmth traces *(the persistence engine)*
Every optional care act leaves a **permanent positive trace that only accumulates**: the habitat
warms a notch (lantern, life), the Journey fills, the bond ratchets up, cozy details unlock.
**Nothing ever decays.** You return to something that *grew*.

*Without B, a cute interaction is forgotten forever.*

### D — Tiny rituals *(the rhythm seasoning — a pinch, not a quest)*
A handful of small, warm, recurring touchpoints: a morning stretch, the **first treat of the day**
landing extra-appreciated, a weather-specific moment. Engaging in the window earns a special beat;
missing it loses **nothing** — the ritual simply happens or waits.

*Not a daily quest. Rhythm, not obligation.*

---

## Soul-safe re-frames of the original ask

**Treat-curious — the soul-safe "hunger" (the unlock).** Not *"I'm hungry"* (a need) but
*"I'd enjoy a treat right now"* (an opportunity). Occasionally — from mood/rhythm, **never from a
drain** — the pet eyes the jar with a hopeful look. Feed now → extra delight + a happy memory.
Ignore → a content shrug. An offer of a nice moment, never a deficit to fix.

**Sleepy & waking.** The pet gets drowsy after a long *active* session or late at night — rest is
the natural close of a good day, **cozy, never failure**. zzz animation. It wakes on its own, or
glad if you gently rouse it. It **never** auto-switches, **never** says "feed me," **never**
deteriorates.

**The week-away test (the real test).** A user disappears for seven days and returns to:

> "Had a long nap. Welcome back."

Not: hungry / sad / dirty / energy 0. The one that survives long term is the one that makes the user
*smile* on return, not feel guilt. (Handled by the existing return-without-shame system.)

---

## What we never build

- ❌ Any **visible draining number/bar.** Once a number exists, humans optimize it; the number
  becomes the feature and the relationship becomes secondary.
- ❌ Any **required** feeding / tending.
- ❌ Any **penalty** for absence, neglect, or inactivity — no sadness, sickness, decay, or leaving.

---

## v0.1 — ship the shelf, not the cathedral

Following the same discipline as [HEARTH_SHELF.md](HEARTH_SHELF.md): build the smallest version
that proves the pull is real, on top of systems that already exist (treats, petting, play, bond,
drift, quirks, chapter memory, Journey, biomes, weather).

**Ship:**
1. **The mood-invitation layer (A)** — a small state machine over the existing `petState`: a few
   moods with triggers + natural expiries + *gentle* cues. Start with **treat-curious**, **sleepy**,
   **playful**, **curious**. No new currency, no new bar.
2. **One persistent keepsake (B)** — habitat warmth that nudges up a notch from any care act and
   **never** goes back down.

**Defer:** the full mood set, rituals (D), seasonal drip, any indicator UI.

**Measure:** do people interact *because they want to* (treat-curious accepted, play offered),
with absence staying completely safe? If yes, layer D and more keepsakes. If no, the pull is wrong —
fix that before adding surface.

---

## Behavioral consequences (why this, not a bar)

| | 1 week | 1 month | 6 months |
|---|---|---|---|
| **Draining bar** (rejected) | most interactions (anxiety) | fatigue, "I *have* to check" | churn + guilt-quit |
| **A + B + D** (this) | novelty + first warmth traces | rhythm + visible growth, pride | a personalized record of the relationship; affection |

The bar wins week one and loses the user by month six. This model builds slower but **absence is
safe, so returning is joyful** — which is the entire product.

---

## The pass (every care idea runs SOUL.md's test)

1. Seen, or tracked? 2. Good on the worst day? 3. Warmth, or activity? 4. Rare enough?
5. Could it read as guilt / comparison / pressure? *(if yes — don't.)* 6. Does it deepen history?

If it can't pass — and especially if it ever **prevents a penalty** rather than **creating a
reward** — it doesn't ship.
