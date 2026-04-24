# Frame It

一个浏览器里运行的照片加边框工具。读 EXIF、加白边、写参数、盖品牌 logo。完全本地处理，照片不会上传任何服务器。

## 功能

- 拖拽多张照片，批量处理
- 自动读取 EXIF
- 四个角每个角三种显示模式：
  - **Auto**：按角位置显示默认信息（左上快门/光圈/ISO，右下机身/镜头等）
  - **Field**：从字段下拉里选一个单独的 EXIF 字段
  - **Template**：模板字符串，支持 `{Shutter}   {Aperture}   {ISO}` 这种占位符
- **品牌 logo**：盖在右下机身名前面，像印章
  - 自动匹配 EXIF Make 字段
  - 也能手动选一个品牌（给胶片扫描用）
  - 可选"用文字色着色"（黑白 SVG 最佳）
  - 支持界面上直接上传补充
- 实时预览，所见即所得
- 自定义画幅比、边框厚度、背景色、文字色、文字大小、字体
- 批量打包成 zip 下载
- 完全本地：所有处理在浏览器里完成，不联网

## ⚠️ 一定要用 HTTP 访问，不要双击本地文件

由于浏览器安全策略（CORS），`file://` 协议下：
- JSON 清单读取失败 → **默认 logo 库加载不了**
- Canvas 带图片会被标记为 tainted → **导出会失败**

**两种正确打开方式：**

### A. 部署到 GitHub Pages（推荐，给别人用）

见下文。

### B. 本地开一个 mini 服务器（自己用）

在项目目录里开终端：

```bash
python3 -m http.server 8000
```

浏览器访问 `http://localhost:8000/`。

## 部署到 GitHub Pages

1. 在 GitHub 建一个新 repo，比如叫 `frameit`
2. 把这个目录里所有文件 push 上去：
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/你的用户名/frameit.git
   git push -u origin main
   ```
3. 在 repo 的 **Settings → Pages**：
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)`
   - Save
4. 等 1-2 分钟，访问 `https://你的用户名.github.io/frameit/`

## 目录结构

```
frameit-web/
├── index.html
├── app.js
├── style.css
├── README.md
├── vendor/
│   ├── exifr.umd.js
│   └── jszip.min.js
└── logos/
    ├── logos.json        ← logo 清单
    ├── README.md
    ├── contax.svg        ← 占位 logo（首字母徽章）
    ├── fujifilm.svg
    └── ... (13 个预置品牌)
```

## Logo 库

预置了 13 个品牌的**占位 logo**（圆圈里的首字母）——Contax / Fujifilm / Nikon / Canon / Sony / Leica / Rollei / Hasselblad / Olympus / Pentax / Ricoh / Panasonic / Mamiya。

**要让它们变成真实 logo**，按 `logos/README.md` 的说明替换。简单说就是：

1. 把真实 logo 文件（SVG 或 PNG）放到 `logos/` 里
2. 编辑 `logos/logos.json`，把 `"file"` 指向你的文件

## 模板语法

在角的"Template"模式下，用 `{字段名}` 做占位符。可用字段：

| 占位符              | 示例值               |
|---------------------|----------------------|
| `{Shutter}`         | `1/250 sec`          |
| `{Aperture}`        | `f/2.8`              |
| `{ISO}`             | `ISO400`             |
| `{FocalLength}`     | `23mm`               |
| `{Camera}`          | `FUJIFILM X-E5`      |
| `{Make}`            | `FUJIFILM`           |
| `{Model}`           | `X-E5`               |
| `{Lens}`            | `XF23mmF2.8 R WR`    |
| `{ExposureProgram}` | `Manual`             |
| `{Date}`            | `2024-11-23`         |
| `{WhiteBalance}`    | `Auto`               |
| `{MeteringMode}`    | `Multi-segment`      |
| `{Flash}`           | `No Flash`           |

用 `\n` 换行。比如 `{Camera}\n{Lens}` 会显示成两行。

## 手机也能用

- 拖张照片进来就能用，手势操作全部支持
- **双指捏合**缩放预览，**双击**放大/复位
- 点右上角的齿轮图标打开设置面板
- 默认自动降采样到 16MP（iOS Safari 的 canvas 内存限制）——在 Export 区能调整或关闭
- 建议连 Wi-Fi 用，字体文件首次加载需联网

## 快捷键（桌面）

- `Cmd/Ctrl + S` — 下载当前预览的图
- `Ctrl + 滚轮` — 缩放预览
- `双击` — 放大 / 复位
- `↑ / ↓ / ← / →` — 切换文件队列里的上一张/下一张

## 工作流示例

**胶片扫描**（无 EXIF）：

1. 拖一卷扫描件进来
2. 右下角 Mode 选 **Template**，填 `Contax G1\nBiogon 28/2.8`
3. 左上角 Mode 选 **Template**，填 `Portra 400`
4. 勾上 **Show brand logo**，Brand 下拉里手动选 `Contax`
5. 点 **Download all (zip)**

**数码 JPG**（带 EXIF）：

1. 拖照片进来
2. 四个角想显示什么就勾上（默认 Auto 模式）
3. 勾上 **Show brand logo** → 自动匹配
4. 导出

## 技术

- 纯前端，无后端
- EXIF: [exifr](https://github.com/MikeKovarik/exifr) 7.1.3
- ZIP: [JSZip](https://stuk.github.io/jszip/) 3.10.1
- 图片处理: 原生 Canvas API
- 字体: EB Garamond / IBM Plex Sans / IBM Plex Mono（Google Fonts）+ 系统字体 + 可上传

## License

MIT
