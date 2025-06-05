import React from 'react';
import * as d3 from 'd3';

type TimeAxisProps = {
  xScale: Date[] & d3.ScaleTime<number, number, never>;
  height: number;
  width: number;
  xMin: any;
  xMax: any;
};

export const TimeAxis = ({ xScale, height, width, xMin, xMax }: TimeAxisProps) => {
  return (    
    <g transform={`translate(0, ${height + 30})`}>
      {[xMin, ...xScale.ticks(8), xMax].map((value, i, array) => {
        if (i === array.length - 1) return null;
        const nextValue = array[i + 1];
        return (
          <line
            key={i}
            x1={xScale(value) + 6}
            x2={xScale(nextValue) - 6}
            y1={0}
            y2={0}
            stroke="#4460bf"
            strokeWidth={1}
          />
        );
      })}
      
      <circle cx={0} cy={0} r={6} fill="#4460bf" />
      <circle cx={width} cy={0} r={6} fill="#4460bf" />
      
      {[xMin, ...xScale.ticks(8), xMax].map((value, i) => (
        <circle
          key={i}
          cx={xScale(value)}
          cy={0}
          r={3}
          fill="#4460bf"
        />
      ))}
      
      <text
        x={10}
        y={20}
        textAnchor="start"
        fill="#4460bf"
        fontSize={14}
      >
        {xMin}
      </text>
      <text
        x={width - 10}
        y={20}
        textAnchor="end"
        fill="#4460bf"
        fontSize={14}
      >
        {xMax}
      </text>
    </g>
  );
};
