// Constants for brick dimensions and spacing
export const FULL_BRICK_LENGTH = 210; // mm
export const HALF_BRICK_LENGTH = 100; // mm
export const BRICK_HEIGHT = 50; // mm
export const HEAD_JOINT = 10; // mm
export const COURSE_HEIGHT = 62.5; // mm (brick height + bed joint)
export const CUSTOM_BRICK_ECB1_LENGTH = 40; // mm, for English Cross Bond courses 1 and 3
export const CUSTOM_BRICK_FLEMISH_HEADER_LENGTH = 45; // mm, for Flemish bond

export type BondType = "stretcher" | "english_cross" | "flemish";
export type BrickType =
  | "full"
  | "half"
  | "custom_40"
  | "custom_end"
  | "custom_45";

export interface Brick {
  x: number;
  y: number;
  type: BrickType;
  length: number; // Actual length of the brick
  strideIndex: number;
  orderInStride: number;
  id: string;
}

export const generateInitialBrickLayout = (
  bondType: BondType,
  wallWidth: number,
  wallHeight: number
): Brick[] => {
  const generatedBricks: Brick[] = [];
  const numCourses = Math.floor(wallHeight / COURSE_HEIGHT);

  for (let courseIndex = 0; courseIndex < numCourses; courseIndex++) {
    const y = courseIndex * COURSE_HEIGHT;
    let currentX = 0;
    let brickInCourseIndex = 0;

    if (bondType === "stretcher") {
      const isEvenCourse = courseIndex % 2 === 0;
      while (currentX < wallWidth) {
        const remainingRowLength = wallWidth - currentX;
        if (remainingRowLength <= 0) break;

        let brickToPlace: { type: BrickType; length: number } | null = null;
        const startWithHalf = !isEvenCourse && brickInCourseIndex === 0;

        if (startWithHalf) {
          if (remainingRowLength >= HALF_BRICK_LENGTH) {
            brickToPlace = { type: "half", length: HALF_BRICK_LENGTH };
          } else {
            brickToPlace = {
              type: "custom_end",
              length: remainingRowLength,
            };
          }
        } else {
          if (remainingRowLength >= FULL_BRICK_LENGTH) {
            brickToPlace = { type: "full", length: FULL_BRICK_LENGTH };
          } else if (remainingRowLength >= HALF_BRICK_LENGTH) {
            brickToPlace = { type: "half", length: HALF_BRICK_LENGTH };
          } else {
            brickToPlace = {
              type: "custom_end",
              length: remainingRowLength,
            };
          }
        }

        if (brickToPlace) {
          generatedBricks.push({
            x: currentX,
            y,
            type: brickToPlace.type,
            length: brickToPlace.length,
            strideIndex: -1, // Will be updated by stride calculation
            orderInStride: -1, // Will be updated by stride calculation
            id: `brick-${courseIndex}-${brickInCourseIndex}`,
          });

          if (currentX + brickToPlace.length < wallWidth) {
            currentX += brickToPlace.length + HEAD_JOINT;
          } else {
            currentX += brickToPlace.length;
          }
          brickInCourseIndex++;
        } else {
          break;
        }
      }
    } else if (bondType === "english_cross") {
      const patternType = courseIndex % 4;
      while (currentX < wallWidth) {
        const remainingRowLength = wallWidth - currentX;
        if (remainingRowLength <= 0) break;

        let brickToPlace: { type: BrickType; length: number } | null = null;

        if (patternType === 0) {
          // Full bricks primarily
          if (remainingRowLength >= FULL_BRICK_LENGTH) {
            brickToPlace = { type: "full", length: FULL_BRICK_LENGTH };
          } else if (remainingRowLength >= HALF_BRICK_LENGTH) {
            brickToPlace = { type: "half", length: HALF_BRICK_LENGTH };
          } else {
            brickToPlace = {
              type: "custom_end",
              length: remainingRowLength,
            };
          }
        } else if (patternType === 1 || patternType === 3) {
          // Custom(40) - Half - Half ...
          if (brickInCourseIndex === 0) {
            if (remainingRowLength >= CUSTOM_BRICK_ECB1_LENGTH) {
              brickToPlace = {
                type: "custom_40",
                length: CUSTOM_BRICK_ECB1_LENGTH,
              };
            } else {
              brickToPlace = {
                type: "custom_end",
                length: remainingRowLength,
              };
            }
          } else {
            if (remainingRowLength >= HALF_BRICK_LENGTH) {
              brickToPlace = { type: "half", length: HALF_BRICK_LENGTH };
            } else {
              brickToPlace = {
                type: "custom_end",
                length: remainingRowLength,
              };
            }
          }
        } else {
          // patternType === 2: Half - Full - Full ...
          if (brickInCourseIndex === 0) {
            if (remainingRowLength >= HALF_BRICK_LENGTH) {
              brickToPlace = { type: "half", length: HALF_BRICK_LENGTH };
            } else {
              brickToPlace = {
                type: "custom_end",
                length: remainingRowLength,
              };
            }
          } else {
            if (remainingRowLength >= FULL_BRICK_LENGTH) {
              brickToPlace = { type: "full", length: FULL_BRICK_LENGTH };
            } else if (remainingRowLength >= HALF_BRICK_LENGTH) {
              brickToPlace = { type: "half", length: HALF_BRICK_LENGTH };
            } else {
              brickToPlace = {
                type: "custom_end",
                length: remainingRowLength,
              };
            }
          }
        }

        if (brickToPlace) {
          generatedBricks.push({
            x: currentX,
            y,
            type: brickToPlace.type,
            length: brickToPlace.length,
            strideIndex: -1, // Will be updated by stride calculation
            orderInStride: -1, // Will be updated by stride calculation
            id: `brick-${courseIndex}-${brickInCourseIndex}`,
          });
          if (currentX + brickToPlace.length < wallWidth) {
            currentX += brickToPlace.length + HEAD_JOINT;
          } else {
            currentX += brickToPlace.length;
          }
          brickInCourseIndex++;
        } else {
          break;
        }
      }
    } else if (bondType === "flemish") {
      const isLine1Pattern = courseIndex % 2 === 0;
      while (currentX < wallWidth) {
        const remainingRowLength = wallWidth - currentX;
        if (remainingRowLength <= 0) break;
        let brickToPlace: { type: BrickType; length: number } | null = null;

        if (isLine1Pattern) {
          // Full - Half - Full - Half
          const useFullBrick = brickInCourseIndex % 2 === 0;
          if (useFullBrick) {
            if (remainingRowLength >= FULL_BRICK_LENGTH) {
              brickToPlace = { type: "full", length: FULL_BRICK_LENGTH };
            } else if (remainingRowLength >= HALF_BRICK_LENGTH) {
              brickToPlace = { type: "half", length: HALF_BRICK_LENGTH };
            } else {
              brickToPlace = {
                type: "custom_end",
                length: remainingRowLength,
              };
            }
          } else {
            // Use Half Brick
            if (remainingRowLength >= HALF_BRICK_LENGTH) {
              brickToPlace = { type: "half", length: HALF_BRICK_LENGTH };
            } else {
              brickToPlace = {
                type: "custom_end",
                length: remainingRowLength,
              };
            }
          }
        } else {
          // Line 2: Custom(45) - Half - Full - Half - Full
          if (brickInCourseIndex === 0) {
            // Custom 45mm
            if (remainingRowLength >= CUSTOM_BRICK_FLEMISH_HEADER_LENGTH) {
              brickToPlace = {
                type: "custom_45",
                length: CUSTOM_BRICK_FLEMISH_HEADER_LENGTH,
              };
            } else {
              brickToPlace = {
                type: "custom_end",
                length: remainingRowLength,
              };
            }
          } else {
            // After the first custom_45 brick, the pattern is Half, Full, Half, Full ...
            // So, at brickInCourseIndex 1, 3, 5... (odd indices) place Half
            // At brickInCourseIndex 2, 4, 6... (even indices) place Full
            const isHalfBrickSpot = (brickInCourseIndex - 1) % 2 === 0;
            if (isHalfBrickSpot) {
              // Half brick
              if (remainingRowLength >= HALF_BRICK_LENGTH) {
                brickToPlace = { type: "half", length: HALF_BRICK_LENGTH };
              } else {
                brickToPlace = {
                  type: "custom_end",
                  length: remainingRowLength,
                };
              }
            } else {
              // Full brick
              if (remainingRowLength >= FULL_BRICK_LENGTH) {
                brickToPlace = { type: "full", length: FULL_BRICK_LENGTH };
              } else if (remainingRowLength >= HALF_BRICK_LENGTH) {
                // Can't fit full, try half
                brickToPlace = { type: "half", length: HALF_BRICK_LENGTH };
              } else {
                brickToPlace = {
                  type: "custom_end",
                  length: remainingRowLength,
                };
              }
            }
          }
        }

        if (brickToPlace) {
          generatedBricks.push({
            x: currentX,
            y,
            type: brickToPlace.type,
            length: brickToPlace.length,
            strideIndex: -1,
            orderInStride: -1,
            id: `brick-${courseIndex}-${brickInCourseIndex}`,
          });
          if (currentX + brickToPlace.length < wallWidth) {
            currentX += brickToPlace.length + HEAD_JOINT;
          } else {
            currentX += brickToPlace.length;
          }
          brickInCourseIndex++;
        } else {
          break;
        }
      }
    }
  }
  return generatedBricks;
};
