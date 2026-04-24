# Logo Library

这些是占位 logo（圆圈里的首字母），用来**验证功能可用**。你需要的话可以替换成真实的品牌 logo。

## 目录结构

```
logos/
├── logos.json    ← 清单（改这个告诉程序有哪些 logo）
├── contax.svg
├── fujifilm.svg
└── ...
```

## 替换成真实 logo

1. 把真实 logo 文件（SVG 或 PNG）放进这个目录
2. 文件名可以沿用（`contax.svg`）也可以改名
3. 编辑 `logos.json`，把对应的 `"file"` 改成你的文件名

## 添加新品牌

编辑 `logos.json`，加一条：

```json
{
  "name": "Sigma",
  "matches": ["sigma"],
  "file": "sigma.svg"
}
```

- `name`：显示在 UI 下拉里的品牌名
- `matches`：EXIF Make 字段里要匹配的关键词（小写，支持多个。比如 Lumix 相机的 Make 是 "Panasonic"，所以写 `["panasonic", "lumix"]`）
- `file`：图片文件名（放在 `logos/` 里）

把 logo 文件也放进 `logos/`，刷新页面即可。

## SVG 的建议

- 最好用**纯黑色**的 SVG。程序可以用 "Tint with text color" 功能把它染成文字色。
- 不要用 `fill="currentColor"` —— canvas 不认识 CSS 变量，用确定的颜色（`fill="black"` 或 `fill="#000"`）。
- `viewBox` 要写好，比如 `viewBox="0 0 100 100"`，否则缩放会有问题。

## PNG 的建议

- 透明背景
- 分辨率至少 200×200（太小在大图上会糊）
- 单色 logo 同样可以配合 Tint 功能

## 版权注意

品牌 logo 通常是注册商标，仅限你自己的作品使用。不要重新分发包含品牌 logo 的模板。

## 在界面上临时上传

如果不想每次都改 `logos.json`，也可以在界面的 Logo 区块里直接上传 —— 输入品牌名、选文件，就能立刻用。但这是**一次性**的（刷新页面就没了）。
