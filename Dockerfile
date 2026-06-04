FROM node:14

WORKDIR /usr/opt/cachearoo
COPY . .
RUN npm install

WORKDIR /usr/opt/cachearoo/_admin
RUN npm install
WORKDIR /usr/opt/cachearoo

COPY ./config-linux.json ./config.json
RUN npm run build

EXPOSE 4300
WORKDIR /usr/opt/cachearoo/build
CMD ["node", "index"]

