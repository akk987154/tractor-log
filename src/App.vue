<script setup>
import { ref, onMounted } from 'vue'
import { getTractors, addTractor, deleteTractor, getMaintenance, addMaintenance, deleteMaintenance, getDueSoon, typeLabels } from './db.js'

const tractors = ref([])
const maintenance = ref([])
const dueItems = ref([])
const tab = ref('log')

const showAddTractor = ref(false)
const newTractor = ref({ name: '', brand: '', model: '', year: 2022, currentHours: 0 })

const showAddMaint = ref(false)
const newMaint = ref({
  tractorId: null, type: 'oil', date: new Date().toISOString().split('T')[0],
  hours: 0, cost: 0, notes: '', parts: ''
})

const tabs = [
  { key: 'log', label: '📋 维护日志' },
  { key: 'tractors', label: '🚜 农机管理' },
  { key: 'alerts', label: '🔔 保养提醒' },
]

async function loadData() {
  tractors.value = await getTractors()
  maintenance.value = await getMaintenance()
  dueItems.value = await getDueSoon()
}

async function handleAddTractor() {
  if (!newTractor.value.name) return
  await addTractor(newTractor.value)
  newTractor.value = { name: '', brand: '', model: '', year: 2022, currentHours: 0 }
  showAddTractor.value = false
  await loadData()
}

async function handleDeleteTractor(id) {
  if (!confirm('确定删除该农机及其所有维护记录吗？')) return
  await deleteTractor(id)
  await loadData()
}

async function handleAddMaint() {
  if (!newMaint.value.tractorId) return
  const tid = Number(newMaint.value.tractorId)
  await addMaintenance({ ...newMaint.value, tractorId: tid })
  const t = tractors.value.find(tr => tr.id === tid)
  if (t) {
    const idx = indexedDB.open('tractorlog', 1)
    idx.onsuccess = () => {
      const db = idx.result
      const tx = db.transaction('tractors', 'readwrite')
      tx.objectStore('tractors').put({ ...t, currentHours: Number(newMaint.value.hours) || t.currentHours })
    }
  }
  newMaint.value = { tractorId: tid, type: 'oil', date: new Date().toISOString().split('T')[0], hours: 0, cost: 0, notes: '', parts: '' }
  showAddMaint.value = false
  await loadData()
}

async function handleDeleteMaint(id) {
  if (!confirm('确定删除该记录？')) return
  await deleteMaintenance(id)
  await loadData()
}

function getTractorName(id) {
  const t = tractors.value.find(tr => tr.id === id)
  return t ? `${t.name} (${t.brand} ${t.model})` : '未知农机'
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('zh-CN') : '' }

onMounted(loadData)
</script>

