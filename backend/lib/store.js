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
    // One transaction: see log_turn in supabase/schema.sql.
    async logTurn(day, { items, goals, messages }) {
      must(await supabase.rpc('log_turn', { p_day: day, p_items: items, p_goals: goals, p_messages: messages }));
    },
    async getEntries(day) {
      return must(await supabase.from('entries').select('food, qty, kcal, protein, carbs, fat').eq('day', day).order('created_at'));
    },
    async getMessages(day) {
      return must(await supabase.from('messages').select('role, text').eq('day', day).order('created_at').order('id'));
    },
  };
}
