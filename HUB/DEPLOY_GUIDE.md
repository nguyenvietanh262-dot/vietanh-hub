# VietAnh Hub — Hướng dẫn Deploy Netlify

## Cấu trúc thư mục cần có

```
your-repo/
├── vietanh-hub.html          ← File HTML chính (đã cập nhật)
├── netlify.toml              ← Config Netlify
└── netlify/
    └── functions/
        └── rss.js            ← RSS proxy function
```

---

## Các bước deploy

### Bước 1: Tạo repo GitHub

```bash
git init
git add .
git commit -m "Initial: VietAnh Hub with RSS"
git remote add origin https://github.com/YOUR_USERNAME/vietanh-hub.git
git push -u origin main
```

### Bước 2: Kết nối với Netlify

1. Vào [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Chọn **GitHub** → chọn repo `vietanh-hub`
3. Build settings:
   - **Build command**: _(để trống)_
   - **Publish directory**: `.` (dấu chấm)
4. Click **Deploy site**

### Bước 3: Kiểm tra Function hoạt động

Sau khi deploy xong, test function tại:
```
https://YOUR-SITE.netlify.app/.netlify/functions/rss?url=https://hbr.org/feed
```

Nếu trả về JSON array → thành công ✦

---

## Thêm nguồn RSS mới

Chỉnh sửa 2 chỗ:

**1. Trong `vietanh-hub.html`** — thêm vào mảng `RSS_SOURCES`:
```js
{
  id: 'ten-nguon',
  name: 'Tên Hiển Thị',
  rssUrl: 'https://example.com/rss.xml',
  topic: 'HR',          // HR | F&B | AI | Care Share
  color: '#E1F5EE',     // màu badge
  txtColor: '#085041',
  tags: ['#Tag1', '#Tag2'],
},
```

**2. Trong `netlify/functions/rss.js`** — thêm domain vào `ALLOWED_DOMAINS`:
```js
const ALLOWED_DOMAINS = [
  'hbr.org',
  'example.com',  // ← thêm vào đây
  ...
];
```

---

## RSS feeds gợi ý theo chủ đề của bạn

| Chủ đề | Nguồn | RSS URL |
|--------|-------|---------|
| HR & Leadership | Harvard Business Review | `https://hbr.org/feed` |
| HR & Leadership | Simon Sinek | `https://simonsinek.com/feed` |
| HR & Leadership | MIT Sloan Review | `https://sloanreview.mit.edu/feed/` |
| F&B & Ops | Restaurant Business Online | `https://restaurantbusinessonline.com/rss.xml` |
| F&B & Ops | Nation's Restaurant News | `https://www.nrn.com/rss.xml` |
| AI & Tech | TechCrunch | `https://techcrunch.com/feed/` |
| AI & Tech | Hacker News | `https://hnrss.org/frontpage` |
| AI & Tech | MIT Tech Review | `https://www.technologyreview.com/feed/` |

---

## Giới hạn Netlify Free

| Tính năng | Free tier |
|-----------|-----------|
| Function invocations | 125,000 / tháng |
| Function runtime | 10 giây / call |
| Bandwidth | 100 GB / tháng |

VietAnh Hub fetch ~5 feeds × ~50 lần/ngày = **~7,500 invocations/tháng** → rất thoải mái trong free tier.

---

*Tạo bởi VietAnh Hub build system — June 2026*
