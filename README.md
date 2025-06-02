# Masonry – Local Development & Stride Calculator Overview

## Getting started (pnpm)

1. Install pnpm (if you don't already have it):

```sh
npm install -g pnpm
```

2. Install project dependencies:

```sh
pnpm install
```

3. Run the development server:

```sh
pnpm dev
```

The app will be available at **http://localhost:5173** (default Vite port).

4. Other handy scripts:

```sh
pnpm build     # production build
pnpm preview   # serve the production build locally
pnpm lint      # run eslint
```

---

## Stride Calculator (`src/utils/strideCalculator.ts`)

`calculateWallStrides` breaks the complete wall into **strides** – groups of
bricks that the robot can place without moving its chassis.
The routine is greedy; it favours the stride that places the _most_ bricks
right now and repeats until everything is placed.

High-level flow:

1. **Loop while bricks remain**
   1. Find the bottom-most course (smallest `y`) still containing unplaced
      bricks. This `y` becomes the fixed bottom edge of the next envelope.
2. **Generate candidate `startX` positions**
   For every unplaced brick consider two options:
   • envelope's left edge aligns with the brick's left edge
   • envelope's right edge aligns with the brick's right edge
   Clamp each option so the envelope stays inside the wall bounds.
3. **Evaluate each candidate envelope `(startX, startY)`**
   - Collect unplaced bricks that lie completely inside the envelope.
   - Iterate through them in course-then-left-to-right order:
     include a brick only if `isBrickSupported` confirms 100 % support from
     bricks already placed globally **or** earlier in this tentative stride.
4. **Filter & choose**
   Discard candidates that don't place at least one brick on the current
   bottom-most course.
   Keep the candidate that places the greatest number of bricks
   (ties resolved by first-come).
   If no candidate places anything, fall back to a stride containing just the
   first unplaced brick.
5. **Commit**
   Mark chosen bricks as placed, record their `strideIndex` and
   `orderInStride`, and store the envelope bounds.
6. **Repeat** until every brick has been assigned a stride.

Return shape:

```ts
{
  strides:   Brick[][]          // ordered array of strides
  envelopes: Record<number, {   // strideIndex → envelope bounds
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>
}
```

⚠️ This heuristic is _not_ guaranteed to be globally optimal, but it is simple,
fast, and works well enough for now. Feel free to experiment with more
sophisticated search/optimisation techniques!
