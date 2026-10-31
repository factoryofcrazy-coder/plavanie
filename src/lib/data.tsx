import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { disciplineKey, type Course, type Stroke } from './format';

export interface Athlete {
  id: number;
  key: string;
  first_name: string;
  last_name: string;
  gender: 'F' | 'M';
  birth_year: number | null;
  club: string | null;
}
export interface Swim {
  id: number;
  meet_id: number | null;
  event_number: number | null;
  athlete_id: number;
  race_date: string;
  course: Course;
  stroke: Stroke;
  distance: number;
  swim_ms: number | null;
  status: string | null;
  points: number | null;
  reaction_ms: number | null;
  splits: { d: number; ms: number }[] | null;
  agegroup: string | null;
  club: string | null;
  competition: string | null;
  notes: string | null;
  meets?: { name: string; city: string | null } | null;
}
export interface Goal {
  id: number;
  stroke: string;
  distance: number;
  pool_length: number;
  course: string | null;
  target_ms: number;
  label: string | null;
  target_date: string | null;
}

export const SWIM_COLS =
  'id,meet_id,event_number,athlete_id,race_date,course,stroke,distance,swim_ms,status,points,reaction_ms,splits,agegroup,club,competition,notes,meets(name,city)';

export async function fetchSwims(athleteId: number): Promise<Swim[]> {
  const { data, error } = await supabase
    .from('swims')
    .select(SWIM_COLS)
    .eq('athlete_id', athleteId)
    .order('race_date', { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as unknown as Swim[];
}

export interface PB {
  key: string;
  stroke: Stroke;
  distance: number;
  course: Course;
  best: Swim;
  count: number;
  history: Swim[];
}

export function computePBs(swims: Swim[]): PB[] {
  const map = new Map<string, PB>();
  for (const s of swims) {
    if (s.status || !s.swim_ms) continue;
    const k = disciplineKey(s.stroke, s.distance, s.course);
    const pb = map.get(k);
    if (!pb) map.set(k, { key: k, stroke: s.stroke, distance: s.distance, course: s.course, best: s, count: 1, history: [s] });
    else {
      pb.count++;
      pb.history.push(s);
      if (s.swim_ms < pb.best.swim_ms!) pb.best = s;
    }
  }
  const order = ['FREE', 'BACK', 'BREAST', 'FLY', 'MEDLEY'];
  return [...map.values()].sort(
    (a, b) => order.indexOf(a.stroke) - order.indexOf(b.stroke) || a.distance - b.distance || a.course.localeCompare(b.course),
  );
}

interface Ctx {
  loading: boolean;
  error: string | null;
  athlete: Athlete | null;
  displayName: string;
  swims: Swim[];
  pbs: PB[];
  goals: Goal[];
  session: Session | null;
  isEditor: boolean;
  reload: () => Promise<void>;
}
const DataCtx = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [displayName, setDisplayName] = useState('Kristínka Hodoňová');
  const [swims, setSwims] = useState<Swim[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isEditor, setIsEditor] = useState(false);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const { data: settings } = await supabase.from('settings').select('key,value');
      const s = Object.fromEntries((settings ?? []).map((r: any) => [r.key, r.value]));
      if (s.main_athlete_name) setDisplayName(s.main_athlete_name);
      const { data: a } = await supabase.from('athletes').select('*').eq('key', s.main_athlete_key ?? '').maybeSingle();
      setAthlete((a as Athlete) ?? null);
      setSwims(a ? await fetchSwims(a.id) : []);
      const { data: g } = await supabase.from('goals').select('*').order('distance');
      setGoals((g as Goal[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Nepodarilo sa načítať dáta');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [reload]);

  useEffect(() => {
    if (!session?.user?.email) return setIsEditor(false);
    supabase
      .from('editors')
      .select('email')
      .ilike('email', session.user.email)
      .maybeSingle()
      .then(({ data }) => setIsEditor(!!data));
  }, [session]);

  const pbs = useMemo(() => computePBs(swims), [swims]);
  return (
    <DataCtx.Provider value={{ loading, error, athlete, displayName, swims, pbs, goals, session, isEditor, reload }}>
      {children}
    </DataCtx.Provider>
  );
}

export function useData() {
  const c = useContext(DataCtx);
  if (!c) throw new Error('DataProvider chýba');
  return c;
}
