# Menggunakan image Node.js resmi
FROM node:18

# Mengatur direktori kerja
WORKDIR /usr/src/app

# Menyalin package.json dan package-lock.json
COPY package*.json ./

# Menginstal dependensi
RUN npm install

# Menyalin semua file dari proyek ke dalam container
COPY . .

# Menjalankan aplikasi
CMD ["node", "index.js"]

# Mengatur port yang akan digunakan
EXPOSE 8080
