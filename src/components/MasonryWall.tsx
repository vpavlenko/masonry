import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";

// Constants from assignment
const WALL_WIDTH = 2300; // mm
const WALL_HEIGHT = 2000; // mm
const FULL_BRICK_LENGTH = 210; // mm
const HALF_BRICK_LENGTH = 100; // mm
const BRICK_HEIGHT = 50; // mm
const HEAD_JOINT = 10; // mm
const COURSE_HEIGHT = 62.5; // mm (brick height + bed joint)
const CUSTOM_BRICK_ECB1_LENGTH = 40; // mm, for English Cross Bond courses 1 and 3
const CUSTOM_BRICK_FLEMISH_HEADER_LENGTH = 45; // mm, for Flemish bond

// Robot constraints
const ROBOT_WIDTH = 800; // mm
const ROBOT_HEIGHT = 1300; // mm

type BondType = "stretcher" | "english_cross" | "flemish";

type BrickType = "full" | "half" | "custom_40" | "custom_end" | "custom_45";

interface Brick {
  x: number;
  y: number;
  type: BrickType;
  length: number; // Actual length of the brick
  strideIndex: number;
  orderInStride: number;
  id: string;
}

interface StrideMeta {
  minX: number; // Will represent robot's start X for the envelope
  minY: number; // Will represent robot's start Y for the envelope
  maxX: number; // minX + ROBOT_WIDTH
  maxY: number; // minY + ROBOT_HEIGHT
  // We might not need actual bricks here if we just need bounds for visualization
}

type Stride = Brick[];

// Stride colors - red, blue, orange, green, purple, aqua, lime, then contrasting colors
const STRIDE_COLORS = [
  "#FFFFFF",
  "#820000", // toma to
  "#FF0000",
  "#007000",
  "#00FB47",
  "#9500B3",
  "#EA7EFF",
  "#787878",
  "#0000FF",
  "#03B9D5",
  "#ff7328",
  "#ff0",
  "#0000FF",
  "#FF0000", // red
  "#FFA500", // orange
  "#008000", // green
  "#800080", // purple
  "#00FFFF", // aqua
  "#00FF00", // lime
  "#FF1493", // deep pink
  "#FFD700", // gold
  "#8A2BE2", // blue violet
  "#FF4500", // orange red
  "#32CD32", // lime green
  "#FF69B4", // hot pink
  "#00CED1", // dark turquoise
  "#FF6347", // tomato
  "#9932CC", // dark orchid
  "#00FA9A", // medium spring green
  "#1E90FF", // dodger blue
  "#FF8C00", // dark orange
  "#ADFF2F", // green yellow
  "#DC143C", // crimson
  "#40E0D0", // turquoise
  "#BA55D3", // medium orchid
  "#7FFF00", // chartreuse
  "#CD5C5C", // indian red
  "#4169E1", // royal blue
  "#FF7F50", // coral
  "#98FB98", // pale green
  "#DA70D6", // orchid
  "#87CEEB", // sky blue
];

// Styled Components
const AppContainer = styled.div`
  display: flex;
  height: 100vh;
  width: 100vw;
  padding: 0;
  margin: 0;
`;

const WallColumn = styled.div`
  flex: 0 0 70%;
  height: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow-y: auto; // If content like title makes it too tall
`;

const DebugColumn = styled.div`
  flex: 0 0 30%;
  height: 100%;
  background-color: #000; // Dark background
  padding: 15px;
  overflow-y: auto;
  color: #f0f0f0; // Light default text color
  display: flex;
  flex-direction: column; // To allow fixed positioning of elements at bottom

  h3,
  h4 {
    color: #f0f0f0; // Light text for headers
  }
  label {
    color: #f0f0f0; // Light text for labels
  }
`;

const WallHeader = styled.div`
  margin-bottom: 20px;
  h2,
  p {
    color: #f0f0f0; // Light text for wall header
  }
`;

const WallDisplayContainer = styled.div`
  position: relative;
  // width and height are set dynamically via inline style based on wallScale
  background-color: #000; // 3. Set background to black
  margin: auto; // Center the wall if space allows after scaling
`;

