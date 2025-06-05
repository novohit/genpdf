const captureStreamGraph = async (page, data, options = {}) => {
    const {
        width = 600,
        height = 200,
        colors = ["#fea46e", "#73bb74", "#62a1c7", "#fecea5", "#c6d9ec"],
        textColor = "black",
        isDark = false
    } = options;

    // 注入D3库
    await page.addScriptTag({
        url: 'https://d3js.org/d3.v7.min.js'
    });

    // 创建容器
    await page.evaluate(() => {
        const div = document.createElement('div');
        div.id = 'streamgraph-container';
        div.style.width = '600px';
        div.style.height = '200px';
        div.style.position = 'relative';
        document.body.appendChild(div);
    });

    // 在页面中渲染StreamGraph并返回SVG字符串
    const svgString = await page.evaluate(({ data, width, height, colors, textColor, isDark }) => {
        const MARGIN = { top: 30, right: 30, bottom: 50, left: 50 };
        const boundsWidth = width - MARGIN.right - MARGIN.left;
        const boundsHeight = height - MARGIN.top - MARGIN.bottom;

        // 创建SVG容器
        const svg = d3.select('#streamgraph-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('xmlns', 'http://www.w3.org/2000/svg');

        // 创建主绘图区域组
        const g = svg.append('g')
            .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

        // 获取所有组（除了x轴数据）
        const groups = Object.keys(data[0]).filter(key => key !== 'x');

        // 创建堆叠生成器
        const stackSeries = d3.stack()
            .keys(groups)
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetSilhouette);

        const series = stackSeries(data);

        // Y轴比例尺
        const yValues = series.flatMap(s => s.flatMap(d => [d[0], d[1]]));
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        const yScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([boundsHeight, 0]);

        // X轴比例尺
        const xValues = data.map(d => d.x);
        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const xScale = d3.scaleLinear()
            .domain([xMin, xMax])
            .range([0, boundsWidth]);

        // 颜色比例尺
        const colorScale = d3.scaleOrdinal()
            .domain(groups)
            .range(colors);

        // 创建面积生成器
        const areaBuilder = d3.area()
            .x(d => xScale(d.data.x))
            .y1(d => yScale(d[1]))
            .y0(d => yScale(d[0]))
            .curve(d3.curveCatmullRom);

        // 绘制流图区域
        series.forEach((serie, i) => {
            g.append('path')
                .attr('d', areaBuilder(serie))
                .attr('fill', colorScale(serie.key))
                .attr('fill-opacity', 0.8);
        });

        // 绘制网格线和年份标签
        const uniqueXValues = [...new Set(data.map(d => d.x))];
        uniqueXValues.forEach(value => {
            // 垂直网格线
            g.append('line')
                .attr('x1', xScale(value))
                .attr('x2', xScale(value))
                .attr('y1', 0)
                .attr('y2', boundsHeight)
                .attr('stroke', '#808080')
                .attr('opacity', 0.2);

            // 年份标签
            g.append('text')
                .attr('x', xScale(value))
                .attr('y', boundsHeight + 10)
                .attr('text-anchor', 'middle')
                .attr('alignment-baseline', 'central')
                .attr('font-size', 12)
                .attr('fill', textColor)
                .text(value);
        });

        // 添加 TimeAxis
        const timeAxisGroup = g.append('g')
            .attr('transform', `translate(0, ${boundsHeight + 30})`);

        // 绘制连接线
        const xTicks = [xMin, ...d3.ticks(xMin, xMax, 8), xMax];
        xTicks.forEach((value, i, array) => {
            if (i === array.length - 1) return;
            const nextValue = array[i + 1];
            timeAxisGroup.append('line')
                .attr('x1', xScale(value) + 6)
                .attr('x2', xScale(nextValue) - 6)
                .attr('y1', 0)
                .attr('y2', 0)
                .attr('stroke', '#4460bf')
                .attr('stroke-width', 1);
        });

        // 绘制端点圆圈
        timeAxisGroup.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 6)
            .attr('fill', '#4460bf');

        timeAxisGroup.append('circle')
            .attr('cx', boundsWidth)
            .attr('cy', 0)
            .attr('r', 6)
            .attr('fill', '#4460bf');

        // 绘制中间点
        xTicks.forEach(value => {
            timeAxisGroup.append('circle')
                .attr('cx', xScale(value))
                .attr('cy', 0)
                .attr('r', 3)
                .attr('fill', '#4460bf');
        });

        // 添加起始和结束年份标签
        timeAxisGroup.append('text')
            .attr('x', 10)
            .attr('y', 20)
            .attr('text-anchor', 'start')
            .attr('fill', '#4460bf')
            .attr('font-size', 14)
            .text(xMin);

        timeAxisGroup.append('text')
            .attr('x', boundsWidth - 10)
            .attr('y', 20)
            .attr('text-anchor', 'end')
            .attr('fill', '#4460bf')
            .attr('font-size', 14)
            .text(xMax);

        // 图例常量定义
        const LEGEND_ITEM_SPACING = 30; // 图例项之间的固定间距
        const CIRCLE_TEXT_SPACING = 12; // 圆形图标和文本之间的间距
        const ITEMS_PER_ROW = 6; // 每行最多显示的图例数量
        const ROW_HEIGHT = 25; // 行间距

        // 计算文本宽度
        const tempSvg = d3.select('body').append('svg');
        const legendWidths = groups.map(key => {
            const text = tempSvg.append('text')
                .attr('font-size', '12px')
                .text(key);
            const width = text.node().getBBox().width;
            text.remove();
            return width;
        });
        tempSvg.remove();

        // 计算每个图例项的位置
        const legendPositions = legendWidths.reduce((acc, width, i) => {
            const rowIndex = Math.floor(i / ITEMS_PER_ROW);
            const colIndex = i % ITEMS_PER_ROW;
            const previousPosition = colIndex === 0 ? 0 : acc[i - 1] + legendWidths[i - 1] + LEGEND_ITEM_SPACING;
            acc.push(previousPosition);
            return acc;
        }, []);

        // 添加图例
        const legendGroup = svg.append('g')
            .attr('transform', `translate(${MARGIN.left}, 20)`);

        groups.forEach((key, i) => {
            const rowIndex = Math.floor(i / ITEMS_PER_ROW);
            const y = rowIndex * ROW_HEIGHT;
            
            const legendItem = legendGroup.append('g')
                .attr('transform', `translate(${legendPositions[i]}, ${y})`);

            legendItem.append('circle')
                .attr('r', 6)
                .attr('fill', colorScale(key));

            legendItem.append('text')
                .attr('x', CIRCLE_TEXT_SPACING)
                .attr('y', 4)
                .attr('font-size', 12)
                .attr('fill', textColor)
                .text(key);
        });

        // 获取SVG字符串
        const container = document.getElementById('streamgraph-container');
        return container.innerHTML;
    }, { data, width, height, colors, textColor, isDark });

    return svgString;
};

module.exports = {
    captureStreamGraph
}; 