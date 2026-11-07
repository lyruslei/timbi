// The only file that talks to Supabase.
import { HttpError } from './http.js';

const MY_FOOD_COLS = 'id, name, serving, kcal, protein, carbs, fat, fiber, sugar, sat_fat, sodium, cholesterol, potassium';

export function createStore(supabase) {
  const must = ({ data, error }) => {
    if (error) throw new Error(`Supabase: ${error.message}`);
    return data;
  };

  return {
    async getGoals() {
      const g = must(await supabase.from('goals').select('kcal, protein, carbs, fat').eq('id', 1).single());
      return { kcal: g.kcal, protein: g.protein, carbs: g.carbs, fat: g.fat };
    },
    async setGoals(g) {
      must(await supabase.from('goals').update({ kcal: g.kcal, protein: g.protein, carbs: g.carbs, fat: g.fat }).eq('id', 1));
    },
    // One transaction: see log_turn in supabase/schema.sql.
    async logTurn(day, { items, goals, messages }) {
      must(await supabase.rpc('log_turn', { p_day: day, p_items: items, p_goals: goals, p_messages: messages }));
    },
    async getEntries(day) {
      return must(await supabase.from('entries')
        .select('id, food, qty, kcal, protein, carbs, fat, fiber, sugar, sat_fat, sodium, cholesterol, potassium')
        .eq('day', day).order('created_at').order('id'));
    },
    async moveEntries(ids, day) {
      return must(await supabase.from('entries').update({ day }).in('id', ids).select('id')).length;
    },
    async removeEntries(ids) {
      return must(await supabase.from('entries').delete().in('id', ids).select('id')).length;
    },
    async getLoggedDays(fromDay, toDay) {
      const rows = must(await supabase.rpc('logged_days', { p_from: fromDay, p_to: toDay }));
      return rows.map((r) => (typeof r === 'string' ? r : r.logged_days));
    },
    async listMyFoods() {
      return must(await supabase.from('my_foods').select(MY_FOOD_COLS).order('name'));
    },
    async getMyFoods(ids) {
      return must(await supabase.from('my_foods').select(MY_FOOD_COLS).in('id', ids));
    },
    async addMyFood(food) {
      const r = await supabase.from('my_foods').insert(food).select(MY_FOOD_COLS).single();
      if (r.error?.code === '23505') throw new HttpError(409, `You already have a food called ${food.name}`);
      return must(r);
    },
    async updateMyFood(id, food) {
      const r = await supabase.from('my_foods').update({ ...food, updated_at: new Date().toISOString() }).eq('id', id).select(MY_FOOD_COLS).single();
      if (r.error?.code === '23505') throw new HttpError(409, `You already have a food called ${food.name}`);
      return must(r);
    },
    async removeMyFoods(ids) {
      return must(await supabase.from('my_foods').delete().in('id', ids).select('id')).length;
    },
    async getMessages(day) {
      return must(await supabase.from('messages').select('role, text').eq('day', day).order('created_at').order('id'));
    },
  };
}
