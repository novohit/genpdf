const { teacherSkillsData, teachingAchievementData } = require('./mock/data');

// 扇形图绘制函数
async function capturePieChart(page, dataType = 'skills') {
    // 注入D3库
    await page.addScriptTag({
        url: 'https://d3js.org/d3.v7.min.js'
    });

    // 创建一个容器来放置图表
    await page.evaluate(() => {
        const div = document.createElement('div');
        div.id = 'pie-chart-container';
        document.body.appendChild(div);
    });

    // 选择数据
    const mockData = dataType === 'skills' ? teacherSkillsData.pie : teachingAchievementData.pie;
    const chartTitle = dataType === 'skills' ? '教师能力评估' : '教学成果分布';

    // 在页面中渲染扇形图并返回SVG字符串
    const svgString = await page.evaluate((data, title) => {
        const width = 600;
        const height = 500;
        const radius = Math.min(width, height) / 2;

        // 创建SVG容器
        const svg = d3.select('#pie-chart-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('xmlns', 'http://www.w3.org/2000/svg');

        // 创建图表组并移动到中心
        const g = svg.append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`);

        // 颜色比例尺
        const color = d3.scaleOrdinal()
            .domain(data.map(d => d.label))
            .range(d3.schemeCategory10);

        // 创建饼图生成器
        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        // 创建弧生成器
        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius * 0.8);

        // 创建标签弧生成器
        const labelArc = d3.arc()
            .innerRadius(radius * 0.9)
            .outerRadius(radius * 0.9);

        // 添加扇形
        const arcs = g.selectAll('.arc')
            .data(pie(data))
            .enter()
            .append('g')
            .attr('class', 'arc');

        // 绘制扇形
        arcs.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.label))
            .attr('stroke', 'white')
            .style('stroke-width', '2px');

        // 添加标签
        arcs.append('text')
            .attr('transform', d => `translate(${labelArc.centroid(d)})`)
            .attr('dy', '.35em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(d => `${d.data.label} ${d.data.value}%`);

        // 添加标题
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text(title);

        // 获取SVG字符串
        const container = document.getElementById('pie-chart-container');
        return container.innerHTML;
    }, mockData, chartTitle);

    return svgString;
}

module.exports = {
    capturePieChart
}; 