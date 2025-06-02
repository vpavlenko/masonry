import type { Brick } from "./bondGenerator";
import { COURSE_HEIGHT, BRICK_HEIGHT, HEAD_JOINT } from "./bondGenerator";

export interface StrideMeta {
  minX: number; // Will represent robot's start X for the envelope
  minY: number; // Will represent robot's start Y for the envelope
  maxX: number; // minX + ROBOT_WIDTH
  maxY: number; // minY + ROBOT_HEIGHT
  // We might not need actual bricks here if we just need bounds for visualization
}

export type Stride = Brick[];

/**
 * Checks if a brick has sufficient support from bricks below it
 * Requires 100% continuous support from the layer directly below
 */
const isBrickSupported = (
  brick: Brick,
  placedBricks: readonly Brick[]
): boolean => {
  if (brick.y === 0) return true;

  // Get all bricks in the layer directly under this brick that overlap
  const supportingBricksBelow = placedBricks
    .filter((supportBrick) => {
      // Must be in the course directly below
      if (supportBrick.y !== brick.y - COURSE_HEIGHT) return false;

      return !(
        supportBrick.x >= brick.x + brick.length ||
        supportBrick.x + supportBrick.length < brick.x
      );
      // const supportEndX = supportBrick.x;
      // return supportBrick.x > brick.x && supportEndX > brick.x;
    })
    .sort((a, b) => a.x - b.x);

  if (supportingBricksBelow.length === 0) return false;

  // Scan-line algorithm to ensure continuous support from brick.x to brick.x + brick.length
  let coveredUpTo = brick.x + HEAD_JOINT;

  for (const supportBrick of supportingBricksBelow) {
    if (supportBrick.x > coveredUpTo) return false;

    coveredUpTo = supportBrick.x + supportBrick.length + HEAD_JOINT;
  }

  // Check if we've covered the entire brick (100% support)
  return coveredUpTo >= brick.x + brick.length;
};

/**
 * Calculates the optimal stride sequences for building a wall with robot constraints
 */
export const calculateWallStrides = (
  allWallBricks: readonly Brick[],
  envWidth: number,
  envHeight: number,
  wallWidth: number
): {
  strides: Stride[];
  envelopes: Record<number, StrideMeta>;
} => {
  const calculatedStrides: Stride[] = [];
  const calculatedEnvelopes: Record<number, StrideMeta> = {};
  const placedBrickIds = new Set<string>();
  let strideIndexCounter = 0;

  while (placedBrickIds.size < allWallBricks.length) {
    const unplacedBricks = allWallBricks.filter(
      (b) => !placedBrickIds.has(b.id)
    );
    if (unplacedBricks.length === 0) break;

    /* -------------------------------------------------------------------
       1. Find the bottom-most (smallest Y) course that still contains
          unplaced bricks and use that Y as the only allowed
          envelope-bottom for the next stride.
       ------------------------------------------------------------------- */
    const bottomMostY = unplacedBricks.reduce(
      (min, b) => Math.min(min, b.y),
      Infinity
    );

    /* -------------------------------------------------------------------
       2. Build the candidate X positions from *all* unplaced bricks,
          regardless of their course.  Each brick yields two start-X
          options: one where the envelope's left edge touches the brick's
          left edge, and one where it touches the brick's right edge.
       ------------------------------------------------------------------- */
    const candidateRobotStartXSet = new Set<number>();

    // Loop through every unplaced brick (no course filtering)
    unplacedBricks.forEach((brick) => {
      // Option A – envelope starts at (or before wall origin) so that
      // the brick's left edge is inside the envelope.
      const candidate1 = Math.max(0, Math.min(brick.x, wallWidth - envWidth));
      candidateRobotStartXSet.add(candidate1);

      // Option B – envelope shifted right so that the brick's right edge
      // is flush with the envelope's right edge.
      const candidate2 = Math.max(
        0,
        Math.min(brick.x + brick.length - envWidth, wallWidth - envWidth)
      );
      candidateRobotStartXSet.add(candidate2);
    });

    const candidateRobotStartXPositions = Array.from(
      candidateRobotStartXSet
    ).sort((a, b) => a - b);

    let bestStrideOption = {
      startX: -1,
      startY: -1,
      bricks: [] as Brick[],
      count: -1,
    };

    for (const candidateStartX of candidateRobotStartXPositions) {
      const candidateStartY = bottomMostY; // enforce bottom-most course

      const horizontallyReachableUnplaced = unplacedBricks.filter((b) => {
        return (
          b.x >= candidateStartX &&
          b.x + b.length <= candidateStartX + envWidth &&
          b.y >= candidateStartY &&
          b.y + BRICK_HEIGHT <= candidateStartY + envHeight
        );
      });

      const tempCurrentStrideAttempt: Brick[] = [];

      const potentialBricksForOption = horizontallyReachableUnplaced.sort(
        (a, b) => {
          if (a.y !== b.y) return a.y - b.y;
          return a.x - b.x;
        }
      );

      for (const potentialBrick of potentialBricksForOption) {
        // Create a merged array of all placed bricks (global + current stride)
        const allPlacedBricks = [
          ...allWallBricks.filter((b) => placedBrickIds.has(b.id)),
          ...tempCurrentStrideAttempt,
        ];

        if (isBrickSupported(potentialBrick, allPlacedBricks)) {
          tempCurrentStrideAttempt.push(potentialBrick);
        }
      }

      if (tempCurrentStrideAttempt.length > bestStrideOption.count) {
        bestStrideOption = {
          startX: candidateStartX,
          startY: candidateStartY,
          bricks: [...tempCurrentStrideAttempt],
          count: tempCurrentStrideAttempt.length,
        };
      }
    }

    if (bestStrideOption.count <= 0) {
      const fallbackBrick = unplacedBricks[0];
      bestStrideOption = {
        startX: Math.max(0, Math.min(fallbackBrick.x, wallWidth - envWidth)),
        startY: fallbackBrick.y,
        bricks: [fallbackBrick],
        count: 1,
      };
    }

    const finalCurrentStride = bestStrideOption.bricks.map((b) => ({
      ...b,
    }));

    if (finalCurrentStride.length > 0) {
      finalCurrentStride.forEach((b) => {
        b.strideIndex = strideIndexCounter;
        placedBrickIds.add(b.id);
      });
      finalCurrentStride.forEach((brick, order) => {
        brick.orderInStride = order;
      });

      calculatedEnvelopes[strideIndexCounter] = {
        minX: bestStrideOption.startX,
        minY: bestStrideOption.startY,
        maxX: bestStrideOption.startX + envWidth,
        maxY: bestStrideOption.startY + envHeight,
      };

      calculatedStrides.push(finalCurrentStride);
      strideIndexCounter++;
    }
  }
  return { strides: calculatedStrides, envelopes: calculatedEnvelopes };
};
