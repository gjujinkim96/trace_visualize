FROM node:18.7.0

EXPOSE 3000

WORKDIR /home/node/app

RUN npm init -y && npm install express mysql2 sortablejs


COPY app/main.js main.js
COPY app/public public

CMD ["node", "main.js"]
