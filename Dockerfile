# Gunakan image Node.js resmi sebagai base image
FROM node:18

# Atur direktori kerja di dalam container
WORKDIR /index

# Salin package.json dan package-lock.json ke dalam container
COPY package*.json ./

# Install dependensi
RUN npm install

# Salin semua file dari proyek ke dalam container
COPY . .

# Expose port aplikasi
EXPOSE 8080

# Jalankan aplikasi
CMD ["node", "index.js"]
