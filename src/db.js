const DB_NAME = 'tractorlog';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Tractor CRUD
export async function getTractors() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('tractors', 'readonly');
    const store = tx.objectStore('tractors');
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function addTractor(tractor) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('tractors', 'readwrite');
    const store = tx.objectStore('tractors');
    const req = store.add({ ...tractor, createdAt: new Date().toISOString() });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function deleteTractor(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('tractors', 'readwrite');
    tx.objectStore('tractors').delete(id);
    const mt = db.transaction('maintenance', 'readwrite');
    const idx = mt.objectStore('maintenance').index('tractorId');
    const cursorReq = idx.openCursor(IDBKeyRange.only(id));
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// Maintenance CRUD
export async function getMaintenance(tractorId = null) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('maintenance', 'readonly');
    const store = tx.objectStore('maintenance');
    let req;
    if (tractorId !== null) {
      req = store.index('tractorId').getAll(IDBKeyRange.only(tractorId));
    } else {
      req = store.getAll();
    }
    req.onsuccess = () => res(req.result.sort((a, b) => b.date?.localeCompare(a.date)));
    req.onerror = () => rej(req.error);
  });
}

export async function addMaintenance(record) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('maintenance', 'readwrite');
    const store = tx.objectStore('maintenance');
    const req = store.add({ ...record, createdAt: new Date().toISOString() });
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
  });
}

// Check for overdue maintenance
export async function getDueSoon(thresholdHours = 50) {
  const db = await openDB();
  const tractors = await getTractors();
  const allMaint = await getMaintenance();
  const dueItems = [];

  for (const tractor of tractors) {
    const maint = allMaint.filter(m => m.tractorId === tractor.id);
    const lastByType = {};
    for (const m of maint) {
      if (m.hours && (!lastByType[m.type] || m.hours > lastByType[m.type].hours)) {
        lastByType[m.type] = m;
      }
    }

    const intervals = { oil: 250, filter: 500, hydraulic: 1000, transmission: 1500, grease: 50 };
    for (const [type, interval] of Object.entries(intervals)) {
      const last = lastByType[type];
      const lastHours = last?.hours || 0;
      const currentHours = tractor.currentHours || lastHours;
      const nextDue = lastHours + interval;
      const remaining = nextDue - currentHours;
      if (remaining <= thresholdHours) {
        dueItems.push({
          tractorId: tractor.id,
          tractorName: tractor.name,
          type,
          typeLabel: typeLabels[type],
          lastHours,
          currentHours,
          nextDue,
          remaining,
          interval,
          overdue: remaining < 0,
        });
      }
    }
  }
  return dueItems.sort((a, b) => a.remaining - b.remaining);
}

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

export { typeLabels };
