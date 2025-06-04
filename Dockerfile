# 使用 Node.js 官方镜像作为基础镜像
FROM node:18-slim

# 设置工作目录
WORKDIR /usr/src/app

# 配置更可靠的镜像源并添加重试机制
RUN rm -f /etc/apt/sources.list.d/*.list \
    && echo "deb http://mirrors.ustc.edu.cn/debian/ bookworm main non-free contrib" > /etc/apt/sources.list \
    && echo "deb http://mirrors.ustc.edu.cn/debian-security/ bookworm-security main" >> /etc/apt/sources.list \
    && echo "deb http://mirrors.ustc.edu.cn/debian/ bookworm-updates main non-free contrib" >> /etc/apt/sources.list \
    && echo "deb http://mirrors.ustc.edu.cn/debian/ bookworm-backports main non-free contrib" >> /etc/apt/sources.list \
    && echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries \
    && echo 'Acquire::Check-Valid-Until "false";' >> /etc/apt/apt.conf.d/80-retries \
    && echo 'APT::Get::Assume-Yes "true";' >> /etc/apt/apt.conf.d/80-retries

# 安装 Puppeteer 所需的最小系统依赖
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends \
        fonts-wqy-zenhei \
        libx11-xcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxi6 \
        libxtst6 \
        libnss3 \
        libcups2 \
        libxss1 \
        libxrandr2 \
        libasound2 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libpangocairo-1.0-0 \
        libgtk-3-0 \
        libgbm1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 复制 package.json 和 package-lock.json
COPY package*.json ./
# ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm config set registry https://registry.npmjs.org/
# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 创建 templates 目录
RUN mkdir -p src/templates

# 设置环境变量
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"] 