// Wrapper for each brick that includes extra hit‐box area (right head joint and top bed joint) to avoid flicker when moving between adjacent bricks.
const BrickHitBox = styled.div<{
  left: number;
  bottom: number;
  width: number;
  height: number;
}>`
  position: absolute;
  left: ${(props) => props.left}px;
  bottom: ${(props) => props.bottom}px;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  background: transparent;
  pointer-events: auto;
`;

// Modify BrickDiv to be relative inside wrapper (no absolute positioning now)
const BrickDiv = styled.div<{
  width: number;
  height: number;
  borderColor: string;
  fontSize: number;
  isHoveredStrideBrick?: boolean;
  isDirectlyHovered?: boolean;
}>`
  position: absolute;
  left: 0;
  bottom: 0;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  border: 2px solid ${(props) => props.borderColor};
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(props) => props.fontSize}px;
  font-weight: ${(props) => (props.isDirectlyHovered ? "bold" : "normal")};
  color: white; // 3. Text color inside brick to white
  box-sizing: border-box;
  cursor: pointer;
  overflow: hidden;

  box-shadow: ${(props) =>
    props.isHoveredStrideBrick
      ? `inset 0 0 0 3px ${props.borderColor}` // Thicker border inwards (2px border + 3px inset shadow)
      : "none"};
`;

const DebugSection = styled.div`
  margin-bottom: 20px;
  h4 {
    margin-top: 0;
    color: #f0f0f0; // Ensure h4 inside DebugSection is also inverted
  }
  label {
    // Ensure labels inside DebugSection are inverted
    color: #f0f0f0;
  }
`;

const DebugInput = styled.input`
  width: 60px;
  margin-left: 5px;
  padding: 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
  background-color: #333; // Inverted style
  color: #fff; // Inverted style
  border: 1px solid #555; // Inverted style
`;

const HoverInfoBox = styled.div`
  background-color: white;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ddd; // Added a subtle border
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); // Added a subtle shadow
  margin-bottom: 20px; // Added to separate from StrideStats
  p {
    margin: 5px 0;
    font-size: 14px;
  }
  strong {
    color: #555;
  }
  /* text-align: center; // Removed for left alignment */
  background-color: #1a1a1a; // Inverted style
  border: 1px solid #444; // Inverted style
  color: #f0f0f0; // Inverted style
  p {
    margin: 5px 0;
    font-size: 14px;
    color: #f0f0f0; // Ensure p text is inverted
  }
  strong {
    color: #ccc; // Inverted style
  }
  h4 {
    // Ensure h4 inside HoverInfoBox is inverted
    color: #f0f0f0;
  }
`;

const StrideStatItem = styled.div`
  margin-bottom: 8px; // Increased spacing
  font-size: 12px;
  display: flex;
  flex-direction: column; // Stack items vertically initially
  align-items: flex-start;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee; // Separator for items
  color: #f0f0f0; // Default text color for item
  border-bottom: 1px solid #333; // Inverted style

  &:last-child {
    border-bottom: none;
  }

  div {
    // Sub-div for horizontal groups
    display: flex;
    align-items: center;
    margin-bottom: 3px;
  }
  span.label {
    // For labels like "Time:"
    font-weight: bold;
    min-width: 50px; // Ensure alignment
    margin-right: 5px;
    color: #aaa; // Inverted style
  }
  span.coords {
    font-family: monospace;
    color: #ddd; // Inverted style
  }
`;

const StrideColorSwatch = styled.span<{ bgColor: string; textColor: string }>`
  background-color: ${(props) => props.bgColor};
  color: white; // Text on swatch
  color: ${(props) => props.textColor};
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 8px;
  display: inline-block;
  min-width: 20px; // Ensure number is visible
  text-align: center;
`;

const BORDER_WIDTH_PX = 3;
// const OVERLAY_COLOR_STR = "rgba(0, 0, 0, 0.5)"; // No longer used

const StrideEnvelopeDiv = styled.div<{
  left: number;
  bottom: number;
  width: number;
  height: number;
  strideColor: string;
}>`
  position: absolute;
  left: ${(props) => props.left}px;
  bottom: ${(props) => props.bottom}px;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  pointer-events: none;
  z-index: 5;
  box-sizing: border-box;
  // New outward blurred shadow using strideColor, with increased thickness
  box-shadow: 0 0 ${BORDER_WIDTH_PX * 6}px ${BORDER_WIDTH_PX * 2}px
    ${(props) => props.strideColor};
`;

