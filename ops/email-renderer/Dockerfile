FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /opt/email-renderer
ENV NODE_ENV=production EMAIL_RENDER_SPOOL=/spool
COPY ops/email-renderer/package.json ops/email-renderer/package-lock.json ./
RUN npm ci --omit=dev
COPY ops/email-renderer/*.mjs ./
USER pwuser
CMD ["node", "worker.mjs"]
