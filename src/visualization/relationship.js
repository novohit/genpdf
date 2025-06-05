const captureRelationshipGraph = async (page, data, useFixedSize = true) => {
    console.log('captureRelationshipGraph', data.length);
    // 注入D3库
    await page.addScriptTag({
        url: 'https://d3js.org/d3.v7.min.js'
    });

    // 创建一个容器来放置图表
    await page.evaluate(() => {
        const div = document.createElement('div');
        div.id = 'relationship-graph-container';
        div.style.width = '600px';
        div.style.height = '400px';
        div.style.border = '1px solid #e5e7eb';
        div.style.borderRadius = '8px';
        div.style.overflow = 'hidden';
        div.style.position = 'relative';
        div.style.backgroundColor = '#fff';
        document.body.appendChild(div);
    });

    // 在页面中渲染关系图并返回SVG字符串
    const svgString = await page.evaluate((graphData, fixedSize) => {
        console.log('BBBBB graphData', JSON.stringify(graphData));
        console.log('BBBBB graphData length', JSON.stringify(graphData.length));
        const width = 600;
        const height = 400;
        const FIXED_NODE_SIZE = 8;

        // 创建SVG容器
        const svg = d3.select('#relationship-graph-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('xmlns', 'http://www.w3.org/2000/svg');

        // 计算数据的最大最小值
        const maxStrength = Math.max(...graphData.map(d => d.strength));
        const minStrength = Math.min(...graphData.map(d => d.strength));
        
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
            .range([250, 50]);

        // 定义半径比例尺
        const radiusScale = d3.scaleLinear()
            .domain([domainMin, domainMax])
            .range([2.5, 10]);

        // 添加三层背景同心环
        const circles = [
            { radius: 100, color: 'rgba(29, 83, 255, 0.08)', opacity: 1 },
            { radius: 200, color: 'rgba(29, 83, 255, 0.05)', opacity: 1 },
            { radius: 300, color: 'rgba(29, 83, 255, 0.02)', opacity: 1 }
        ];

        circles.forEach(circle => {
            svg.append('circle')
                .attr('cx', width / 2)
                .attr('cy', height / 2)
                .attr('r', circle.radius)
                .attr('fill', circle.color)
                .attr('opacity', circle.opacity)
                .attr('stroke', 'none');
        });

        // 创建中心节点
        svg.append('circle')
            .attr('cx', width / 2)
            .attr('cy', height / 2)
            .attr('r', 25)
            .attr('fill', '#1d53ff')
            .attr('stroke', '#fff');

        // 添加中心节点文字
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#fff')
            .attr('pointer-events', 'none')
            .text(' ');

        // 计算其他节点的位置并添加
        graphData.forEach((item, index) => {
            let angle;
            if (index < graphData.length / 2) {
                // 左半边：-45度到45度 (-π/4 到 π/4)
                angle = -Math.PI/4 + (index * (Math.PI/2) / (graphData.length/2));
            } else {
                // 右半边：135度到225度 (3π/4 到 5π/4)
                angle = 3*Math.PI/4 + ((index - graphData.length/2) * (Math.PI/2) / (graphData.length/2));
            }
            
            const distance = distanceScale(item.strength);
            const x = width / 2 + Math.cos(angle) * distance;
            const y = height / 2 + Math.sin(angle) * distance;

            const getColor = () => {
                if (item.strength <= 5) return '#15cfa1';      // 1-5次
                if (item.strength <= 10) return '#ffa940';     // 6-10次
                return '#ff4d4f';                              // >10次
            }

            // 添加节点
            svg.append('circle')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', fixedSize ? FIXED_NODE_SIZE : radiusScale(item.strength))
                .attr('fill', getColor())
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);

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
            .attr('x', width/2 - outerRadius - 20)
            .attr('y', height/2)
            .attr('text-anchor', 'end')
            .attr('fill', LABEL_COLOR)
            .attr('font-size', LABEL_FONT_SIZE)
            .attr('pointer-events', 'none')
            .text('弱');

        svg.append('line')
            .attr('x1', width/2 - outerRadius)
            .attr('y1', height/2)
            .attr('x2', width/2 - middleRadius)
            .attr('y2', height/2)
            .attr('stroke', LABEL_COLOR)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4')
            .attr('pointer-events', 'none');

        svg.append('text')
            .attr('x', width/2 - middleRadius + 30)
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
            .attr('x', width/2 - innerRadius + 20)
            .attr('y', height/2)
            .attr('text-anchor', 'start')
            .attr('fill', LABEL_COLOR)
            .attr('font-size', LABEL_FONT_SIZE)
            .attr('pointer-events', 'none')
            .text('强');

        // 添加右侧标签
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

        // 添加图例
        const legendGroup = svg.append('g')
            .attr('transform', `translate(${width - 280}, 15)`);

        // 添加背景矩形
        legendGroup.append('rect')
            .attr('width', 220)
            .attr('height', 30)
            .attr('fill', 'rgba(255, 255, 255, 0.9)')
            .attr('rx', 4)
            .attr('ry', 4);

        // 添加"合作频次"文本
        legendGroup.append('text')
            .attr('x', 8)
            .attr('y', 20)
            .attr('fill', '#666')
            .attr('font-size', '12px')
            .text('合作频次:');

        // 定义图例项
        const legendItems = [
            { color: '#15cfa1', text: '1-5次', x: 65 },
            { color: '#ffa940', text: '6-10次', x: 115 },
            { color: '#ff4d4f', text: '>10次', x: 170 }
        ];

        // 添加图例项
        legendItems.forEach(item => {
            // 添加圆点
            legendGroup.append('circle')
                .attr('cx', item.x)
                .attr('cy', 16)
                .attr('r', 4)
                .attr('fill', item.color);

            // 添加文本
            legendGroup.append('text')
                .attr('x', item.x + 8)
                .attr('y', 20)
                .attr('fill', '#666')
                .attr('font-size', '12px')
                .text(item.text);
        });

        // 获取SVG字符串
        const container = document.getElementById('relationship-graph-container');
        return container.innerHTML;
    }, data, useFixedSize);

    return svgString;
};

module.exports = {
    captureRelationshipGraph
}; 