const StrideStatsContainer = styled.div`
  margin-top: auto;
  max-height: 30%; // As per "bottom 30% of right pane" - can be adjusted
  overflow-y: auto;
  border: 1px solid #ccc;
  padding: 10px;
  background-color: #f9f9f9; // Slightly different background for distinction
  h4 {
    margin-top: 0;
    margin-bottom: 15px; // Increased margin
    color: #f0f0f0; // Ensure h4 is inverted
  }
  background-color: #111; // Inverted style
  border: 1px solid #333; // Inverted style
`;

// Semi–transparent overlay segments used to dim everything outside the highlighted envelope
const WallOverlaySegment = styled.div<{
  left: number;
  bottom: number;
  width: number;
  height: number;
}>`
  position: absolute;
  left: ${(props) => props.left}px;
  bottom: ${(props) => props.bottom}px;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  background-color: rgba(0, 0, 0, 0.5);
  pointer-events: none;
  z-index: 4; // Just below the envelope border (5) and bricks (default)
`;

const MasonryWall: React.FC = () => {
  const [strides, setStrides] = useState<Stride[]>([]);
  const [strideEnvelopes, setStrideEnvelopes] = useState<
    Record<number, StrideMeta>
  >({});
  const [hoveredBrick, setHoveredBrick] = useState<Brick | null>(null);
  const [hoveredStrideFromList, setHoveredStrideFromList] = useState<
    number | null
  >(null);
  const [repositionTime, setRepositionTime] = useState(10);
  const [robotRepositionTime, setRobotRepositionTime] = useState(600);
  const [wallScale, setWallScale] = useState(0.1); // Initial small scale
  const [currentBondType, setCurrentBondType] = useState<BondType>("stretcher"); // New state for bond type
  const [wallWidth, setWallWidth] = useState(2300); // Default WALL_WIDTH
  const [wallHeight, setWallHeight] = useState(2000); // Default WALL_HEIGHT
  const wallColumnRef = useRef<HTMLDivElement>(null);
  const allBricksRef = useRef<Brick[]>([]); // To store the initial grid of all bricks

  useEffect(() => {
    const generateInitialBrickLayout = (bondType: BondType): Brick[] => {
      const generatedBricks: Brick[] = [];
      const numCourses = Math.floor(wallHeight / COURSE_HEIGHT); // Use state variable

      for (let courseIndex = 0; courseIndex < numCourses; courseIndex++) {
        const y = courseIndex * COURSE_HEIGHT;
        let currentX = 0;
        let brickInCourseIndex = 0;

        if (bondType === "stretcher") {
          const isEvenCourse = courseIndex % 2 === 0;
          while (currentX < wallWidth) {
            // Use state variable
            const remainingRowLength = wallWidth - currentX; // Use state variable
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
                // Use state variable
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
            // Use state variable
            const remainingRowLength = wallWidth - currentX; // Use state variable
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
                // Use state variable
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

    const currentAllBricks = generateInitialBrickLayout(currentBondType);
    allBricksRef.current = currentAllBricks;

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
            !(
              candidateSupportBrick.x < brickEndX &&
              supportCandidateEndX > brick.x
            )
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
      const sortedActualSupports = supportingBricksBelow.sort(
        (a, b) => a.x - b.x
      );

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

    const calculateWallStrides = (
      allWallBricks: readonly Brick[]
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

        const candidateRobotStartXSet = new Set<number>();
        allWallBricks.forEach((brick) => {
          const candidate1 = Math.max(
            0,
            Math.min(brick.x, wallWidth - ROBOT_WIDTH) // Use state variable
          );
          candidateRobotStartXSet.add(candidate1);

          const candidate2 = Math.max(
            0,
            Math.min(
              brick.x + brick.length - ROBOT_WIDTH,
              wallWidth - ROBOT_WIDTH // Use state variable
            )
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
          const horizontallyReachableUnplaced = unplacedBricks.filter((b) => {
            return (
              b.x >= candidateStartX &&
              b.x + b.length <= candidateStartX + ROBOT_WIDTH
            );
          });

          if (horizontallyReachableUnplaced.length === 0) continue;

          const candidateStartY = horizontallyReachableUnplaced.reduce(
            (minY, b) => Math.min(minY, b.y),
            Infinity
          );

          const tempCurrentStrideAttempt: Brick[] = [];

          const potentialBricksForOption = unplacedBricks
            .filter((b) => {
              return (
                b.x >= candidateStartX &&
                b.x + b.length <= candidateStartX + ROBOT_WIDTH &&
                b.y >= candidateStartY &&
                b.y + BRICK_HEIGHT <= candidateStartY + ROBOT_HEIGHT
              );
            })
            .sort((a, b) => {
              if (a.y !== b.y) return a.y - b.y;
              return a.x - b.x;
            });

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
          const overallLowestUnplacedBrick = unplacedBricks.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
          })[0];

          if (overallLowestUnplacedBrick) {
            console.warn(
              `Could not place brick ${overallLowestUnplacedBrick.id} (type: ${overallLowestUnplacedBrick.type}, length: ${overallLowestUnplacedBrick.length}) in any stride, skipping it. X: ${overallLowestUnplacedBrick.x}, Y: ${overallLowestUnplacedBrick.y}`
            );
            globallyPlacedBrickIds.add(overallLowestUnplacedBrick.id);
            continue;
          }
          console.warn(
            "No bricks could be placed and no unplaced bricks found to skip. Breaking stride calculation."
          );
          break;
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
            maxX: bestStrideOption.startX + ROBOT_WIDTH,
            maxY: bestStrideOption.startY + ROBOT_HEIGHT,
          };

          calculatedStrides.push(finalCurrentStride);
          strideIndexCounter++;
        }
      }
      return { strides: calculatedStrides, envelopes: calculatedEnvelopes };
    };

    const { strides: calculatedStrides, envelopes: calculatedEnvelopes } =
      calculateWallStrides(currentAllBricks);
    setStrides(calculatedStrides);
    setStrideEnvelopes(calculatedEnvelopes);
  }, [currentBondType, wallWidth, wallHeight]); // Added currentBondType and wallWidth/wallHeight as dependencies

  useEffect(() => {
    const updateScale = () => {
      if (wallColumnRef.current) {
        const wallColumnElement = wallColumnRef.current;
        const padding = 40; // 20px left + 20px right padding in WallColumn

        const availableWidth = wallColumnElement.offsetWidth - padding;
        const availableHeight = wallColumnElement.offsetHeight - padding; // Assuming similar padding for height or just overall container height

        if (
          wallWidth > 0 && // Use state variable
          wallHeight > 0 && // Use state variable
          availableWidth > 0 &&
          availableHeight > 0
        ) {
          const scaleX = availableWidth / wallWidth; // Use state variable
          const scaleY = availableHeight / wallHeight; // Use state variable
          const newScale = Math.min(scaleX, scaleY); // Use the smaller scale to fit both dimensions
          setWallScale(newScale);
        } else {
          setWallScale(0.1); // Fallback small scale
        }
      }
    };

    updateScale();
    // Debounced resize handler
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateScale, 100); // Debounce
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, [wallWidth, wallHeight]); // Add wallWidth and wallHeight as dependencies

  const getStrideColor = (strideIndex: number): string => {
    return STRIDE_COLORS[strideIndex % STRIDE_COLORS.length];
  };

  const getTextColorForBackground = (hexColor: string): string => {
    if (!hexColor || hexColor.length < 7) return "white"; // Default for invalid
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "black" : "white";
  };

  const getStrideStartTime = (sIndex: number): number => {
    if (sIndex < 0 || sIndex >= strides.length) return 0;
    let startTime = 0;
    // Robot repositions to get to this stride and all previous ones
    startTime += (sIndex + 1) * robotRepositionTime;
    // Bricks in all previous strides
    for (let i = 0; i < sIndex; i++) {
      if (strides[i]) {
        startTime += strides[i].length * repositionTime;
      }
    }
    return startTime;
  };

  const calculateBrickTime = (brick: Brick | null): number => {
    if (!brick || brick.strideIndex < 0 || brick.orderInStride < 0) return 0;
    if (strides.length === 0 || !strides[brick.strideIndex]) return 0;

    let totalTime = 0;

    // Add robot reposition time for all strides up to and including the current one.
    // (brick.strideIndex + 1) robot movements.
    totalTime += (brick.strideIndex + 1) * robotRepositionTime;

    // Add brick building time for all bricks in previous strides.
    for (let i = 0; i < brick.strideIndex; i++) {
      if (strides[i]) {
        totalTime += strides[i].length * repositionTime;
      }
    }

    // Add brick building time for bricks before the current one in the current stride.
    totalTime += brick.orderInStride * repositionTime;

    return totalTime;
  };

  const allRenderableBricks = strides.flat();

  // Decide which stride (if any) should currently be highlighted
  const currentHighlightStrideIndex: number | null =
    hoveredStrideFromList !== null
      ? hoveredStrideFromList
      : hoveredBrick
      ? hoveredBrick.strideIndex
      : null;

  return (
    <AppContainer>
      <WallColumn ref={wallColumnRef}>
        <WallDisplayContainer
          style={{
            width: wallWidth * wallScale,
            height: wallHeight * wallScale,
          }}
        >
          {allRenderableBricks.map((brick) => {
            const brickLength = brick.length; // Use actual brick length
            const isHighlightedStride =
              currentHighlightStrideIndex !== null &&
              brick.strideIndex === currentHighlightStrideIndex;

            // Calculate extended hitbox dimensions (covering right head joint and top bed joint)
            const additionalWidth =
              brick.x + brickLength < wallWidth ? HEAD_JOINT : 0; // Use state variable
            const additionalHeight =
              brick.y + COURSE_HEIGHT < wallHeight // Use state variable
                ? COURSE_HEIGHT - BRICK_HEIGHT
                : 0;

            const hitWidth = (brickLength + additionalWidth) * wallScale;
            const hitHeight = (BRICK_HEIGHT + additionalHeight) * wallScale;

            const visualWidth = brickLength * wallScale;
            const visualHeight = BRICK_HEIGHT * wallScale;

            return (
              <BrickHitBox
                key={brick.id}
                left={brick.x * wallScale}
                bottom={brick.y * wallScale}
                width={hitWidth}
                height={hitHeight}
                onMouseEnter={() => setHoveredBrick(brick)}
                onMouseLeave={() => setHoveredBrick(null)}
              >
                <BrickDiv
                  width={visualWidth}
                  height={visualHeight}
                  borderColor={getStrideColor(brick.strideIndex)}
                  fontSize={Math.max(8, BRICK_HEIGHT * wallScale * 0.7)}
                  isHoveredStrideBrick={isHighlightedStride}
                  isDirectlyHovered={hoveredBrick?.id === brick.id}
                  style={{ pointerEvents: "none" }} // hitbox captures events
                >
                  {brick.strideIndex + 1}.{brick.orderInStride + 1}
                </BrickDiv>
              </BrickHitBox>
            );
          })}

          {/* Overlay dimming everything outside the highlighted envelope */}
          {currentHighlightStrideIndex !== null &&
            strideEnvelopes[currentHighlightStrideIndex] && (
              <>
                {(() => {
                  const env = strideEnvelopes[currentHighlightStrideIndex];
                  const segments = [] as React.ReactElement[];
                  const wallWidthPx = wallWidth * wallScale; // Use state variable
                  const wallHeightPx = wallHeight * wallScale; // Use state variable
                  const envLeftPx = env.minX * wallScale;
                  const envBottomPx = env.minY * wallScale;
                  const envWidthPx = ROBOT_WIDTH * wallScale;
                  const envHeightPx = ROBOT_HEIGHT * wallScale;

                  // Bottom overlay
                  if (envBottomPx > 0) {
                    segments.push(
                      <WallOverlaySegment
                        key="bottom"
                        left={0}
                        bottom={0}
                        width={wallWidthPx}
                        height={envBottomPx}
                      />
                    );
                  }
                  // Top overlay
                  if (envBottomPx + envHeightPx < wallHeightPx) {
                    segments.push(
                      <WallOverlaySegment
                        key="top"
                        left={0}
                        bottom={envBottomPx + envHeightPx}
                        width={wallWidthPx}
                        height={wallHeightPx - (envBottomPx + envHeightPx)}
                      />
                    );
                  }
                  // Left overlay
                  if (envLeftPx > 0) {
                    segments.push(
                      <WallOverlaySegment
                        key="left"
                        left={0}
                        bottom={envBottomPx}
                        width={envLeftPx}
                        height={envHeightPx}
                      />
                    );
                  }
                  // Right overlay
                  if (envLeftPx + envWidthPx < wallWidthPx) {
                    segments.push(
                      <WallOverlaySegment
                        key="right"
                        left={envLeftPx + envWidthPx}
                        bottom={envBottomPx}
                        width={wallWidthPx - (envLeftPx + envWidthPx)}
                        height={envHeightPx}
                      />
                    );
                  }
                  return segments;
                })()}
              </>
            )}

          {/* Dotted envelope border */}
          {currentHighlightStrideIndex !== null &&
            strideEnvelopes[currentHighlightStrideIndex] && (
              <StrideEnvelopeDiv
                left={
                  strideEnvelopes[currentHighlightStrideIndex].minX * wallScale
                }
                bottom={
                  strideEnvelopes[currentHighlightStrideIndex].minY * wallScale
                }
                width={ROBOT_WIDTH * wallScale}
                height={ROBOT_HEIGHT * wallScale}
                strideColor={getStrideColor(currentHighlightStrideIndex)}
              />
            )}
        </WallDisplayContainer>
      </WallColumn>

      <DebugColumn>
        <WallHeader>
          <h2>Masonry Wall Builder</h2>
          <p>
            Wall: {WALL_WIDTH}mm × {WALL_HEIGHT}mm | Strides: {strides.length} |
            Wall: {wallWidth}mm × {wallHeight}mm | Strides: {strides.length} |
            Total Bricks: {allBricksRef.current.length} | Placed:{" "}
            {allRenderableBricks.length} | Bond:{" "}
            {currentBondType.charAt(0).toUpperCase() + currentBondType.slice(1)}
          </p>
        </WallHeader>
        <DebugSection>
          <h4>Constants:</h4>
          <div style={{ marginBottom: "10px" }}>
            <label>Reposition within stride (sec): </label>
            <DebugInput
              type="number"
              value={repositionTime}
              onChange={(e) =>
                setRepositionTime(Math.max(0, Number(e.target.value)))
              }
            />
          </div>
          <div>
            <label>Robot reposition (sec): </label>
            <DebugInput
              type="number"
              value={robotRepositionTime}
              onChange={(e) =>
                setRobotRepositionTime(Math.max(0, Number(e.target.value)))
              }
            />
          </div>
        </DebugSection>
        <DebugSection>
          <h4>Wall Settings:</h4>
          <div style={{ marginBottom: "10px" }}>
            <label>Wall Width (mm): </label>
            <DebugInput
              type="number"
              value={wallWidth}
              onChange={(e) =>
                setWallWidth(
                  Math.max(100, Math.round(Number(e.target.value) / 100) * 100)
                )
              }
              step={100}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>Wall Height (mm): </label>
            <DebugInput
              type="number"
              value={wallHeight}
              onChange={(e) =>
                setWallHeight(
                  Math.max(
                    COURSE_HEIGHT,
                    Math.round(Number(e.target.value) / COURSE_HEIGHT) *
                      COURSE_HEIGHT
                  )
                )
              }
              step={COURSE_HEIGHT}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>Bond Type: </label>
            {/* Basic button styling for active/inactive states */}
            {(["stretcher", "english_cross", "flemish"] as BondType[]).map(
              (bond) => (
                <button
                  key={bond}
                  onClick={() => setCurrentBondType(bond)}
                  disabled={currentBondType === bond}
                  style={{
                    marginLeft: "5px",
                    marginRight: "5px",
                    padding: "5px 10px",
                    cursor: "pointer",
                    backgroundColor:
                      currentBondType === bond ? "#007bff" : "#555",
                    color: "white",
                    border:
                      currentBondType === bond
                        ? "1px solid #0056b3"
                        : "1px solid #333",
                    borderRadius: "3px",
                  }}
                >
                  {bond.charAt(0).toUpperCase() + bond.slice(1)}
                </button>
              )
            )}
          </div>
        </DebugSection>

        {hoveredBrick ? (
          <HoverInfoBox>
            <h4
              style={{
                marginTop: 0,
                marginBottom: "15px",
                textAlign: "center",
              }}
            >
              Brick #{hoveredBrick.strideIndex + 1}.
              {hoveredBrick.orderInStride + 1}:
            </h4>
            <div
              style={{
                position: "relative",
                width: hoveredBrick.length * wallScale + 4, // +4 for border
                height: BRICK_HEIGHT * wallScale + 4, // +4 for border
                margin: "20px auto 30px auto", // Increased margin for BL/TR text
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "2px",
                  bottom: "2px",
                  width: hoveredBrick.length * wallScale,
                  height: BRICK_HEIGHT * wallScale,
                  border: `2px solid ${getStrideColor(
                    hoveredBrick.strideIndex
                  )}`,
                  backgroundColor: "transparent",
                  boxSizing: "border-box",
                }}
              />
              <p
                style={{
                  position: "absolute",
                  bottom: "-20px", // Adjusted for visibility
                  left: "0px",
                  fontSize: "12px",
                  margin: 0,
                  color: "#aaa", // Lighter color for coordinate text
                }}
              >
                BL: {hoveredBrick.x.toFixed(1)}, {hoveredBrick.y.toFixed(1)}
              </p>
              <p
                style={{
                  position: "absolute",
                  top: "-20px", // Adjusted for visibility
                  right: "0px",
                  fontSize: "12px",
                  margin: 0,
                  color: "#aaa", // Lighter color for coordinate text
                }}
              >
                TR: {(hoveredBrick.x + hoveredBrick.length).toFixed(1)},{" "}
                {(hoveredBrick.y + BRICK_HEIGHT).toFixed(1)}
              </p>
            </div>
            <p>
              <strong>Type:</strong> {hoveredBrick.type} (L:{" "}
              {hoveredBrick.length.toFixed(0)}mm)
            </p>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ textAlign: "left" }}>
                <strong>BL:</strong> ({hoveredBrick.x.toFixed(1)},{" "}
                {hoveredBrick.y.toFixed(1)})mm
              </p>
              <p style={{ textAlign: "right" }}>
                <strong>TR:</strong> (
                {(hoveredBrick.x + hoveredBrick.length) // Use actual brick length
                  .toFixed(1)}
                , {(hoveredBrick.y + BRICK_HEIGHT).toFixed(1)})mm
              </p>
            </div>
            <p>
              <strong>Stride start time:</strong>{" "}
              {getStrideStartTime(hoveredBrick.strideIndex)}s
            </p>
            <p>
              <strong>Build start time:</strong>{" "}
              {calculateBrickTime(hoveredBrick)}s
            </p>
          </HoverInfoBox>
        ) : (
          <HoverInfoBox style={{ textAlign: "center" }}>
            <p>Hover over a brick for details</p>
          </HoverInfoBox>
        )}

        <StrideStatsContainer>
          <h4>Stride Order ({strides.length} total)</h4>
          {strides.map((stride, index) => {
            if (!strideEnvelopes[index]) return null; // Guard against missing envelope data

            const calculatedStrideStartTime = getStrideStartTime(index);
            const strideBricklayingDuration = stride.length * repositionTime;
            // End time is when the last brick in the stride is completed
            const calculatedStrideEndTime =
              calculatedStrideStartTime + strideBricklayingDuration;

            return (
              <StrideStatItem
                key={index}
                onMouseEnter={() => setHoveredStrideFromList(index)}
                onMouseLeave={() => setHoveredStrideFromList(null)}
              >
                <div>
                  <StrideColorSwatch
                    bgColor={getStrideColor(index)}
                    textColor={getTextColorForBackground(getStrideColor(index))}
                  >
                    {index + 1}
                  </StrideColorSwatch>
                  <span>{stride.length} bricks</span>
                </div>
                <div>
                  <span className="label">Pos:</span>
                  <span className="coords">
                    ({strideEnvelopes[index].minX.toFixed(0)},{" "}
                    {strideEnvelopes[index].minY.toFixed(0)})mm
                  </span>
                </div>
                <div>
                  <span className="label">Time:</span>
                  <span>
                    {calculatedStrideStartTime}s - {calculatedStrideEndTime}s
                  </span>
                </div>
              </StrideStatItem>
            );
          })}
          {strides.length === 0 && <p>No strides calculated yet.</p>}
        </StrideStatsContainer>
      </DebugColumn>
    </AppContainer>
  );
};

export default MasonryWall;
