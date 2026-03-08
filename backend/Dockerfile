# Gunakan image node resmi
FROM node:20

# Install libatomic1 (agar sqlite3 bisa build)
RUN apt-get update && apt-get install -y libatomic1

WORKDIR /app
COPY . .

RUN npm install

CMD ["npm", "start"]
