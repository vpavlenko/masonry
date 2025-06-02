import type { Brick } from "./bondGenerator";
import { COURSE_HEIGHT, BRICK_HEIGHT } from "./bondGenerator";

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
 */
const isBrickSupported = (
  brick: Brick,
  globallyPlacedBricks: ReadonlySet<string>,
  bricksAlreadyInCurrentStride: readonly Brick[],
  allWallBricks: readonly Brick[]
): boolean => {
  if (brick.y === 0) return true;

  const brickEndX = brick.x + brick.length;

  const supportingBricksBelow = allWallBricks.filter(
    (candidateSupportBrick) => {
      if (candidateSupportBrick.y !== brick.y - COURSE_HEIGHT) return false;

      const supportCandidateEndX =
        candidateSupportBrick.x + candidateSupportBrick.length;
      if (
        !(candidateSupportBrick.x < brickEndX && supportCandidateEndX > brick.x)
      )
        return false;

      const isGloballyPlaced = globallyPlacedBricks.has(
        candidateSupportBrick.id
      );
      const isLocallyPlaced = bricksAlreadyInCurrentStride.some(
        (b) => b.id === candidateSupportBrick.id
      );
      return isGloballyPlaced || isLocallyPlaced;
    }
  );

  let totalActualSupportLength = 0;
  const sortedActualSupports = supportingBricksBelow.sort((a, b) => a.x - b.x);

  for (const support of sortedActualSupports) {
    const overlapStart = Math.max(support.x, brick.x);
    const overlapEnd = Math.min(support.x + support.length, brickEndX);
    if (overlapEnd > overlapStart) {
      totalActualSupportLength += overlapEnd - overlapStart;
    }
  }
  // Ensure at least 25% of the brick's length is supported, or 90% as originally.
  // Using 0.9 for consistency with original intent if not specified otherwise.
  const requiredSupportLength = brick.length * 0.9;
  return totalActualSupportLength >= requiredSupportLength;
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
  const globallyPlacedBrickIds = new Set<string>();
  let strideIndexCounter = 0;

  while (globallyPlacedBrickIds.size < allWallBricks.length) {
    const unplacedBricks = allWallBricks.filter(
      (b) => !globallyPlacedBrickIds.has(b.id)
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
       2. Build the candidate X positions *only* from the bricks that are
          on that bottom-most course.  Each brick yields two start-X
          options: one where the envelope's left edge touches the brick's
          left edge, and one where it touches the brick's right edge.
       ------------------------------------------------------------------- */
    const candidateRobotStartXSet = new Set<number>();

    unplacedBricks
      .filter((b) => b.y === bottomMostY)
      .forEach((brick) => {
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
        if (
          isBrickSupported(
            potentialBrick,
            globallyPlacedBrickIds,
            tempCurrentStrideAttempt,
            allWallBricks // Pass allWallBricks here
          )
        ) {
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
        globallyPlacedBrickIds.add(b.id);
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
