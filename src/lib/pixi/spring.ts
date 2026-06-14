// The heart of V2 motion: a critically-damped spring. Pull `value` toward
// `target` each frame with weight (stiffness) and settle (damping). This is what
// gives the body momentum/overshoot/softness that CSS easing never could.
export class Spring {
  value: number;
  target: number;
  vel = 0;
  stiffness: number;
  damping: number;

  constructor(value = 0, stiffness = 170, damping = 22) {
    this.value = value;
    this.target = value;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  /** Advance by dt seconds (semi-implicit Euler — stable at small dt). */
  step(dt: number): number {
    const force = -this.stiffness * (this.value - this.target);
    const drag = -this.damping * this.vel;
    this.vel += (force + drag) * dt;
    this.value += this.vel * dt;
    return this.value;
  }

  /** Kick the velocity — for hops, taps, landing squash. */
  nudge(v: number): void {
    this.vel += v;
  }

  /** Snap to a value with no motion. */
  set(v: number): void {
    this.value = v;
    this.target = v;
    this.vel = 0;
  }
}
