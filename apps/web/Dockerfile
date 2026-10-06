FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Important for Docker live reload
ENV CHOKIDAR_USEPOLLING=true

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]