const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const { captureD3Chart, capturePieChart, captureRelationshipGraph, captureStreamGraph } = require('./visualization');

// 注册 Handlebars 辅助函数
handlebars.registerHelper('slice', function(arr, start, end) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(start, end);
});

handlebars.registerHelper('gt', function(a, b) {
    return a > b;
});

handlebars.registerHelper('eq', function(a, b) {
    return a === b;
});

handlebars.registerHelper('subtract', function(a, b) {
    return a - b;
});

// 排序辅助函数
handlebars.registerHelper('sort', function(array, field, direction) {
    if (!Array.isArray(array)) return [];
    const sorted = [...array].sort((a, b) => {
        if (direction === 'desc') {
            return b[field] - a[field];
        }
        return a[field] - b[field];
    });
    return sorted;
});

// 字符串分割辅助函数
handlebars.registerHelper('split', function(str, separator) {
    if (!str) return [];
    return str.split(separator).map(item => item.trim());
});

// 默认值辅助函数
handlebars.registerHelper('default', function(value, defaultValue) {
    return value != null ? value : defaultValue;
});

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

app.post('/generate-pdf', async (req, res) => {
    try {
        const { teacherData, chartOptions = {}, papers = [], collaborations = [],
         relationshipGraph = [], streamGraphData = [], experience = [] } = req.body;
        
        if (!teacherData) {
            return res.status(400).json({ error: 'Teacher data is required' });
        }

        // 将论文数据和合作关系数据添加到模板数据中
        const templateData = {
            ...teacherData,
            papers,
            collaborations: collaborations.sort((a, b) => b.numCooperation - a.numCooperation), // 按合作次数降序排序
            experience
        };

        // 获取并编译模板
        const template = await getTemplate();
        const html = template(templateData);

        // 启动 Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox']
        });
        const page = await browser.newPage();

        // 准备所有图表的SVG字符串
        let skillsPieChart = '';
        let achievementPieChart = '';
        let skillsBarChart = '';
        let publicationBarChart = '';
        let relationshipGraphSvg = '';
        let streamGraphSvg = '';

        // 生成教师能力评估饼图
        skillsPieChart = await capturePieChart(page, 'skills');
    
        // 生成论文发表统计柱状图
        publicationBarChart = await captureD3Chart(page, 'publication', chartOptions);

        // 生成合作关系图
        if (relationshipGraph.length > 0) {
            relationshipGraphSvg = await captureRelationshipGraph(page, relationshipGraph);
        }

        // 生成河流图
        if (streamGraphData.length > 0) {
            streamGraphSvg = await captureStreamGraph(page, streamGraphData);
        }

        // 将所有图表插入到HTML中
        let finalHtml = html;
        
        // 插入教师能力评估饼图
        finalHtml = finalHtml.replace('<div id="skills-pie-chart-placeholder"></div>', `
            <div style="page-break-inside: avoid; margin: 20px 0;">
                ${skillsPieChart}
            </div>
        `);

        // 插入论文发表统计柱状图
        finalHtml = finalHtml.replace('<div id="publication-bar-chart-placeholder"></div>', `
            <div style="page-break-inside: avoid; margin: 20px 0;">
                ${publicationBarChart}
            </div>
        `);

        // 插入合作关系图
        if (relationshipGraph.length > 0) {
            finalHtml = finalHtml.replace('<div id="relationship-graph-placeholder"></div>', `
                <div style="page-break-inside: avoid; margin: 20px 0;">
                    ${relationshipGraphSvg}
                </div>
            `);
        }

        // 插入流图
        if (streamGraphData.length > 0) {
            finalHtml = finalHtml.replace('<div id="stream-graph-placeholder"></div>', `
                <div style="page-break-inside: avoid; margin: 20px 0;">
                    ${streamGraphSvg}
                </div>
            `);
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