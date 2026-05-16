FROM node:22-alpine
WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml ./
RUN corepack enable && yarn install --immutable

COPY src ./src

EXPOSE 8787
CMD ["corepack", "yarn", "start"]
