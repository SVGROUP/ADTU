/**
 * detail.html JS（IIFE 模块化）
 * 职责：发布详情表格（分页 + 状态筛选 + 行内操作）
 * 模式：与 config.js / interface.js 对齐
 *   - 所有事件用 addEventListener 绑定
 *   - 动态渲染的表格用事件委托（避免行内 onclick）
 *   - fetch 统一封装
 */
(function () {
  'use strict';

  // ============================================================
  // 模块 1: state — 分页 + 筛选状态
  // ============================================================
  const state = {
    currentPage: 1,
  };

  // ============================================================
  // 模块 2: api — 统一 fetch 封装（dtu 子路径）
  // ============================================================
  const api = (() => {
    const BASE = 'sv/dtu/api';

    function call(method, { query, body } = {}) {
      const options = { method: 'GET' };
      if (body !== undefined) {
        options.method = 'POST';
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
      }
      let url = `${BASE}/${method}`;
      if (query && Object.keys(query).length > 0) {
        const qs = Object.entries(query)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`)
          .join('&');
        url += `?${qs}`;
      }
      return fetch(url, options);
    }

    return { call };
  })();

  // ============================================================
  // 模块 3: sites — 站点码 → 中文名 映射
  // 与 ARSS 的 SITE_LIST 类似的硬编码列表
  // ============================================================
  const sites = (() => {
    const SITE_MAP = {
      'www.agsvpt.com': '末日', 'ubits.club': '优堡', 'www.hdkyl.in': '麒麟',
      'carpt.net': '车站', 'ptlgs.org': '劳改所', 'zmpt.cc': '织梦',
      'raingfh.top': '雨站', 'lemonhd.club': '柠檬', 'njtupt.top': '南工',
      'pt.btschool.club': '学校', 'www.qingwapt.com': '青蛙', 'hdfans.org': '红豆饭',
      'hdarea.club': '好大', 'pterclub.net': '猫站', 'kufei.org': '库非',
      'pt.hdclone.org': '克隆', 'rousi.zip': '肉丝', 'www.icc2022.com': '冰淇淋',
      '1ptba.com': '一吧', 'ptsbao.club': '烧包', 'www.devtracker.me': '做我',
      'cyanbug.net': '青虫', 'pandapt.net': '熊猫', 'totheglory.im': '套套',
      'www.ptzone.xyz': '私区', 'pt.soulvoice.club': '铃音', 'pt.0ff.cc': '农场',
      'hdhome.org': '家园', 'hdtime.org': '时光', 'pt.upxin.net': '好多油',
      'www.joyhd.net': '开心', 'www.okpt.net': 'OK', 'www.oshen.win': '欧申',
      'ptchina.org': '铂金', 'pthome.net': '高清家', 'ptcafe.club': '咖啡',
      'crabpt.vip': '蟹黄堡', 'www.dragonhd.xyz': '龙之家', 'hspt.club': '回声',
      'hdbao.cc': '海宝', 'www.ptlover.cc': '爱乐', 'ptfans.cc': '铂粉',
      'pt.gtkpw.xyz': '搞铁', 'hdpt.xyz': '明教', 'www.hitpt.com': '百川',
      'sanpro.pw': '小伞', 'torrenthub.club': '种子库', 'pt.xingyungept.org': '星陨阁',
      'cspt.top': '财神', 'tmpt.top': '唐门', 'hudbt.hust.edu.cn': '蝴蝶',
      'nanyangpt.com': '南洋', 'tjupt.org': 'TJUPT', 'wintersakura.net': '冬樱',
      'et8.org': '吹风', 'pt.eastgame.org': '吐鲁番', 'hdvideo.one': '海威',
      'hdcity.city': 'HDCITY', 'www.hddolby.com': '杜比', '52pt.site': '五二',
      'audiences.me': '人人', 'pt.ying.us.kg': '樱花', 'sewerpt.com': '下水道',
      'lemonhd.net': '柠檬甜', 'bilibili.download': '轨道炮', 'pt.novahd.top': '新星',
      'duckboobee.org': '三月', 'pt.luckpt.de': '幸运', 'pt.lajidui.top': '垃圾堆',
      '13city.org': '十三城', 'zrpt.cc': '自然', 'www.yhpp.cc': '昆仑',
      'pt.muxuege.org': '慕雪阁', 'cc.mypt.cc': '我的', 'nex.jivon.de': '幻境',
      'sbpt.link': '沙比', 'pt.aling.de': '爱玲', 'cangbao.ge': '藏宝',
      'dubhe.site': '天枢', 'ptlao.top': '忘年', 'longpt.org': '长久',
      'www.ptskit.org': '铂金短', 'www.tangpt.top': '躺平', 'pt.baozi.cc': '包子',
    };

    return {
      getName(code) { return SITE_MAP[code] || code; },
    };
  })();

  // ============================================================
  // 模块 4: utils — 时间戳/状态显示
  // ============================================================
  const utils = (() => {
    const DOWN_STATUS = { 0: '下载中', 1: '已下载' };
    const UP_STATUS = { 0: '未发布', 1: '已发布', 2: '已跳过' };
    const ACTION_TEXT = { 1: '通知下载完成', 2: '通知重发' };

    function timestampToUTC8(ts) {
      if (!ts) return '';
      const d = new Date(ts * 1000);
      return d.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
    }

    function downStatusText(downloaded, ts) {
      return (DOWN_STATUS[downloaded] || '') + '<br>' + timestampToUTC8(ts);
    }
    function upStatusText(uploaded, ts) {
      return (UP_STATUS[uploaded] || '') + '<br>' + timestampToUTC8(ts);
    }
    function actionText(flag) { return ACTION_TEXT[flag] || ''; }

    return { timestampToUTC8, downStatusText, upStatusText, actionText };
  })();

  // ============================================================
  // 模块 5: table — 表格渲染（行内按钮用 dataset，事件委托处理点击）
  // ============================================================
  const table = (() => {
    // 行 class + 操作按钮判定
    function classifyRow(item) {
      if (item.downloaded === 0) return { rowClass: 'downloading', flag: 1 };
      if (item.downloaded === 1 && item.uploaded === 0) return { rowClass: 'downloaded-not-uploaded', flag: 0 };
      if (item.uploaded === 1) return { rowClass: 'uploaded', flag: 0 };
      if (item.uploaded === 2) return { rowClass: 'skipped', flag: 2 };
      return { rowClass: '', flag: 0 };
    }

    function renderRow(item) {
      const { rowClass, flag } = classifyRow(item);
      let actionCell = '';
      if (flag !== 0) {
        // 用 dataset 存数据，事件委托在 tbody 统一处理
        actionCell = `<button class="action-btn" data-flag="${flag}" data-hash="${item.source_hash || ''}" data-target-site="${item.target_site || ''}">${utils.actionText(flag)}</button>`;
      }
      return `<tr class="${rowClass}">
        <td class="hash-cell">${item.source_hash || ''}</td>
        <td>${sites.getName(item.source_site)}</td>
        <td>${sites.getName(item.target_site)}</td>
        <td>${utils.downStatusText(item.downloaded, item.timestamp)}</td>
        <td>${utils.upStatusText(item.uploaded, item.up_ts)}</td>
        <td><textarea class="remark-textarea" readonly>${item.remark || ''}</textarea></td>
        <td>${actionCell}</td>
      </tr>`;
    }

    function render(torrentList) {
      const tbody = document.getElementById('torrentTableBody');
      if (!torrentList || torrentList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">暂无数据</td></tr>';
        return;
      }
      tbody.innerHTML = torrentList.map(renderRow).join('');
    }

    return { render };
  })();

  // ============================================================
  // 模块 7: pagination — 边界禁用逻辑
  // 下一页没有内容 → 禁用下一页按钮（同时退回上一页）
  // 上一页到底（当前页 === 1）→ 禁用上一页按钮
  // ============================================================
  const PAGE_SIZE = 20;  // 后端 atut_serv.py: page * 20

  function updatePaginationButtons(list) {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if (!prevBtn || !nextBtn) return;
    // 上一页：当前页 === 1 → 禁用
    prevBtn.disabled = (state.currentPage <= 1);
    // 下一页：返回数据小于 PAGE_SIZE → 后面没数据了 → 禁用
    //         返回空数组（list.length === 0）→ 越界访问 → 退回到上一页 + 重新刷
    if (list.length === 0 && state.currentPage > 1) {
      state.currentPage--;
      actions.refresh();
      return;
    }
    nextBtn.disabled = (list.length < PAGE_SIZE);
  }

  // ============================================================
  // 模块 8: actions — 数据加载 + 行内操作
  // ============================================================
  const actions = {
    async load(direction) {
      if (direction === 'next') state.currentPage++;
      else if (direction === 'prev') state.currentPage = Math.max(1, state.currentPage - 1);
      else if (direction === 'first') state.currentPage = 1;
      await actions.refresh();
    },

    async refresh() {
      const statusFilter = document.getElementById('statusFilter').value;
      try {
        const res = await api.call('torrentsStatus', {
          query: { p: state.currentPage, s: statusFilter },
        });
        if (!res.ok) throw new Error('获取种子信息失败');
        const data = await res.json();
        if (data.code === 200) {
          const list = JSON.parse(data.msg) || [];
          table.render(list);
          updatePaginationButtons(list);
        } else {
          document.getElementById('torrentTableBody').innerHTML =
            `<tr><td colspan="7">加载数据失败: ${data.msg}</td></tr>`;
        }
      } catch (err) {
        document.getElementById('torrentTableBody').innerHTML =
          `<tr><td colspan="7">加载数据出错: ${err.message}</td></tr>`;
      }
    },

    async performAction(flag, hash, targetSite) {
      let method;
      if (flag === 1) method = 'downloaded';
      else if (flag === 2) method = 'reload';
      else return;

      const query = { h: hash };
      if (flag === 2) query.ts = targetSite;

      try {
        const res = await api.call(method, { query });
        if (!res.ok) throw new Error('请求失败');
        const data = await res.json();
        if (data.code === 200) {
          await actions.refresh();  // 操作成功后重新加载
        }
      } catch (err) {
        console.error('performAction 失败:', err);
      }
    },
  };

  // ============================================================
  // 模块 7: bind — 启动时绑定所有事件
  // ============================================================
  function bind() {
    // 状态筛选下拉框
    document.getElementById('statusFilter').addEventListener('change', () => {
      state.currentPage = 1;
      actions.refresh();
    });

    // 分页按钮
    document.getElementById('prevPageBtn').addEventListener('click', () => actions.load('prev'));
    document.getElementById('nextPageBtn').addEventListener('click', () => actions.load('next'));

    // 表格行内按钮 — 事件委托（避免行内 onclick）
    document.getElementById('torrentTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('.action-btn');
      if (!btn) return;
      const flag = parseInt(btn.dataset.flag, 10);
      const hash = btn.dataset.hash;
      const targetSite = btn.dataset.targetSite;
      actions.performAction(flag, hash, targetSite);
    });
  }

  // ============================================================
  // 模块 8: init — DOMContentLoaded 启动
  // ============================================================
  function init() {
    bind();
    actions.load('first');  // 首次加载
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
