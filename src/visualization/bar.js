const { teacherSkillsData, publicationData } = require('./mock/data');

// 柱状图绘制函数
async function captureD3Chart(page, dataType = 'skills', chartOptions = {}) {
    // 添加控制台监听
    page.on('console', msg => console.log('Browser log:', msg.text()));
    
    // 注入D3库
    // 记录注入时间
    const startTime = Date.now();
    console.log('D3库注入时间 单位ms:', startTime);

    await page.addScriptTag({
        url: 'https://d3js.org/d3.v7.min.js'
    });
    const endTime = Date.now();
    console.log('D3库注入时间 单位ms:', endTime - startTime);

    // 创建一个容器来放置图表
    await page.evaluate(() => {
        const div = document.createElement('div');
        div.id = 'd3-chart-container';
        document.body.appendChild(div);
    });

    // 选择数据
    const chartData = dataType === 'skills' ? teacherSkillsData.bar : publicationData.bar;
    const chartTitle = dataType === 'skills' ? '教师综合评估' : '论文发表统计';
    console.log('Node.js environment - chartData:', chartData);
    // 在页面中渲染D3图表并返回SVG字符串
    const svgString = await page.evaluate((data, options, title) => {
        console.log('SSSSSSSS', JSON.stringify(data));
        const width = options.width || 600;
        const height = options.height || 400;
        const margin = options.margin || { top: 40, right: 20, bottom: 30, left: 40 };

        const svg = d3.select('#d3-chart-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('xmlns', 'http://www.w3.org/2000/svg'); // 添加命名空间

        // 添加标题
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', margin.top / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text(title);

        const chart = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // 设置比例尺
        const x = d3.scaleBand()
            .range([0, width - margin.left - margin.right])
            .padding(0.1);

        const y = d3.scaleLinear()
            .range([height - margin.top - margin.bottom, 0]);

        // 设置数据域
        x.domain(data.map(d => d.label));
        y.domain([0, d3.max(data, d => d.value)]);

        // 添加x轴
        chart.append('g')
            .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
            .call(d3.axisBottom(x));

        // 添加y轴
        chart.append('g')
            .call(d3.axisLeft(y));

        // 绘制柱状图
        chart.selectAll('.bar')
            .data(data)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.label))
            .attr('y', d => y(d.value))
            .attr('width', x.bandwidth())
            .attr('height', d => height - margin.top - margin.bottom - y(d.value))
            .attr('fill', 'steelblue');

        // 添加数值标签
        chart.selectAll('.value-label')
            .data(data)
            .enter()
            .append('text')
            .attr('class', 'value-label')
            .attr('x', d => x(d.label) + x.bandwidth() / 2)
            .attr('y', d => y(d.value) - 5)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(d => d.value);

        // 获取SVG字符串
        const container = document.getElementById('d3-chart-container');
        return container.innerHTML;
    }, chartData, chartOptions, chartTitle);

    return svgString;
}

module.exports = {
    captureD3Chart
}; 