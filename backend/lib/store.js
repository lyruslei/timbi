// The only file that talks to Supabase.

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
    async getEntries(day) {
      return must(await supabase.from('entries').select('food, qty, kcal, protein, carbs, fat').eq('day', day).order('created_at'));
    },
    async addEntries(day, items) {
      must(await supabase.from('entries').insert(items.map((it) => ({ day, ...it }))));
    },
    async getMessages(day) {
      return must(await supabase.from('messages').select('role, text').eq('day', day).order('created_at').order('id'));
    },
    async addMessages(day, msgs) {
      must(await supabase.from('messages').insert(msgs.map((m) => ({ day, role: m.role, text: m.text }))));
    },
  };
}
