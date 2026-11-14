# Durak — Telegram Mini App

Telegram guruhida 2 dan 6 kishigacha oʻynaladigan **Durak** (podkidnoy) karta oʻyini. Bura botining tuzilishi asosida qurilgan: oʻyin zali, stollar, botlar, ovozli chat, oʻzbek va rus tillari.

Guruhda `/durak` deb yoziladi. Bot oʻyin zalini ochadi. Stol ochishda oʻyinchilar soni tanlanadi (2–6). Oʻrinlar toʻlsa, oʻyin oʻzi boshlanadi.

## Qoidalar (podkidnoy)

- 36 ta karta, har kimga 6 tadan. Keyingi karta ochilib koloda tagiga qoʻyiladi — uning masti koʻzir.
- Birinchi oʻyinda eng kichik koʻziri bor oʻyinchi yuradi. Keyingi oʻyinlarda **durakning tagidan** yuriladi.
- Hujum: 1 ta karta yoki bir xil qiymatdagi bir nechta karta. Himoya: oʻsha mastning kattarogʻi yoki koʻzir.
- Faqat **himoyachining ikki yonidagi** oʻyinchilar (hujumchi va himoyachidan keyingi oʻyinchi) bir xil qiymatdagi kartani **tashlay oladi**: bir yurishda 6 tadan koʻp emas va himoyachining kartalaridan koʻp emas.
- **Olaman** — himoyachi hamma kartalarni oladi va navbatini oʻtkazib yuboradi. **Bito** — kartalar chiqib ketadi, himoyachi yuradi.
- Koloda tugagach kartasi qolmaganlar chiqadi. Oxirgi qolgan — **durak**. Hisob: kim necha marta durak boʻlgani.
- Vaqt tugasa: himoyachi oladi, hujumchi eng kichik kartasi bilan yuradi, tashlovchi — bito.

## Nimalar bor

- **Telegram bot** — `/durak` buyrugʻi bilan guruhda oʻyin zali xabarini chiqaradi va uni yangilab turadi.
- **Mini App** — telefonga moslashtirilgan oʻyin stoli: raqiblar tepada, oʻrtada koloda va stoldagi juftliklar, pastda qoʻlingiz va «Olaman», «Bito», «Pas» tugmalari.
- **Oʻyin zali** — guruhdagi barcha stollar: kim qaysi stolda, boʻsh oʻrinlar, kuzatish.
- **Server** — kartalar serverda saqlanadi, hech kim boshqaning kartasini koʻrmaydi.
- **Botlar** — odam yetmasa boʻsh oʻringa bot qoʻyiladi; chiqib ketgan oʻyinchi oʻrniga bot oʻynaydi.
- **Ovozli chat** va **UZ/RU** tillari — Bura'dagidek.
- **Oʻyinchilar samaradorligi (reyting)** — har bir yurish tahlil qilinadi: samaradorlik = toʻgʻri yurishlar (50%) + durak boʻlmaslik (25%) + chiqish oʻrni (25%). Reytingga kirish uchun kamida 3 ta oʻyin. Botlar hisoblanmaydi.
- **3D koʻrinish** — hajmli stol, qiya movut, yelpigʻich qoʻl. Menyuda 2D/3D tanlovi (har bir telefonda alohida saqlanadi).
- **Narsalar** — oʻz avataringizni bosib, oldingizga viski, sigara, tort yoki pivo qoʻyasiz; stoldagilarning hammasi koʻradi.
- **Oflayn oʻyinchi** — 30 soniyadan ortiq oflayn qolsa, oʻrni boʻshaydi; qaytsa — mehmon boʻladi.

### Statistikani saqlash (Yandex Disk)

Reyting `DATA_DIR` papkasidagi `stats.json` faylida (yoʻq boʻlsa `./data`) saqlanadi. Render'da server qayta ishga tushganda fayl yoʻqolmasligi uchun Yandex Disk ulanadi: Render → Environment → `YANDEX_DISK_TOKEN` (OAuth token, «cloud_api:disk.app_folder» ruxsati). Fayl nomi — `durak-stats.json`, Bura statistikasi bilan aralashmaydi; bitta tokenni ikkala botda ishlatish mumkin.

