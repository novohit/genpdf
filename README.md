# 教师简历 PDF 生成服务

这是一个使用 Node.js、Express 和 Puppeteer 构建的 PDF 生成服务，可以根据教师数据生成简历 PDF。

## 安装

### 方式一：本地安装

1. 确保你已安装 Node.js (版本 14 或更高)
2. 克隆此仓库
3. 安装依赖：
```bash
npm install
```

### 方式二：使用 Docker

1. 确保已安装 Docker
2. 构建镜像：
```bash
docker build -t teacher-resume-pdf .
```
3. 运行容器：
```bash
docker run -p 3000:3000 teacher-resume-pdf
```

## 运行服务

### 本地运行

开发模式（带有热重载）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

### Docker 运行

```bash
# 构建镜像
docker build -t teacher-resume-pdf .

# 运行容器
docker run -p 3000:3000 teacher-resume-pdf

# 后台运行
docker run -d -p 3000:3000 teacher-resume-pdf
```

服务器将在 http://localhost:3000 上运行。

## API 使用说明

### 生成 PDF

**端点:** `POST /generate-pdf`

**请求体示例:**
```json
{
  "teacherData": {
    "name": "张三",
    "gender": "男",
    "age": 35,
    "phone": "13800138000",
    "email": "zhangsan@example.com",
    "education": [
      {
        "school": "北京师范大学",
        "major": "教育学",
        "degree": "硕士",
        "startYear": "2008",
        "endYear": "2011"
      }
    ],
    "experience": [
      {
        "institution": "XX中学",
        "position": "高级教师",
        "courses": "数学",
        "startDate": "2011-09",
        "endDate": "至今",
        "description": "负责高中数学教学工作，多次获得优秀教师称号"
      }
    ],
    "skills": [
      "精通数学教学方法",
      "擅长因材施教",
      "良好的沟通能力"
    ],
    "achievements": [
      "2019年市级优秀教师",
      "2020年教学成果一等奖"
    ]
  }
}
```

**响应:** 
- 成功：返回 PDF 文件
- 失败：返回错误信息 JSON

## 注意事项

1. 确保系统中已安装了所有必要的字体，特别是中文字体
2. 如果在 Linux 环境下运行，可能需要安装额外的依赖来支持 Puppeteer
3. 生成的 PDF 为 A4 格式，带有适当的页边距
4. 使用 Docker 运行时，所有依赖都已经包含在镜像中，无需额外安装 