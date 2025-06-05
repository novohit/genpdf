import { useMemo, useState } from "react";
import * as d3 from "d3";
import { curveCatmullRom } from "d3";
import styles from "./streamgraph.module.css";
import React from "react";
import { TimeAxis } from "./TimeAxis";
import { Labels } from "./Labels";

const MARGIN = { top: 30, right: 30, bottom: 50, left: 50 };

type StreamGraphProps = {
  width: number;
  height: number;
  data: { [key: string]: number }[];
  colors?: string[];
  textColor?: string;
  isDark?: boolean;
};
export type WideDataItem = {
  date: string;
} & { [key: string]: number }
const DEFAULT_COLORS = ["#fea46e", "#73bb74", "#62a1c7", "#fecea5", "#c6d9ec"];

const StreamGraph: React.FC<StreamGraphProps> = ({ width, height, data, colors = DEFAULT_COLORS, textColor = "black", isDark = false }) => {
  const [interactionData, setInteractionData] = useState<WideDataItem | null>(
    null
  );
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  // bounds = area inside the graph axis = calculated by substracting the margins
  const boundsWidth = width - MARGIN.right - MARGIN.left;
  const boundsHeight = height - MARGIN.top - MARGIN.bottom;

  // Add state for visible groups
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());

  // Update groups to only use visible ones for stacking
  const groups = useMemo(() => {
    if (!data || data.length === 0 || !data[0]) return [];
    return Object.keys(data[0]).filter(key => key !== 'x');
  }, [data]);
  const visibleGroups = groups.filter(group => !hiddenGroups.has(group));

  // Update stack to use only visible groups
  const stackSeries = d3
    .stack()
    .keys(visibleGroups)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetSilhouette);
  const series = stackSeries(data);

  // Y axis
  const topYValues = series.flatMap((s) => s.map((d) => d[1])); // Extract the upper values of each data point in the stacked series
  const yMax = Math.max(...topYValues);

  const bottomYValues = series.flatMap((s) => s.map((d) => d[0])); // Extract the upper values of each data point in the stacked series
  const yMin = Math.min(...bottomYValues);

  const yScale = useMemo(() => {
    return d3.scaleLinear().domain([yMin, yMax]).range([boundsHeight, 0]);
  }, [data, height]);

  // X axis
  const [xMin, xMax] = d3.extent(data, (d) => d.x);
  const xScale = useMemo(() => {
    return d3
      .scaleLinear()
      .domain([xMin || 0, xMax || 0])
      .range([0, boundsWidth]);
  }, [data, width]);

  // Color
  const colorScale = d3
    .scaleOrdinal<string>()
    .domain(groups)
    .range(colors);

  // Build the shapes
  const areaBuilder = d3
    .area<any>()
    .x((d) => {
      return xScale(d.data.x);
    })
    .y1((d) => yScale(d[1]))
    .y0((d) => yScale(d[0]))
    .curve(curveCatmullRom);

  const allPath = series.map((serie, i) => {
    const path = areaBuilder(serie);
    return (
      <path
        key={i}
        className={styles.shape}
        d={path}
        opacity={1}
        //stroke="grey" // border
        fill={colorScale(serie.key)}
        fillOpacity={0.8}
        cursor="pointer"
      />
    );
  });

  const grid = data
  .map(d => d.x) // 获取所有数据点的x值（年份）
  .filter((value, index, self) => self.indexOf(value) === index) // 去重
  .map((value, i) => (
    <g key={i}>
      <line
        x1={xScale(value)}
        x2={xScale(value)}
        y1={0}
        y2={boundsHeight}
        stroke="#808080"
        opacity={0.2}
      />
      <text
        x={xScale(value)}
        y={boundsHeight + 10}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={12}
        opacity={1}
        fill={textColor}
      >
        {value}
      </text>
    </g>
  ));

  // 获取最近的数据点
  const getClosestPoint = (mouseX: number) => {
    const xValue = xScale.invert(mouseX);
    let closestPoint = data[0];
    let minDistance = Infinity;

    data.forEach(point => {
      const distance = Math.abs(point.x - xValue);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    });

    return closestPoint;
  };

  // 鼠标移动处理
  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const closest = getClosestPoint(mouseX);
    setInteractionData(closest);
    setTooltipPos({ 
      x: e.clientX,
      y: e.clientY
    });
  };

  // 鼠标离开处理
  const handleMouseLeave = () => {
    setInteractionData(null);
  };

  return (
    <div>
      <svg width="100%" height={height}>
        <Labels 
          groups={groups} 
          colorScale={colorScale} 
          marginLeft={MARGIN.left}
          hiddenGroups={hiddenGroups}
          onToggleGroup={(group) => {
            setHiddenGroups(prev => {
              const next = new Set(prev);
              if (next.has(group)) {
                next.delete(group);
              } else {
                next.add(group);
                // 如果所有组都被隐藏了，则清空 hiddenGroups（显示所有组）
                if (next.size === groups.length) {
                  return new Set();
                }
              }
              return next;
            });
          }}
          textColor={textColor}
        />

        <g
          width={boundsWidth}
          height={boundsHeight}
          transform={`translate(${[MARGIN.left, MARGIN.top].join(",")})`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          
          {grid}
          <g className={styles.container}>{allPath}</g>
          
          
          <TimeAxis xScale={xScale} height={boundsHeight} width={boundsWidth} xMin={xMin} xMax={xMax} />
        </g>
      </svg>
    </div>
  );
};

export default StreamGraph;