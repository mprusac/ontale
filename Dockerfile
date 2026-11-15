FROM node:24-slim
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY migrations ./migrations
COPY seed ./seed
COPY scripts ./scripts
COPY public ./public
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
