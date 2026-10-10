systemctl enable --now arkhiv
cd /arkhive/
cd /arkhiv/
systemctl enable --now arkhiv
journalctl -u arkhiv -f  
cd /opt/arkhiv
cd /arkhiv
apt install -y certbot python3-certbot-nginx
nano /etc/nginx/sites-available/arkhiv
[200~ln -s /etc/nginx/sites-available/arkhiv /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d app.ваш-домен.com    # сам выпустит сертификат и включит https~
ln -s /etc/nginx/sites-available/arkhiv /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d catsalers.ru    # сам выпустит сертификат и включит https
cd /opt/arkhiv && git pull && systemctl restart arkhiv
d[200~/etc/nginx/sites-available/arkhiv~
cd /etc/nginx/sites-available/arkhiv
cd /etc/nginx/sites-available/
git pull && systemctl restart arkhiv
sudo bash deploy-vps.sh app.ваш-домен.com ВАШ_BOT_TOKEN ВАШ_TELEGRAM_ID
sudo bash deploy-vps.sh catsalers.ru 8760799628:AAHon0msqWKGtAKo8vzTHtmRsiWA7VwtY1c 6562008872
getent hosts app.catsalers.ru
ping app.catsalers.ru
ping catsalers.ru
ssh-keygen -t ed25519
cd /etc/nginx/sites-available
ssh-keygen -t ed25519
mkdir -p ~/.ssh && echo "SHA256:5HlNZO1Zm+pQGIsHBNOaXaLOA7siKWZ++ohFVnJsEFk" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
mkdir -p ~/.ssh && echo "SHA256:5HlNZO1Zm+pQGIsHBNOaXaLOA7siKWZ++ohFVnJsEFk root@box-973085" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
ssh root@185.185.71.172
sudo apt update
sudo apt install -y nodejs npm nginx
PUBLIC_URL=https://catsalers.ru
cd /opt/catsalers-archive
npm install
npm run build
npm start
cd /opt/catsalers-archive
npm install
npm run build
cd /opt/catsalers-archive
npm install
npm run build
npm start
cd /opt/
cd /opt/catsalers-archive
cd /opt/catsalers-archive/
npm install
npm run build
npm start
npm install
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d archive.твой-домен.com
cd /opt
mkdir -p archive-bot
cd archive-bot
nano setup.js
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d catsalers.ru
sudo cp deploy/catsalers.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now catsalers
docker compose up -d --build
cd
cd /opt/catsalers-archive
npm install
npm run build
npm start
cd /opt/catsalers-archive
cd /catsalers-archive
cd /catsalers-archive/
npm install
npm run dev
ll
cd cd.../
cd cd../
cd local/
cd /local/
exit
passwd
exit
cd /tmp/
pwd
ls
ls | grep .zip
exit
history
ll
cd /opt/archive-bot/
ll
cd /
find -type d -name '*deploy*'
cd /opt
ll
npm run build
cd dir
pwd
ll
sudo apt update
cd /opt/catsalers-archive
npm install
npm run build
cd /
cd /opt/catsalers-archive
npm install
npm run build
npm start
sudo apt install -y certbot python3-certbot-nginx
sudi dpkg --configure -a
sudo dpkg --configure -a
sudo apt install -y certbot python3-certbot-nginx
sudo cp deploy/catsalers.service /etc/systemd/system/
cd deploy/
cd /deploy/
cd /opt/catsalers-archive 
npm install 
npm run build 
cd /opt/
cd /deploy/
cd /opt/deploy 
cd /opt/catsalers-archive 
npm install 
npm run build 
npm install 
ll
cd /opt/archive-bot/
cd /opt/catsalers-archive 
npm install 
npm run build 
npm start
sudo apt update
cd /opt/catsalers-archive
npm install
npm run build
npm start
l
ll
passwd
cd /opt/
ll
pwd
cd ..
ls
cd 
ll
cd tmp
cd ..
cd tmp
pwd
sudo apt update
cd /opt/catsalers-archive
npm install
npm run build
npm start/
cd /
cd
npm install 
ll
sudo apt install -y certbot python3-certbot-nginx
cd /opt/catsalers-archive 
npm install 
npm run build 
npm start
ll
cd /tmp
ll
cd /
ll
cd
ll
ls
pwd
cd ..
ls
ll
cd
ll
ls
ll
cd /dir/
cd /dir
cd /root/dir
ll
sudo apt update 
sudo apt install -y nodejs npm nginx 
# либо docker 
curl -O http://vestacp.com/pub/vst-install.sh
apt-get update
bash vst-install.sh
curl -O http://vestacp.com/pub/vst-install.sh
apt-get update
bash vst-install.sh
cd /root/dir
bash vst-install.sh
ssh root@185.185.71.172
ssh root@185.185.71.172
cd /root/dir
ll
cd dir
ll
cd /usr/bin/node server/
cd /usr/bin/npm start
cd /usr/bin/npm start/
cd usr
/cd /usr/
cd /usr
/cd /bin
ll
cd bin/
ll
cd /npm start
cd /node server
cd node server/
which npm
which node
nano /etc/systemd/system/catsalers.service
# Обновляем конфиг
systemctl daemon-reload
# Перезапускаем сервис
systemctl restart catsalers
# Проверяем статус
systemctl status catsalers
journalctl -u catsalers -n 50 --no-pager
curl -I http://127.0.0.1:3000
npm install
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
npm cache clean --force
npm install --no-audit --no-fund --prefer-offline
npm run build
systemctl restart catsalers
curl -I http://127.0.0.1:3000
nano /etc/nginx/sites-available/catsalers.conf
# Проверяем, есть ли симлинк в sites-enabled (если нет, создаем)
ln -sf /etc/nginx/sites-available/catsalers.conf /etc/nginx/sites-enabled/
# Проверяем конфиг на синтаксические ошибки
nginx -t
# Перезапускаем веб-сервер
systemctl restart nginx
certbot --nginx -d catsalers.ru -d www.catsalers.ru
dig +short catsalers.ru
dig +short www.catsalers.ru
dig @8.8.8.8 +short catsalers.ru
dig @1.1.1.1 +short catsalers.ru
dig @8.8.8.8 +short www.catsalers.ru
dig @1.1.1.1 +short www.catsalers.ru
curl -I http://catsalers.ru
curl -I http://www.catsalers.ru
curl -I http://127.0.0.1:3000
nginx -T | grep -A15 -B3 "catsalers.ru"
certbot --nginx -d catsalers.ru -d www.catsalers.ru
ss -tulpn | grep ':443'
curl -I https://catsalers.ru
curl -I https://www.catsalers.ru
nginx -T | grep -A25 -B3 "catsalers.ru"
curl -I http://127.0.0.1:3000
ss -ltnp | grep ':3000'
ps aux | grep '[n]ode'
curl -vk --resolve catsalers.ru:443:127.0.0.1 https://catsalers.ru/ -o /tmp/site.html
head -30 /tmp/site.html
curl -sk -D - https://catsalers.ru/ -o /dev/null
tail -n 50 /var/log/nginx/error.log
tail -n 50 /var/log/nginx/access.log
grep -oE '(/api/[A-Za-z0-9_./?=&-]+)' public/assets/*.js dist/assets/*.js 2>/dev/null | sort -u
find . -type f -name '*.js'
grep -RniE '503|Service Unavailable|status.?503' .   --exclude-dir=node_modules   --exclude='*.map'
grep -RniE '503|Service Unavailable|status.?503' .   --exclude-dir=node_modules   --exclude='*.map'
tail -f /var/log/nginx/access.log
dig +short A catsalers.ru
dig +short AAAA catsalers.ru
dig +short A www.catsalers.ru
dig +short AAAA www.catsalers.ru
tail -f /var/log/nginx/access.log /var/log/nginx/error.log
curl -4 -vk --connect-timeout 10 https://catsalers.ru/
nc -vz 185.185.71.172 80
nc -vz 185.185.71.172 443
