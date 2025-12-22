# 使用 Node 镜像，因为你的 package.json 显示这是 React 项目
FROM node:18-alpine

WORKDIR /app

# 复制前端依赖文件
COPY package*.json ./
RUN npm install

# 复制所有源码
COPY . .

# 暴露 3000 端口（根据你之前的日志确认过是 3000）
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
