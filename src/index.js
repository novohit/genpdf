const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');

const app = express();
const port = process.env.PORT || 3000;

// 字体路径
const FONT_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'simhei.ttf');

app.use(cors());
app.use(express.json());

// 读取模板文件
async function getTemplate() {
    const templatePath = path.join(__dirname, 'templates', 'resume.html');
    const template = await fs.readFile(templatePath, 'utf-8');
    return handlebars.compile(template);
}

// 新增：将D3图表转换为SVG的函数
async function captureD3Chart(page, chartData, chartOptions) {
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

    // 在页面中渲染D3图表并返回SVG字符串
    const svgString = await page.evaluate((data, options) => {
        const width = options.width || 600;
        const height = options.height || 400;
        const margin = options.margin || { top: 20, right: 20, bottom: 30, left: 40 };

        const svg = d3.select('#d3-chart-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('xmlns', 'http://www.w3.org/2000/svg'); // 添加命名空间

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

        // 获取SVG字符串
        const container = document.getElementById('d3-chart-container');
        return container.innerHTML;
    }, chartData, chartOptions);

    return svgString;
}

// 新增：绘制扇形图的函数
async function capturePieChart(page) {
    // 注入D3库
    // await page.addScriptTag({
    //     url: 'https://d3js.org/d3.v7.min.js'
    // });

    // 创建一个容器来放置图表
    await page.evaluate(() => {
        const div = document.createElement('div');
        div.id = 'pie-chart-container';
        document.body.appendChild(div);
    });

    // Mock数据
    const mockData = [
        { label: "教学能力", value: 35 },
        { label: "专业知识", value: 25 },
        { label: "沟通技巧", value: 20 },
        { label: "课程设计", value: 15 },
        { label: "其他", value: 5 }
    ];

    // 在页面中渲染扇形图并返回SVG字符串
    const svgString = await page.evaluate((data) => {
        const width = 600;
        const height = 400;
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
            .attr('y', 30)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text('教');

        // 获取SVG字符串
        const container = document.getElementById('pie-chart-container');
        return container.innerHTML;
    }, mockData);

    return svgString;
}

app.post('/generate-pdf', async (req, res) => {
    try {
        const { teacherData, chartData, chartOptions, includePieChart = false } = req.body;
        
        if (!teacherData) {
            return res.status(400).json({ error: 'Teacher data is required' });
        }

        // 获取并编译模板
        const template = await getTemplate();
        const html = template(teacherData);

        // 启动 Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox']
        });
        const page = await browser.newPage();

        // 准备所有图表的SVG字符串
        let chartSvgString = '';
        let pieSvgString = '';

        // 如果有图表数据，生成柱状图SVG
        console.log('chartData', chartData);
        if (chartData) {
            chartSvgString = await captureD3Chart(page, chartData, chartOptions || {});
            console.log('chartSvgString length:', chartSvgString ? chartSvgString.length : 0);
        }

        // 如果需要扇形图，生成扇形图SVG
        if (includePieChart) {
            pieSvgString = await capturePieChart(page);
            console.log('pieSvgString length:', pieSvgString ? pieSvgString.length : 0);
        }

        // 将所有图表插入到HTML中
        let finalHtml = html;
        if (chartSvgString || pieSvgString) {
            const chartsHtml = `
                <div style="page-break-inside: avoid;">
                    ${chartSvgString || ''}
                </div>
                ${pieSvgString ? `
                <div style="page-break-inside: avoid; margin-top: 20px;">
                    ${pieSvgString}
                </div>
                ` : ''}
            `;
            finalHtml = html.replace('</body>', `${chartsHtml}</body>`);
        }

        await page.setContent(finalHtml, {
            waitUntil: 'networkidle0'
        });

        // 生成 PDF
        const pdf = await page.pdf({
            format: 'A4',
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            },
            printBackground: true // 确保背景图形被打印
        });

        await browser.close();

        // 设置响应头并发送 PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=teacher-resume.pdf');
        res.send(pdf);

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// 使用 PDFKit 生成 PDF
app.post('/generate-pdf-pdfkit', async (req, res) => {
    try {
        const { teacherData } = req.body;
        
        if (!teacherData) {
            return res.status(400).json({ error: 'Teacher data is required' });
        }

        // 创建 PDF 文档
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            autoFirstPage: true
        });

        // 注册中文字体
        doc.registerFont('SourceHanSans', FONT_PATH);
        doc.font('SourceHanSans');

        // 设置响应头
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=teacher-resume.pdf');

        // 将 PDF 流式传输到响应
        doc.pipe(res);

        // 添加内容到 PDF
        doc.fontSize(20).text('教师简历', { align: 'center' });
        doc.moveDown();

        // 添加基本信息
        doc.fontSize(14);
        if (teacherData.name) {
            doc.text(`姓名: ${teacherData.name}`);
        }
        if (teacherData.age) {
            doc.text(`年龄: ${teacherData.age}`);
        }
        if (teacherData.education) {
            doc.text(`学历: ${teacherData.education}`);
        }
        if (teacherData.experience) {
            doc.moveDown();
            doc.text('教学经验:', { underline: true });
            doc.fontSize(12).text(teacherData.experience);
        }
        if (teacherData.skills) {
            doc.moveDown();
            doc.fontSize(14).text('专业技能:', { underline: true });
            doc.fontSize(12).text(teacherData.skills);
        }

        // 结束文档
        doc.end();

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// 新增：将URL转换为PDF的路由
app.post('/url-to-pdf', async (req, res) => {
    try {
        const { url, options = {} } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // 验证URL格式
        try {
            new URL(url);
        } catch (error) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // 设置默认PDF选项
        const pdfOptions = {
            format: options.format || 'A4',
            margin: options.margin || {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            },
            printBackground: options.printBackground !== false,
            landscape: options.landscape || false,
            scale: options.scale || 1,
            preferCSSPageSize: options.preferCSSPageSize || true
        };

        // 启动浏览器
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // 创建新页面
        const page = await browser.newPage();

        // 设置视口大小
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
        });

        // 导航到目标URL
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // 生成PDF
        const pdf = await page.pdf(pdfOptions);

        // 关闭浏览器
        await browser.close();

        // 设置响应头
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=webpage-${Date.now()}.pdf`);
        
        // 发送PDF
        res.send(pdf);

    } catch (error) {
        console.error('URL to PDF conversion error:', error);
        res.status(500).json({ 
            error: 'Failed to convert URL to PDF',
            details: error.message 
        });
    }
});

app.post('/generate-pie-chart', async (req, res) => {
    try {
        // 启动 Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox']
        });
        const page = await browser.newPage();

        // 生成扇形图
        const svgString = await capturePieChart(page);

        // 创建简单的HTML页面
        const html = `
            <!DOCTYPE html>
            <html>
            <body>
                ${svgString}
            </body>
            </html>
        `;

        await page.setContent(html, {
            waitUntil: 'networkidle0'
        });

        // 生成 PDF
        const pdf = await page.pdf({
            format: 'A4',
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            },
            printBackground: true
        });

        await browser.close();

        // 设置响应头并发送 PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=teacher-pie-chart.pdf');
        res.send(pdf);

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});