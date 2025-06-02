import React, { useState, useEffect } from "react";

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
}

type Stride = Brick[];

const MasonryWall: React.FC = () => {
  const [strides, setStrides] = useState<Stride[]>([]);
  const [showJson, setShowJson] = useState(false);

  // Calculate wall structure
  useEffect(() => {
    const calculateWallStructure = (): Stride[] => {
      const allBricks: Brick[] = [];

      // Calculate number of courses (rows)
      const numCourses = Math.floor(WALL_HEIGHT / COURSE_HEIGHT);

      // Generate bricks for each course
      for (let courseIndex = 0; courseIndex < numCourses; courseIndex++) {
        const y = courseIndex * COURSE_HEIGHT;
        const isOddRow = courseIndex % 2 === 0; // 0-indexed, so course 0 is "odd" in assignment terms

        let x = 0;
        let brickIndex = 0;

        // For stretcher bond: odd rows start with half brick, even rows start with full brick
        while (x < WALL_WIDTH) {
          let brickLength: number;
          let brickType: BrickType;

          if (isOddRow && brickIndex === 0) {
            // First brick in odd row is half brick
            brickLength = HALF_BRICK_LENGTH;
            brickType = "half";
          } else {
            // Check if we can fit a full brick
            const remainingSpace = WALL_WIDTH - x;
            if (remainingSpace >= FULL_BRICK_LENGTH + HEAD_JOINT) {
              brickLength = FULL_BRICK_LENGTH;
              brickType = "full";
            } else if (remainingSpace >= HALF_BRICK_LENGTH) {
              brickLength = HALF_BRICK_LENGTH;
              brickType = "half";
            } else {
              break; // Can't fit any more bricks
            }
          }

          allBricks.push({
            x,
            y,
            type: brickType,
            strideIndex: 0, // Will be calculated later
            orderInStride: 0, // Will be calculated later
          });

          x += brickLength + HEAD_JOINT;
          brickIndex++;
        }
      }

      // Group bricks into strides based on robot constraints
      const strides: Stride[] = [];
      const unprocessedBricks = [...allBricks];

      while (unprocessedBricks.length > 0) {
        const currentStride: Brick[] = [];
        let strideStartX = -1;
        let strideStartY = -1;

        // Find the lowest, leftmost unprocessed brick to start the stride
        unprocessedBricks.sort((a, b) => {
          if (a.y !== b.y) return a.y - b.y; // Lower Y first
          return a.x - b.x; // Then leftmost X
        });

        const startBrick = unprocessedBricks[0];
        strideStartX = startBrick.x;
        strideStartY = startBrick.y;

        // Collect all bricks within robot reach from this position
        for (let i = unprocessedBricks.length - 1; i >= 0; i--) {
          const brick = unprocessedBricks[i];

          // Check if brick is within robot reach
          const withinX =
            brick.x >= strideStartX && brick.x < strideStartX + ROBOT_WIDTH;
          const withinY =
            brick.y >= strideStartY && brick.y < strideStartY + ROBOT_HEIGHT;

          if (withinX && withinY) {
            brick.strideIndex = strides.length;
            currentStride.push(brick);
            unprocessedBricks.splice(i, 1);
          }
        }

        // Sort bricks within stride by row (bottom to top), then left to right
        currentStride.sort((a, b) => {
          if (a.y !== b.y) return a.y - b.y;
          return a.x - b.x;
        });

        // Assign order within stride
        currentStride.forEach((brick, index) => {
          brick.orderInStride = index;
        });

        strides.push(currentStride);
      }

      return strides;
    };

    const calculatedStrides = calculateWallStructure();
    setStrides(calculatedStrides);

    // Log the beautified JSON as requested
    console.log(
      "Wall Structure (Strides):",
      JSON.stringify(calculatedStrides, null, 2)
    );
  }, []);

  // Color palette for strides
  const strideColors = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#45B7D1", // Blue
    "#FFA726", // Orange
    "#AB47BC", // Purple
    "#66BB6A", // Green
    "#FFCA28", // Yellow
    "#EF5350", // Light Red
    "#26A69A", // Dark Teal
    "#42A5F5", // Light Blue
  ];

  const getStrideColor = (strideIndex: number): string => {
    return strideColors[strideIndex % strideColors.length];
  };

  const getBrickColor = (brick: Brick): string => {
    const baseColor = getStrideColor(brick.strideIndex);
    const stride = strides[brick.strideIndex];
    const progress = stride ? brick.orderInStride / (stride.length - 1) : 0;

    // Interpolate from black (0) to base color (0.5) to white (1)
    if (progress <= 0.5) {
      // Black to base color
      const factor = progress * 2;
      return interpolateColor("#000000", baseColor, factor);
    } else {
      // Base color to white
      const factor = (progress - 0.5) * 2;
      return interpolateColor(baseColor, "#FFFFFF", factor);
    }
  };

  const interpolateColor = (
    color1: string,
    color2: string,
    factor: number
  ): string => {
    const hex1 = color1.substring(1);
    const hex2 = color2.substring(1);

    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);

    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);

    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);

    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };

  const scale = 0.2; // Scale factor for display

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2>
          Wall Dimensions: {WALL_WIDTH}mm × {WALL_HEIGHT}mm
        </h2>
        <p>Total Strides: {strides.length}</p>
        <p>
          Robot Envelope: {ROBOT_WIDTH}mm × {ROBOT_HEIGHT}mm
        </p>
        <button
          onClick={() => setShowJson(!showJson)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#4ECDC4",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            marginTop: "10px",
          }}
        >
          {showJson ? "Hide" : "Show"} Stride Structure (JSON)
        </button>
      </div>

      {showJson && (
        <div
          style={{
            marginBottom: "20px",
            textAlign: "left",
            backgroundColor: "#f5f5f5",
            padding: "15px",
            borderRadius: "5px",
            maxHeight: "400px",
            overflow: "auto",
          }}
        >
          <h3>2D Stride Array Structure:</h3>
          <pre
            style={{
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {JSON.stringify(strides, null, 2)}
          </pre>
        </div>
      )}

      <div
        style={{
          position: "relative",
          width: WALL_WIDTH * scale,
          height: WALL_HEIGHT * scale,
          border: "2px solid #333",
          backgroundColor: "#f0f0f0",
          margin: "0 auto",
        }}
      >
        {strides.flat().map((brick, index) => {
          const brickLength =
            brick.type === "full" ? FULL_BRICK_LENGTH : HALF_BRICK_LENGTH;

          return (
            <div
              key={index}
              style={{
                position: "absolute",
                left: brick.x * scale,
                bottom: brick.y * scale,
                width: brickLength * scale,
                height: BRICK_HEIGHT * scale,
                backgroundColor: getBrickColor(brick),
                border: "1px solid #666",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: "bold",
                color: "#333",
                boxSizing: "border-box",
              }}
            >
              {brick.strideIndex + 1}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: "20px" }}>
        <h3>Stride Colors:</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {strides.map((_, index) => (
            <div
              key={index}
              style={{ display: "flex", alignItems: "center", gap: "5px" }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  backgroundColor: getStrideColor(index),
                  border: "1px solid #666",
                }}
              />
              <span>
                Stride {index + 1} ({strides[index]?.length || 0} bricks)
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "15px", fontSize: "14px" }}>
          <p>
            <strong>Color Coding:</strong> Each stride has its base color.
            Within each stride, bricks progress from black → stride color →
            white based on build order.
          </p>
          <p>
            <strong>Numbers:</strong> The number in each brick indicates which
            stride it belongs to.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MasonryWall;
