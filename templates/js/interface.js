/**
 * interface.html JS（IIFE 模块化）
 * 职责：11 个工具接口的调用 + 站点标识对照表 modal
 * 模式：与 ARSS 的 interface.js 对齐
 *   - 声明式 INTERFACES 表（method/inputs/body/query）
 *   - 默认走 GET query（无 body 函数时）
 *   - 事件用 addEventListener
 *   - 站点 modal 独立模块（sites.modal）
 */
(function () {
  'use strict';

  // ============================================================
  // 模块 1: api — 统一 fetch 封装（dtu 子路径）
  // ============================================================
  const api = (() => {
    const BASE = 'sv/dtu/api';

    function buildUrl(method, query) {
      const url = `${BASE}/${method}`;
      if (!query || Object.keys(query).length === 0) return url;
      const qs = Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`)
        .join('&');
      return `${url}?${qs}`;
    }

    function call(method, { query, body } = {}) {
      const options = { method: 'GET' };
      if (body !== undefined) {
        options.method = 'POST';
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
      }
      return fetch(buildUrl(method, query), options).then((response) =>
        response.json().then((data) => ({ response, data })),
      );
    }

    return { call, buildUrl };
  })();

  // ============================================================
  // 模块 2: ui — 结果区渲染 + 站点 modal
  // ============================================================
  const ui = (() => {
    function setResult(method, text, kind) {
      const el = document.getElementById(`${method}_result`);
      if (!el) return;
      el.textContent = text;
      el.className = 'result' + (kind ? ' ' + kind : '');
    }

    return { setResult };
  })();

  // ============================================================
  // 模块 3: sites — 站点数据（站点标识对照表 modal 用）
  // ============================================================
  const sites = (() => {
    const SITE_DATA = [
      { name: '末日',     identifier: 'www.agsvpt.com' },
      { name: '优堡',     identifier: 'ubits.club' },
      { name: '麒麟',     identifier: 'www.hdkyl.in' },
      { name: '车站',     identifier: 'carpt.net' },
      { name: '劳改所',   identifier: 'ptlgs.org' },
      { name: '织梦',     identifier: 'zmpt.cc' },
      { name: '雨站',     identifier: 'raingfh.top' },
      { name: '柠檬',     identifier: 'lemonhd.club' },
      { name: '南工',     identifier: 'njtupt.top' },
      { name: '学校',     identifier: 'pt.btschool.club' },
      { name: '青蛙',     identifier: 'www.qingwapt.com' },
      { name: '红豆饭',   identifier: 'hdfans.org' },
      { name: '好大',     identifier: 'hdarea.club' },
      { name: '猫站',     identifier: 'pterclub.net' },
      { name: '库非',     identifier: 'kufei.org' },
      { name: '克隆',     identifier: 'pt.hdclone.org' },
      { name: '肉丝',     identifier: 'rousi.zip' },
      { name: '冰淇淋',   identifier: 'www.icc2022.com' },
      { name: '一吧',     identifier: '1ptba.com' },
      { name: '烧包',     identifier: 'ptsbao.club' },
      { name: '做我',     identifier: 'www.devtracker.me' },
      { name: '青虫',     identifier: 'cyanbug.net' },
      { name: '熊猫',     identifier: 'pandapt.net' },
      { name: '套套',     identifier: 'totheglory.im' },
      { name: '私区',     identifier: 'www.ptzone.xyz' },
      { name: '铃音',     identifier: 'pt.soulvoice.club' },
      { name: '农场',     identifier: 'pt.0ff.cc' },
      { name: '家园',     identifier: 'hdhome.org' },
      { name: '时光',     identifier: 'hdtime.org' },
      { name: '好多油',   identifier: 'pt.upxin.net' },
      { name: '开心',     identifier: 'www.joyhd.net' },
      { name: 'OK',       identifier: 'www.okpt.net' },
      { name: '欧申',     identifier: 'www.oshen.win' },
      { name: '铂金',     identifier: 'ptchina.org' },
      { name: '高清家',   identifier: 'pthome.net' },
      { name: '咖啡',     identifier: 'ptcafe.club' },
      { name: '蟹黄堡',   identifier: 'crabpt.vip' },
      { name: '龙之家',   identifier: 'www.dragonhd.xyz' },
      { name: '回声',     identifier: 'hspt.club' },
      { name: '海宝',     identifier: 'hdbao.cc' },
      { name: '爱乐',     identifier: 'www.ptlover.cc' },
      { name: '铂粉',     identifier: 'ptfans.cc' },
      { name: '搞铁',     identifier: 'pt.gtkpw.xyz' },
      { name: '明教',     identifier: 'hdpt.xyz' },
      { name: '百川',     identifier: 'www.hitpt.com' },
      { name: '小伞',     identifier: 'sanpro.pw' },
      { name: '种子库',   identifier: 'torrenthub.club' },
      { name: '星陨阁',   identifier: 'pt.xingyungept.org' },
      { name: '财神',     identifier: 'cspt.top' },
      { name: '唐门',     identifier: 'tmpt.top' },
      { name: '蝴蝶',     identifier: 'hudbt.hust.edu.cn' },
      { name: '南洋',     identifier: 'nanyangpt.com' },
      { name: 'TJUPT',    identifier: 'tjupt.org' },
      { name: '冬樱',     identifier: 'wintersakura.net' },
      { name: '吹风',     identifier: 'et8.org' },
      { name: '吐鲁番',   identifier: 'pt.eastgame.org' },
      { name: '海威',     identifier: 'hdvideo.one' },
      { name: 'HDCITY',   identifier: 'hdcity.city' },
      { name: '杜比',     identifier: 'www.hddolby.com' },
      { name: '五二',     identifier: '52pt.site' },
      { name: '人人',     identifier: 'audiences.me' },
      { name: '樱花',     identifier: 'pt.ying.us.kg' },
      { name: '下水道',   identifier: 'sewerpt.com' },
      { name: '柠檬甜',   identifier: 'lemonhd.net' },
      { name: '轨道炮',   identifier: 'bilibili.download' },
      { name: '新星',     identifier: 'pt.novahd.top' },
      { name: '三月',     identifier: 'duckboobee.org' },
      { name: '幸运',     identifier: 'pt.luckpt.de' },
      { name: '垃圾堆',   identifier: 'pt.lajidui.top' },
      { name: '十三城',   identifier: '13city.org' },
      { name: '自然',     identifier: 'zrpt.cc' },
      { name: '昆仑',     identifier: 'www.yhpp.cc' },
      { name: '慕雪阁',   identifier: 'pt.muxuege.org' },
      { name: '我的',     identifier: 'cc.mypt.cc' },
      { name: '幻境',     identifier: 'nex.jivon.de' },
      { name: '沙比',     identifier: 'sbpt.link' },
      { name: '爱玲',     identifier: 'pt.aling.de' },
      { name: '藏宝',     identifier: 'cangbao.ge' },
      { name: '天枢',     identifier: 'dubhe.site' },
      { name: '忘年',     identifier: 'ptlao.top' },
      { name: '长久',     identifier: 'longpt.org' },
      { name: '铂金短',   identifier: 'www.ptskit.org' },
      { name: '躺平',     identifier: 'www.tangpt.top' },
      { name: '包子',     identifier: 'pt.baozi.cc' },
      { name: '好学',     identifier: 'www.hxpt.org' },
      { name: '传道院',   identifier: 'pt.cdy.skin' },
    ];

    const modal = (() => {
      let modalEl = null;
      function ensure() {
        if (modalEl) return modalEl;
        modalEl = document.getElementById('siteModal');
        return modalEl;
      }
      function open() {
        const el = ensure();
        if (el) el.classList.add('open');
      }
      function close() {
        const el = ensure();
        if (el) el.classList.remove('open');
      }
      function render() {
        const grid = document.getElementById('siteListGrid');
        if (!grid) return;
        grid.innerHTML = SITE_DATA.map((s) => `
          <div class="site-item">
            <span class="site-name">${s.name}</span>
            <span class="site-identifier">${s.identifier}</span>
          </div>
        `).join('');
      }
      return { open, close, render };
    })();

    return { SITE_DATA, modal };
  })();

  // ============================================================
  // 模块 4: INTERFACES — 11 个 API 的声明式定义
  // ============================================================
  const INTERFACES = [
    { method: 'forceLimit', inputs: [] },
    { method: 'forceRss',   inputs: [] },
    { method: 'unfinished', inputs: [] },

    { method: 'delTorrent', inputs: [{ id: 'delTorrent_h', type: 'text', as: 'h' }] },
    { method: 'reloadHash', inputs: [{ id: 'reloadHash_h', type: 'text', as: 'h' }] },
    { method: 'reloadSite', inputs: [{ id: 'reloadSite_s', type: 'text', as: 's' }] },
    { method: 'change',
      inputs: [{ id: 'change_os', type: 'text', as: 'os' },
               { id: 'change_ns', type: 'text', as: 'ns' }] },
    { method: 'addNewSite',
      inputs: [{ id: 'addNewSite_ts', type: 'text', as: 'ts' },
               { id: 'addNewSite_ns', type: 'text', as: 'ns' }] },
    { method: 'statistics',
      inputs: [{ id: 'statistics_s',  type: 'text', as: 's' },
               { id: 'statistics_ym', type: 'text', as: 'ym' }] },

    { method: 'forceDownTorrent',
      inputs: [{ id: 'forceDownTorrent_h', type: 'text', as: 'h' },
               { id: 'forceDownTorrent_u', type: 'text', as: 'u' }],
      body: (v) => ({ h: v.h, u: v.u }) },

    { method: 'getHashInfo',
      inputs: [{ id: 'adminPassword', type: 'password', as: 'pw', required: true },
               { id: 'getHashInfo_h', type: 'text',     as: 'h' }],
      body: (v) => ({ h: v.h, pw: v.pw }) },
  ];

  // ============================================================
  // 模块 5: actions — 执行一次接口调用
  // ============================================================
  const actions = {
    collectValues(iface) {
      const v = {};
      for (const inp of iface.inputs) {
        const el = document.getElementById(inp.id);
        if (!el) continue;
        v[inp.as] = (inp.type === 'checkbox') ? el.checked : el.value;
      }
      return v;
    },
    checkRequired(iface, values) {
      for (const inp of iface.inputs) {
        if (!inp.required) continue;
        if (inp.type === 'text' && !values[inp.as]) {
          ui.setResult(iface.method, '错误: 请先填写必填项', 'error');
          return false;
        }
        if (inp.type === 'password' && !values[inp.as]) {
          void window.alertModal('请输入密码');
          return false;
        }
      }
      return true;
    },
    call(iface) {
      const values = actions.collectValues(iface);
      if (!actions.checkRequired(iface, values)) return;

      // 决定走 POST body 还是 GET query：
      //   - body:    POST JSON
      //   - query:   GET query
      //   - 都没有：  无参数调用（仅限 inputs 为空）
      let body, query;
      if (typeof iface.body === 'function') {
        body = iface.body(values);
      } else if (typeof iface.query === 'function') {
        query = iface.query(values);
      } else if (iface.inputs.length > 0) {
        // 默认走 GET query（inputs 里所有字段按 as 映射为 query 参数）
        query = {};
        for (const inp of iface.inputs) {
          query[inp.as] = values[inp.as];
        }
      }

      api.call(iface.method, { body, query })
        .then(({ response, data }) => {
          if (!response.ok || (data && data.code !== 200)) {
            const msg = (data && data.msg) || `HTTP error! status: ${response.status}`;
            ui.setResult(iface.method, `错误: ${msg}`, 'error');
          } else {
            const msg = (data && data.msg) || '操作成功';
            ui.setResult(iface.method, msg, 'success');
          }
        })
        .catch((err) => {
          ui.setResult(iface.method, `错误: ${err.message}`, 'error');
        });
    },
  };

  // ============================================================
  // 模块 6: bind — 启动时绑定所有事件
  // ============================================================
  function bind() {
    // 11 个 API 按钮
    for (const iface of INTERFACES) {
      const btn = document.getElementById(`${iface.method}_btn`);
      if (!btn) continue;
      btn.addEventListener('click', () => actions.call(iface));
    }

    // 站点 modal
    const openSiteBtn = document.getElementById('openSiteModalBtn');
    if (openSiteBtn) openSiteBtn.addEventListener('click', sites.modal.open);

    const closeSiteBtn = document.getElementById('closeSiteModalBtn');
    if (closeSiteBtn) closeSiteBtn.addEventListener('click', sites.modal.close);

    const siteModal = document.getElementById('siteModal');
    if (siteModal) {
      siteModal.addEventListener('click', (e) => {
        // 点击遮罩关闭（点击 modal-content 内部不关）
        if (e.target === siteModal) sites.modal.close();
      });
    }
  }

  // ============================================================
  // 模块 7: init
  // ============================================================
  function init() {
    sites.modal.render();
    bind();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
