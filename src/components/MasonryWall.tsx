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

// Robot constraints
const ROBOT_WIDTH = 800; // mm
const ROBOT_HEIGHT = 1300; // mm

type BrickType = "full" | "half";

interface Brick {
  x: number;
  y: number;
  type: BrickType;
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
  "#FF0000", // red
  "#0000FF", // blue
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
  background-color: #f5f5f5;
  padding: 15px;
  overflow-y: auto;
  color: #333; // Default text color for debug panel
  display: flex;
  flex-direction: column; // To allow fixed positioning of elements at bottom

  h3,
  h4 {
    color: #333;
  }
  label {
    color: #333;
  }
`;

const WallHeader = styled.div`
  margin-bottom: 20px;
  h2,
  p {
    color: #333; // Changed from #ccc as it's now on a light background
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
  background-color: ${(props) =>
    props.isDirectlyHovered ? "#333" : "transparent"};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(props) => props.fontSize}px;
  font-weight: ${(props) => (props.isHoveredStrideBrick ? "bold" : "normal")};
  color: white; // 3. Text color inside brick to white
  box-sizing: border-box;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out; // Only background-color transition, box-shadow (border) is instant

  box-shadow: ${(props) =>
    props.isHoveredStrideBrick
      ? `inset 0 0 0 3px ${props.borderColor}` // Thicker border inwards (2px border + 3px inset shadow)
      : "none"};

  &:hover {
    // Apply a general hover background if not the directly hovered one (which already has #333)
    // and not part of an already highlighted stride that sets its own effects
    background-color: ${(props) =>
      props.isDirectlyHovered ? "#333" : "rgba(255, 255, 255, 0.1)"};
  }
`;

const DebugSection = styled.div`
  margin-bottom: 20px;
  h4 {
    margin-top: 0;
  }
`;

const DebugInput = styled.input`
  width: 60px;
  margin-left: 5px;
  padding: 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
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
`;

const StrideStatItem = styled.div`
  margin-bottom: 8px; // Increased spacing
  font-size: 12px;
  display: flex;
  flex-direction: column; // Stack items vertically initially
  align-items: flex-start;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee; // Separator for items

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
  }
  span.coords {
    font-family: monospace;
  }
