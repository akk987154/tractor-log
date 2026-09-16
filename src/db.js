const DB_NAME = 'tractorlog';
const DB_VERSION = 1;

// 保养类型的中文名与建议周期（小时）。
// 注意：INTERVALS 必须覆盖所有可选择的类型，否则用户记录的那类保养永远不会产生提醒。
// 之前只有 5 个类型有条目，导致"轮胎检查 / 电瓶检查 / 皮带更换"三类虽然能记录却从不提醒。
const typeLabels = {
  oil: '机油更换',
  filter: '滤芯更换',
  hydraulic: '液压油更换',
  transmission: '变速箱保养',
  grease: '润滑',
  tire: '轮胎检查',
  battery: '电瓶检查',
  belt: '皮带更换',
  other: '其他',
};

// 建议保养周期（小时）。'other' 不设周期，因此不参与到期计算。
const INTERVALS = {
  oil: 250,
  filter: 500,
  hydraulic: 1000,
  transmission: 1500,
  grease: 50,
  tire: 500,
  battery: 1000,
  belt: 1000,
};

// 到期判定：剩余 <= 周期的 10%
const DUE_RATIO = 0.1;

// 单例连接。原实现每次操作都 indexedDB.open() 且从不 close()，
// 而 loadData() 一次就会开 3 个连接并在每次增删后重复调用，长驻 PWA 中会持续累积。
let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('tractors')) {
          const tractorStore = db.createObjectStore('tractors', { keyPath: 'id', autoIncrement: true });
          tractorStore.createIndex('name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains('maintenance')) {
          const maintStore = db.createObjectStore('maintenance', { keyPath: 'id', autoIncrement: true });
          maintStore.createIndex('tractorId', 'tractorId', { unique: false });
          maintStore.createIndex('date', 'date', { unique: false });
          maintStore.createIndex('type', 'type', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // 其它标签页触发了版本升级时，主动让出连接，否则对方会一直卡在 onblocked
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
      // 原实现没有处理 onblocked：多标签页场景下版本升级会无限期挂起且没有任何提示
      req.onblocked = () => {
        dbPromise = null;
        reject(new Error('数据库正被其它标签页占用，请关闭其它 TractorLog 页面后重试'));
      };
    });
  }
  return dbPromise;
}

/** 请求持久化存储，降低浏览器在存储紧张时清空全部保养记录的风险 */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// Tractor CRUD
export async function getTractors() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('tractors', 'readonly');
    const req = tx.objectStore('tractors').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function addTractor(tractor) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('tractors', 'readwrite');
    const req = tx.objectStore('tractors').add({ ...tractor, createdAt: new Date().toISOString() });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

/**
 * 局部更新一台农机。
 * 存在的意义是让 App.vue 不必自己 indexedDB.open('tractorlog', 1) ——
 * 那种写法把数据库名和版本号复制到了组件里，一旦 db.js 升版就会静默失效。
 */
export async function updateTractor(id, patch) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('tractors', 'readwrite');
    const store = tx.objectStore('tractors');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const current = getReq.result;
      if (current) store.put({ ...current, ...patch, id });
    };
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

/**
 * 删除农机并级联删除其维护记录。
 * 必须在同一个事务里跨两个 store 完成：原实现开了两个独立事务，
 * 却在 tractors 事务的 oncomplete 上 resolve，导致维护记录的游标可能还没走完
 * 调用方就已经 loadData() 了，界面会残留记录；标签页提前关闭则留下孤儿数据。
 */
export async function deleteTractor(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(['tractors', 'maintenance'], 'readwrite');
    tx.objectStore('tractors').delete(id);

    const cursorReq = tx.objectStore('maintenance').index('tractorId').openCursor(IDBKeyRange.only(id));
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

// Maintenance CRUD
export async function getMaintenance(tractorId = null) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('maintenance', 'readonly');
    const store = tx.objectStore('maintenance');
    const req =
      tractorId !== null
        ? store.index('tractorId').getAll(IDBKeyRange.only(tractorId))
        : store.getAll();
    req.onsuccess = () =>
      res(req.result.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))));
    req.onerror = () => rej(req.error);
  });
}

export async function addMaintenance(record) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('maintenance', 'readwrite');
    const req = tx.objectStore('maintenance').add({ ...record, createdAt: new Date().toISOString() });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function deleteMaintenance(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('maintenance', 'readwrite');
    tx.objectStore('maintenance').delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

/** 小时数是否为有效数值（0 是合法读数，不能用真值判断过滤掉） */
function isValidHours(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * 纯函数：根据农机与维护记录计算到期项目。
 * 抽出来是为了能脱离 IndexedDB 做单元测试 —— 周期表与阈值判定正是之前出问题的地方
 * （只有 5 个类型有条目，导致另外 3 类保养永远不会提醒）。
 */
export function computeDueItems(tractors, allMaint) {
  const dueItems = [];

  for (const tractor of tractors) {
    const maint = allMaint.filter((m) => m.tractorId === tractor.id);

    // 用 Map 而不是普通对象：db 中的 type 字段若被篡改为 "__proto__"，
    // 对普通对象赋值会命中原型 setter 而不是创建属性
    const lastByType = new Map();
    for (const m of maint) {
      if (!isValidHours(m.hours)) continue;
      const prev = lastByType.get(m.type);
      if (!prev || m.hours > prev.hours) lastByType.set(m.type, m);
    }

    for (const [type, interval] of Object.entries(INTERVALS)) {
      const last = lastByType.get(type);
      const lastHours = isValidHours(last?.hours) ? last.hours : 0;
      // 读数不应早于最后一次保养，否则用 currentHours 为 0/未填时退回 lastHours
      const recorded = isValidHours(tractor.currentHours) ? tractor.currentHours : 0;
      const currentHours = Math.max(recorded, lastHours);

      const nextDue = lastHours + interval;
      const remaining = nextDue - currentHours;
      const dueThreshold = interval * DUE_RATIO;

      if (remaining > dueThreshold) continue;

      dueItems.push({
        tractorId: tractor.id,
        tractorName: tractor.name,
        type,
        typeLabel: typeLabels[type] || type,
        lastHours,
        currentHours,
        nextDue,
        remaining,
        interval,
        overdue: remaining < 0,
        severe: remaining < -interval,
      });
    }
  }

  return dueItems.sort((a, b) => a.remaining - b.remaining);
}

/**
 * 计算即将到期 / 已超期的保养项目。
 *
 * 判定口径（与 README 一致）：
 *   即将到期：剩余 <= 周期的 10%
 *   已超期：  剩余 < 0
 *   严重超期：剩余 < -周期
 */
export async function getDueSoon() {
  const tractors = await getTractors();
  const allMaint = await getMaintenance();
  return computeDueItems(tractors, allMaint);
}

export { typeLabels, INTERVALS };
