import React, { useMemo } from 'react';
import * as d3 from 'd3';
import styles from "./streamgraph.module.css";

type LabelsProps = {
  marginLeft: number;
  groups: string[];
  colorScale: (key: string) => string;
  hiddenGroups: Set<string>;
  onToggleGroup: (group: string) => void;
  textColor?: string;
}

export const Labels = ({ marginLeft, groups, colorScale, hiddenGroups, onToggleGroup, textColor = "black" }: LabelsProps) => {

  const calculateLegendWidths = () => {
    const tempSvg = d3.select('body').append('svg');
    const widths = groups.map(key => {
      const text = tempSvg.append('text')
      .attr('font-size', '12px') // 确保与实际渲染字体大小一致
      .text(key);
      const width = text.node()?.getBBox().width || 0;
      text.remove();
      return width;
    });
    tempSvg.remove();
    return widths;
  };
  
  const LEGEND_ITEM_SPACING = 30; // 图例项之间的固定间距
  const CIRCLE_TEXT_SPACING = 12; // 圆形图标和文本之间的间距
  const ITEMS_PER_ROW = 6; // 每行最多显示的图例数量
  const ROW_HEIGHT = 25; // 行间距

  const legendWidths = useMemo(() => calculateLegendWidths(), [groups]);
  const legendPositions = legendWidths.reduce((acc: number[], width: number, i: number) => {
    // const previousPosition = i === 0 ? 0 : acc[i - 1] + legendWidths[i - 1] + LEGEND_ITEM_SPACING;
    const rowIndex = Math.floor(i / ITEMS_PER_ROW);
    const colIndex = i % ITEMS_PER_ROW;
    const previousPosition = colIndex === 0 ? 0 : acc[i - 1] + legendWidths[i - 1] + LEGEND_ITEM_SPACING;
    acc.push(previousPosition);
    return acc;
  }, []);

  return (<g transform={`translate(${marginLeft}, 20)`}>

    {groups.map((key, i) => {
      const rowIndex = Math.floor(i / ITEMS_PER_ROW);
      const y = rowIndex * ROW_HEIGHT;
      return (
        <g
          key={key}
          transform={`translate(${legendPositions[i]}, ${y})`}
          className={styles.legend}
          onClick={() => onToggleGroup(key)}
        >
          <circle
            r={6}
            fill={colorScale(key)}
            opacity={hiddenGroups.has(key) ? 0.3 : 1}
          />
          <text
            x={CIRCLE_TEXT_SPACING}
            y={4}
            fontSize={12}
            fill={textColor}
            opacity={hiddenGroups.has(key) ? 0.3 : 1}
          >
            {key}
          </text>
        </g>
      );
    })}
  </g>);
};