`;

const StrideColorSwatch = styled.span<{ bgColor: string }>`
  background-color: ${(props) => props.bgColor};
  color: white; // Text on swatch
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
  }
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
  const wallColumnRef = useRef<HTMLDivElement>(null);
  const allBricksRef = useRef<Brick[]>([]); // To store the initial grid of all bricks

  useEffect(() => {
    const generateInitialBrickLayout = (): Brick[] => {
      const generatedBricks: Brick[] = [];
      const numCourses = Math.floor(WALL_HEIGHT / COURSE_HEIGHT);

      for (let courseIndex = 0; courseIndex < numCourses; courseIndex++) {
        const y = courseIndex * COURSE_HEIGHT;
        const isEvenCourse = courseIndex % 2 === 0;
        let x = 0;
        let brickInCourseIndex = 0;

        while (x < WALL_WIDTH) {
          let brickLength: number;
          let brickType: BrickType;
          const remainingSpaceInRow = WALL_WIDTH - x;

          if (!isEvenCourse && brickInCourseIndex === 0) {
            if (remainingSpaceInRow >= HALF_BRICK_LENGTH) {
              brickLength = HALF_BRICK_LENGTH;
              brickType = "half";
            } else {
              break;
            }
          } else {
            if (remainingSpaceInRow >= FULL_BRICK_LENGTH) {
              brickLength = FULL_BRICK_LENGTH;
              brickType = "full";
            } else if (remainingSpaceInRow >= HALF_BRICK_LENGTH) {
              brickLength = HALF_BRICK_LENGTH;
              brickType = "half";
            } else {
              break;
            }
          }

          // Ensure the last brick doesn't get an unnecessary head joint that pushes it out
          const actualBrickLength = brickLength;
          if (x + actualBrickLength > WALL_WIDTH) {
            // This case should ideally be handled by the conditions above correctly.
            // If remainingSpaceInRow was, say, 200, and FULL_BRICK_LENGTH is 210, it should take HALF_BRICK_LENGTH.
            // If brickLength determined above makes x + brickLength > WALL_WIDTH, something is off or it's the very last bit.
            // For now, we assume the logic correctly picks a brick that fits.
          }

          generatedBricks.push({
            x,
            y,
            type: brickType,
            strideIndex: -1,
            orderInStride: -1,
            id: `brick-${courseIndex}-${brickInCourseIndex}`,
          });

          if (x + brickLength < WALL_WIDTH) {
            x += brickLength + HEAD_JOINT;
          } else {
            x += brickLength; // No head joint if it's the last brick flush with the wall end
          }
          brickInCourseIndex++;
        }
      }
      return generatedBricks;
    };

    allBricksRef.current = generateInitialBrickLayout();

    const isBrickSupported = (
      brick: Brick,
      globallyPlacedBricks: ReadonlySet<string>,
      bricksAlreadyInCurrentStride: readonly Brick[]
    ): boolean => {
      if (brick.y === 0) return true;

      const brickEndX =
        brick.x +
        (brick.type === "full" ? FULL_BRICK_LENGTH : HALF_BRICK_LENGTH);

      const supportingBricksBelow = allBricksRef.current.filter(
        (candidateSupportBrick) => {
          if (candidateSupportBrick.y !== brick.y - COURSE_HEIGHT) return false;

          const supportCandidateEndX =
            candidateSupportBrick.x +
            (candidateSupportBrick.type === "full"
              ? FULL_BRICK_LENGTH
              : HALF_BRICK_LENGTH);
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
        const overlapEnd = Math.min(
          support.x +
            (support.type === "full" ? FULL_BRICK_LENGTH : HALF_BRICK_LENGTH),
          brickEndX
        );
        if (overlapEnd > overlapStart) {
          totalActualSupportLength += overlapEnd - overlapStart;
        }
      }
      const requiredSupportLength =
        (brick.type === "full" ? FULL_BRICK_LENGTH : HALF_BRICK_LENGTH) * 0.9;
      return totalActualSupportLength >= requiredSupportLength;
    };

    const calculateWallStrides = (): {
      strides: Stride[];
      envelopes: Record<number, StrideMeta>;
    } => {
      const calculatedStrides: Stride[] = [];
      const calculatedEnvelopes: Record<number, StrideMeta> = {};
      const globallyPlacedBrickIds = new Set<string>();
      let strideIndexCounter = 0;

      while (globallyPlacedBrickIds.size < allBricksRef.current.length) {
        const unplacedBricks = allBricksRef.current.filter(
          (b) => !globallyPlacedBrickIds.has(b.id)
        );
        if (unplacedBricks.length === 0) break;

        // Build a comprehensive list of candidate robot X positions based on brick edges
        const candidateRobotStartXSet = new Set<number>();
        allBricksRef.current.forEach((brick) => {
          const brickLength =
            brick.type === "full" ? FULL_BRICK_LENGTH : HALF_BRICK_LENGTH;
          // Align robot envelope's left edge with brick's left edge
          const candidate1 = Math.max(
            0,
            Math.min(brick.x, WALL_WIDTH - ROBOT_WIDTH)
          );
          candidateRobotStartXSet.add(candidate1);

          // Align robot envelope's right edge with brick's right edge
          const candidate2 = Math.max(
            0,
            Math.min(
              brick.x + brickLength - ROBOT_WIDTH,
              WALL_WIDTH - ROBOT_WIDTH
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
          // Find lowest unplaced brick that fits horizontally fully within envelope
          const horizontallyReachableUnplaced = unplacedBricks.filter((b) => {
            const brickLength =
              b.type === "full" ? FULL_BRICK_LENGTH : HALF_BRICK_LENGTH;
            return (
              b.x >= candidateStartX &&
              b.x + brickLength <= candidateStartX + ROBOT_WIDTH
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
              const brickLength =
                b.type === "full" ? FULL_BRICK_LENGTH : HALF_BRICK_LENGTH;
              return (
                b.x >= candidateStartX &&
                b.x + brickLength <= candidateStartX + ROBOT_WIDTH &&
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
                tempCurrentStrideAttempt
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
          // Could not place any bricks with current rules; mark the lowest brick as skipped to avoid infinite loop
          const overallLowestUnplacedBrick = unplacedBricks.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
          })[0];

          if (overallLowestUnplacedBrick) {
            globallyPlacedBrickIds.add(overallLowestUnplacedBrick.id);
            continue;
          }
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
      calculateWallStrides();
    setStrides(calculatedStrides);
    setStrideEnvelopes(calculatedEnvelopes);
  }, []);

  useEffect(() => {
    const updateScale = () => {
      if (wallColumnRef.current) {
        const wallColumnElement = wallColumnRef.current;
        const padding = 40; // 20px left + 20px right padding in WallColumn

        const availableWidth = wallColumnElement.offsetWidth - padding;
        const availableHeight = wallColumnElement.offsetHeight - padding; // Assuming similar padding for height or just overall container height

        if (
          WALL_WIDTH > 0 &&
          WALL_HEIGHT > 0 &&
          availableWidth > 0 &&
          availableHeight > 0
        ) {
          const scaleX = availableWidth / WALL_WIDTH;
          const scaleY = availableHeight / WALL_HEIGHT;
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
  }, []); // Depends on nothing that changes internally causing re-run of this effect setup

  const getStrideColor = (strideIndex: number): string => {
    return STRIDE_COLORS[strideIndex % STRIDE_COLORS.length];
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
            width: WALL_WIDTH * wallScale,
            height: WALL_HEIGHT * wallScale,
          }}
        >
          {allRenderableBricks.map((brick) => {
            const brickLength =
              brick.type === "full" ? FULL_BRICK_LENGTH : HALF_BRICK_LENGTH;
            const isHighlightedStride =
              currentHighlightStrideIndex !== null &&
              brick.strideIndex === currentHighlightStrideIndex;

            // Calculate extended hitbox dimensions (covering right head joint and top bed joint)
            const additionalWidth =
              brick.x + brickLength < WALL_WIDTH ? HEAD_JOINT : 0;
            const additionalHeight =
              brick.y + COURSE_HEIGHT < WALL_HEIGHT
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
                  const wallWidthPx = WALL_WIDTH * wallScale;
                  const wallHeightPx = WALL_HEIGHT * wallScale;
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
            Total Bricks: {allBricksRef.current.length} | Placed:{" "}
            {allRenderableBricks.length}
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

        {hoveredBrick ? (
          <HoverInfoBox>
            <h4 style={{ marginTop: 0, textAlign: "center" }}>
              Brick #{hoveredBrick.strideIndex + 1}.
              {hoveredBrick.orderInStride + 1}:
            </h4>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ textAlign: "left" }}>
                <strong>BL:</strong> ({hoveredBrick.x.toFixed(1)},{" "}
                {hoveredBrick.y.toFixed(1)})mm
              </p>
              <p style={{ textAlign: "right" }}>
                <strong>TR:</strong> (
                {(
                  hoveredBrick.x +
                  (hoveredBrick.type === "full"
                    ? FULL_BRICK_LENGTH
                    : HALF_BRICK_LENGTH)
                ).toFixed(1)}
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
                  <StrideColorSwatch bgColor={getStrideColor(index)}>
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
