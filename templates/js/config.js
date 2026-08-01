/**
 * config.html JS（IIFE 模块化）
 * 职责：70+ 配置字段的加载 / 编辑 / 站点子配置 / 禁转设置 modal
 * 模式：与 ARSS 的 config.js 对齐（共用修复经验）
 *   - 声明式 FIELDS 表（id → { path, type, event, label }）
 *   - 声明式 SITE_FIELDS 表（站点子配置 + 中文 label）
 *   - 字段级 diff + 中文展示（boolean 转开/关，null 转未设置）
 *   - 站点配置以 state.old 为基线 deep-clone 合并（避免 18 个站点假变更）
 *   - api.request try-catch 包 JSON.parse（兼容 msg 是普通文本）
 *   - 所有事件用 addEventListener 绑定（不用内联 onclick）
 *   - 共享 modal 替换 alert/confirm
 */
(function () {
  'use strict';

  // ============================================================
  // 模块 1: state — 全局状态
  // ============================================================
  const state = (() => {
    let oldConfig = {};
    let newConfig = {};
    let currentSite = '';
    let forbidConfig = {};  // 当前站点的禁转配置 {word, type, standard, tag}
    function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
    return {
      get old() { return oldConfig; },
      get new() { return newConfig; },
      get currentSite() { return currentSite; },
      get forbid() { return forbidConfig; },
      setCurrentSite(site) { currentSite = site; },
      setForbid(cfg) { forbidConfig = cfg; },
      init(config) { oldConfig = clone(config); newConfig = clone(config); },
      setNew(config) { newConfig = config; },
      commitChanges() { oldConfig = clone(newConfig); },
    };
  })();

  // ============================================================
  // 模块 2: api — 统一 fetch 封装（dtu 子路径）
  // ============================================================
  const api = (() => {
    const baseUrl = 'sv/dtu/api';
    async function request(path, opts) {
      try {
        const res = await fetch(baseUrl + path, opts);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (parseInt(data.code) !== 200) throw new Error(data.msg);
        // data.msg 可能是 JSON 字符串（getMainConfig 返回的 toml）也可能就是普通文本（备份成功、恢复成功）
        // try-catch JSON.parse：parse 成功返回对象，失败返回原字符串
        let payload = data.msg;
        if (typeof payload === 'string') {
          try { payload = JSON.parse(payload); } catch (_) { /* 保留原字符串 */ }
        }
        return { ok: true, data: payload };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    return {
      getConfig(password) {
        return request('/getMainConfig', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pw: password }),
        });
      },
      setConfig(password, toml) {
        return request('/setMainConfig', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pw: password, toml }),
        });
      },
      syncCookieCloud() {
        return request('/getCookieCloud', { method: 'GET' });
      },
      backup() {
        return request('/backupMainConfig', { method: 'GET' });
      },
      restore() {
        return request('/restoreMainConfig', { method: 'GET' });
      },
      getForbid(site) {
        return request(`/getForbid?s=${encodeURIComponent(site)}`, { method: 'GET' });
      },
      setForbid(site, forbid) {
        return request('/setForbid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site, forbid }),
        });
      },
    };
  })();

  // ============================================================
  // 模块 3: fields — 声明式字段表
  // - path:  在 newConfig 里的路径（数组，支持嵌套 qb_server.url）
  // - type:  'string' | 'number' | 'float' | 'boolean'
  // - event: 'blur' | 'change'（checkbox 用 change，文本框用 blur）
  // - label: 中文标签（diff 显示用）
  // ============================================================
  const fields = (() => {
    const FIELDS = [
      // === 基本配置 ===
      { id: 'port',                 path: ['port'],                          type: 'number',  event: 'blur',   label: '通信端口' },
      { id: 'tool_api',             path: ['tool_api'],                      type: 'string',  event: 'blur',   label: '通信IP' },
      { id: 'who_am_i',             path: ['who_am_i'],                      type: 'string',  event: 'blur',   label: '应用标识' },
      { id: 'authorize_code',       path: ['authorize_code'],                type: 'string',  event: 'blur',   label: '鉴权识别码' },
      { id: 'annotations',          path: ['annotations'],                   type: 'string',  event: 'blur',   label: '副标题说明' },
      { id: 'is_debug',             path: ['is_debug'],                      type: 'boolean', event: 'change', label: 'Debug模式' },

      // === RSS 配置 ===
      { id: 'rss_start_time',       path: ['rss_start_time'],                type: 'number',  event: 'blur',   label: '开始时间（分钟）' },
      { id: 'rss_task_interval',    path: ['rss_task_interval'],             type: 'number',  event: 'blur',   label: '执行间隔（分钟）' },
      { id: 'rss_control_host',     path: ['rss_control_host'],              type: 'string',  event: 'blur',   label: '种子抓取工具地址' },
      { id: 'rss_pause',            path: ['rss_pause'],                     type: 'boolean', event: 'change', label: '暂停拉取新种' },

      // === 发布配置 ===
      { id: 'time_to_upload',       path: ['time_to_upload'],                type: 'number',  event: 'blur',   label: '扫描间隔（分钟）' },
      { id: 'min_wait_upload',      path: ['min_wait_upload'],               type: 'number',  event: 'blur',   label: '最小等待上传数' },
      { id: 'concurrency_upload_speed', path: ['concurrency_upload_speed'],  type: 'number',  event: 'blur',   label: '并发上传速度阈值（KB）' },
      { id: 'concurrency_upload_num',   path: ['concurrency_upload_num'],    type: 'number',  event: 'blur',   label: '最大并发上传数' },
      { id: 'concurrency_upload_magnify', path: ['concurrency_upload_magnify'], type: 'number', event: 'blur', label: '并发上传倍数' },

      // === 自动删除配置 ===
      { id: 'time_to_delete',           path: ['time_to_delete'],           type: 'boolean', event: 'change', label: '开启自动删除' },
      { id: 'time_to_delete_interval',  path: ['time_to_delete_interval'],  type: 'number',  event: 'blur',   label: '删除间隔（小时）' },
      { id: 'time_to_delete_time',      path: ['time_to_delete_time'],      type: 'number',  event: 'blur',   label: '执行时间（分钟）' },

      // === 自动限速配置 ===
      { id: 'time_to_stop',             path: ['time_to_stop'],             type: 'boolean', event: 'change', label: '开启自动限速' },
      { id: 'time_to_stop_uper',        path: ['time_to_stop_uper'],        type: 'number',  event: 'blur',   label: '限速人数阈值' },
      { id: 'time_to_stop_time',        path: ['time_to_stop_time'],        type: 'number',  event: 'blur',   label: '执行时间（分钟）' },
      { id: 'time_to_stop_torrent',     path: ['time_to_stop_torrent'],     type: 'boolean', event: 'change', label: '暂停做种' },
      { id: 'time_to_stop_delete',      path: ['time_to_stop_delete'],      type: 'boolean', event: 'change', label: '检测后删除种子' },

      // === 移动种子配置 ===
      { id: 'move_source_flag',         path: ['move_source_flag'],         type: 'boolean', event: 'change', label: '开启自动移动' },
      { id: 'move_source_time',         path: ['move_source_time'],         type: 'number',  event: 'blur',   label: '执行移动任务时间间隔（分钟）' },
      { id: 'move_source_speed',        path: ['move_source_speed'],        type: 'number',  event: 'blur',   label: '触发移动的上传速度阈值（KB）' },
      { id: 'move_source_path',         path: ['move_source_path'],         type: 'string',  event: 'blur',   label: '目标移动路径' },

      // === QB 配置 ===
      { id: 'qb_url',               path: ['qb_server', 'url'],              type: 'string',  event: 'blur',   label: 'QB地址' },
      { id: 'qb_port',              path: ['qb_server', 'port'],             type: 'number',  event: 'blur',   label: 'QB端口' },
      { id: 'qb_user',              path: ['qb_server', 'user'],             type: 'string',  event: 'blur',   label: 'QB用户名' },
      { id: 'qb_password',          path: ['qb_server', 'password'],         type: 'string',  event: 'blur',   label: 'QB密码' },
      { id: 'download_path',        path: ['qb_server', 'download_path'],    type: 'string',  event: 'blur',   label: '下载路径' },
      { id: 'down_queue',           path: ['qb_server', 'down_queue'],       type: 'number',  event: 'blur',   label: '同时下载数' },
      { id: 'down_speed_limit',     path: ['qb_server', 'down_speed_limit'], type: 'number',  event: 'blur',   label: '下载速度限制（MB）' },
      { id: 'up_speed_limit',       path: ['qb_server', 'up_speed_limit'],   type: 'number',  event: 'blur',   label: '上传速度限制（MB）' },
      { id: 'tags',                 path: ['qb_server', 'tags'],             type: 'string',  event: 'blur',   label: 'QB标签' },
      { id: 'control_speed',        path: ['qb_server', 'control_speed'],    type: 'boolean', event: 'change', label: '是否盒子' },
      { id: 'up_queue_max',         path: ['qb_server', 'up_queue_max'],     type: 'number',  event: 'blur',   label: '最大并行上传数' },
      { id: 'up_queue_min',         path: ['qb_server', 'up_queue_min'],     type: 'number',  event: 'blur',   label: '最小并行上传数' },
      { id: 'skip_checking',        path: ['qb_server', 'skip_checking'],    type: 'boolean', event: 'change', label: '跳过校验' },
      { id: 'super_seeding',        path: ['qb_server', 'super_seeding'],    type: 'boolean', event: 'change', label: '超级做种' },

      // === CookieCloud 配置 ===
      { id: 'cc_url',               path: ['cc_server', 'url'],              type: 'string',  event: 'blur',   label: 'CC服务器地址' },
      { id: 'cc_key',               path: ['cc_server', 'key'],              type: 'string',  event: 'blur',   label: 'CC用户Key' },
      { id: 'cc_password',          path: ['cc_server', 'password'],         type: 'string',  event: 'blur',   label: 'CC端对端密码' },

      // === 图床配置 ===
      { id: 'bed_use',              path: ['image_bed', 'bed_use'],          type: 'string',  event: 'blur',   label: '图床选择' },
      { id: 'picture_type',         path: ['image_bed', 'picture_type'],     type: 'string',  event: 'blur',   label: '图片格式' },
      { id: 'pieces',               path: ['image_bed', 'pieces'],           type: 'number',  event: 'blur',   label: '截图数量' },
      { id: 'pixhost_domain',       path: ['image_bed', 'image_domain', 'pixhost'], type: 'string', event: 'blur', label: 'pixhost 自定义域名' },
      { id: 'agsvpt_token',         path: ['image_bed', 'token', 'agsvpt'],  type: 'string',  event: 'blur',   label: 'agsvpt Token' },
      { id: 'smms_token',           path: ['image_bed', 'token', 'smms'],    type: 'string',  event: 'blur',   label: 'smms Token' },
      { id: 'ptdream_token',        path: ['image_bed', 'token', 'ptdream'], type: 'string',  event: 'blur',   label: 'ptdream Token' },
      { id: 'agsvpt_email',         path: ['image_bed', 'image_bed_email', 'agsvpt'], type: 'string', event: 'blur', label: 'agsvpt 登录邮箱' },
      { id: 'agsvpt_password',      path: ['image_bed', 'image_bed_pw', 'agsvpt'],     type: 'string', event: 'blur', label: 'agsvpt 登录密码' },

      // === 企业微信通知 ===
      { id: 'qywx_is_used',         path: ['qiyeweixin', 'is_used'],         type: 'boolean', event: 'change', label: '企业微信通知' },
      { id: 'corpsecret',           path: ['qiyeweixin', 'corpsecret'],      type: 'string',  event: 'blur',   label: '企业微信公司密钥' },
      { id: 'agentid',              path: ['qiyeweixin', 'agentid'],         type: 'string',  event: 'blur',   label: '企业微信代理ID' },
      { id: 'corpid',               path: ['qiyeweixin', 'corpid'],          type: 'string',  event: 'blur',   label: '企业微信公司ID' },
      { id: 'userid',               path: ['qiyeweixin', 'userid'],          type: 'string',  event: 'blur',   label: '企业微信用户ID' },
      { id: 'mobile',               path: ['qiyeweixin', 'mobile'],          type: 'string',  event: 'blur',   label: '企业微信手机号' },

      // === 邮件通知 ===
      { id: 'email_is_used',        path: ['email', 'is_used'],              type: 'boolean', event: 'change', label: '邮件通知' },
      { id: 'SMTP_SERVER',          path: ['email', 'SMTP_SERVER'],          type: 'string',  event: 'blur',   label: 'SMTP服务器' },
      { id: 'SMTP_SSL',             path: ['email', 'SMTP_SSL'],             type: 'boolean', event: 'change', label: 'SMTP使用SSL' },
      { id: 'SMTP_EMAIL',           path: ['email', 'SMTP_EMAIL'],           type: 'string',  event: 'blur',   label: '发件邮箱' },
      { id: 'SMTP_PASSWORD',        path: ['email', 'SMTP_PASSWORD'],        type: 'string',  event: 'blur',   label: '邮箱密码' },
      { id: 'SMTP_NAME',            path: ['email', 'SMTP_NAME'],            type: 'string',  event: 'blur',   label: '发件人姓名' },

      // === IYUU 通知 ===
      { id: 'iyuu_is_used',         path: ['iyuu', 'is_used'],               type: 'boolean', event: 'change', label: 'IYUU通知' },
      { id: 'iyuu_token',           path: ['iyuu', 'iyuu_token'],            type: 'string',  event: 'blur',   label: 'IYUU Token' },
    ];

    function getByPath(obj, path) {
      return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
    }
    function setByPath(obj, path, val) {
      const parent = path.slice(0, -1).reduce((o, k) => {
        if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
        return o[k];
      }, obj);
      parent[path[path.length - 1]] = val;
    }
    function parseValue(el, type) {
      if (type === 'boolean') return el.checked;
      const v = el.value;
      // 空字符串保留为 ''（不转 undefined），避免保存时丢失原本为空的字段
      if (v == null) return '';
      if (type === 'number') return v === '' ? '' : parseInt(v, 10);
      if (type === 'float') return v === '' ? '' : parseFloat(v);
      return v;
    }

    return {
      FIELDS,
      getByPath,
      setByPath,
      parseValue,
      // 从 config 填表单（加载配置后调用）
      fill(config) {
        FIELDS.forEach((f) => {
          const el = document.getElementById(f.id);
          if (!el) return;
          const val = getByPath(config, f.path);
          if (f.type === 'boolean') el.checked = !!val;
          else el.value = (val == null ? '' : val);
        });
      },
      // 从表单读出 config（保存前调用）
      // 注意：所有 FIELDS 声明的字段都会被写出（包括空字符串），
      // 避免保存时丢失用户原本就为空的字段
      read() {
        const config = {};
        FIELDS.forEach((f) => {
          const el = document.getElementById(f.id);
          if (!el) return;
          const val = parseValue(el, f.type);
          setByPath(config, f.path, val);
        });
        return config;
      },
      // 自动绑定所有字段的 blur/change 事件
      bind() {
        FIELDS.forEach((f) => {
          const el = document.getElementById(f.id);
          if (!el) return;
          el.addEventListener(f.event, () => {
            const newCfg = state.new;
            const val = parseValue(el, f.type);
            setByPath(newCfg, f.path, val);
            state.setNew(newCfg);
          });
        });
      },
    };
  })();

  // ============================================================
  // 模块 4: sites — 站点子配置
  // ============================================================
  const sites = (() => {
    const SITE_LIST = [
      { value: 'www.agsvpt.com',     label: '末日' },
      { value: 'ubits.club',         label: '优堡' },
      { value: 'www.hdkyl.in',       label: '麒麟' },
      { value: 'carpt.net',          label: '车站' },
      { value: 'ptlgs.org',          label: '劳改所' },
      { value: 'zmpt.cc',            label: '织梦' },
      { value: 'raingfh.top',        label: '雨站' },
      { value: 'lemonhd.club',       label: '柠檬' },
      { value: 'njtupt.top',         label: '南工' },
      { value: 'pt.btschool.club',   label: '学校' },
      { value: 'www.qingwapt.com',   label: '青蛙' },
      { value: 'hdfans.org',         label: '红豆饭' },
      { value: 'hdarea.club',        label: '好大' },
      { value: 'pterclub.net',       label: '猫站' },
      { value: 'kufei.org',          label: '库非' },
      { value: 'pt.hdclone.org',     label: '克隆' },
      { value: 'rousi.zip',          label: '肉丝' },
      { value: 'www.icc2022.com',    label: '冰淇淋' },
      { value: '1ptba.com',          label: '一吧' },
      { value: 'ptsbao.club',        label: '烧包' },
      { value: 'www.devtracker.me',  label: '做我' },
      { value: 'cyanbug.net',        label: '青虫' },
      { value: 'pandapt.net',        label: '熊猫' },
      { value: 'totheglory.im',      label: '套套' },
      { value: 'www.ptzone.xyz',     label: '私区' },
      { value: 'pt.soulvoice.club',  label: '铃音' },
      { value: 'pt.0ff.cc',          label: '农场' },
      { value: 'hdhome.org',         label: '家园' },
      { value: 'hdtime.org',         label: '时光' },
      { value: 'pt.upxin.net',       label: '好多油' },
      { value: 'www.joyhd.net',      label: '开心' },
      { value: 'www.okpt.net',       label: 'OK' },
      { value: 'www.oshen.win',      label: '欧申' },
      { value: 'ptchina.org',        label: '铂金' },
      { value: 'pthome.net',         label: '高清家' },
      { value: 'ptcafe.club',        label: '咖啡' },
      { value: 'crabpt.vip',         label: '蟹黄堡' },
      { value: 'www.dragonhd.xyz',   label: '龙之家' },
      { value: 'hspt.club',          label: '回声' },
      { value: 'hdbao.cc',           label: '海宝' },
      { value: 'www.ptlover.cc',     label: '爱乐' },
      { value: 'ptfans.cc',          label: '铂粉' },
      { value: 'pt.gtkpw.xyz',       label: '搞铁' },
      { value: 'hdpt.xyz',           label: '明教' },
      { value: 'www.hitpt.com',      label: '百川' },
      { value: 'sanpro.pw',          label: '小伞' },
      { value: 'torrenthub.club',    label: '种子库' },
      { value: 'pt.xingyungept.org', label: '星陨阁' },
      { value: 'cspt.top',           label: '财神' },
      { value: 'tmpt.top',           label: '唐门' },
      { value: 'hudbt.hust.edu.cn',  label: '蝴蝶' },
      { value: 'nanyangpt.com',      label: '南洋' },
      { value: 'tjupt.org',          label: 'TJUPT' },
      { value: 'wintersakura.net',   label: '冬樱' },
      { value: 'et8.org',            label: '吹风' },
      { value: 'pt.eastgame.org',    label: '吐鲁番' },
      { value: 'hdvideo.one',        label: '海威' },
      { value: 'hdcity.city',        label: 'HDCITY' },
      { value: 'www.hddolby.com',    label: '杜比' },
      { value: '52pt.site',          label: '五二' },
      { value: 'audiences.me',       label: '人人' },
      { value: 'pt.ying.us.kg',      label: '樱花' },
      { value: 'sewerpt.com',        label: '下水道' },
      { value: 'lemonhd.net',        label: '柠檬甜' },
      { value: 'bilibili.download',  label: '轨道炮' },
      { value: 'pt.novahd.top',      label: '新星' },
      { value: 'duckboobee.org',     label: '三月' },
      { value: 'pt.luckpt.de',       label: '幸运' },
      { value: 'pt.lajidui.top',     label: '垃圾堆' },
      { value: '13city.org',         label: '十三城' },
      { value: 'zrpt.cc',            label: '自然' },
      { value: 'www.yhpp.cc',        label: '昆仑' },
      { value: 'pt.muxuege.org',     label: '慕雪阁' },
      { value: 'cc.mypt.cc',         label: '我的' },
      { value: 'nex.jivon.de',       label: '幻境' },
      { value: 'sbpt.link',          label: '沙比' },
      { value: 'pt.aling.de',        label: '爱玲' },
      { value: 'cangbao.ge',         label: '藏宝' },
      { value: 'dubhe.site',         label: '天枢' },
      { value: 'ptlao.top',          label: '忘年' },
      { value: 'longpt.org',         label: '长久' },
      { value: 'www.ptskit.org',     label: '铂金短' },
      { value: 'www.tangpt.top',     label: '躺平' },
      { value: 'pt.baozi.cc',        label: '包子' },
      { value: 'www.hxpt.org',       label: '好学' },
      { value: 'pt.cdy.skin',        label: '传道院' },
    ];

    const SITE_FIELDS = [
      { id: 'site_domain',   path: 'domain',   type: 'string', label: '域名映射', default: (sel) => sel },
      { id: 'site_userid',   path: 'userid',   type: 'string', label: '用户ID' },
      { id: 'site_cookie',   path: 'cookies',  type: 'string', label: 'Cookies' },
      { id: 'site_priority', path: 'priority', type: 'number', label: '优先级',   default: () => 999 },
    ];

    function getConfigFor(config, site, key) {
      if (!config || !config[key]) return undefined;
      return config[key][site];
    }

    // 切站点时调用
    function fill(config) {
      const sel = document.getElementById('site_selector').value;
      const container = document.getElementById('site_config_container');
      const forbidBtn = document.getElementById('forbidConfigBtn');
      if (!sel) {
        container.style.display = 'none';
        forbidBtn.disabled = true;
        state.setCurrentSite('');
        return;
      }
      container.style.display = 'block';
      forbidBtn.disabled = false;
      state.setCurrentSite(sel);
      // 渲染 SITE_FIELDS
      SITE_FIELDS.forEach((f) => {
        const el = document.getElementById(f.id);
        if (!el) return;
        const val = getConfigFor(config, sel, f.path);
        if (f.type === 'boolean') el.checked = !!val;
        else el.value = (val == null ? (f.default ? f.default(sel) : '') : val);
      });
    }

    // 读当前站点配置（保存前调用）
    function readCurrent() {
      const sel = state.currentSite;
      if (!sel) return {};
      const result = {};
      SITE_FIELDS.forEach((f) => {
        const el = document.getElementById(f.id);
        if (!el) return;
        if (!result[f.path]) result[f.path] = {};
        // 复用 fields.parseValue 进行类型转换，避免保存后类型与加载不一致（譬如 number 被存为字符串）
        result[f.path][sel] = fields.parseValue(el, f.type);
      });
      return result;
    }

    return { SITE_LIST, SITE_FIELDS, fill, readCurrent };
  })();

  // ============================================================
  // 模块 5: diff — 字段级 diff（含 label 展示）
  // ============================================================
  const diff = (() => {
    function deepEqual(a, b) {
      if (a === b) return true;
      // null 和 undefined 视为相等（都表示"未设置"）
      if (a == null && b == null) return true;
      if (a == null || b == null) return a === b || a === '' || b === '';
      if (typeof a !== typeof b) {
        // 空字符串与 null/undefined 视为相等（表示"未填"）
        if ((typeof a === 'string' && a === '' && (b == null || b === 0)) ||
            (typeof b === 'string' && b === '' && (a == null || a === 0))) return true;
        // 字符串数字 vs 数字（toml 解析后端是 number，前端 el.value 是 string）
        if ((typeof a === 'string' && typeof b === 'number') ||
            (typeof a === 'number' && typeof b === 'string')) {
          const na = Number(a), nb = Number(b);
          if (!isNaN(na) && !isNaN(nb) && na === nb) return true;
        }
        // 数组 vs 字符串：后端 toml 经常把 ["","",""] 序列化为 array，
        // 前端 input 的 el.value 永远是 string（数组隐式 join 转 ",,"）。
        // 按"逗号分隔元素"语义比较：",," 拆出来 = ["","","" ] 跟 ["","",""] 相等。
        // 同时把 [""] / [] / "" / null 互相视为"空"。
        if (Array.isArray(a) && typeof b === 'string') return arrStrEqual(a, b);
        if (Array.isArray(b) && typeof a === 'string') return arrStrEqual(b, a);
        return false;
      }
      if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b);
      return false;
    }

    // array vs string 语义比较（深一层展开处理 array vs array、array vs string）
    function arrStrEqual(arr, str) {
      // arr: Array, str: string
      if (str === '' && arr.every((x) => x === '')) return true;  // 全部空元素数组 == 空串
      const parts = str.split(',');  // 单元素数组 'foo' split = ['foo']，刚好相等
      // 长度不等 → 不等（避免 'a,b' 跟 ['a','b','c'] 误判）
      if (parts.length !== arr.length) return false;
      return parts.every((p, i) => deepEqual(p, arr[i]));
    }

    function compute(oldCfg, newCfg) {
      const changes = [];
      // 1) 顶层字段（FIELDS）
      fields.FIELDS.forEach((f) => {
        const oldVal = fields.getByPath(oldCfg, f.path);
        const newVal = fields.getByPath(newCfg, f.path);
        if (!deepEqual(oldVal, newVal)) {
          changes.push({ label: f.label, oldVal, newVal });
        }
      });
      // 2) 站点配置（按站点 + 字段）
      const oldIsUsed = oldCfg.domain || {};
      const newIsUsed = newCfg.domain || {};
      const allSites = new Set([...Object.keys(oldIsUsed), ...Object.keys(newIsUsed)]);
      allSites.forEach((site) => {
        const siteInfo = sites.SITE_LIST.find((s) => s.value === site);
        const siteLabel = (siteInfo ? siteInfo.label : site);
        sites.SITE_FIELDS.forEach((f) => {
          const oldVal = oldCfg[f.path]?.[site];
          const newVal = newCfg[f.path]?.[site];
          if (!deepEqual(oldVal, newVal)) {
            changes.push({ label: `${siteLabel} - ${f.label || f.id}`, oldVal, newVal });
          }
        });
      });
      return changes;
    }

    function formatValue(val) {
      // boolean 转中文"开/关"，更符合使用者理解
      if (val === true) return '开';
      if (val === false) return '关';
      if (val === null || val === undefined) return '未设置';
      if (val === '') return '空';
      return JSON.stringify(val);
    }

    function format(changes) {
      if (changes.length === 0) return '没有配置项发生变更';
      return '以下配置项将被修改:\n\n' + changes
        .map((c) => `  ${c.label}: ${formatValue(c.oldVal)} → ${formatValue(c.newVal)}`)
        .join('\n');
    }

    return { compute, format };
  })();

  // ============================================================
  // 模块 6: forbid — 禁转设置 modal
  // ============================================================
  const forbid = (() => {
    const FIELDS = ['word', 'type', 'standard', 'tag'];
    const LABELS = { word: '关键词', type: '类型', standard: '分辨率', tag: '标签' };

    function getByPath(obj, path) {
      return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
    }

    // 解析逗号分隔的字符串为数组（去空）
    function parseArray(str) {
      return (str || '').split(',').map((s) => s.trim()).filter(Boolean);
    }

    // 把数组转成逗号分隔的字符串
    function arrayToStr(arr) {
      if (!Array.isArray(arr)) return '';
      return arr.join(',');
    }

    // 打开 modal：从后端拉当前站点的禁转配置
    async function open() {
      const sel = state.currentSite;
      if (!sel) {
        void window.alertModal('请先选择一个站点');
        return;
      }
      // 先清空表单
      FIELDS.forEach((k) => {
        const el = document.getElementById(`forbid_${k}`);
        if (el) el.value = '';
      });

      const r = await api.getForbid(sel);
      if (!r.ok) {
        void window.alertModal('获取禁转配置失败: ' + r.error);
        return;
      }
      // r.data 可能是 { forbid: { word, type, standard, tag } } 或直接就是 forbid 对象
      const cfg = (r.data && r.data.forbid) ? r.data.forbid : (r.data || {});
      state.setForbid(cfg);
      FIELDS.forEach((k) => {
        const el = document.getElementById(`forbid_${k}`);
        if (el) el.value = arrayToStr(cfg[k]);
      });
      document.getElementById('forbidModal').classList.add('open');
    }

    function close() {
      document.getElementById('forbidModal').classList.remove('open');
    }

    // 保存禁转配置
    async function save() {
      const sel = state.currentSite;
      if (!sel) {
        void window.alertModal('未选择站点');
        return;
      }
      const forbidObj = {};
      FIELDS.forEach((k) => {
        forbidObj[k] = parseArray(document.getElementById(`forbid_${k}`).value);
      });
      const r = await api.setForbid(sel, { forbid: forbidObj });
      if (!r.ok) {
        void window.alertModal('保存失败: ' + r.error);
        return;
      }
      void window.alertModal(r.data || '禁转配置保存成功');
      close();
    }

    return { open, close, save };
  })();

  // ============================================================
  // 模块 7: mergeDeep — 合并对象（保存时用）
  // ============================================================
  function mergeDeep(target, source) {
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  // ============================================================
  // 模块 8: actions — 5 个按钮 + 站点切换
  // ============================================================
  const actions = {
    getPassword() {
      return document.getElementById('adminPassword').value;
    },

    async load() {
      const pw = actions.getPassword();
      if (!pw) { void window.alertModal('请输入密码后再加载配置'); return; }
      const r = await api.getConfig(pw);
      if (!r.ok) { void window.alertModal('加载配置失败: ' + r.error); return; }
      state.init(r.data);
      fields.fill(state.new);
      sites.fill(state.new);
      document.getElementById('configForm').style.display = 'block';
    },

    async save() {
      const pw = actions.getPassword();
      if (!pw) { void window.alertModal('请输入密码后再保存配置'); return; }
      // 重新读一次表单（确保拿到最新值，不依赖实时 bind 的中间态）
      const formCfg = fields.read();
      const siteCfg = sites.readCurrent();
      // 以 state.old 为基线 deep-clone，这样所有 80 个站点的原有字段都保留，
      // 避免 sites.readCurrent() 只输出当前选中站点，导致其他站点在 diff 中误报
      const newCfg = JSON.parse(JSON.stringify(state.old));
      mergeDeep(newCfg, formCfg);
      mergeDeep(newCfg, siteCfg);
      const changes = diff.compute(state.old, newCfg);
      const ok = await window.confirmModal({
        message: diff.format(changes) + '\n\n确认保存这些更改吗？',
        confirmText: '保存', cancelText: '取消', danger: true,
      });
      if (!ok) return;
      const r = await api.setConfig(pw, newCfg);
      if (!r.ok) { void window.alertModal('配置保存失败: ' + r.error); return; }
      state.setNew(newCfg);
      state.commitChanges();
      void window.alertModal('配置已保存');
    },

    async backup() {
      const ok = await window.confirmModal({
        message: '确定要备份当前配置吗？',
        confirmText: '备份', cancelText: '取消',
      });
      if (!ok) return;
      const r = await api.backup();
      void window.alertModal(r.ok ? (r.data || '备份成功') : '配置备份失败: ' + r.error);
    },

    async restore() {
      const ok = await window.confirmModal({
        message: '确定要从备份恢复配置吗？这将覆盖当前的所有配置！',
        confirmText: '恢复', cancelText: '取消', danger: true,
      });
      if (!ok) return;
      const r = await api.restore();
      if (!r.ok) { void window.alertModal('配置恢复失败: ' + r.error); return; }
      void window.alertModal('配置恢复成功！页面将重新加载以应用配置。');
      location.reload();
    },

    async syncCookieCloud() {
      const r = await api.syncCookieCloud();
      if (!r.ok) { void window.alertModal('同步失败: ' + r.error); return; }
      void window.alertModal(r.data || '同步成功，确定后页面将刷新');
      location.reload();
    },
  };

  // ============================================================
  // 模块 9: bind — 启动时绑定所有事件
  // ============================================================
  function bind() {
    // 5 个顶部按钮
    document.getElementById('loadBtn').addEventListener('click', actions.load);
    document.getElementById('saveBtn').addEventListener('click', actions.save);
    document.getElementById('backupBtn').addEventListener('click', actions.backup);
    document.getElementById('restoreBtn').addEventListener('click', actions.restore);
    document.getElementById('forceSync').addEventListener('click', actions.syncCookieCloud);
    // 返回首页按钮
    const backBtn = document.querySelector('.back-button');
    if (backBtn) backBtn.addEventListener('click', () => { window.location.href = '/'; });

    // 站点选择器
    document.getElementById('site_selector').addEventListener('change', function () {
      // 先把上一个站点的修改保存到 newConfig
      const previous = state.currentSite;
      if (previous) {
        const siteCfg = sites.readCurrent();
        mergeDeep(state.new, siteCfg);
      }
      sites.fill(state.new);
    });

    // 禁转设置 modal
    document.getElementById('forbidConfigBtn').addEventListener('click', forbid.open);
    document.getElementById('forbidSaveBtn').addEventListener('click', forbid.save);
    const forbidCloseBtn = document.getElementById('forbidCloseBtn');
    if (forbidCloseBtn) forbidCloseBtn.addEventListener('click', forbid.close);
    // 点击 modal 外部关闭
    const forbidModal = document.getElementById('forbidModal');
    if (forbidModal) {
      forbidModal.addEventListener('click', (e) => {
        if (e.target === forbidModal) forbid.close();
      });
    }

    // 顶部固定按钮条 → 给 container 留出 margin（与原版行为一致）
    const fixedButtons = document.querySelector('.fixed-top-buttons');
    const container = document.querySelector('.container');
    if (fixedButtons && container) {
      const buttonsHeight = fixedButtons.offsetHeight;
      container.style.marginTop = (buttonsHeight + 20) + 'px';
    }

    // 所有 FIELDS 表声明的字段自动绑定
    fields.bind();
  }

  // ============================================================
  // 模块 10: init
  // ============================================================
  function init() {
    bind();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
