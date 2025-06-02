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
    color: #ccc; // Light color for text on dark background if body is dark
  }
`;

const WallDisplayContainer = styled.div`
  position: relative;
  // width and height are set dynamically via inline style based on wallScale
  // No margin: 0 auto;
`;

const BrickDiv = styled.div<{
  left: number;
  bottom: number;
  width: number;
  height: number;
  borderColor: string;
  fontSize: number;
}>`
  position: absolute;
  left: ${(props) => props.left}px;
  bottom: ${(props) => props.bottom}px;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  border: 2px solid ${(props) => props.borderColor};
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(props) => props.fontSize}px;
  font-weight: bold;
  color: #333; // Number color inside brick
  box-sizing: border-box;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1); // Slight hover effect
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
  p {
    margin: 5px 0;
    font-size: 14px;
  }
  strong {
    color: #555;
  }
`;

const StrideStatItem = styled.div`
  margin-bottom: 5px;
  font-size: 12px;
  display: flex;
  align-items: center;
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

const MasonryWall: React.FC = () => {
  const [strides, setStrides] = useState<Stride[]>([]);
  const [hoveredBrick, setHoveredBrick] = useState<Brick | null>(null);
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

    const calculateWallStrides = (): Stride[] => {
      const calculatedStrides: Stride[] = [];
      const globallyPlacedBrickIds = new Set<string>();
      let strideIndexCounter = 0;

      while (globallyPlacedBrickIds.size < allBricksRef.current.length) {
        const unplacedBricks = allBricksRef.current.filter(
          (b) => !globallyPlacedBrickIds.has(b.id)
        );
        if (unplacedBricks.length === 0) break;

        const overallLowestUnplacedBrick = unplacedBricks.sort((a, b) => {
          if (a.y !== b.y) return a.y - b.y;
          return a.x - b.x;
        })[0];

        if (!overallLowestUnplacedBrick) break; // Should not happen if unplacedBricks.length > 0

        const anchorBrick = overallLowestUnplacedBrick;
        const anchorBrickLength =
          anchorBrick.type === "full" ? FULL_BRICK_LENGTH : HALF_BRICK_LENGTH;
        const strideAttemptFloorY = anchorBrick.y;

        const candidateRobotStartXPositions: number[] = [
          anchorBrick.x,
          anchorBrick.x + anchorBrickLength / 2 - ROBOT_WIDTH / 2,
          anchorBrick.x + anchorBrickLength - ROBOT_WIDTH,
        ].map((x) => Math.max(0, Math.min(x, WALL_WIDTH - ROBOT_WIDTH))); // Clamp

        let bestStrideOption = {
          startX: -1,
          startY: -1,
          bricks: [] as Brick[],
          count: -1,
        };

        for (const candidateStartX of candidateRobotStartXPositions) {
          const candidateStartY = strideAttemptFloorY;
          const tempCurrentStrideAttempt: Brick[] = [];

          const potentialBricksForOption = allBricksRef.current
            .filter(
              (b) =>
                !globallyPlacedBrickIds.has(b.id) &&
                b.x >= candidateStartX &&
                b.x < candidateStartX + ROBOT_WIDTH &&
                b.y >= candidateStartY &&
                b.y < candidateStartY + ROBOT_HEIGHT
            )
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
          console.warn(
            "Could not find a valid stride for remaining bricks. Lowest unplaced:",
            overallLowestUnplacedBrick,
            " Attempting to mark as unplaceable and continue."
          );
          // If the lowest brick cannot start any stride, we might get stuck.
          // A simple recovery: if we can't place the current lowest, maybe it's truly isolated for now.
          // Mark it as "processed" to avoid an infinite loop on this specific brick,
          // though this is a hack and might skip genuinely placeable bricks later.
          // A better solution would be a more global lookahead or backtracking.
          if (overallLowestUnplacedBrick) {
            // Defensive check
            globallyPlacedBrickIds.add(overallLowestUnplacedBrick.id); // Effectively skip it for now
            console.log(
              `Skipping ${overallLowestUnplacedBrick.id} as it led to no stride.`
            );
            continue; // Try to find the next lowest unplaced brick.
          } else {
            break; // Should not happen.
          }
        }

        const finalCurrentStride = bestStrideOption.bricks.map((b) => ({
          ...b,
        })); // Work with copies

        finalCurrentStride.forEach((b) => {
          b.strideIndex = strideIndexCounter;
          globallyPlacedBrickIds.add(b.id);
        });
        finalCurrentStride.forEach((brick, order) => {
          brick.orderInStride = order;
        });

        if (finalCurrentStride.length > 0) {
          calculatedStrides.push(finalCurrentStride);
          strideIndexCounter++;
        } else if (
          unplacedBricks.length > 0 &&
          globallyPlacedBrickIds.size < allBricksRef.current.length
        ) {
          // This condition means bestStrideOption.count was 0 but we didn't break.
          // This part of the logic is now handled by the "count <=0" check above.
        }
      }
      return calculatedStrides;
    };

    const calculatedStrides = calculateWallStrides();
    setStrides(calculatedStrides);
  }, []);

  useEffect(() => {
    const updateScale = () => {
      if (wallColumnRef.current) {
        const wallColumnWidth = wallColumnRef.current.offsetWidth;
        const padding = 40; // 20px left + 20px right padding in WallColumn
        const availableWidthForWall = wallColumnWidth - padding;
        if (WALL_WIDTH > 0 && availableWidthForWall > 0) {
          const newScale = availableWidthForWall / WALL_WIDTH;
          setWallScale(newScale);
        }
      }
    };

    updateScale(); // Initial scale
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

  const calculateBrickTime = (brick: Brick | null): number => {
    if (!brick || brick.strideIndex < 0 || brick.orderInStride < 0) return 0;
    // Strides array might not be populated if brick data is from a premature hover
    if (!strides[brick.strideIndex]) return 0;

    const timeWithinStride = brick.orderInStride * repositionTime;
    const timeToReachStride = brick.strideIndex * robotRepositionTime;
    return timeToReachStride + timeWithinStride;
  };

  const allRenderableBricks = strides.flat();

  return (
    <AppContainer>
      <WallColumn ref={wallColumnRef}>
        <WallHeader>
          <h2>Masonry Wall Builder</h2>
          <p>
            Wall: {WALL_WIDTH}mm × {WALL_HEIGHT}mm | Strides: {strides.length} |
            Total Bricks: {allBricksRef.current.length} | Placed:{" "}
            {allRenderableBricks.length}
          </p>
        </WallHeader>

        <WallDisplayContainer
          style={{
            width: WALL_WIDTH * wallScale,
            height: WALL_HEIGHT * wallScale,
          }}
        >
          {allRenderableBricks.map((brick) => {
            const brickLength =
              brick.type === "full" ? FULL_BRICK_LENGTH : HALF_BRICK_LENGTH;
            return (
              <BrickDiv
                key={brick.id}
                left={brick.x * wallScale}
                bottom={brick.y * wallScale}
                width={brickLength * wallScale}
                height={BRICK_HEIGHT * wallScale}
                borderColor={getStrideColor(brick.strideIndex)}
                fontSize={Math.max(6, Math.min(10, 8 * wallScale))} // Adjusted font size
                onMouseEnter={() => setHoveredBrick(brick)}
                onMouseLeave={() => setHoveredBrick(null)}
              >
                {brick.strideIndex + 1}.{brick.orderInStride + 1}
              </BrickDiv>
            );
          })}
        </WallDisplayContainer>
      </WallColumn>

      <DebugColumn>
        <h3>Debug Panel</h3>
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
            <h4>Brick Data:</h4>
            <p>
              <strong>ID:</strong> {hoveredBrick.id}
            </p>
            <p>
              <strong>Position:</strong> ({hoveredBrick.x.toFixed(1)},{" "}
              {hoveredBrick.y.toFixed(1)})
            </p>
            <p>
              <strong>Type:</strong> {hoveredBrick.type}
            </p>
            <p>
              <strong>Stride:</strong> {hoveredBrick.strideIndex + 1}
            </p>
            <p>
              <strong>Order:</strong> {hoveredBrick.orderInStride + 1}
            </p>
            <p>
              <strong>Build time:</strong> {calculateBrickTime(hoveredBrick)}{" "}
              seconds
            </p>
            <p>
              <strong>Color:</strong>
              <StrideColorSwatch
                style={{ marginLeft: "5px" }}
                bgColor={getStrideColor(hoveredBrick.strideIndex)}
              >
                S{hoveredBrick.strideIndex + 1}
              </StrideColorSwatch>
            </p>
          </HoverInfoBox>
        ) : (
          <HoverInfoBox style={{ textAlign: "center" }}>
            <p>Hover over a brick for details</p>
          </HoverInfoBox>
        )}

        <DebugSection style={{ marginTop: "20px" }}>
          <h4>Stride Statistics: ({strides.length} total)</h4>
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              border: "1px solid #ccc",
              padding: "5px",
            }}
          >
            {strides.map((stride, index) => (
              <StrideStatItem key={index}>
                <StrideColorSwatch bgColor={getStrideColor(index)}>
                  {index + 1}
                </StrideColorSwatch>
                {stride.length} bricks
              </StrideStatItem>
            ))}
            {strides.length === 0 && <p>No strides calculated yet.</p>}
          </div>
        </DebugSection>
      </DebugColumn>
    </AppContainer>
  );
};

export default MasonryWall;
