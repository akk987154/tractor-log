import { describe, it, expect } from 'vitest';
import { computeDueItems, INTERVALS, typeLabels } from './db.js';

// 这些测试锁住两件事：
// 1. 每一类"可选择的保养类型"都必须有周期条目，否则用户记录了却永远收不到提醒
//    （原实现只有 5 个类型有条目，轮胎/电瓶/皮带三类静默失效）
// 2. 到期分级口径与 README 一致：剩余 ≤ 周期 10% 视为即将到期，
//    剩余 < 0 为超期，剩余 < -周期 为严重超期
//
// 注意：computeDueItems 会对 INTERVALS 里的每一种类型都做计算 —— 一台从未保养过的
// 机器会同时命中多项，这是正确行为。因此断言一律按 type 过滤后再做。

const TRACTOR = { id: 1, name: '主力拖拉机', currentHours: 0 };

/** 构造"某种类型是否到期"的最小场景 */
function dueFor(type, lastHours, currentHours) {
  return computeDueItems(
    [{ ...TRACTOR, currentHours }],
    [{ tractorId: 1, type, hours: lastHours, date: '2024-01-01' }]
  ).filter((i) => i.type === type);
}

describe('INTERVALS 与 typeLabels 的一致性', () => {
  it('除 other 外，所有可选择的保养类型都必须有建议周期', () => {
    const missing = Object.keys(typeLabels).filter((t) => t !== 'other' && !(t in INTERVALS));

    expect(missing, `以下类型可以记录但不会产生提醒：${missing.join(', ')}`).toEqual([]);
  });

  it('INTERVALS 里的类型都必须是合法的可选择类型', () => {
    for (const type of Object.keys(INTERVALS)) {
      expect(typeLabels[type], `${type} 缺中文名`).toBeTruthy();
    }
  });
});

describe('computeDueItems', () => {
  it('所有 8 种有周期的保养类型都能产生提醒（回归：原来只有 5 种）', () => {
    const types = Object.keys(INTERVALS);
    const maint = types.map((type) => ({ tractorId: 1, type, hours: 0, date: '2024-01-01' }));

    const items = computeDueItems([{ ...TRACTOR, currentHours: 1_000_000 }], maint);

    expect(items.map((i) => i.type).sort()).toEqual([...types].sort());
  });

  it('"other" 类型不参与到期计算', () => {
    const maint = [{ tractorId: 1, type: 'other', hours: 0, date: '2024-01-01' }];
    const items = computeDueItems([{ ...TRACTOR, currentHours: 1_000_000 }], maint);

    expect(items.every((i) => i.type !== 'other')).toBe(true);
    expect(items.some((i) => i.typeLabel === typeLabels.other)).toBe(false);
  });

  it('剩余超过周期 10% 时不提醒', () => {
    // 机油周期 250，阈值 25。上次保养 0h，当前 180h → 剩余 70
    expect(dueFor('oil', 0, 180)).toEqual([]);
  });

  it('剩余恰好等于周期 10% 时提醒（边界包含）', () => {
    // 剩余 25 === 250 * 0.1
    const oil = dueFor('oil', 0, 225);

    expect(oil).toHaveLength(1);
    expect(oil[0].remaining).toBe(25);
    expect(oil[0].overdue).toBe(false);
    expect(oil[0].severe).toBe(false);
  });

  it('超期与严重超期分级正确', () => {
    // 剩余 -150：已超期，但未超出整整一个周期（250）
    const overdue = dueFor('oil', 0, 400);
    expect(overdue[0].remaining).toBe(-150);
    expect(overdue[0].overdue).toBe(true);
    expect(overdue[0].severe).toBe(false);

    // 剩余 -350 < -250：严重超期
    const severe = dueFor('oil', 0, 600);
    expect(severe[0].remaining).toBe(-350);
    expect(severe[0].overdue).toBe(true);
    expect(severe[0].severe).toBe(true);
  });

  it('取同一类型下小时数最大的记录作为上次保养', () => {
    const oil = computeDueItems(
      [{ ...TRACTOR, currentHours: 1440 }],
      [
        { tractorId: 1, type: 'oil', hours: 500, date: '2024-01-01' },
        { tractorId: 1, type: 'oil', hours: 1200, date: '2024-06-01' },
        { tractorId: 1, type: 'oil', hours: 900, date: '2024-03-01' },
      ]
    ).filter((i) => i.type === 'oil');

    expect(oil).toHaveLength(1);
    expect(oil[0].lastHours).toBe(1200);
    expect(oil[0].nextDue).toBe(1450);
    expect(oil[0].remaining).toBe(10);
  });

  it('currentHours 缺失或非数值时不产生 NaN', () => {
    for (const currentHours of [undefined, null, NaN, 'abc', -5]) {
      const items = computeDueItems(
        [{ id: 1, name: 'T', currentHours }],
        [{ tractorId: 1, type: 'oil', hours: 800, date: '2024-06-01' }]
      );

      for (const item of items) {
        expect(Number.isFinite(item.currentHours), `currentHours=${currentHours}`).toBe(true);
        expect(Number.isFinite(item.remaining), `currentHours=${currentHours}`).toBe(true);
        expect(Number.isFinite(item.lastHours), `currentHours=${currentHours}`).toBe(true);
      }
    }
  });

  it('非数值的 hours 记录被忽略，不会污染计算', () => {
    const oil = computeDueItems(
      [{ ...TRACTOR, currentHours: 545 }],
      [
        { tractorId: 1, type: 'oil', hours: 'x', date: '2024-01-01' },
        { tractorId: 1, type: 'oil', hours: 300, date: '2024-06-01' },
      ]
    ).filter((i) => i.type === 'oil');

    expect(oil).toHaveLength(1);
    expect(oil[0].lastHours).toBe(300);
    expect(oil[0].remaining).toBe(5);
  });

  it('只统计归属于该农机的记录', () => {
    const items = computeDueItems(
      [
        { id: 1, name: 'A', currentHours: 240 },
        { id: 2, name: 'B', currentHours: 240 },
      ],
      [
        { tractorId: 1, type: 'oil', hours: 0, date: '2024-01-01' },
        { tractorId: 2, type: 'oil', hours: 9999, date: '2024-01-01' },
      ]
    );

    // 农机 1：上次 0h → 剩余 10，应提醒
    const a = items.filter((i) => i.type === 'oil' && i.tractorId === 1);
    expect(a).toHaveLength(1);
    expect(a[0].lastHours).toBe(0);

    // 农机 2：上次 9999h → 剩余 250，未到期。若串了数据这里会错误地冒出一条
    expect(items.filter((i) => i.type === 'oil' && i.tractorId === 2)).toEqual([]);
  });

  it('结果按剩余小时升序排列，最紧急的排在最前', () => {
    const maint = Object.keys(INTERVALS).map((type) => ({
      tractorId: 1,
      type,
      hours: 0,
      date: '2024-01-01',
    }));
    const items = computeDueItems([{ ...TRACTOR, currentHours: 3000 }], maint);

    expect(items.length).toBeGreaterThan(1);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].remaining).toBeGreaterThanOrEqual(items[i - 1].remaining);
    }
  });
});
