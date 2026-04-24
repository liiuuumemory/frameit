/* =====================================================
   Frame It — application logic (v2)
   - 三模式四角：Auto / Field / Template
   - 品牌 Logo（自动/手动匹配，支持上传覆盖）
   - 完全本地：照片不上传任何服务器
===================================================== */

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const IS_FILE_PROTOCOL = location.protocol === 'file:';
  const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
                    || (window.matchMedia && window.matchMedia('(max-width: 900px)').matches);

  // ---------- DOM ----------
  const dropzone = $('dropzone');
  const fileInput = $('fileInput');
  const filelist = $('filelist');
  const metaCount = $('metaCount');

  const ratioW = $('ratioW'), ratioH = $('ratioH');
  const borderW = $('borderW'), borderH = $('borderH');
  const borderWVal = $('borderWVal'), borderHVal = $('borderHVal');
  const presets = document.querySelectorAll('.preset');

  const cornerContainer = $('cornerContainer');

  const logoShow = $('logoShow');
  const logoBrand = $('logoBrand');
  const logoSize = $('logoSize'), logoSizeVal = $('logoSizeVal');
  const logoTint = $('logoTint');
  const logoUploadName = $('logoUploadName');
  const logoUploadBtn = $('logoUploadBtn');
  const logoUploadFile = $('logoUploadFile');
  const logoStatus = $('logoStatus');

  const bgColor = $('bgColor'), fgColor = $('fgColor');
  const bgColorVal = $('bgColorVal'), fgColorVal = $('fgColorVal');
  const textSize = $('textSize'), textSizeVal = $('textSizeVal');
  const fontSelect = $('fontSelect');
  const fontFile = $('fontFile');
  const fontStatus = $('fontStatus');

  const quality = $('quality'), qualityVal = $('qualityVal');
  const maxSize = $('maxSize'), maxSizeHint = $('maxSizeHint');
  const downloadOne = $('downloadOne');
  const downloadAll = $('downloadAll');
  const progress = $('progress');
  const progressFill = $('progressFill');
  const progressText = $('progressText');
  const progressCurrent = $('progressCurrent');

  const panel = $('panel');
  const panelToggle = $('panelToggle');
  const layout = $('layout');

  const canvas = $('previewCanvas');
  const ctx = canvas.getContext('2d');
  const canvasEmpty = $('canvasEmpty');
  const exifTray = $('exifTray');

  // ---------- 状态 ----------
  const items = [];
  let activeIdx = -1;
  let customFontFamily = null;
  const PREVIEW_MAX_DIM = 1200;

  // 四角状态：key -> { show, mode, field, template }
  const cornerDefaults = {
    tl: { show: false, mode: 'auto', field: 'Shutter', template: '{Shutter}   {Aperture}   {ISO}' },
    tr: { show: false, mode: 'auto', field: 'ExposureProgram', template: '{Date}' },
    bl: { show: false, mode: 'auto', field: 'FocalLength', template: '{FocalLength}' },
    br: { show: true,  mode: 'auto', field: 'Camera', template: '{Camera}\n{Lens}' },
  };
  const cornerStates = JSON.parse(JSON.stringify(cornerDefaults));

  // ---------- 工具 ----------
  const debounce = (fn, ms = 80) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  const uid = () => Math.random().toString(36).slice(2, 9);

  const isImage = (f) => /^image\//.test(f.type) || /\.(jpe?g|png|tiff?|webp)$/i.test(f.name);

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  // ---------- EXIF 格式化 ----------
  function fmtShutter(t) {
    if (t == null) return '';
    if (t >= 1) return `${t} sec`;
    return `1/${Math.round(1 / t)} sec`;
  }
  function fmtAperture(f) { return f == null ? '' : `f/${f}`; }
  function fmtIso(i) { return i == null ? '' : `ISO${i}`; }
  function fmtFocal(f) { return f == null ? '' : `${Math.round(f)}mm`; }
  function fmtCamera(make, model) {
    if (!model) return '';
    if (make && !model.toLowerCase().includes(make.toLowerCase())) {
      return `${make} ${model}`;
    }
    return model;
  }
  function fmtDate(d) {
    if (!d) return '';
    if (d instanceof Date) {
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }
    return String(d);
  }

  // ---------- 字段字典 ----------
  const FIELD_DICT = {
    Shutter:         { label: 'Shutter (1/250 sec)',   get: e => fmtShutter(e.ExposureTime) },
    Aperture:        { label: 'Aperture (f/2.8)',      get: e => fmtAperture(e.FNumber) },
    ISO:             { label: 'ISO (ISO400)',          get: e => fmtIso(e.ISO) },
    FocalLength:     { label: 'Focal Length (23mm)',   get: e => fmtFocal(e.FocalLength) },
    Camera:          { label: 'Camera (Make + Model)', get: e => fmtCamera(e.Make, e.Model) },
    Make:            { label: 'Make',                  get: e => e.Make || '' },
    Model:           { label: 'Model',                  get: e => e.Model || '' },
    Lens:            { label: 'Lens',                   get: e => e.LensModel || '' },
    ExposureProgram: { label: 'Exposure Program',       get: e => e.ExposureProgram ? String(e.ExposureProgram) : '' },
    Date:            { label: 'Date',                   get: e => fmtDate(e.DateTimeOriginal) },
    WhiteBalance:    { label: 'White Balance',          get: e => e.WhiteBalance ? String(e.WhiteBalance) : '' },
    MeteringMode:    { label: 'Metering Mode',          get: e => e.MeteringMode ? String(e.MeteringMode) : '' },
    Flash:           { label: 'Flash',                  get: e => e.Flash ? String(e.Flash) : '' },
  };

  // 默认四角 EXIF 文本（auto 模式）
  function defaultCornerText(corner, exif) {
    if (!exif) return '';
    if (corner === 'tl') {
      const parts = [fmtShutter(exif.ExposureTime), fmtAperture(exif.FNumber), fmtIso(exif.ISO)].filter(Boolean);
      return parts.join('   ');
    }
    if (corner === 'tr') return exif.ExposureProgram ? String(exif.ExposureProgram) : '';
    if (corner === 'bl') return fmtFocal(exif.FocalLength);
    if (corner === 'br') {
      const lines = [fmtCamera(exif.Make, exif.Model), exif.LensModel || ''].filter(Boolean);
      return lines.join('\n');
    }
    return '';
  }

  function renderTemplate(tpl, exif) {
    if (!tpl) return '';
    const out = tpl.replace(/\{(\w+)\}/g, (_, key) => {
      const f = FIELD_DICT[key];
      return f ? (f.get(exif) || '') : '';
    });
    return out.replace(/\\n/g, '\n');
  }

  function getCornerText(corner, state, exif) {
    if (!state.show) return '';
    if (state.mode === 'auto') return defaultCornerText(corner, exif);
    if (state.mode === 'field') {
      const f = FIELD_DICT[state.field];
      return f ? f.get(exif) : '';
    }
    if (state.mode === 'template') return renderTemplate(state.template, exif);
    return '';
  }

  // ---------- Logo 系统 ----------
  /** logoLibrary: Map<string(lowercase brand key), {name, matches: string[], img: HTMLImageElement}> */
  const logoLibrary = new Map();
  let logoLoadPromise = null;

  async function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  async function loadLogoLibrary() {
    if (IS_FILE_PROTOCOL) {
      logoStatus.textContent = 'file:// mode — upload logos manually';
      return;
    }
    try {
      const resp = await fetch('logos/logos.json', { cache: 'no-store' });
      if (!resp.ok) throw new Error('no logos.json');
      const list = await resp.json();
      for (const entry of list) {
        try {
          const img = await loadImage(`logos/${entry.file}`);
          const key = (entry.name || '').toLowerCase();
          logoLibrary.set(key, {
            name: entry.name,
            matches: (entry.matches || [entry.name]).map(s => s.toLowerCase()),
            img,
          });
        } catch (e) {
          console.warn('[Frame It] logo load failed:', entry.file, e);
        }
      }
      rebuildBrandSelect();
      console.log(`[Frame It] Loaded ${logoLibrary.size} logos`);
    } catch (e) {
      console.warn('[Frame It] logos/logos.json not found or invalid:', e.message);
    }
  }

  function rebuildBrandSelect() {
    const prevVal = logoBrand.value;
    // 清除自动/None 之外的所有 option
    [...logoBrand.options].forEach(o => {
      if (o.value !== '__auto__' && o.value !== '__none__') o.remove();
    });
    const sorted = [...logoLibrary.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of sorted) {
      const opt = document.createElement('option');
      opt.value = entry.name.toLowerCase();
      opt.textContent = entry.name;
      logoBrand.appendChild(opt);
    }
    // 恢复选中
    if ([...logoBrand.options].some(o => o.value === prevVal)) {
      logoBrand.value = prevVal;
    }
  }

  function pickLogoForExif(exif) {
    // 手动选项覆盖
    const v = logoBrand.value;
    if (v === '__none__') return null;
    if (v !== '__auto__') return logoLibrary.get(v) || null;

    // Auto：扫描 Make + Model
    const hay = [(exif && exif.Make) || '', (exif && exif.Model) || ''].join(' ').toLowerCase();
    if (!hay.trim()) return null;
    // 匹配最长的 match（避免 "Sony" 撞 "Sonic" 之类）
    let best = null;
    for (const entry of logoLibrary.values()) {
      for (const m of entry.matches) {
        if (!m) continue;
        if (hay.includes(m)) {
          if (!best || m.length > best.matchLen) best = { entry, matchLen: m.length };
        }
      }
    }
    return best ? best.entry : null;
  }

  async function uploadLogo(file, name) {
    if (!file || !name) return;
    try {
      // 读成 dataURL（同源，不污染 canvas）
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const img = await loadImage(dataUrl);
      const key = name.toLowerCase();
      logoLibrary.set(key, {
        name: name,
        matches: [key],
        img,
      });
      rebuildBrandSelect();
      logoBrand.value = key;
      logoShow.checked = true;
      logoStatus.textContent = `Loaded: ${name}`;
      render();
    } catch (e) {
      logoStatus.textContent = `Failed: ${e.message || e}`;
    }
  }

  // ---------- 文件加载 ----------
  async function addFiles(fileList) {
    const files = Array.from(fileList).filter(isImage);
    if (!files.length) return;
    for (const file of files) {
      const id = uid();
      const item = { id, file, name: file.name, fullBitmap: null, previewBitmap: null, exif: null };
      items.push(item);
      addToFileList(item);
      decodeItem(item).then(() => {
        if (activeIdx < 0) selectItem(items.indexOf(item));
        updateMeta();
      }).catch(err => console.error('decode error', file.name, err));
    }
    updateMeta();
  }

  async function decodeItem(item) {
    if (typeof exifr === 'undefined') {
      console.error('[Frame It] exifr library not loaded — check vendor/exifr.umd.js');
      item.exif = {};
    } else {
      try {
        item.exif = await exifr.parse(item.file, {
          pick: ['ExposureTime','FNumber','ISO','ISOSpeedRatings','ExposureProgram',
                 'FocalLength','Make','Model','LensModel','DateTimeOriginal',
                 'WhiteBalance','MeteringMode','Flash'],
        }) || {};
        if (!item.exif.ISO && item.exif.ISOSpeedRatings) {
          item.exif.ISO = item.exif.ISOSpeedRatings;
        }
        console.log(`[Frame It] EXIF for ${item.name}:`, item.exif);
      } catch (e) {
        console.warn(`[Frame It] EXIF parse failed for ${item.name}:`, e);
        item.exif = {};
      }
    }
    item.fullBitmap = await createImageBitmap(item.file, { imageOrientation: 'from-image' });
    const { width: fw, height: fh } = item.fullBitmap;
    const scale = Math.min(1, PREVIEW_MAX_DIM / Math.max(fw, fh));
    if (scale < 1) {
      item.previewBitmap = await createImageBitmap(item.fullBitmap, {
        resizeWidth: Math.round(fw * scale),
        resizeHeight: Math.round(fh * scale),
        resizeQuality: 'high',
      });
    } else {
      item.previewBitmap = item.fullBitmap;
    }
    updateFileListThumb(item);
  }

  function addToFileList(item) {
    const li = document.createElement('li');
    li.dataset.id = item.id;
    li.innerHTML = `
      <span class="file-thumb"></span>
      <span class="file-name">${escapeHtml(item.name)}</span>
      <button type="button" class="file-remove" title="Remove">×</button>
    `;
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('file-remove')) return;
      const idx = items.findIndex(x => x.id === item.id);
      if (idx >= 0) selectItem(idx);
    });
    li.querySelector('.file-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeItem(item.id);
    });
    filelist.appendChild(li);
  }

  function updateFileListThumb(item) {
    const li = filelist.querySelector(`li[data-id="${item.id}"]`);
    if (!li || !item.previewBitmap) return;
    const slot = li.querySelector('.file-thumb');
    const t = document.createElement('canvas');
    t.width = 48; t.height = 48;
    const tctx = t.getContext('2d');
    const bm = item.previewBitmap;
    const r = Math.max(48 / bm.width, 48 / bm.height);
    const sw = bm.width * r, sh = bm.height * r;
    tctx.drawImage(bm, (48 - sw) / 2, (48 - sh) / 2, sw, sh);
    slot.outerHTML = `<img class="file-thumb" src="${t.toDataURL('image/jpeg', 0.6)}" alt="">`;
  }

  function removeItem(id) {
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;
    items.splice(idx, 1);
    const li = filelist.querySelector(`li[data-id="${id}"]`);
    if (li) li.remove();
    if (activeIdx >= items.length) activeIdx = items.length - 1;
    if (activeIdx < 0) clearCanvas();
    else selectItem(activeIdx);
    updateMeta();
  }

  function selectItem(idx) {
    activeIdx = idx;
    [...filelist.children].forEach((li, i) => li.classList.toggle('active', i === idx));
    if (window._resetZoom) window._resetZoom();
    render();
    updateExifTray();
  }

  function updateMeta() {
    metaCount.textContent = items.length === 0 ? 'no files' : `${items.length} file${items.length > 1 ? 's' : ''}`;
    downloadOne.disabled = activeIdx < 0;
    downloadAll.disabled = items.length === 0;
  }

  function clearCanvas() {
    canvas.width = 0; canvas.height = 0;
    canvas.style.display = 'none';
    canvasEmpty.style.display = '';
    exifTray.hidden = true;
  }

  function updateExifTray() {
    const item = items[activeIdx];
    if (!item || !item.exif) { exifTray.hidden = true; return; }
    const e = item.exif;
    const set = (id, val) => $(id).textContent = val || '';
    set('exifShutter', fmtShutter(e.ExposureTime));
    set('exifAperture', fmtAperture(e.FNumber));
    set('exifIso', fmtIso(e.ISO));
    set('exifFocal', fmtFocal(e.FocalLength));
    set('exifCamera', fmtCamera(e.Make, e.Model));
    set('exifLens', e.LensModel || '');
    const hasAny = ['exifShutter','exifAperture','exifIso','exifFocal','exifCamera','exifLens']
      .some(id => $(id).textContent);
    exifTray.hidden = !hasAny;
  }

  // ---------- Corner UI 构建 ----------
  const CORNER_LABELS = {
    tl: 'Top-Left',
    tr: 'Top-Right',
    bl: 'Bottom-Left',
    br: 'Bottom-Right',
  };

  function buildCornerUI() {
    cornerContainer.innerHTML = '';
    for (const key of ['tl', 'tr', 'bl', 'br']) {
      const st = cornerStates[key];
      const row = document.createElement('div');
      row.className = `corner-row mode-${st.mode}`;
      row.dataset.key = key;
      row.innerHTML = `
        <div class="corner-head">
          <label class="cb">
            <input type="checkbox" data-role="show" ${st.show ? 'checked' : ''}>
            <span>${CORNER_LABELS[key]}</span>
          </label>
          <select class="mode-select" data-role="mode">
            <option value="auto"     ${st.mode === 'auto' ? 'selected' : ''}>Auto</option>
            <option value="field"    ${st.mode === 'field' ? 'selected' : ''}>Field</option>
            <option value="template" ${st.mode === 'template' ? 'selected' : ''}>Template</option>
          </select>
        </div>
        <div class="extras extras-field">
          <select class="field-select" data-role="field">
            ${Object.entries(FIELD_DICT).map(([k, v]) =>
              `<option value="${k}" ${st.field === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="extras extras-template">
          <input type="text" class="text-input" data-role="template"
                 value="${escapeHtml(st.template)}"
                 placeholder="{Shutter}   {Aperture}   {ISO}">
        </div>
      `;
      cornerContainer.appendChild(row);
    }
    // 绑定事件
    cornerContainer.querySelectorAll('.corner-row').forEach(row => {
      const key = row.dataset.key;
      row.querySelector('[data-role=show]').addEventListener('change', e => {
        cornerStates[key].show = e.target.checked;
        renderDebounced();
      });
      row.querySelector('[data-role=mode]').addEventListener('change', e => {
        cornerStates[key].mode = e.target.value;
        row.className = `corner-row mode-${e.target.value}`;
        renderDebounced();
      });
      row.querySelector('[data-role=field]').addEventListener('change', e => {
        cornerStates[key].field = e.target.value;
        renderDebounced();
      });
      row.querySelector('[data-role=template]').addEventListener('input', e => {
        cornerStates[key].template = e.target.value;
        renderDebounced();
      });
    });
  }

  // ---------- 核心：绘制 ----------
  function renderToCanvas(targetCanvas, bitmap, exif, opts) {
    const {
      ratioW, ratioH, borderW, borderH,
      bgHex, fgHex, textSizeRatio, fontFamily,
      cornerStates, logoOpts,
    } = opts;

    const sw = bitmap.width, sh = bitmap.height;
    const finalRatio = ratioW / ratioH;
    let resultW, resultH, textPx;

    if ((sw / finalRatio) > sh) {
      resultW = Math.round(sw * (1 + borderW));
      resultH = Math.round(resultW / finalRatio);
      textPx = borderW > 0
        ? (resultW - sw) * (borderH / borderW) / 2 * textSizeRatio
        : (resultH - sh) / 2 * textSizeRatio;
    } else {
      resultH = Math.round(sh * (1 + borderH));
      resultW = Math.round(resultH * finalRatio);
      textPx = (resultH - sh) / 2 * textSizeRatio;
    }
    textPx = Math.max(6, Math.round(textPx));

    targetCanvas.width = resultW;
    targetCanvas.height = resultH;
    const c = targetCanvas.getContext('2d');

    c.fillStyle = bgHex;
    c.fillRect(0, 0, resultW, resultH);

    const offX = Math.round((resultW - sw) / 2);
    const offY = Math.round((resultH - sh) / 2);
    c.drawImage(bitmap, offX, offY);

    c.fillStyle = fgHex;
    c.font = `${textPx}px ${fontFamily}`;
    c.textBaseline = 'middle';

    const padH = (resultH - sh) / 2;
    const padW = (resultW - sw) / 2;

    drawCornerText(c, 'tl', cornerStates.tl, exif, padW, padH / 2, textPx);
    drawCornerText(c, 'tr', cornerStates.tr, exif, resultW - padW, padH / 2, textPx);
    drawCornerText(c, 'bl', cornerStates.bl, exif, padW, resultH - padH / 2, textPx);
    // 右下：文字 + 可选 logo
    drawBottomRight(c, cornerStates.br, exif, resultW - padW, resultH - padH / 2,
                    textPx, fgHex, fontFamily, logoOpts);
  }

  function drawCornerText(c, corner, state, exif, x, y, textPx) {
    const txt = getCornerText(corner, state, exif);
    if (!txt) return;
    const isRight = corner === 'tr';
    c.textAlign = isRight ? 'right' : 'left';
    const lines = txt.split('\n');
    const lineH = textPx * 1.15;
    const startY = y - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => c.fillText(line, x, startY + i * lineH));
  }

  function drawBottomRight(c, state, exif, x, y, textPx, fgHex, fontFamily, logoOpts) {
    const txt = getCornerText('br', state, exif);
    const logoEntry = (logoOpts && logoOpts.show) ? pickLogoForExif(exif) : null;

    if (!txt && !logoEntry) return;

    const lines = txt ? txt.split('\n') : [];
    const lineH = textPx * 1.15;
    const blockH = lines.length * lineH;

    // 测量文字宽
    c.textAlign = 'left';  // 测量
    let maxTextW = 0;
    for (const line of lines) {
      maxTextW = Math.max(maxTextW, c.measureText(line).width);
    }

    // logo 尺寸
    let logoW = 0, logoH = 0, gap = 0;
    if (logoEntry) {
      logoH = textPx * (logoOpts.size || 1.2);
      const nw = logoEntry.img.naturalWidth || logoEntry.img.width || 1;
      const nh = logoEntry.img.naturalHeight || logoEntry.img.height || 1;
      logoW = logoH * (nw / nh);
      gap = maxTextW > 0 ? textPx * 0.45 : 0;
    }

    const totalW = logoW + gap + maxTextW;
    const blockLeft = x - totalW;
    const startY = y - ((lines.length - 1) * lineH) / 2;

    // 绘制 logo
    if (logoEntry) {
      const logoY = y - logoH / 2;
      if (logoOpts.tint) {
        drawTintedLogo(c, logoEntry.img, blockLeft, logoY, logoW, logoH, fgHex);
      } else {
        try {
          c.drawImage(logoEntry.img, blockLeft, logoY, logoW, logoH);
        } catch (e) {
          console.warn('[Frame It] drawImage failed (logo):', e);
        }
      }
    }

    // 绘制文字（右对齐到 x）
    if (lines.length) {
      c.textAlign = 'right';
      lines.forEach((line, i) => {
        c.fillText(line, x, startY + i * lineH);
      });
    }
  }

  function drawTintedLogo(c, img, dx, dy, dw, dh, hex) {
    // 在离屏 canvas 上画 logo，然后用 source-in 填色，再贴到主 canvas
    const off = document.createElement('canvas');
    const scale = Math.max(1, Math.ceil(window.devicePixelRatio || 1));
    off.width = Math.max(1, Math.round(dw));
    off.height = Math.max(1, Math.round(dh));
    const oc = off.getContext('2d');
    try {
      oc.drawImage(img, 0, 0, off.width, off.height);
      oc.globalCompositeOperation = 'source-in';
      oc.fillStyle = hex;
      oc.fillRect(0, 0, off.width, off.height);
      c.drawImage(off, dx, dy, dw, dh);
    } catch (e) {
      console.warn('[Frame It] tinted logo failed:', e);
      // fallback: 原样画
      try { c.drawImage(img, dx, dy, dw, dh); } catch (_) {}
    }
  }

  // ---------- 渲染入口 ----------
  function getOpts() {
    return {
      ratioW: parseInt(ratioW.value) || 1,
      ratioH: parseInt(ratioH.value) || 1,
      borderW: parseFloat(borderW.value) || 0,
      borderH: parseFloat(borderH.value) || 0,
      bgHex: bgColor.value,
      fgHex: fgColor.value,
      textSizeRatio: parseFloat(textSize.value) || 0.18,
      fontFamily: customFontFamily ? `"${customFontFamily}", sans-serif` : fontSelect.value,
      cornerStates,
      logoOpts: {
        show: logoShow.checked,
        size: parseFloat(logoSize.value) || 1.2,
        tint: logoTint.checked,
      },
    };
  }

  function render() {
    const item = items[activeIdx];
    if (!item || !item.previewBitmap) { clearCanvas(); return; }
    canvasEmpty.style.display = 'none';
    canvas.style.display = '';
    renderToCanvas(canvas, item.previewBitmap, item.exif || {}, getOpts());
  }
  const renderDebounced = debounce(render, 50);

  // ---------- 导出 ----------
  // 根据 maxSize 选项，必要时把全分辨率 bitmap 降采样
  async function getExportBitmap(item) {
    const maxMP = parseFloat(maxSize.value) || 0;
    const src = item.fullBitmap;
    if (maxMP <= 0) return { bitmap: src, isDownscaled: false };

    const srcMP = (src.width * src.height) / 1_000_000;
    if (srcMP <= maxMP) return { bitmap: src, isDownscaled: false };

    // 按面积比例缩放
    const scale = Math.sqrt(maxMP / srcMP);
    const newW = Math.round(src.width * scale);
    const newH = Math.round(src.height * scale);
    try {
      const scaled = await createImageBitmap(src, {
        resizeWidth: newW,
        resizeHeight: newH,
        resizeQuality: 'high',
      });
      return { bitmap: scaled, isDownscaled: true };
    } catch (e) {
      console.warn('[Frame It] downscale failed, using original:', e);
      return { bitmap: src, isDownscaled: false };
    }
  }

  async function exportItemBlob(item, opts) {
    const { bitmap } = await getExportBitmap(item);
    return new Promise((resolve, reject) => {
      const off = document.createElement('canvas');
      try {
        renderToCanvas(off, bitmap, item.exif || {}, opts);
      } catch (e) { reject(e); return; }
      try {
        off.toBlob(blob => {
          if (!blob) reject(new Error('toBlob returned null (canvas may be tainted — check logo source)'));
          else resolve(blob);
        }, 'image/jpeg', parseInt(quality.value) / 100);
      } catch (e) {
        reject(e);
      }
    });
  }

  function makeOutName(srcName) {
    const base = srcName.replace(/\.[^.]+$/, '');
    return `${base}_framed.jpg`;
  }

  async function downloadCurrent() {
    const item = items[activeIdx];
    if (!item) return;
    downloadOne.disabled = true;
    try {
      const blob = await exportItemBlob(item, getOpts());
      saveBlob(blob, makeOutName(item.name));
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      downloadOne.disabled = false;
    }
  }

  async function downloadAllZip() {
    if (!items.length) return;
    const opts = getOpts();
    downloadAll.disabled = true;
    // 手机上收起面板让进度可见
    if (IS_MOBILE) closePanel();
    progress.hidden = false;
    progressFill.style.width = '0%';
    progressText.textContent = `0 / ${items.length}`;
    progressCurrent.textContent = '';

    const zip = new JSZip();
    let done = 0;
    for (const item of items) {
      try {
        progressCurrent.textContent = item.name;
        await new Promise(r => setTimeout(r, 10));
        const blob = await exportItemBlob(item, opts);
        zip.file(makeOutName(item.name), blob);
      } catch (e) {
        console.error('export failed:', item.name, e);
      }
      done++;
      progressFill.style.width = (done / items.length * 100) + '%';
      progressText.textContent = `${done} / ${items.length}`;
    }
    progressText.textContent = `${done} / ${items.length} · packing zip…`;
    progressCurrent.textContent = '';
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveBlob(zipBlob, `frameit_${Date.now()}.zip`);
    setTimeout(() => { progress.hidden = true; }, 1200);
    downloadAll.disabled = false;
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- 字体上传 ----------
  async function loadCustomFont(file) {
    try {
      const buffer = await file.arrayBuffer();
      const familyName = `User_${Date.now()}`;
      const ff = new FontFace(familyName, buffer);
      await ff.load();
      document.fonts.add(ff);
      customFontFamily = familyName;
      fontStatus.textContent = `Loaded: ${file.name}`;
      render();
    } catch (e) {
      fontStatus.textContent = `Failed to load font`;
      customFontFamily = null;
    }
  }

  // ---------- 事件绑定 ----------
  ['dragenter','dragover'].forEach(ev =>
    dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev =>
    dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone.addEventListener('drop', e => { if (e.dataTransfer.files) addFiles(e.dataTransfer.files); });
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    if (e.target.closest('.dropzone')) return;
    e.preventDefault();
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  [ratioW, ratioH].forEach(el => el.addEventListener('input', renderDebounced));
  borderW.addEventListener('input', () => {
    borderWVal.textContent = parseFloat(borderW.value).toFixed(2);
    renderDebounced();
  });
  borderH.addEventListener('input', () => {
    borderHVal.textContent = parseFloat(borderH.value).toFixed(2);
    renderDebounced();
  });

  presets.forEach(b => b.addEventListener('click', () => {
    ratioW.value = b.dataset.w;
    ratioH.value = b.dataset.h;
    presets.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    render();
  }));

  // Logo 事件
  logoShow.addEventListener('change', renderDebounced);
  logoBrand.addEventListener('change', renderDebounced);
  logoSize.addEventListener('input', () => {
    logoSizeVal.textContent = parseFloat(logoSize.value).toFixed(2) + '×';
    renderDebounced();
  });
  logoTint.addEventListener('change', renderDebounced);
  logoUploadBtn.addEventListener('click', () => logoUploadFile.click());
  logoUploadFile.addEventListener('change', () => {
    const file = logoUploadFile.files[0];
    const name = logoUploadName.value.trim();
    if (!file) return;
    if (!name) { logoStatus.textContent = 'Enter a brand name first'; return; }
    uploadLogo(file, name);
    logoUploadFile.value = '';
  });

  bgColor.addEventListener('input', () => { bgColorVal.textContent = bgColor.value; renderDebounced(); });
  fgColor.addEventListener('input', () => { fgColorVal.textContent = fgColor.value; renderDebounced(); });
  textSize.addEventListener('input', () => {
    textSizeVal.textContent = parseFloat(textSize.value).toFixed(2);
    renderDebounced();
  });

  fontSelect.addEventListener('change', () => {
    if (fontSelect.value === '__custom__') {
      fontFile.click();
      fontSelect.value = customFontFamily ? '__custom__' : 'serif';
    } else {
      customFontFamily = null;
      fontStatus.textContent = '';
    }
    render();
  });
  fontFile.addEventListener('change', () => {
    if (fontFile.files[0]) loadCustomFont(fontFile.files[0]);
    fontFile.value = '';
  });

  quality.addEventListener('input', () => { qualityVal.textContent = quality.value; });

  // maxSize 提示文案
  function updateMaxSizeHint() {
    const val = parseFloat(maxSize.value);
    if (val <= 0) {
      maxSizeHint.textContent = IS_MOBILE
        ? 'May fail on phones for large images'
        : '';
    } else {
      maxSizeHint.textContent = `Images larger than ${val}MP will be downscaled on export`;
    }
  }
  maxSize.addEventListener('change', updateMaxSizeHint);

  // 手机默认限 16MP
  if (IS_MOBILE) {
    maxSize.value = '16';
  }
  updateMaxSizeHint();

  // Panel 切换（手机）
  function openPanel()  { layout.classList.add('panel-open');    panelToggle.classList.add('active'); }
  function closePanel() { layout.classList.remove('panel-open'); panelToggle.classList.remove('active'); }
  function togglePanel() {
    if (layout.classList.contains('panel-open')) closePanel(); else openPanel();
  }
  panelToggle.addEventListener('click', togglePanel);

  // 点预览区自动关掉面板（手机）
  $('canvasWrap').addEventListener('click', () => {
    if (IS_MOBILE && layout.classList.contains('panel-open')) closePanel();
  });

  // ---------- 预览区手势缩放 / 平移 ----------
  // 在预览 canvas 上应用 CSS transform 做缩放，不改数据
  (function setupZoom() {
    const wrap = $('canvasWrap');
    let scale = 1, tx = 0, ty = 0;
    const MIN_SCALE = 1, MAX_SCALE = 6;

    function apply() {
      canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
    function reset() {
      scale = 1; tx = 0; ty = 0;
      canvas.style.transition = 'transform 0.2s ease';
      apply();
      setTimeout(() => { canvas.style.transition = ''; }, 220);
    }

    // 双击放大/复位
    canvas.addEventListener('dblclick', (e) => {
      if (scale > 1.05) { reset(); return; }
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left - r.width / 2;
      const cy = e.clientY - r.top  - r.height / 2;
      scale = 2.5;
      tx = -cx * (scale - 1);
      ty = -cy * (scale - 1);
      canvas.style.transition = 'transform 0.2s ease';
      apply();
      setTimeout(() => { canvas.style.transition = ''; }, 220);
    });

    // 滚轮缩放（桌面）
    wrap.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;  // 要按 Ctrl/Cmd，避免误触
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      const prevScale = scale;
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * (1 + delta)));
      if (scale === 1) { tx = 0; ty = 0; }
      else {
        const r = canvas.getBoundingClientRect();
        const cx = e.clientX - r.left - r.width / 2;
        const cy = e.clientY - r.top  - r.height / 2;
        tx = cx - (cx - tx) * (scale / prevScale);
        ty = cy - (cy - ty) * (scale / prevScale);
      }
      apply();
    }, { passive: false });

    // 触屏：双指捏合 + 单指拖动（scale > 1 时）
    let pt1 = null, pt2 = null;  // 当前两指位置
    let startDist = 0, startScale = 1;
    let panStart = null;

    wrap.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pt1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        pt2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
        startDist = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);
        startScale = scale;
      } else if (e.touches.length === 1 && scale > 1.05) {
        panStart = { x: e.touches[0].clientX - tx, y: e.touches[0].clientY - ty };
      }
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pt1 && pt2) {
        e.preventDefault();
        const x1 = e.touches[0].clientX, y1 = e.touches[0].clientY;
        const x2 = e.touches[1].clientX, y2 = e.touches[1].clientY;
        const dist = Math.hypot(x2 - x1, y2 - y1);
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, startScale * (dist / startDist)));
        apply();
      } else if (e.touches.length === 1 && panStart && scale > 1.05) {
        e.preventDefault();
        tx = e.touches[0].clientX - panStart.x;
        ty = e.touches[0].clientY - panStart.y;
        apply();
      }
    }, { passive: false });

    wrap.addEventListener('touchend', () => {
      pt1 = pt2 = null;
      panStart = null;
      if (scale <= 1.02) reset();
    });

    // 暴露 reset 给 selectItem 在切换图时调用
    window._resetZoom = reset;
  })();

  // 图片切换钩子
  // 导出按钮绑定
  downloadOne.addEventListener('click', downloadCurrent);
  downloadAll.addEventListener('click', downloadAllZip);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (!downloadOne.disabled) downloadCurrent();
    } else if (!items.length) return;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      e.preventDefault();
      selectItem((activeIdx + 1) % items.length);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      e.preventDefault();
      selectItem((activeIdx - 1 + items.length) % items.length);
    }
  });

  // ---------- 初始化 ----------
  borderWVal.textContent = parseFloat(borderW.value).toFixed(2);
  borderHVal.textContent = parseFloat(borderH.value).toFixed(2);
  textSizeVal.textContent = parseFloat(textSize.value).toFixed(2);
  bgColorVal.textContent = bgColor.value;
  fgColorVal.textContent = fgColor.value;
  qualityVal.textContent = quality.value;
  logoSizeVal.textContent = parseFloat(logoSize.value).toFixed(2) + '×';
  document.querySelector('.preset[data-w="3"][data-h="2"]').classList.add('active');
  buildCornerUI();
  updateMeta();

  // 库加载检查
  if (typeof exifr === 'undefined' || typeof JSZip === 'undefined') {
    const missing = [];
    if (typeof exifr === 'undefined') missing.push('exifr');
    if (typeof JSZip === 'undefined') missing.push('JSZip');
    const msg = `Missing library: ${missing.join(', ')}. Check vendor/ folder next to index.html.`;
    console.error('[Frame It]', msg);
    metaCount.textContent = '⚠ ' + msg;
    metaCount.style.color = 'var(--accent)';
  }

  // 加载 logo 库
  loadLogoLibrary();

  // 移动端底部栏提示切换
  if (IS_MOBILE) {
    $('hintDesktop').hidden = true;
    $('hintMobile').hidden = false;
  }

})();