## 1-qadam. Bot yaratish

1. Telegramʼda **@BotFather** ni oching va `/newbot` yuboring.
2. Bot nomini va username kiriting (masalan, `DurakOyinBot`).
3. BotFather bergan **token**ni saqlab qoʻying (koʻrinishi: `1234567890:AAH...`). Uni hech kimga bermang.

## 2-qadam. Serverga joylash

Mini App faqat **HTTPS** manzilda ishlaydi. Eng oson yoʻl — [Render.com](https://render.com) (bepul tarif bor).

1. Kodni GitHubʼdagi repozitoriyga joylang (`node_modules` papkasi kerak emas).
2. Render → **New → Blueprint** → repozitoriyni tanlang. Render `render.yaml` faylini oʻqiydi va faqat `BOT_TOKEN` ni soʻraydi — BotFather bergan tokenni kiriting.
3. Deploy tugagach, Render bergan manzilni oching va oxiriga `/health` qoʻshing (masalan `https://durak-abcd.onrender.com/health`) — `ok` chiqishi kerak.

`PUBLIC_URL` Renderʼda shart emas: server oʻz manzilini `RENDER_EXTERNAL_URL` orqali oʻzi aniqlaydi.

Bepul tarifda server 15 daqiqa ishlatilmasa «uxlaydi» va keyingi soʻrovda taxminan bir daqiqada uygʻonadi. Doim yoqiq turishi uchun Starter tarifiga (oyiga 7 $) oʻtkazish mumkin.

**Oʻz serveringiz (VPS) boʻlsa:**

```bash
cp .env.example .env        # ichini toʻldiring
docker build -t durak .
docker run -d --restart=always -p 3000:3000 --env-file .env durak
```

HTTPS uchun oldiga Caddy yoki Nginx qoʻying (domen kerak).

**Faqat kompyuterda sinash uchun:** `npm install`, keyin `npx cloudflared tunnel --url http://localhost:3000` bergan `https://…trycloudflare.com` manzilini `PUBLIC_URL` ga yozib, `npm start`.

## 3-qadam. Mini App ni botga ulash

1. @BotFather → `/newapp` → botingizni tanlang.
2. Sarlavha: `Durak`. Tavsif: `Guruhda 2–6 kishilik Durak karta oʻyini`.
3. Rasm (640×360) soʻralganda `assets/durak-cover-640x360.png` faylini yuboring.
4. GIF soʻralsa: `/empty`.
5. Web App URL: `PUBLIC_URL` dagi manzil.
6. Short name: `durak` — bu `APP_SHORT_NAME` bilan bir xil boʻlishi kerak.

## 4-qadam. Oʻynash

1. Botni guruhga qoʻshing.
2. Guruhda `/durak` yozing — bot guruhga **oʻyin zali** xabarini yuboradi.
3. «🎮 Oʻyin zaliga kirish» tugmasini bosing:
   - boʻsh oʻrinni (+) bossangiz, oʻtirasiz; oʻrinlar toʻlsa, hamma «Tayyorman» bosadi va oʻyin boshlanadi;
   - «Yangi stol ochish» — oʻyinchilar soni (2–6) va «Doʻstlar bilan» yoki «Botlar bilan»;
   - oʻyin ketayotgan stolni kuzatish mumkin; oʻyin tugagach bot oʻrniga oʻtirasiz.
4. Oʻyinda: kartani bosing va «Yurish» / «Tashlash». Himoyada urmoqchi boʻlgan kartani bosing — urilmagan karta bitta boʻlsa, darhol uriladi; bir nechta boʻlsa, stoldagi kerakli kartani bosing. Ura olmasangiz — «Olaman».

## Demo (internetsiz, botlar bilan)

```bash
npm run build:demo   # dist/durak-demo.html
```

Faylni brauzerda oching — 3 ta botga qarshi oʻynaysiz.

## Sinash

```bash
npm install
npm test                       # 62 ta test
DEV_MODE=1 npm start           # http://localhost:3000/?dev=1&uid=1&name=Ali
```