<template>
  <div class="app">
    <header>
      <h1>🚜 TractorLog</h1>
      <p>农机维护日志 · 离线可用 · 数据存于本地</p>
    </header>

    <nav class="tabs-bar">
      <button v-for="t in tabs" :key="t.key" class="tb" :class="{ active: tab === t.key }" @click="tab = t.key">
        {{ t.label }}
      </button>
    </nav>

    <main>
      <!-- 维护日志 -->
      <section v-if="tab === 'log'">
        <div class="bar"><button class="btn" @click="showAddMaint = !showAddMaint">➕ 添加维护记录</button></div>

        <div v-if="showAddMaint" class="card">
          <h3>新增维护记录</h3>
          <div class="grid2">
            <label>选择农机
              <select v-model.number="newMaint.tractorId">
                <option :value="null">-- 请选择 --</option>
                <option v-for="t in tractors" :key="t.id" :value="t.id">{{ t.name }} ({{ t.brand }} {{ t.model }})</option>
              </select>
            </label>
            <label>保养类型
              <select v-model="newMaint.type">
                <option v-for="(label, key) in typeLabels" :key="key" :value="key">{{ label }}</option>
              </select>
            </label>
            <label>日期 <input type="date" v-model="newMaint.date" /></label>
            <label>小时数 <input type="number" v-model.number="newMaint.hours" /></label>
            <label>费用 (元) <input type="number" v-model.number="newMaint.cost" step="0.01" /></label>
            <label>更换零件 <input type="text" v-model="newMaint.parts" /></label>
          </div>
          <label class="full">备注 <textarea v-model="newMaint.notes" rows="2"></textarea></label>
          <div class="btns"><button class="btn" @click="handleAddMaint" :disabled="!newMaint.tractorId">保存</button><button class="btn-c" @click="showAddMaint = false">取消</button></div>
        </div>

        <div v-if="maintenance.length === 0" class="empty">📝 暂无维护记录</div>

        <div class="list">
          <div v-for="m in maintenance" :key="m.id" class="mcard">
            <div class="mrow"><span class="tag">{{ typeLabels[m.type] || m.type }}</span><span class="date">{{ fmtDate(m.date) }}</span><button class="del" @click="handleDeleteMaint(m.id)">🗑️</button></div>
            <div class="mbody">
              <p><strong>农机:</strong> {{ getTractorName(m.tractorId) }}</p>
              <p v-if="m.hours"><strong>时数:</strong> {{ m.hours }}h</p>
              <p v-if="m.cost"><strong>费用:</strong> ¥{{ m.cost }}</p>
              <p v-if="m.parts"><strong>零件:</strong> {{ m.parts }}</p>
              <p v-if="m.notes" class="nt">{{ m.notes }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 农机管理 -->
      <section v-if="tab === 'tractors'">
        <div class="bar"><button class="btn" @click="showAddTractor = !showAddTractor">➕ 添加农机</button></div>

        <div v-if="showAddTractor" class="card">
          <h3>添加农机</h3>
          <div class="grid2">
            <label>名称* <input type="text" v-model="newTractor.name" placeholder="如：主力拖拉机" /></label>
            <label>品牌 <input type="text" v-model="newTractor.brand" placeholder="如：John Deere" /></label>
            <label>型号 <input type="text" v-model="newTractor.model" placeholder="如：6110M" /></label>
            <label>年份 <input type="number" v-model.number="newTractor.year" /></label>
            <label>当前小时数 <input type="number" v-model.number="newTractor.currentHours" /></label>
          </div>
          <div class="btns"><button class="btn" @click="handleAddTractor" :disabled="!newTractor.name">保存</button><button class="btn-c" @click="showAddTractor = false">取消</button></div>
        </div>

        <div v-if="tractors.length === 0" class="empty">🚜 暂无农机</div>

        <div class="grid2">
          <div v-for="t in tractors" :key="t.id" class="tcard">
            <div class="mrow"><strong>{{ t.name }}</strong><button class="del" @click="handleDeleteTractor(t.id)">🗑️</button></div>
            <p>{{ t.brand }} {{ t.model }}</p>
            <p>{{ t.year }}年 · {{ t.currentHours?.toLocaleString() || 0 }}h</p>
          </div>
        </div>
      </section>

      <!-- 保养提醒 -->
      <section v-if="tab === 'alerts'">
        <h2>🔔 保养提醒</h2>
        <p class="sub">基于当前小时数和保养周期自动计算</p>
        <div v-if="dueItems.length === 0" class="empty">✅ 所有保养项目均未到期</div>
        <div class="list">
          <div v-for="item in dueItems" :key="`${item.tractorId}-${item.type}`" class="acard" :class="{ overdue: item.overdue }">
            <div class="mrow"><span class="tag">{{ item.tractorName }}</span><span>{{ item.typeLabel }}</span><span class="badge" :class="{ overdue: item.overdue }">{{ item.overdue ? `⚠️ 超期 ${Math.abs(item.remaining)}h` : `⏳ 剩余 ${item.remaining}h` }}</span></div>
            <div class="sub">当前 {{ item.currentHours }}h · 上次 {{ item.lastHours }}h · 周期 {{ item.interval }}h</div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; background: #fafaf5; color: #1a2e1a; }
.app { min-height: 100vh; max-width: 40rem; margin: 0 auto; padding: 0 1rem 3rem; }
header { text-align: center; padding: 2rem 0 1rem; background: linear-gradient(180deg, #f0fdf4 0%, #fafaf5 100%); }
header h1 { font-size: 1.75rem; font-weight: 800; }
header p { font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem; }
.tabs-bar { display: flex; gap: 0.5rem; justify-content: center; margin: 1rem 0; }
.tb { padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem; background: #fff; cursor: pointer; font-size: 0.8125rem; color: #6b7280; }
.tb.active { background: #16a34a; color: #fff; border-color: #16a34a; }
.bar { display: flex; justify-content: flex-end; margin-bottom: 1rem; }
.btn { background: #16a34a; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; font-weight: 500; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-c { background: #f3f4f6; border: 1px solid #d1d5db; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; }
.del { background: none; border: none; cursor: pointer; opacity: 0.4; }
.del:hover { opacity: 1; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem; margin-bottom: 1rem; }
.card h3 { font-size: 1rem; margin-bottom: 0.75rem; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
@media (max-width: 480px) { .grid2 { grid-template-columns: 1fr; } }
label { display: block; font-size: 0.75rem; color: #6b7280; margin-bottom: 0.25rem; }
label.full { grid-column: 1 / -1; }
input, select, textarea { display: block; width: 100%; margin-top: 0.125rem; padding: 0.5rem 0.625rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #16a34a; box-shadow: 0 0 0 2px rgba(22,163,74,0.15); }
.btns { margin-top: 1rem; display: flex; gap: 0.5rem; }
.empty { text-align: center; padding: 3rem 1rem; color: #9ca3af; font-size: 0.9375rem; }
.list { display: flex; flex-direction: column; gap: 0.5rem; }
.mcard { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.75rem 1rem; }
.mrow { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem; }
.tag { font-weight: 600; font-size: 0.8125rem; background: #f0fdf4; color: #16a34a; padding: 0.125rem 0.5rem; border-radius: 0.25rem; }
.date { font-size: 0.75rem; color: #9ca3af; }
.mbody p { font-size: 0.8125rem; margin-bottom: 0.125rem; }
.nt { color: #6b7280; font-style: italic; }
.tcard { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.75rem 1rem; }
.sub { font-size: 0.75rem; color: #9ca3af; margin-bottom: 1rem; }
.acard { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.75rem 1rem; }
.acard.overdue { border-color: #fca5a5; background: #fef2f2; }
.badge { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 1rem; background: #f0fdf4; color: #16a34a; }
.badge.overdue { background: #fef2f2; color: #dc2626; }
</style>
