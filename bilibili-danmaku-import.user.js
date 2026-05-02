// ==UserScript==
// @name         B站视频弹幕迁移填充
// @namespace    https://space.bilibili.com/166852
// @version      1.1.0
// @description  从其他B站视频导入弹幕到当前视频，支持设置和弹幕列表管理
// @author       Nothentai
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/bangumi/play/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ========== Settings (shared state) ==========

  var settings = {
    fontSize: 25,       // global font size override (12-48)
    timeMin: 0,         // display range start (seconds)
    timeMax: Infinity,  // display range end (seconds)
    displayArea: 1.0,   // vertical display area: 0.1, 0.25, 0.5, 0.75, 1.0
    opacity: 1.0        // danmaku opacity: 0.0-1.0
  };

  // ========== Module 1: SidePanel UI ==========

  var PANEL_WIDTH = 320;

  function createSidePanel() {
    GM_addStyle(`
      #danmaku-import-container {
        position: fixed;
        top: 70px;
        right: 0;
        z-index: 99999;
        display: flex;
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
        transition: transform 0.3s ease;
        max-height: calc(100vh - 90px);
      }
      #danmaku-import-container.collapsed {
        transform: translateX(${PANEL_WIDTH}px);
      }
      #danmaku-import-toggle {
        width: 28px;
        height: 100px;
        background: rgba(0, 0, 0, 0.7);
        border: none;
        border-radius: 6px 0 0 6px;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
        align-self: center;
        display: flex;
        align-items: center;
        justify-content: center;
        writing-mode: vertical-lr;
        letter-spacing: 4px;
        padding: 0;
        flex-shrink: 0;
      }
      #danmaku-import-toggle:hover {
        background: rgba(0, 0, 0, 0.85);
      }
      #danmaku-import-panel {
        width: ${PANEL_WIDTH}px;
        background: rgba(20, 20, 30, 0.94);
        backdrop-filter: blur(10px);
        border-left: 1px solid rgba(255, 255, 255, 0.1);
        color: #e0e0e0;
        padding: 14px 14px 10px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 12px;
        max-height: calc(100vh - 90px);
        overflow-y: auto;
      }
      #danmaku-import-panel::-webkit-scrollbar {
        width: 4px;
      }
      #danmaku-import-panel::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.15);
        border-radius: 2px;
      }
      #danmaku-import-panel h3, #danmaku-import-panel h4 {
        margin: 0;
        font-size: 13px;
        color: #ff6699;
        font-weight: 600;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 6px;
      }
      #danmaku-import-panel h4 {
        font-size: 12px;
        color: #aa88ff;
        margin-top: 4px;
      }
      #danmaku-import-url {
        width: 100%;
        padding: 7px 8px;
        border-radius: 5px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        font-size: 12px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s;
      }
      #danmaku-import-url:focus {
        border-color: #ff6699;
      }
      #danmaku-import-url::placeholder {
        color: rgba(255, 255, 255, 0.4);
      }
      #danmaku-import-options {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #999;
      }
      #danmaku-import-options input[type="checkbox"] {
        accent-color: #ff6699;
      }
      .dmi-btn {
        width: 100%;
        padding: 8px 0;
        border: none;
        border-radius: 5px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }
      #danmaku-import-btn {
        background: #ff6699;
        color: #fff;
      }
      #danmaku-import-btn:hover {
        background: #ff4477;
      }
      #danmaku-import-btn:disabled {
        background: #666;
        cursor: not-allowed;
      }
      #danmaku-import-clear-btn {
        background: transparent;
        color: #ccc;
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 11px;
        font-weight: 400;
        padding: 6px 0;
      }
      #danmaku-import-clear-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #ff4d4f;
        border-color: #ff4d4f;
      }
      #danmaku-import-status {
        font-size: 11px;
        min-height: 16px;
        line-height: 1.4;
        word-break: break-all;
      }
      #danmaku-import-status.success { color: #52c41a; }
      #danmaku-import-status.error { color: #ff4d4f; }
      #danmaku-import-status.loading { color: #faad14; }

      /* Settings section */
      .dmi-setting-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: #bbb;
      }
      .dmi-setting-row label {
        flex-shrink: 0;
        min-width: 50px;
      }
      .dmi-setting-row input[type="range"] {
        flex: 1;
        accent-color: #ff6699;
        height: 4px;
      }
      .dmi-setting-row .dmi-val {
        min-width: 24px;
        text-align: right;
        color: #ff6699;
        font-weight: 600;
      }
      .dmi-time-input {
        width: 55px;
        padding: 4px 5px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        font-size: 11px;
        text-align: center;
        outline: none;
        box-sizing: border-box;
      }
      .dmi-time-input:focus {
        border-color: #aa88ff;
      }
      #dmi-apply-settings-btn {
        width: 100%;
        padding: 5px 0;
        border: 1px solid rgba(170, 136, 255, 0.4);
        border-radius: 4px;
        background: transparent;
        color: #aa88ff;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
      }
      #dmi-apply-settings-btn:hover {
        background: rgba(170, 136, 255, 0.15);
      }
      #dmi-display-area {
        flex: 1;
        padding: 4px 5px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        font-size: 11px;
        outline: none;
        cursor: pointer;
      }
      #dmi-display-area option {
        background: #1a1a2e;
        color: #fff;
      }
      #dmi-display-area:focus {
        border-color: #aa88ff;
      }

      /* Author info */
      #dmi-author {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        margin-bottom: 2px;
      }
      #dmi-author-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 102, 153, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      }
      #dmi-author-info {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      #dmi-author-name {
        font-size: 13px;
        color: #ff6699;
        font-weight: 600;
      }
      #dmi-author-link {
        font-size: 10px;
        color: #88aaff;
        text-decoration: none;
      }
      #dmi-author-link:hover {
        text-decoration: underline;
        color: #aaccff;
      }

      /* Danmaku list */
      #dmi-list-container {
        max-height: 250px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 5px;
        background: rgba(0, 0, 0, 0.2);
      }
      #dmi-list-container::-webkit-scrollbar {
        width: 4px;
      }
      #dmi-list-container::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.12);
        border-radius: 2px;
      }
      .dmi-batch-group {
        margin-bottom: 2px;
      }
      .dmi-batch-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 8px;
        background: rgba(170, 136, 255, 0.1);
        cursor: pointer;
        user-select: none;
        border-radius: 3px;
        transition: background 0.15s;
      }
      .dmi-batch-header:hover {
        background: rgba(170, 136, 255, 0.2);
      }
      .dmi-batch-arrow {
        font-size: 9px;
        color: #aa88ff;
        transition: transform 0.2s;
        flex-shrink: 0;
      }
      .dmi-batch-arrow.collapsed {
        transform: rotate(-90deg);
      }
      .dmi-batch-title {
        flex: 1;
        font-size: 11px;
        color: #ccbbff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dmi-batch-count {
        font-size: 10px;
        color: #888;
        flex-shrink: 0;
      }
      .dmi-batch-delete {
        flex-shrink: 0;
        font-size: 10px;
        color: #888;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 2px;
        transition: all 0.15s;
        border: none;
        background: none;
      }
      .dmi-batch-delete:hover {
        color: #ff4d4f;
        background: rgba(255, 77, 79, 0.15);
      }
      .dmi-batch-body {
        overflow: hidden;
        transition: max-height 0.25s ease;
      }
      .dmi-batch-body.collapsed {
        max-height: 0 !important;
      }
      .dmi-list-empty {
        padding: 20px;
        text-align: center;
        color: #666;
        font-size: 12px;
      }
      .dmi-list-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        cursor: pointer;
        transition: background 0.15s;
      }
      .dmi-list-item:hover {
        background: rgba(255, 255, 255, 0.06);
      }
      .dmi-list-time {
        flex-shrink: 0;
        width: 48px;
        font-size: 10px;
        color: #ff6699;
        font-family: monospace;
        text-align: center;
        background: rgba(255, 102, 153, 0.1);
        border-radius: 3px;
        padding: 2px 0;
      }
      .dmi-list-text {
        flex: 1;
        font-size: 11px;
        color: #ddd;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dmi-list-count {
        font-size: 11px;
        color: #888;
        margin-bottom: 2px;
      }
    `);

    var container = document.createElement('div');
    container.id = 'danmaku-import-container';

    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'danmaku-import-toggle';
    toggleBtn.textContent = '导入弹幕';
    toggleBtn.title = '导入弹幕';

    var panel = document.createElement('div');
    panel.id = 'danmaku-import-panel';
    panel.innerHTML =
      '<div id="dmi-author">' +
        '<div id="dmi-author-avatar">&#x9759;</div>' +
        '<div id="dmi-author-info">' +
          '<span id="dmi-author-name">作者: 静寂</span>' +
          '<a id="dmi-author-link" href="https://space.bilibili.com/166852" target="_blank" title="访问B站主页">B站主页: space.bilibili.com/166852</a>' +
        '</div>' +
      '</div>' +
      '<h3>弹幕导入</h3>' +
      '<input type="text" id="danmaku-import-url" placeholder="粘贴B站视频链接...">' +
      '<div id="danmaku-import-options">' +
        '<input type="checkbox" id="danmaku-import-proportional">' +
        '<label for="danmaku-import-proportional">按视频时长比例缩放</label>' +
      '</div>' +
      '<button class="dmi-btn" id="danmaku-import-btn">导入弹幕</button>' +
      '<button class="dmi-btn" id="danmaku-import-clear-btn">清除导入弹幕</button>' +
      '<div id="danmaku-import-status"></div>' +

      '<h4>显示设置</h4>' +
      '<div class="dmi-setting-row">' +
        '<label>字体大小</label>' +
        '<input type="range" id="dmi-font-size" min="12" max="48" value="' + settings.fontSize + '">' +
        '<span class="dmi-val" id="dmi-font-val">' + settings.fontSize + '</span>' +
      '</div>' +
      '<div class="dmi-setting-row">' +
        '<label>时间范围</label>' +
        '<input type="text" class="dmi-time-input" id="dmi-time-min" placeholder="0" value="0">' +
        '<span style="color:#666;">-</span>' +
        '<input type="text" class="dmi-time-input" id="dmi-time-max" placeholder="结束">' +
        '<span style="color:#888;font-size:10px;">秒</span>' +
      '</div>' +
      '<div class="dmi-setting-row">' +
        '<label>显示区域</label>' +
        '<select id="dmi-display-area">' +
          '<option value="1.0" selected>100%</option>' +
          '<option value="0.75">75%</option>' +
          '<option value="0.5">50%</option>' +
          '<option value="0.25">25%</option>' +
          '<option value="0.1">10%</option>' +
        '</select>' +
      '</div>' +
      '<div class="dmi-setting-row">' +
        '<label>不透明度</label>' +
        '<input type="range" id="dmi-opacity" min="10" max="100" value="100">' +
        '<span class="dmi-val" id="dmi-opacity-val">100%</span>' +
      '</div>' +
      '<button class="dmi-btn" id="dmi-apply-settings-btn">应用设置</button>' +

      '<h4>弹幕列表 <span class="dmi-list-count" id="dmi-list-count"></span></h4>' +
      '<div id="dmi-list-container">' +
        '<div class="dmi-list-empty">暂无导入弹幕</div>' +
      '</div>';

    container.appendChild(toggleBtn);
    container.appendChild(panel);
    document.body.appendChild(container);

    toggleBtn.addEventListener('click', function () {
      container.classList.toggle('collapsed');
    });

    var ui = {
      container: container,
      panel: panel,
      urlInput: panel.querySelector('#danmaku-import-url'),
      proportionalCheckbox: panel.querySelector('#danmaku-import-proportional'),
      importBtn: panel.querySelector('#danmaku-import-btn'),
      clearBtn: panel.querySelector('#danmaku-import-clear-btn'),
      statusEl: panel.querySelector('#danmaku-import-status'),
      fontSizeSlider: panel.querySelector('#dmi-font-size'),
      fontSizeVal: panel.querySelector('#dmi-font-val'),
      timeMinInput: panel.querySelector('#dmi-time-min'),
      timeMaxInput: panel.querySelector('#dmi-time-max'),
      applySettingsBtn: panel.querySelector('#dmi-apply-settings-btn'),
      displayAreaSelect: panel.querySelector('#dmi-display-area'),
      opacitySlider: panel.querySelector('#dmi-opacity'),
      opacityVal: panel.querySelector('#dmi-opacity-val'),
      listContainer: panel.querySelector('#dmi-list-container'),
      listCount: panel.querySelector('#dmi-list-count')
    };

    // Font size slider live update
    ui.fontSizeSlider.addEventListener('input', function () {
      var val = parseInt(this.value);
      ui.fontSizeVal.textContent = val;
      settings.fontSize = val;
      applySettingsToRenderer();
    });

    ui.opacitySlider.addEventListener('input', function () {
      var val = parseInt(this.value);
      ui.opacityVal.textContent = val + '%';
      settings.opacity = val / 100;
      applySettingsToRenderer();
    });

    return ui;
  }

  function setStatus(ui, type, message) {
    ui.statusEl.textContent = message;
    ui.statusEl.className = type;
  }

  function setLoading(ui, loading) {
    ui.importBtn.disabled = loading;
    ui.importBtn.textContent = loading ? '导入中...' : '导入弹幕';
  }

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function refreshDanmakuList(ui) {
    var container = ui.listContainer;
    container.innerHTML = '';

    var totalCount = 0;
    for (var b = 0; b < danmakuBatches.length; b++) {
      totalCount += danmakuBatches[b].danmakuList.length;
    }

    if (danmakuBatches.length === 0) {
      container.innerHTML = '<div class="dmi-list-empty">暂无导入弹幕</div>';
      ui.listCount.textContent = '';
      return;
    }

    ui.listCount.textContent = '(' + totalCount + '条 / ' + danmakuBatches.length + '组)';

    for (var bi = 0; bi < danmakuBatches.length; bi++) {
      var batch = danmakuBatches[bi];
      var batchId = batch.id;

      var group = document.createElement('div');
      group.className = 'dmi-batch-group';

      // Header
      var header = document.createElement('div');
      header.className = 'dmi-batch-header';
      header.innerHTML =
        '<span class="dmi-batch-arrow" id="dmi-arrow-' + batchId + '">&#9660;</span>' +
        '<span class="dmi-batch-title" title="' + escapeHtml(batch.sourceTitle) + '">' + escapeHtml(batch.sourceTitle) + '</span>' +
        '<span class="dmi-batch-count">' + batch.danmakuList.length + '条</span>' +
        '<button class="dmi-batch-delete" title="删除此组弹幕">✕</button>';

      // Body
      var body = document.createElement('div');
      body.className = 'dmi-batch-body';
      body.id = 'dmi-body-' + batchId;
      body.style.maxHeight = 'none';

      for (var di = 0; di < batch.danmakuList.length; di++) {
        var dm = batch.danmakuList[di];
        var item = document.createElement('div');
        item.className = 'dmi-list-item';
        item.innerHTML =
          '<span class="dmi-list-time">' + formatTime(dm.time) + '</span>' +
          '<span class="dmi-list-text" title="' + escapeHtml(dm.text) + '">' + escapeHtml(dm.text) + '</span>';

        (function (time) {
          item.addEventListener('click', function (e) {
            e.stopPropagation();
            if (videoEl) {
              videoEl.currentTime = time;
            }
          });
        })(dm.time);

        body.appendChild(item);
      }

      // Toggle collapse
      (function (bid, arrow, bd) {
        header.addEventListener('click', function () {
          var isCollapsed = bd.classList.contains('collapsed');
          if (isCollapsed) {
            bd.classList.remove('collapsed');
            bd.style.maxHeight = '400px';
            arrow.classList.remove('collapsed');
          } else {
            bd.classList.add('collapsed');
            bd.style.maxHeight = '0';
            arrow.classList.add('collapsed');
          }
        });
      })(batchId, header.querySelector('.dmi-batch-arrow'), body);

      // Delete batch
      (function (bid) {
        header.querySelector('.dmi-batch-delete').addEventListener('click', function (e) {
          e.stopPropagation();
          removeBatch(bid, ui);
        });
      })(batchId);

      group.appendChild(header);
      group.appendChild(body);
      container.appendChild(group);
    }
  }

  function removeBatch(batchId, ui) {
    for (var i = danmakuBatches.length - 1; i >= 0; i--) {
      if (danmakuBatches[i].id === batchId) {
        // Reset active states for this batch's danmaku
        var list = danmakuBatches[i].danmakuList;
        for (var j = 0; j < list.length; j++) {
          list[j].active = false;
        }
        // Also remove from activeDanmaku
        danmakuBatches.splice(i, 1);
        break;
      }
    }
    // Clean up activeDanmaku entries from removed batch
    activeDanmaku = [];

    if (danmakuBatches.length === 0) {
      stopRendering();
    } else {
      // Restart rendering for remaining batches
      applySettingsToRenderer();
    }

    refreshDanmakuList(ui);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ========== Module 2: URL Parser ==========

  function parseBilibiliUrl(url) {
    url = url.trim();

    var bvMatch = url.match(/BV([a-zA-Z0-9]{10})/);
    if (bvMatch) return { type: 'bv', id: 'BV' + bvMatch[1], shortUrl: false };

    var avMatch = url.match(/av(\d+)/i);
    if (avMatch) return { type: 'av', id: avMatch[1], shortUrl: false };

    var epMatch = url.match(/ep(\d+)/i);
    if (epMatch) return { type: 'ep', id: epMatch[1], shortUrl: false };

    var ssMatch = url.match(/ss(\d+)/i);
    if (ssMatch) return { type: 'ss', id: ssMatch[1], shortUrl: false };

    if (url.includes('b23.tv')) return { type: 'short', id: url, shortUrl: true };

    return null;
  }

  function getVideoInfo(identifier) {
    return new Promise(function (resolve, reject) {
      var apiUrl;
      if (identifier.type === 'bv') {
        apiUrl = 'https://api.bilibili.com/x/web-interface/view?bvid=' + identifier.id;
      } else if (identifier.type === 'av') {
        apiUrl = 'https://api.bilibili.com/x/web-interface/view?aid=' + identifier.id;
      } else if (identifier.type === 'ep') {
        apiUrl = 'https://api.bilibili.com/pgc/view/web/season?ep_id=' + identifier.id;
      } else {
        reject(new Error('不支持的链接类型'));
        return;
      }

      GM_xmlhttpRequest({
        method: 'GET',
        url: apiUrl,
        onload: function (res) {
          try {
            var data = JSON.parse(res.responseText);
            if (data.code !== 0) {
              reject(new Error('API错误: ' + (data.message || data.code)));
              return;
            }
            var cid;
            var duration;
            if (identifier.type === 'ep') {
              var episodes = data.result && data.result.episodes;
              if (!episodes || episodes.length === 0) {
                reject(new Error('未找到该番剧的剧集信息'));
                return;
              }
              cid = episodes[0].cid;
              duration = episodes[0].duration;
              resolve({ cid: cid, duration: duration, title: (data.result.title || '番剧') + ' EP' + identifier.id });
            } else {
              cid = data.data.cid;
              duration = data.data.duration;
              resolve({ cid: cid, duration: duration, title: data.data.title || ('视频-' + identifier.id) });
            }
          } catch (e) {
            reject(new Error('解析视频信息失败: ' + e.message));
          }
        },
        onerror: function () {
          reject(new Error('请求视频信息失败，请检查链接是否正确'));
        }
      });
    });
  }

  // ========== Module 3: Danmaku Fetcher ==========

  function fetchDanmaku(cid) {
    return new Promise(function (resolve, reject) {
      // Step 1: Get segment index
      var segUrl = 'https://api.bilibili.com/x/v2/dm/web/seg.so?oid=' + cid + '&type=1';

      GM_xmlhttpRequest({
        method: 'GET',
        url: segUrl,
        onload: function (segRes) {
          try {
            var segData = JSON.parse(segRes.responseText);
            if (segData.code !== 0 || !segData.data || !segData.data.segments) {
              // Fallback: try single segment fetch
              fetchSingleSegment(cid, resolve, reject);
              return;
            }

            var segments = segData.data.segments;
            var totalSegments = segments.length;
            var allDanmaku = [];
            var completed = 0;
            var hasError = false;

            if (totalSegments === 0) {
              reject(new Error('该视频弹幕池为空'));
              return;
            }

            // Step 2: Fetch all segments in parallel
            for (var s = 0; s < totalSegments; s++) {
              (function (segIndex) {
                var dmUrl = 'https://api.bilibili.com/x/v1/dm/list.so?oid=' + cid + '&segment_index=' + segIndex;

                GM_xmlhttpRequest({
                  method: 'GET',
                  url: dmUrl,
                  onload: function (dmRes) {
                    if (hasError) return;
                    try {
                      var list = parseDanmakuXml(dmRes.responseText);
                      allDanmaku = allDanmaku.concat(list);
                    } catch (e) {
                      // skip failed segment
                    }
                    completed++;
                    if (completed >= totalSegments) {
                      if (allDanmaku.length === 0) {
                        reject(new Error('该视频弹幕池为空'));
                      } else {
                        resolve(allDanmaku);
                      }
                    }
                  },
                  onerror: function () {
                    if (hasError) return;
                    completed++;
                    if (completed >= totalSegments && allDanmaku.length === 0) {
                      reject(new Error('获取弹幕失败，请检查网络'));
                    } else if (completed >= totalSegments) {
                      resolve(allDanmaku);
                    }
                  }
                });
              })(segments[s].segment_index);
            }
          } catch (e) {
            // Fallback on parse error
            fetchSingleSegment(cid, resolve, reject);
          }
        },
        onerror: function () {
          // Fallback: try single segment
          fetchSingleSegment(cid, resolve, reject);
        }
      });
    });
  }

  function fetchSingleSegment(cid, resolve, reject) {
    var url = 'https://api.bilibili.com/x/v1/dm/list.so?oid=' + cid;
    GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      onload: function (res) {
        try {
          var danmakuList = parseDanmakuXml(res.responseText);
          if (danmakuList.length === 0) {
            reject(new Error('该视频弹幕池为空'));
            return;
          }
          resolve(danmakuList);
        } catch (e) {
          reject(new Error('解析弹幕数据失败: ' + e.message));
        }
      },
      onerror: function () {
        reject(new Error('获取弹幕失败，请检查网络'));
      }
    });
  }

  function parseDanmakuXml(xmlText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xmlText, 'text/xml');

    var errorNode = doc.querySelector('parsererror');
    if (errorNode) throw new Error('XML解析错误');

    var danmakuElements = doc.querySelectorAll('d');
    var danmakuList = [];

    for (var i = 0; i < danmakuElements.length; i++) {
      var el = danmakuElements[i];
      var p = el.getAttribute('p');
      if (!p) continue;

      var parts = p.split(',');
      if (parts.length < 8) continue;

      danmakuList.push({
        time: parseFloat(parts[0]),
        mode: parseInt(parts[1]),
        fontSize: parseInt(parts[2]),
        color: parseInt(parts[3]),
        sendTime: parseInt(parts[4]),
        pool: parseInt(parts[5]),
        userID: parts[6],
        rowID: parts[7],
        text: el.textContent
      });
    }

    return danmakuList;
  }

  // ========== Module 4: Canvas Danmaku Renderer ==========

  var DANMAKU_SPEED = 150;
  var DANMAKU_LIFETIME = 8;
  var ROW_HEIGHT = 30;
  var FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", sans-serif';

  var canvas = null;
  var ctx = null;
  var videoEl = null;
  var danmakuBatches = [];   // [{ id, sourceUrl, sourceTitle, danmakuList }]
  var activeDanmaku = [];
  var animFrameId = null;
  var isRunning = false;
  var batchIdCounter = 0;

  function initCanvas() {
    videoEl = document.querySelector('video');
    if (!videoEl) return false;

    var container = videoEl.parentElement;
    while (container && container !== document.body) {
      if (container.querySelector('video') === videoEl &&
          (container.classList.contains('bpx-player-video-wrap') ||
           container.classList.contains('bilibili-player-video') ||
           container.tagName === 'BWP-VIEO' ||
           container.tagName === 'BWP-VIDEO')) {
        break;
      }
      container = container.parentElement;
    }
    if (!container || container === document.body) {
      container = videoEl.parentElement;
    }

    var oldCanvas = document.getElementById('imported-danmaku-canvas');
    if (oldCanvas) oldCanvas.remove();

    canvas = document.createElement('canvas');
    canvas.id = 'imported-danmaku-canvas';
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    ctx = canvas.getContext('2d');

    function resize() {
      var rect = videoEl.getBoundingClientRect();
      var cw = rect.width;
      var ch = rect.height;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
    }
    resize();

    var resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(videoEl);

    var cs = getComputedStyle(container);
    if (cs.position === 'static') {
      container.style.position = 'relative';
    }

    container.appendChild(canvas);
    return true;
  }

  function colorToCSS(colorNum) {
    var r = (colorNum >> 16) & 0xFF;
    var g = (colorNum >> 8) & 0xFF;
    var b = colorNum & 0xFF;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function getRowY(rowIndex) {
    return rowIndex * ROW_HEIGHT + ROW_HEIGHT;
  }

  function getDisplayHeight() {
    return canvas.height * settings.displayArea;
  }

  function assignRow(existingRows) {
    var usedRows = {};
    for (var i = 0; i < existingRows.length; i++) {
      usedRows[existingRows[i]] = true;
    }
    var availHeight = getDisplayHeight();
    var maxRows = Math.floor((availHeight - ROW_HEIGHT) / ROW_HEIGHT);
    if (maxRows < 2) maxRows = 2;
    for (var r = 0; r < maxRows; r++) {
      if (!usedRows[r]) return r;
    }
    return Math.floor(Math.random() * maxRows);
  }

  function isInTimeRange(danmakuTime) {
    return danmakuTime >= settings.timeMin &&
           (settings.timeMax === Infinity || danmakuTime <= settings.timeMax);
  }

  function startRendering() {
    if (isRunning) return;
    if (!initCanvas()) return;
    isRunning = true;

    function render() {
      if (!isRunning) return;

      var currentTime = videoEl.currentTime;
      var cw = canvas.width;
      var ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);
      ctx.globalAlpha = settings.opacity;

      var occupiedRows = [];
      var displayHeight = getDisplayHeight();

      for (var i = activeDanmaku.length - 1; i >= 0; i--) {
        var dm = activeDanmaku[i];
        var elapsed = currentTime - dm.startTime;

        if (elapsed > dm.lifetime || elapsed < -1) {
          activeDanmaku.splice(i, 1);
          continue;
        }

        if (dm.mode === 1 || dm.mode === 6 || dm.mode === 0 || dm.mode > 6) {
          var progress = elapsed / dm.lifetime;
          var x;
          if (dm.mode === 6) {
            x = -cw * 0.5 + progress * (cw * 1.5);
          } else {
            x = cw - progress * (cw + dm.textWidth);
          }

          ctx.font = dm.fontSize + 'px ' + FONT_FAMILY;
          ctx.fillStyle = dm.color;
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 3;
          ctx.fillText(dm.text, x, getRowY(dm.row));
          ctx.shadowBlur = 0;

          occupiedRows.push(dm.row);
        } else if (dm.mode === 5) {
          ctx.font = dm.fontSize + 'px ' + FONT_FAMILY;
          ctx.fillStyle = dm.color;
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 3;
          ctx.fillText(dm.text, (cw - dm.textWidth) / 2, ROW_HEIGHT);
          ctx.shadowBlur = 0;
        } else if (dm.mode === 4) {
          ctx.font = dm.fontSize + 'px ' + FONT_FAMILY;
          ctx.fillStyle = dm.color;
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 3;
          ctx.fillText(dm.text, (cw - dm.textWidth) / 2, displayHeight - ROW_HEIGHT);
          ctx.shadowBlur = 0;
        } else {
          var p2 = elapsed / dm.lifetime;
          var x2 = cw - p2 * (cw + dm.textWidth);
          ctx.font = dm.fontSize + 'px ' + FONT_FAMILY;
          ctx.fillStyle = dm.color;
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 3;
          ctx.fillText(dm.text, x2, getRowY(dm.row));
          ctx.shadowBlur = 0;
          occupiedRows.push(dm.row);
        }
      }

      // Activate new danmaku from all batches
      for (var bi = 0; bi < danmakuBatches.length; bi++) {
        var batchList = danmakuBatches[bi].danmakuList;
        for (var j = 0; j < batchList.length; j++) {
          var idm = batchList[j];
        if (idm.active) continue;

        if (!isInTimeRange(idm.time)) {
          continue; // skip danmaku outside time range
        }

        var timeDiff = currentTime - idm.time;
        if (timeDiff >= 0 && timeDiff < 0.5) {
          idm.active = true;

          ctx.font = idm.fontSize + 'px ' + FONT_FAMILY;
          var tw = ctx.measureText(idm.text).width;

          var row;
          if (idm.mode === 1 || idm.mode === 6 || idm.mode === 0 || idm.mode > 6) {
            row = assignRow(occupiedRows);
            occupiedRows.push(row);
          } else {
            row = 0;
          }

          activeDanmaku.push({
            text: idm.text,
            mode: idm.mode || 1,
            color: colorToCSS(idm.color || 0xFFFFFF),
            fontSize: settings.fontSize || idm.fontSize || 25,
            startTime: currentTime,
            lifetime: DANMAKU_LIFETIME,
            row: row,
            textWidth: tw
          });
        }
      }
      }

      animFrameId = requestAnimationFrame(render);
    }

    animFrameId = requestAnimationFrame(render);
  }

  function stopRendering() {
    isRunning = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    activeDanmaku = [];
    for (var bi = 0; bi < danmakuBatches.length; bi++) {
      var list = danmakuBatches[bi].danmakuList;
      for (var i = 0; i < list.length; i++) {
        list[i].active = false;
      }
    }
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
      canvas = null;
      ctx = null;
    }
  }

  function applySettingsToRenderer() {
    // When settings change, restart rendering with current danmaku
    if (danmakuBatches.length === 0) return;
    if (!isRunning) return;

    // Stop and restart
    stopRendering();
    // Reset active state
    for (var bi = 0; bi < danmakuBatches.length; bi++) {
      var list = danmakuBatches[bi].danmakuList;
      for (var i = 0; i < list.length; i++) {
        list[i].active = false;
      }
    }
    if (initCanvas()) {
      startRendering();
    }
  }

  function injectDanmakuToCanvas(danmakuList, sourceDuration, proportional, sourceTitle, sourceUrl) {
    var currentDuration = videoEl ? videoEl.duration : 0;
    if (!currentDuration && unsafeWindow.__INITIAL_STATE__) {
      currentDuration = unsafeWindow.__INITIAL_STATE__.videoData ?
        unsafeWindow.__INITIAL_STATE__.videoData.duration : 0;
    }
    if (!currentDuration) {
      throw new Error('无法获取当前视频时长，请先播放视频');
    }

    var batchDanmaku = [];
    for (var i = 0; i < danmakuList.length; i++) {
      var dm = danmakuList[i];
      var time = dm.time;

      if (proportional && sourceDuration > 0 && currentDuration > 0) {
        time = (dm.time / sourceDuration) * currentDuration;
      }

      if (time > currentDuration + 5) continue;

      batchDanmaku.push({
        text: dm.text,
        time: time,
        mode: dm.mode || 1,
        fontSize: dm.fontSize || 25,
        color: dm.color || 0xFFFFFF,
        active: false
      });
    }

    batchDanmaku.sort(function (a, b) { return a.time - b.time; });

    // Add as new batch (don't replace existing batches)
    batchIdCounter++;
    danmakuBatches.push({
      id: batchIdCounter,
      sourceUrl: sourceUrl || '',
      sourceTitle: sourceTitle || ('导入 #' + batchIdCounter),
      danmakuList: batchDanmaku
    });

    // Restart rendering if stopped, or let it pick up new batch automatically
    if (!isRunning) {
      if (initCanvas()) {
        startRendering();
      } else {
        throw new Error('未找到视频元素，请确认视频正在播放');
      }
    }

    return batchDanmaku.length;
  }

  // ========== Main: Wiring ==========

  function main() {
    var ui = createSidePanel();

    // Apply settings button
    ui.applySettingsBtn.addEventListener('click', function () {
      var timeMin = parseFloat(ui.timeMinInput.value) || 0;
      var timeMaxRaw = ui.timeMaxInput.value.trim();
      var timeMax = timeMaxRaw === '' ? Infinity : (parseFloat(timeMaxRaw) || Infinity);

      settings.timeMin = Math.max(0, timeMin);
      settings.timeMax = timeMax;
      settings.displayArea = parseFloat(ui.displayAreaSelect.value) || 1.0;
      settings.opacity = parseInt(ui.opacitySlider.value) / 100;

      ui.opacityVal.textContent = ui.opacitySlider.value + '%';

      setStatus(ui, 'success', '设置已应用');
      applySettingsToRenderer();
    });

    // Import button
    ui.importBtn.addEventListener('click', function () {
      var url = ui.urlInput.value.trim();

      if (!url) {
        setStatus(ui, 'error', '请输入B站视频链接');
        return;
      }

      var identifier = parseBilibiliUrl(url);
      if (!identifier) {
        setStatus(ui, 'error', '无法识别该链接格式，请确认是B站视频链接');
        return;
      }

      setLoading(ui, true);
      setStatus(ui, 'loading', '正在获取视频信息...');

      handleImport(ui, identifier);
    });

    // Enter key
    ui.urlInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        ui.importBtn.click();
      }
    });

    // Clear button
    ui.clearBtn.addEventListener('click', function () {
      stopRendering();
      danmakuBatches = [];
      refreshDanmakuList(ui);
      setStatus(ui, 'success', '已清除全部导入弹幕');
    });

    function handleImport(ui, identifier) {
      var sourceUrl = ui.urlInput.value.trim();

      Promise.resolve().then(function () {
        if (identifier.shortUrl) {
          return resolveShortUrl(identifier.id).then(function (realUrl) {
            if (!realUrl) {
              throw new Error('无法解析短链接，请直接粘贴完整BV/AV链接');
            }
            var resolved = parseBilibiliUrl(realUrl);
            if (!resolved) {
              throw new Error('短链接重定向后无法识别');
            }
            return resolved;
          });
        }
        return identifier;
      }).then(function (resolvedIdentifier) {
        setStatus(ui, 'loading', '正在获取视频CID...');
        return getVideoInfo(resolvedIdentifier);
      }).then(function (videoInfo) {
        setStatus(ui, 'loading', '正在获取弹幕数据...');
        return Promise.all([videoInfo, fetchDanmaku(videoInfo.cid)]);
      }).then(function (results) {
        var videoInfo = results[0];
        var danmakuList = results[1];

        setStatus(ui, 'loading', '正在注入弹幕...');
        var proportional = ui.proportionalCheckbox.checked;
        var count = injectDanmakuToCanvas(
          danmakuList,
          videoInfo.duration,
          proportional,
          videoInfo.title,
          sourceUrl
        );

        // Update time range max to current video duration
        var dur = videoEl ? videoEl.duration : videoInfo.duration;
        ui.timeMaxInput.placeholder = '全部 (' + Math.floor(dur) + 's)';

        // Refresh danmaku list
        refreshDanmakuList(ui);

        setLoading(ui, false);
        setStatus(ui, 'success', '成功导入 ' + count + ' 条弹幕！');
      }).catch(function (e) {
        setLoading(ui, false);
        setStatus(ui, 'error', e.message);
      });
    }
  }

  function resolveShortUrl(shortUrl) {
    return new Promise(function (resolve) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: shortUrl,
        onload: function (res) {
          var finalUrl = res.finalUrl || '';
          if (finalUrl && finalUrl.includes('bilibili.com')) {
            resolve(finalUrl);
          } else {
            resolve(null);
          }
        },
        onerror: function () {
          resolve(null);
        }
      });
    });
  }

  main();
})();
