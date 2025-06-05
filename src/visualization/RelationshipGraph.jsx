import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const RelationshipGraph = ({ data, useFixedSize = false }) => {
  const svgRef = useRef(null);
  const width = 600;
  const height = 400;
  const FIXED_NODE_SIZE = 8;

  useEffect(() => {
    if (!data || !svgRef.current) return;

    // 计算数据的最大最小值
    const maxStrength = Math.max(...data.map(d => d.strength));
    const minStrength = Math.min(...data.map(d => d.strength));
    
    // 为了视觉效果，可以稍微扩展一下范围
    let tolerance = 5;
    if (maxStrength - minStrength < 10) {
        tolerance = 1;
    }
    const domainMin = Math.max(0, minStrength - tolerance);  // 下限不低于0
    const domainMax = Math.min(100, maxStrength + tolerance);  // 上限不超过100

    // 定义距离比例尺
    const distanceScale = d3.scaleLinear()
      .domain([domainMin, domainMax])
      .range([250, 50]);  // 距离范围保持不变

    // 定义半径比例尺 - 也使用相同的 domain
    const radiusScale = d3.scaleLinear()
      .domain([domainMin, domainMax])
      .range([2.5, 10]);

    // 清除之前的内容
    d3.select(svgRef.current).selectAll('*').remove();

    // 创建SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const circles = [
      { radius: 100, color: 'rgba(29, 83, 255, 0.08)', opacity: 1 },  // 内层 - 最深
      { radius: 200, color: 'rgba(29, 83, 255, 0.05)', opacity: 1 },  // 中层 - 较淡
      { radius: 300, color: 'rgba(29, 83, 255, 0.02)', opacity: 1 }   // 外层 - 最淡
    ];
    // 添加三层背景同心环
    // const circles = [
    //   { radius: 150, color: 'rgba(29, 83, 255, 0.08)', opacity: 1 },  // 内层 - 最深
    //   { radius: 250, color: 'rgba(29, 83, 255, 0.05)', opacity: 1 },  // 中层 - 较淡
    //   { radius: 350, color: 'rgba(29, 83, 255, 0.02)', opacity: 1 }   // 外层 - 最淡
    // ];

    circles.forEach(circle => {
      svg.append('circle')
        .attr('cx', width / 2)
        .attr('cy', height / 2)
        .attr('r', circle.radius)
        .attr('fill', circle.color)
        .attr('opacity', circle.opacity)
        .attr('stroke', 'none');
    });

    // 定义颜色比例尺
    const colorScale = d3.scaleLinear()
      .domain([0, 100])
      .range(['#a8e6cf', '#3d6b7d']); // 从浅绿色到深蓝色

    // 创建中心节点
    svg.append('circle')
      .attr('cx', width / 2)
      .attr('cy', height / 2)
      .attr('r', 25)
      .attr('fill', '#1d53ff')
      .attr('stroke', '#fff')
      .style('cursor', 'pointer')  // 鼠标变为手型
      .on('mouseover', function() {  // 鼠标悬停效果
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 30)  // 放大
          .attr('fill', '#1345d2')  // 加深蓝色
          .attr('stroke-width', 2);
      })
      .on('mouseout', function() {  // 鼠标移出恢复
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 25)
          .attr('fill', '#1d53ff')
          .attr('stroke-width', 1);
      });

    // 添加中心节点文字
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')  // 忽略鼠标事件
      .text(' ');

    // 计算其他节点的位置并添加
    data.forEach((item, index) => {
      let angle;
      if (index < data.length / 2) {
        // 左半边：-45度到45度 (-π/4 到 π/4)
        angle = -Math.PI/4 + (index * (Math.PI/2) / (data.length/2));
      } else {
        // 右半边：135度到225度 (3π/4 到 5π/4)
        angle = 3*Math.PI/4 + ((index - data.length/2) * (Math.PI/2) / (data.length/2));
      }
      
      const distance = distanceScale(item.strength);
      const x = width / 2 + Math.cos(angle) * distance;
      const y = height / 2 + Math.sin(angle) * distance;

      const getColor = () => {
        // 根据 strength 设置颜色
        if (item.strength <= 5) return '#15cfa1';      // 1-5次
        if (item.strength <= 10) return '#ffa940';     // 6-10次
        return '#ff4d4f';                              // >10次
      }

      const getHoverColor = () => {
        // 悬停时加深颜色
        if (item.strength <= 5) return '#0eb48c';      // 1-5次加深
        if (item.strength <= 10) return '#f29530';     // 6-10次加深
        return '#f03f42';                              // >10次加深
      }

      // 添加节点
      svg.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', useFixedSize ? FIXED_NODE_SIZE : radiusScale(item.strength))
        // .attr('fill', colorScale(item.strength))
        .attr('fill', getColor())  // 其他节点使用固定的青色
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .attr('data', item)
        .on('click', function() {
            const nodeData = {
              data: item,
              position: {x, y},
              index: index
            };
            console.log('点击节点:', nodeData);
          })
        // 增加鼠标交互效果
        .style('cursor', 'pointer')  // 鼠标变为手型
        .on('mouseover', function() {  // 鼠标悬停效果
          d3.select(this)
            .transition()
            .duration(200)
            .attr('r', (useFixedSize ? FIXED_NODE_SIZE : radiusScale(item.strength)) * 1.2)  // 放大1.2倍
            .attr('fill', getHoverColor())  // 使用加深的颜色
            .attr('stroke-width', 2);  // 加粗边框
        })
        .on('mouseout', function() {  // 鼠标移出恢复
          d3.select(this)
            .transition()
            .duration(200)
            .attr('r', useFixedSize ? FIXED_NODE_SIZE : radiusScale(item.strength))
            .attr('fill', getColor())
            .attr('stroke-width', 1);
        });


      // 添加连接线
    //   svg.append('line')
    //     .attr('x1', width / 2)
    //     .attr('y1', height / 2)
    //     .attr('x2', x)
    //     .attr('y2', y)
    //     .attr('stroke', colorScale(item.strength))
    //     .attr('stroke-width', item.strength / 50)
    //     .attr('opacity', 0.5);

      // 添加节点文字
      svg.append('text')
        .attr('x', x)
        .attr('y', y + radiusScale(item.strength) + 12)
        .attr('text-anchor', 'middle')
        .attr('fill', '#1d53ff')
        .attr('font-size', '11px')
        .text(item.id);
    });

    // 获取同心环的半径，用于定位标签
    const innerRadius = 100;
    const middleRadius = 200;
    const outerRadius = 250;
    const LABEL_COLOR = '#666';
    const LABEL_FONT_SIZE = '12px';

    // 添加左侧标签
    svg.append('text')
      .attr('x', width/2 - outerRadius - 20)  // 最外圈再往外20px
      .attr('y', height/2)
      .attr('text-anchor', 'end')
      .attr('fill', LABEL_COLOR)
      .attr('font-size', LABEL_FONT_SIZE)
      .attr('pointer-events', 'none')  // 忽略鼠标事件
      .text('弱');

    svg.append('line')
      .attr('x1', width/2 - outerRadius)
      .attr('y1', height/2)
      .attr('x2', width/2 - middleRadius)
      .attr('y2', height/2)
      .attr('stroke', LABEL_COLOR)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4')
      .attr('pointer-events', 'none');  // 忽略鼠标事件

    svg.append('text')
      .attr('x', width/2 - middleRadius + 30)  // 中间圈位置
      .attr('y', height/2)
      .attr('text-anchor', 'middle')
      .attr('fill', LABEL_COLOR)
      .attr('font-size', LABEL_FONT_SIZE)
      .attr('pointer-events', 'none')
      .text('合作关系');

    svg.append('line')
      .attr('x1', width/2 - middleRadius + 60)
      .attr('y1', height/2)
      .attr('x2', width/2 - innerRadius)
      .attr('y2', height/2)
      .attr('stroke', LABEL_COLOR)
      .attr('stroke-width', 1)
      .attr('pointer-events', 'none')
      .attr('stroke-dasharray', '4');

    svg.append('text')
      .attr('x', width/2 - innerRadius + 20)  // 内圈位置
      .attr('y', height/2)
      .attr('text-anchor', 'start')
      .attr('fill', LABEL_COLOR)
      .attr('font-size', LABEL_FONT_SIZE)
      .attr('pointer-events', 'none')
      .text('强');

    // 添加右侧标签（对称布局）
    svg.append('text')
      .attr('x', width/2 + innerRadius - 20)
      .attr('y', height/2)
      .attr('text-anchor', 'end')
      .attr('fill', LABEL_COLOR)
      .attr('font-size', LABEL_FONT_SIZE)
      .attr('pointer-events', 'none')
      .text('强');

    svg.append('line')
      .attr('x1', width/2 + innerRadius)
      .attr('y1', height/2)
      .attr('x2', width/2 + middleRadius - 60)
      .attr('y2', height/2)
      .attr('stroke', LABEL_COLOR)
      .attr('stroke-width', 1)
      .attr('pointer-events', 'none')
      .attr('stroke-dasharray', '4');

    svg.append('text')
      .attr('x', width/2 + middleRadius - 30)
      .attr('y', height/2)
      .attr('text-anchor', 'middle')
      .attr('fill', LABEL_COLOR)
      .attr('font-size', LABEL_FONT_SIZE)
      .attr('pointer-events', 'none')
      .text('合作关系');

    svg.append('line')
      .attr('x1', width/2 + middleRadius)
      .attr('y1', height/2)
      .attr('x2', width/2 + outerRadius)
      .attr('y2', height/2)
      .attr('stroke', LABEL_COLOR)
      .attr('stroke-width', 1)
      .attr('pointer-events', 'none')
      .attr('stroke-dasharray', '4');

    svg.append('text')
      .attr('x', width/2 + outerRadius + 20)
      .attr('y', height/2)
      .attr('text-anchor', 'start')
      .attr('fill', LABEL_COLOR)
      .attr('font-size', LABEL_FONT_SIZE)
      .attr('pointer-events', 'none')
      .text('弱');
    
  }, [data, useFixedSize]);

  return (
    <div className="graph-container" style={{ 
      width: '600px', 
      height: '400px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: '#fff'
    }}>
      {/* 右上角 */}
      <div style={{
        position: 'absolute',
        top: '5px',
        right: '5px',
        fontSize: '12px',
        color: '#666',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',  // 半透明白色背景
        padding: '4px 8px',
        borderRadius: '4px',
        zIndex: 1
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          合作频次:
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#15cfa1',
            borderRadius: '50%',
            display: 'inline-block'
          }}></span>
          1-5次
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#ffa940',
            borderRadius: '50%',
            display: 'inline-block'
          }}></span>
          6-10次
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#ff4d4f',
            borderRadius: '50%',
            display: 'inline-block'
          }}></span>
          &gt;10次
        </span>
      </div>

      <svg ref={svgRef}></svg>
    </div>
  );
};

export default RelationshipGraph; 