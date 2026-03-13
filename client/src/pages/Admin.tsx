import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { MatchWithRelations, Game, Team, League, Player } from "@shared/schema";
import {
  LogIn, RefreshCw, Trash2, Pencil, Plus, Check, X,
  Shield, Gamepad2, Users, Trophy, Loader2, Tv2, Medal,
  BarChart2, Star, UserCheck, Download, UserPlus, GitBranch, Table2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── helpers ──────────────────────────────────────────────────────────────────
const TOKEN_KEY = "rivox_admin_token";
const TOKEN_EXP_KEY = "rivox_admin_token_exp";

const getToken = () => {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  const exp = Number(localStorage.getItem(TOKEN_EXP_KEY) || 0);

  if (!token) return "";
  if (exp && Date.now() > exp) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
    return "";
  }

  return token;
};

const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

async function adminFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(opts.headers || {}) },
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Error");
  }
  return res.json();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("تعذر قراءة ملف الصورة"));
    reader.readAsDataURL(file);
  });
}

function ImageSourceBadge({ source }: { source?: "auto" | "manual" | null }) {
  const isManual = source === "manual";

  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
        isManual
          ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
          : "bg-blue-500/15 border-blue-500/40 text-blue-300"
      }`}
    >
      {isManual ? "يدوية" : "تلقائية"}
    </span>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      const { token, expiresInMs } = await res.json();
      localStorage.setItem(TOKEN_KEY, token);
      if (typeof expiresInMs === "number" && Number.isFinite(expiresInMs)) {
        localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + expiresInMs));
      }
      onLogin(token);
      toast({ title: "تم الدخول بنجاح" });
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold text-white">لوحة الإدارة</h1>
        </div>
        <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1 block">كلمة المرور</label>
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white outline-none focus:border-primary transition"
              placeholder="••••••••"
              data-testid="input-admin-password"
              autoFocus
            />
          </div>
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition"
            data-testid="button-admin-login"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            دخول
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Stream URLs Input Component ───────────────────────────────────────────────
function StreamUrlsInput({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [newUrl, setNewUrl] = useState("");

  const add = () => {
    const trimmed = newUrl.trim();
    if (!trimmed || urls.includes(trimmed)) return;
    onChange([...urls, trimmed]);
    setNewUrl("");
  };

  const remove = (idx: number) => onChange(urls.filter((_, i) => i !== idx));

  const getPlatform = (url: string) => {
    if (url.includes("twitch")) return { label: "Twitch", color: "bg-purple-600/20 border-purple-500/30 text-purple-300" };
    if (url.includes("youtube")) return { label: "YouTube", color: "bg-red-600/20 border-red-500/30 text-red-300" };
    if (url.includes("afreeca") || url.includes("soop")) return { label: "AfreecaTV", color: "bg-blue-600/20 border-blue-500/30 text-blue-300" };
    if (url.includes("bilibili")) return { label: "bilibili", color: "bg-pink-600/20 border-pink-500/30 text-pink-300" };
    return { label: "بث مباشر", color: "bg-primary/15 border-primary/30 text-primary" };
  };

  return (
    <div className="space-y-2">
      <label className="text-white/50 text-xs mb-1 flex items-center gap-1.5">
        <Tv2 className="w-3.5 h-3.5" /> روابط البث (Twitch / YouTube / ...)
      </label>
      {/* Existing URLs */}
      {urls.map((url, idx) => {
        const { label, color } = getPlatform(url);
        return (
          <div key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${color}`}>
            <span className="font-bold flex-shrink-0">{label}</span>
            <span className="flex-1 truncate opacity-70">{url}</span>
            <button onClick={() => remove(idx)} className="flex-shrink-0 hover:opacity-100 opacity-60">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
      {/* Add new URL */}
      <div className="flex gap-2">
        <input
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="https://twitch.tv/... أو https://youtube.com/..."
          className="flex-1 bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-xs outline-none placeholder:text-white/30"
          data-testid="input-stream-url"
        />
        <button
          onClick={add}
          disabled={!newUrl.trim()}
          className="px-3 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold hover:bg-primary/30 disabled:opacity-40 transition flex items-center gap-1"
          data-testid="button-add-stream-url"
        >
          <Plus className="w-3 h-3" /> إضافة
        </button>
      </div>
    </div>
  );
}

// ── Matches Tab ───────────────────────────────────────────────────────────────
function MatchesTab() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [newMatch, setNewMatch] = useState<any>({ status: "upcoming", score1: 0, score2: 0, streamUrls: [] });
  const [uploadingMatchId, setUploadingMatchId] = useState<number | null>(null);
  const [syncingUpcoming, setSyncingUpcoming] = useState(false);
  const [syncingLive, setSyncingLive] = useState(false);
  const [importing, setImporting] = useState(false);

  const { data: matches, isLoading } = useQuery<MatchWithRelations[]>({
    queryKey: ["/api/admin/matches"],
    queryFn: () => adminFetch("/api/admin/matches"),
  });
  const { data: games } = useQuery<Game[]>({ queryKey: ["/api/games"] });
  const { data: teams } = useQuery<Team[]>({ queryKey: ["/api/teams"] });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      adminFetch(`/api/admin/matches/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] }); setEditId(null); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/matches/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] }); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const addMut = useMutation({
    mutationFn: (data: any) => adminFetch("/api/admin/matches", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] }); setShowAdd(false); setNewMatch({ status: "upcoming", score1: 0, score2: 0, streamUrls: [] }); toast({ title: "تمت الإضافة" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const uploadImageMut = useMutation({
    mutationFn: async ({ matchId, file }: { matchId: number; file: File }) => {
      const fileData = await readFileAsDataUrl(file);
      return adminFetch("/api/admin/upload-image", {
        method: "POST",
        body: JSON.stringify({
          fileData,
          entityType: "match",
          entityId: matchId,
        }),
      });
    },
    onMutate: ({ matchId }) => {
      setUploadingMatchId(matchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({ title: "تم استبدال صورة المباراة" });
    },
    onError: (e: any) => toast({ title: "خطأ في رفع الصورة", description: e.message, variant: "destructive" }),
    onSettled: () => {
      setUploadingMatchId(null);
    },
  });

  const startEdit = (m: MatchWithRelations) => {
    setEditId(m.id);
    setEditData({ score1: m.score1, score2: m.score2, status: m.status, tournament: m.tournament, streamUrls: m.streamUrls ?? [] });
  };

  const handleSyncUpcoming = async () => {
    setSyncingUpcoming(true);
    try {
      const res = await adminFetch("/api/admin/sync-upcoming", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({ title: `✅ ${res.message}` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSyncingUpcoming(false); }
  };

  const handleSyncLive = async () => {
    setSyncingLive(true);
    try {
      const res = await adminFetch("/api/admin/sync-live", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({ title: `✅ ${res.message}` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSyncingLive(false); }
  };

  const handleImportJson = async () => {
    setImporting(true);
    try {
      const parsed = JSON.parse(importJson);
      const matchesArray = Array.isArray(parsed) ? parsed : parsed.matches;
      if (!Array.isArray(matchesArray)) throw new Error("يجب أن يكون JSON مصفوفة أو { matches: [...] }");
      const res = await adminFetch("/api/admin/import-matches", { method: "POST", body: JSON.stringify({ matches: matchesArray }) });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({ title: `✅ ${res.message}` });
      setShowImport(false);
      setImportJson("");
    } catch (e: any) {
      toast({ title: "خطأ في الاستيراد", description: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  const statusColors: Record<string, string> = {
    live: "bg-green-500/20 text-green-400 border-green-500/30",
    finished: "bg-white/8 text-white/40 border-white/10",
    upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };

  return (
    <div className="space-y-3">
      {/* Sync & Import Controls */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary" /> جلب البيانات
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSyncUpcoming}
            disabled={syncingUpcoming}
            className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
            data-testid="button-sync-upcoming"
          >
            {syncingUpcoming ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            جلب المباريات القادمة
          </button>
          <button
            onClick={handleSyncLive}
            disabled={syncingLive}
            className="flex items-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
            data-testid="button-sync-live"
          >
            {syncingLive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tv2 className="w-4 h-4" />}
            جلب المباريات الحية
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-xl text-sm font-bold transition"
            data-testid="button-show-import"
          >
            <Download className="w-4 h-4" /> استيراد JSON
          </button>
        </div>
        {/* Import JSON Panel */}
        {showImport && (
          <div className="mt-3 space-y-2">
            <textarea
              value={importJson}
              onChange={e => setImportJson(e.target.value)}
              placeholder='[{"gameId":1,"team1Id":1,"team2Id":2,"startTime":"2026-03-12T18:00:00Z","tournament":"VCT","status":"upcoming"}]'
              className="w-full h-32 bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none resize-none"
              data-testid="textarea-import-json"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowImport(false); setImportJson(""); }} className="px-4 py-2 rounded-xl text-white/50 hover:text-white text-sm transition">إلغاء</button>
              <button
                onClick={handleImportJson}
                disabled={importing || !importJson.trim()}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
                data-testid="button-import-json"
              >
                {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} استيراد
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-white/50 text-sm">{matches?.length ?? 0} مباراة</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-4 py-2 rounded-xl text-sm font-bold transition"
          data-testid="button-add-match"
        >
          <Plus className="w-4 h-4" /> إضافة مباراة
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 mb-4">
          <h3 className="text-white font-bold text-sm">مباراة جديدة</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">اللعبة</label>
              <select value={newMatch.gameId ?? ""} onChange={e => setNewMatch({ ...newMatch, gameId: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                <option value="">اختر</option>
                {games?.map(g => {
                  const plat = (g as any).platform;
                  const platLabel = plat === "mobile" ? "📱" : plat === "console" ? "🎮" : plat === "cross-platform" ? "🌐" : "💻";
                  return <option key={g.id} value={g.id}>{g.name} {platLabel}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">البطولة</label>
              <input value={newMatch.tournament ?? ""} onChange={e => setNewMatch({ ...newMatch, tournament: e.target.value })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="اسم البطولة" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">الفريق 1</label>
              <select value={newMatch.team1Id ?? ""} onChange={e => setNewMatch({ ...newMatch, team1Id: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                <option value="">اختر</option>
                {teams?.filter(t => !newMatch.gameId || t.gameId === newMatch.gameId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">الفريق 2</label>
              <select value={newMatch.team2Id ?? ""} onChange={e => setNewMatch({ ...newMatch, team2Id: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                <option value="">اختر</option>
                {teams?.filter(t => !newMatch.gameId || t.gameId === newMatch.gameId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Date (YYYY-MM-DD)</label>
              <input 
                type="date" 
                value={newMatch.startTime ? newMatch.startTime.split('T')[0] : ""} 
                onChange={e => {
                  const currentTime = newMatch.startTime ? newMatch.startTime.split('T')[1]?.substring(0, 5) || "12:00" : "12:00";
                  const newDateTime = `${e.target.value}T${currentTime}:00.000Z`;
                  setNewMatch({ ...newMatch, startTime: newDateTime });
                }}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" 
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Time (HH:MM)</label>
              <input 
                type="time" 
                value={newMatch.startTime ? newMatch.startTime.split('T')[1]?.substring(0, 5) || "" : ""} 
                onChange={e => {
                  const currentDate = newMatch.startTime ? newMatch.startTime.split('T')[0] : new Date().toISOString().split('T')[0];
                  const newDateTime = `${currentDate}T${e.target.value}:00.000Z`;
                  setNewMatch({ ...newMatch, startTime: newDateTime });
                }}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" 
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">الحالة</label>
              <select value={newMatch.status} onChange={e => setNewMatch({ ...newMatch, status: e.target.value })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                <option value="upcoming">قادمة</option>
                <option value="live">مباشر</option>
                <option value="finished">منتهية</option>
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">نتيجة 1</label>
              <input type="number" min={0} value={newMatch.score1} onChange={e => setNewMatch({ ...newMatch, score1: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">نتيجة 2</label>
              <input type="number" min={0} value={newMatch.score2} onChange={e => setNewMatch({ ...newMatch, score2: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
            </div>
          </div>
          {/* Stream URLs */}
          <div className="col-span-2">
            <StreamUrlsInput
              urls={newMatch.streamUrls ?? []}
              onChange={urls => setNewMatch({ ...newMatch, streamUrls: urls })}
            />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-white/50 hover:text-white text-sm transition">إلغاء</button>
            <button onClick={() => addMut.mutate(newMatch)} disabled={addMut.isPending}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold flex items-center gap-2 transition">
              {addMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} حفظ
            </button>
          </div>
        </div>
      )}

      {/* Match list */}
      <div className="space-y-2">
        {matches?.map(m => (
          <div key={m.id} className="bg-white/5 border border-white/8 rounded-2xl p-4" data-testid={`card-match-${m.id}`}>
            {editId === m.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/50 text-xs mb-1 block">البطولة</label>
                    <input value={editData.tournament} onChange={e => setEditData({ ...editData, tournament: e.target.value })}
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs mb-1 block">الحالة</label>
                    <select value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value })}
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                      <option value="upcoming">قادمة</option>
                      <option value="live">مباشر</option>
                      <option value="finished">منتهية</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white/50 text-xs mb-1 block">نتيجة {m.team1.name}</label>
                    <input type="number" min={0} value={editData.score1} onChange={e => setEditData({ ...editData, score1: Number(e.target.value) })}
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs mb-1 block">نتيجة {m.team2.name}</label>
                    <input type="number" min={0} value={editData.score2} onChange={e => setEditData({ ...editData, score2: Number(e.target.value) })}
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                  </div>
                </div>
                {/* Stream URLs */}
                <StreamUrlsInput
                  urls={editData.streamUrls ?? []}
                  onChange={urls => setEditData({ ...editData, streamUrls: urls })}
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditId(null)} className="p-2 rounded-lg text-white/40 hover:text-white transition"><X className="w-4 h-4" /></button>
                  <button onClick={() => updateMut.mutate({ id: m.id, data: editData })} disabled={updateMut.isPending}
                    className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition">
                    {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <img
                  src={m.imageUrl || m.game.imageUrl}
                  alt={m.tournament}
                  className="w-10 h-10 object-cover rounded-lg border border-white/10"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white/40 text-xs">{m.game.name} · {m.tournament}</p>
                    <ImageSourceBadge source={m.imageSource} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-bold truncate">{m.team1.name}</span>
                    <span className="text-white/60 text-sm font-mono font-bold">{m.score1} – {m.score2}</span>
                    <span className="text-white text-sm font-bold truncate">{m.team2.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[m.status]}`}>
                      {m.status === "live" ? "مباشر" : m.status === "finished" ? "منتهية" : "قادمة"}
                    </span>
                    <span className="text-white/30 text-xs">{format(new Date(m.startTime), "dd/MM HH:mm")}</span>
                    {m.streamUrls && m.streamUrls.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-400/80 font-bold">
                        <Tv2 className="w-2.5 h-2.5" /> {m.streamUrls.length} بث
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <label
                    className="px-2.5 py-1 rounded-lg border border-white/15 text-white/70 hover:text-white text-xs cursor-pointer transition"
                    data-testid={`button-replace-match-image-${m.id}`}
                  >
                    {uploadingMatchId === m.id && uploadImageMut.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      "استبدال"
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) uploadImageMut.mutate({ matchId: m.id, file });
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <button onClick={() => startEdit(m)} className="p-2 rounded-lg text-white/40 hover:text-white transition" data-testid={`button-edit-match-${m.id}`}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteMut.mutate(m.id)} disabled={deleteMut.isPending}
                    className="p-2 rounded-lg text-white/40 hover:text-red-400 transition" data-testid={`button-delete-match-${m.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Games Tab ─────────────────────────────────────────────────────────────────
const PLATFORM_OPTIONS = [
  { value: "pc", label: "كمبيوتر (PC)" },
  { value: "mobile", label: "جوال (Mobile)" },
  { value: "console", label: "كونسول (PlayStation/Xbox)" },
  { value: "cross-platform", label: "متعدد المنصات" },
];

function GamesTab() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newGame, setNewGame] = useState({ name: "", imageUrl: "", platform: "pc" });

  const { data: games, isLoading } = useQuery<Game[]>({ queryKey: ["/api/games"] });

  const addMut = useMutation({
    mutationFn: (data: any) => adminFetch("/api/admin/games", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/games"] }); setShowAdd(false); setNewGame({ name: "", imageUrl: "", platform: "pc" }); toast({ title: "تمت الإضافة" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => adminFetch(`/api/admin/games/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/games"] }); setEditId(null); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/games/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/games"] }); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/50 text-sm">{games?.length ?? 0} لعبة</p>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-4 py-2 rounded-xl text-sm font-bold transition"
          data-testid="button-add-game">
          <Plus className="w-4 h-4" /> إضافة لعبة
        </button>
      </div>

      {showAdd && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 mb-4">
          <h3 className="text-white font-bold text-sm">لعبة جديدة</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">اسم اللعبة</label>
              <input value={newGame.name} onChange={e => setNewGame({ ...newGame, name: e.target.value })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="مثال: Valorant" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">المنصة</label>
              <select value={newGame.platform} onChange={e => setNewGame({ ...newGame, platform: e.target.value })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                {PLATFORM_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-white/50 text-xs mb-1 block">رابط الصورة</label>
              <input value={newGame.imageUrl} onChange={e => setNewGame({ ...newGame, imageUrl: e.target.value })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="https://..." />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-white/50 hover:text-white text-sm transition">إلغاء</button>
            <button onClick={() => addMut.mutate(newGame)} disabled={addMut.isPending}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold flex items-center gap-2 transition">
              {addMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} حفظ
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {games?.map(g => {
          const platformLabel = PLATFORM_OPTIONS.find(p => p.value === (g as any).platform)?.label || "PC";
          const platformColors: Record<string, string> = {
            pc: "bg-blue-500/20 text-blue-400 border-blue-500/30",
            mobile: "bg-green-500/20 text-green-400 border-green-500/30",
            console: "bg-purple-500/20 text-purple-400 border-purple-500/30",
            "cross-platform": "bg-amber-500/20 text-amber-400 border-amber-500/30",
          };
          return (
          <div key={g.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-3" data-testid={`card-game-${g.id}`}>
            <img src={g.imageUrl} alt={g.name} className="w-8 h-8 object-contain rounded" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            {editId === g.id ? (
              <div className="flex-1 flex gap-2 flex-wrap">
                <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })}
                  className="flex-1 min-w-[120px] bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none" />
                <select value={editData.platform} onChange={e => setEditData({ ...editData, platform: e.target.value })}
                  className="min-w-[140px] bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none">
                  {PLATFORM_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <input value={editData.imageUrl} onChange={e => setEditData({ ...editData, imageUrl: e.target.value })}
                  className="flex-1 min-w-[160px] bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none" placeholder="URL الصورة" />
                <button onClick={() => updateMut.mutate({ id: g.id, data: editData })} className="p-1.5 rounded-lg bg-primary/20 text-primary"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-white font-medium text-sm">{g.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${platformColors[(g as any).platform] || platformColors.pc}`}>
                    {platformLabel}
                  </span>
                </div>
                <button onClick={() => { setEditId(g.id); setEditData({ name: g.name, imageUrl: g.imageUrl, platform: (g as any).platform || "pc" }); }}
                  className="p-2 text-white/40 hover:text-white transition" data-testid={`button-edit-game-${g.id}`}><Pencil className="w-4 h-4" /></button>
                <button onClick={() => deleteMut.mutate(g.id)}
                  className="p-2 text-white/40 hover:text-red-400 transition" data-testid={`button-delete-game-${g.id}`}><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        );})}
      </div>
    </div>
  );
}

// ── Teams Tab ─────────────────────────────────────────────────────────────────
function TeamsTab() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", logoUrl: "", gameId: 0 });
  const [uploadingTeamId, setUploadingTeamId] = useState<number | null>(null);

  const { data: teams, isLoading } = useQuery<Team[]>({ queryKey: ["/api/teams"] });
  const { data: games } = useQuery<Game[]>({ queryKey: ["/api/games"] });

  const gameMap = Object.fromEntries((games ?? []).map(g => [g.id, g.name]));

  const addMut = useMutation({
    mutationFn: (data: any) => adminFetch("/api/admin/teams", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/teams"] }); setShowAdd(false); setNewTeam({ name: "", logoUrl: "", gameId: 0 }); toast({ title: "تمت الإضافة" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => adminFetch(`/api/admin/teams/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/teams"] }); setEditId(null); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/teams/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/teams"] }); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const uploadImageMut = useMutation({
    mutationFn: async ({ teamId, file }: { teamId: number; file: File }) => {
      const fileData = await readFileAsDataUrl(file);
      return adminFetch("/api/admin/upload-image", {
        method: "POST",
        body: JSON.stringify({
          fileData,
          entityType: "team",
          entityId: teamId,
        }),
      });
    },
    onMutate: ({ teamId }) => {
      setUploadingTeamId(teamId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({ title: "تم استبدال صورة الفريق" });
    },
    onError: (e: any) => toast({ title: "خطأ في رفع الصورة", description: e.message, variant: "destructive" }),
    onSettled: () => {
      setUploadingTeamId(null);
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/50 text-sm">{teams?.length ?? 0} فريق</p>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-4 py-2 rounded-xl text-sm font-bold transition"
          data-testid="button-add-team">
          <Plus className="w-4 h-4" /> إضافة فريق
        </button>
      </div>

      {showAdd && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 mb-4">
          <h3 className="text-white font-bold text-sm">فريق جديد</h3>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">اسم الفريق</label>
              <input value={newTeam.name} onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="اسم الفريق" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">رابط الشعار</label>
              <input value={newTeam.logoUrl} onChange={e => setNewTeam({ ...newTeam, logoUrl: e.target.value })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="https://..." />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">اللعبة</label>
              <select value={newTeam.gameId} onChange={e => setNewTeam({ ...newTeam, gameId: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none">
                <option value={0}>اختر لعبة</option>
                {games?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-white/50 hover:text-white text-sm transition">إلغاء</button>
            <button onClick={() => addMut.mutate(newTeam)} disabled={addMut.isPending}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold flex items-center gap-2 transition">
              {addMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} حفظ
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {teams?.map(t => (
          <div key={t.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-3" data-testid={`card-team-${t.id}`}>
            <img src={t.imageUrl || t.logoUrl} alt={t.name} className="w-8 h-8 object-cover rounded" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            {editId === t.id ? (
              <div className="flex-1 flex gap-2 flex-wrap">
                <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })}
                  className="flex-1 min-w-[120px] bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none" placeholder="الاسم" />
                <input value={editData.logoUrl} onChange={e => setEditData({ ...editData, logoUrl: e.target.value })}
                  className="flex-1 min-w-[160px] bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none" placeholder="URL الشعار" />
                <button onClick={() => updateMut.mutate({ id: t.id, data: editData })} className="p-1.5 rounded-lg bg-primary/20 text-primary"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm truncate">{t.name}</p>
                    <ImageSourceBadge source={t.imageSource} />
                  </div>
                  <p className="text-white/40 text-xs">{gameMap[t.gameId ?? 0] ?? "—"}</p>
                </div>
                {t.imageSource === "manual" && (
                  <button
                    onClick={() => updateMut.mutate({ id: t.id, data: { imageUrl: t.logoUrl, imageSource: "auto" } })}
                    className="px-2.5 py-1 rounded-lg border border-blue-500/30 text-blue-400 hover:text-blue-200 text-xs transition"
                    data-testid={`button-reset-team-image-${t.id}`}
                  >
                    تلقائي
                  </button>
                )}
                <label
                  className="px-2.5 py-1 rounded-lg border border-white/15 text-white/70 hover:text-white text-xs cursor-pointer transition"
                  data-testid={`button-replace-team-image-${t.id}`}
                >
                  {uploadingTeamId === t.id && uploadImageMut.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "استبدال"
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) uploadImageMut.mutate({ teamId: t.id, file });
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <button onClick={() => { setEditId(t.id); setEditData({ name: t.name, logoUrl: t.logoUrl }); }}
                  className="p-2 text-white/40 hover:text-white transition" data-testid={`button-edit-team-${t.id}`}><Pencil className="w-4 h-4" /></button>
                <button onClick={() => deleteMut.mutate(t.id)}
                  className="p-2 text-white/40 hover:text-red-400 transition" data-testid={`button-delete-team-${t.id}`}><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Leagues Tab ───────────────────────────────────────────────────────────────
function LeaguesTab() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newLeague, setNewLeague] = useState({ name: "", imageUrl: "", gameId: 0 });
  const [uploadingLeagueId, setUploadingLeagueId] = useState<number | null>(null);

  const { data: leagues, isLoading } = useQuery<League[]>({ queryKey: ["/api/leagues"] });
  const { data: games } = useQuery<Game[]>({ queryKey: ["/api/games"] });

  const gameMap = Object.fromEntries((games ?? []).map(g => [g.id, g.name]));

  const addMut = useMutation({
    mutationFn: (data: any) => adminFetch("/api/admin/leagues", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setShowAdd(false);
      setNewLeague({ name: "", imageUrl: "", gameId: 0 });
      toast({ title: "تمت إضافة البطولة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      adminFetch(`/api/admin/leagues/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setEditId(null);
      toast({ title: "تم تحديث البطولة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/leagues/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      toast({ title: "تم حذف البطولة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const uploadImageMut = useMutation({
    mutationFn: async ({ leagueId, file }: { leagueId: number; file: File }) => {
      const fileData = await readFileAsDataUrl(file);
      return adminFetch("/api/admin/upload-image", {
        method: "POST",
        body: JSON.stringify({
          fileData,
          entityType: "league",
          entityId: leagueId,
        }),
      });
    },
    onMutate: ({ leagueId }) => {
      setUploadingLeagueId(leagueId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({ title: "تم استبدال صورة البطولة" });
    },
    onError: (e: any) => toast({ title: "خطأ في رفع الصورة", description: e.message, variant: "destructive" }),
    onSettled: () => {
      setUploadingLeagueId(null);
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/50 text-sm">{leagues?.length ?? 0} بطولة</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-4 py-2 rounded-xl text-sm font-bold transition"
          data-testid="button-add-league"
        >
          <Plus className="w-4 h-4" /> إضافة بطولة
        </button>
      </div>

      {showAdd && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 mb-4">
          <h3 className="text-white font-bold text-sm">بطولة جديدة</h3>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">اسم البطولة</label>
              <input
                value={newLeague.name}
                onChange={e => setNewLeague({ ...newLeague, name: e.target.value })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none"
                placeholder="اسم البطولة"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">رابط الصورة</label>
              <input
                value={newLeague.imageUrl}
                onChange={e => setNewLeague({ ...newLeague, imageUrl: e.target.value })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">اللعبة</label>
              <select
                value={newLeague.gameId}
                onChange={e => setNewLeague({ ...newLeague, gameId: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none"
              >
                <option value={0}>اختر لعبة</option>
                {games?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-white/50 hover:text-white text-sm transition">إلغاء</button>
            <button
              onClick={() => addMut.mutate(newLeague)}
              disabled={addMut.isPending}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold flex items-center gap-2 transition"
            >
              {addMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} حفظ
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {leagues?.map(l => (
          <div key={l.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-3" data-testid={`card-league-${l.id}`}>
            <img src={l.imageUrl} alt={l.name} className="w-8 h-8 object-cover rounded" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            {editId === l.id ? (
              <div className="flex-1 flex gap-2 flex-wrap">
                <input
                  value={editData.name}
                  onChange={e => setEditData({ ...editData, name: e.target.value })}
                  className="flex-1 min-w-[120px] bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none"
                  placeholder="الاسم"
                />
                <input
                  value={editData.imageUrl}
                  onChange={e => setEditData({ ...editData, imageUrl: e.target.value })}
                  className="flex-1 min-w-[160px] bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none"
                  placeholder="URL الصورة"
                />
                <select
                  value={editData.gameId}
                  onChange={e => setEditData({ ...editData, gameId: Number(e.target.value) })}
                  className="min-w-[140px] bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm outline-none"
                >
                  <option value={0}>اختر لعبة</option>
                  {games?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button onClick={() => updateMut.mutate({ id: l.id, data: editData })} className="p-1.5 rounded-lg bg-primary/20 text-primary"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm truncate">{l.name}</p>
                    <ImageSourceBadge source={l.imageSource} />
                  </div>
                  <p className="text-white/40 text-xs">{gameMap[l.gameId ?? 0] ?? "—"}</p>
                </div>
                {l.imageSource === "manual" && (
                  <button
                    onClick={() => updateMut.mutate({ id: l.id, data: { imageSource: "auto" } })}
                    className="px-2.5 py-1 rounded-lg border border-blue-500/30 text-blue-400 hover:text-blue-200 text-xs transition"
                    data-testid={`button-reset-league-image-${l.id}`}
                  >
                    تلقائي
                  </button>
                )}
                <label
                  className="px-2.5 py-1 rounded-lg border border-white/15 text-white/70 hover:text-white text-xs cursor-pointer transition"
                  data-testid={`button-replace-league-image-${l.id}`}
                >
                  {uploadingLeagueId === l.id && uploadImageMut.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "استبدال"
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) uploadImageMut.mutate({ leagueId: l.id, file });
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <button onClick={() => { setEditId(l.id); setEditData({ name: l.name, imageUrl: l.imageUrl, gameId: l.gameId ?? 0 }); }}
                  className="p-2 text-white/40 hover:text-white transition" data-testid={`button-edit-league-${l.id}`}><Pencil className="w-4 h-4" /></button>
                <button onClick={() => deleteMut.mutate(l.id)}
                  className="p-2 text-white/40 hover:text-red-400 transition" data-testid={`button-delete-league-${l.id}`}><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => adminFetch("/api/admin/stats"),
  });
  const { data: chart } = useQuery({
    queryKey: ["/api/admin/visits-chart"],
    queryFn: () => adminFetch("/api/admin/visits-chart"),
  });
  const { data: feedbackList } = useQuery({
    queryKey: ["/api/admin/feedback"],
    queryFn: () => adminFetch("/api/admin/feedback"),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>;

  const s = stats || {};
  const chartData: { date: string; count: number }[] = chart || [];
  const maxCount = Math.max(...chartData.map((d: any) => d.count), 1);
  const recentFeedback: any[] = (feedbackList || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "إجمالي الزوار", value: s.totalVisitors ?? 0, icon: Users, color: "text-violet-400" },
          { label: "زوار اليوم", value: s.visitorsToday ?? 0, icon: UserCheck, color: "text-green-400" },
          { label: "المباريات", value: s.totalMatches ?? 0, icon: Trophy, color: "text-yellow-400" },
          { label: "الفرق", value: s.totalTeams ?? 0, icon: Gamepad2, color: "text-blue-400" },
          { label: "متوسط التقييم", value: s.avgRating ? `${s.avgRating} ★` : "—", icon: Star, color: "text-amber-400" },
          { label: "Mobile %", value: `${s.mobilePercent ?? 0}%`, icon: BarChart2, color: "text-pink-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/5 border border-white/8 rounded-2xl p-4">
            <div className={`flex items-center gap-2 mb-1 ${color}`}>
              <Icon className="w-4 h-4" />
              <span className="text-xs text-white/50">{label}</span>
            </div>
            <p className="text-white font-extrabold text-2xl">{value}</p>
          </div>
        ))}
      </div>

      {/* 7-day chart */}
      <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
        <p className="text-white/60 text-xs mb-3">الزيارات — آخر 7 أيام</p>
        <div className="flex items-end gap-1 h-20">
          {chartData.map((d: any) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-violet-600/70 rounded-t"
                style={{ height: `${Math.round((d.count / maxCount) * 64) + 4}px` }}
              />
              <span className="text-white/30 text-[9px]">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent feedback */}
      <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
        <p className="text-white/60 text-xs mb-3">آخر التقييمات</p>
        {recentFeedback.length === 0 ? (
          <p className="text-white/30 text-sm">لا توجد تقييمات بعد</p>
        ) : (
          <div className="space-y-2">
            {recentFeedback.map((fb: any) => (
              <div key={fb.id} className="flex items-center gap-3">
                <span className="text-amber-400 text-sm">{"★".repeat(fb.rating)}</span>
                <span className="text-white/60 text-xs truncate">{fb.comment || "—"}</span>
                <span className="text-white/30 text-xs mr-auto">{fb.visitor?.emailOrPhone?.slice(0, 8) ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Sync Section */}
      <DataSyncSection />
    </div>
  );
}

// ── Data Sync Section ─────────────────────────────────────────────────────────
function DataSyncSection() {
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState(30);

  const syncPastMut = useMutation({
    mutationFn: async () => {
      const res = await adminFetch(`/api/admin/sync-past?days=${daysBack}`, { method: "POST" });
      return res;
    },
    onSuccess: (data) => {
      setSyncStatus(`✅ تم جلب ${data.added} مباراة منتهية`);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      setTimeout(() => setSyncStatus(null), 5000);
    },
    onError: (err: any) => {
      setSyncStatus(`❌ ${err.message}`);
      setTimeout(() => setSyncStatus(null), 5000);
    },
  });

  const syncUpcomingMut = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/admin/sync-upcoming", { method: "POST" });
      return res;
    },
    onSuccess: (data) => {
      setSyncStatus(`✅ تم جلب ${data.added} مباراة قادمة`);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      setTimeout(() => setSyncStatus(null), 5000);
    },
    onError: (err: any) => {
      setSyncStatus(`❌ ${err.message}`);
      setTimeout(() => setSyncStatus(null), 5000);
    },
  });

  const syncLiveMut = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/admin/sync-live", { method: "POST" });
      return res;
    },
    onSuccess: (data) => {
      setSyncStatus(`✅ تم جلب ${data.added} مباراة مباشرة`);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      setTimeout(() => setSyncStatus(null), 5000);
    },
    onError: (err: any) => {
      setSyncStatus(`❌ ${err.message}`);
      setTimeout(() => setSyncStatus(null), 5000);
    },
  });

  const isSyncing = syncPastMut.isPending || syncUpcomingMut.isPending || syncLiveMut.isPending;

  return (
    <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
      <p className="text-white/60 text-xs mb-3">مزامنة البيانات من PandaScore</p>
      
      {syncStatus && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-primary/20 border border-primary/30 text-sm text-primary">
          {syncStatus}
        </div>
      )}

      <div className="space-y-3">
        {/* Sync Past Matches */}
        <div className="flex items-center gap-3">
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white"
          >
            <option value={7}>7 أيام</option>
            <option value={14}>14 يوم</option>
            <option value={30}>30 يوم</option>
            <option value={60}>60 يوم</option>
            <option value={90}>90 يوم</option>
          </select>
          <button
            onClick={() => syncPastMut.mutate()}
            disabled={isSyncing}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
          >
            {syncPastMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            جلب المباريات المنتهية
          </button>
        </div>

        {/* Sync Upcoming & Live */}
        <div className="flex gap-2">
          <button
            onClick={() => syncUpcomingMut.mutate()}
            disabled={isSyncing}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
          >
            {syncUpcomingMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            القادمة
          </button>
          <button
            onClick={() => syncLiveMut.mutate()}
            disabled={isSyncing}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
          >
            {syncLiveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tv2 className="w-4 h-4" />}
            المباشرة
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Visitors Tab ──────────────────────────────────────────────────────────────
function VisitorsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/visitors"],
    queryFn: () => adminFetch("/api/admin/visitors"),
  });

  const exportCsv = () => {
    const rows: any[] = data || [];
    const header = "id,emailOrPhone,deviceType,firstVisit,lastVisit,visitCount";
    const lines = rows.map((v: any) =>
      [v.id, v.emailOrPhone, v.deviceType, v.firstVisit, v.lastVisit, v.visitCount].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "visitors.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>;

  const visitors: any[] = data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-sm">{visitors.length} زائر مسجّل</p>
        <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white border border-white/10 px-3 py-1.5 rounded-xl transition">
          <Download className="w-3.5 h-3.5" /> تصدير CSV
        </button>
      </div>
      <div className="space-y-2">
        {visitors.map((v: any) => (
          <div key={v.id} className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{v.emailOrPhone}</p>
              <p className="text-white/40 text-xs">
                {v.deviceType === "mobile" ? "📱 موبايل" : "🖥️ حاسوب"} · {v.visitCount} زيارة
              </p>
            </div>
            <p className="text-white/30 text-xs">{new Date(v.lastVisit).toLocaleDateString("ar")}</p>
          </div>
        ))}
        {visitors.length === 0 && <p className="text-white/30 text-sm text-center py-8">لا يوجد زوار بعد</p>}
      </div>
    </div>
  );
}

// ── Players Tab ──────────────────────────────────────────────────────────────
function PlayersTab() {
  const { toast } = useToast();
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newPlayer, setNewPlayer] = useState<any>({ name: "", handle: "", teamId: null, role: "player", nationality: "", age: null, imageUrl: "" });

  const { data: players, isLoading } = useQuery<Player[]>({
    queryKey: ["/api/admin/players"],
    queryFn: () => adminFetch("/api/admin/players"),
  });
  const { data: teams } = useQuery<Team[]>({ queryKey: ["/api/teams"] });

  const addMut = useMutation({
    mutationFn: (data: any) => adminFetch("/api/admin/players", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["/api/admin/players"] }); 
      queryClient.invalidateQueries({ queryKey: ["/api/players"] }); 
      setShowAdd(false); 
      setNewPlayer({ name: "", handle: "", teamId: null, role: "player", nationality: "", age: null, imageUrl: "" }); 
      toast({ title: "تمت إضافة اللاعب" }); 
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      adminFetch(`/api/admin/players/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["/api/admin/players"] }); 
      queryClient.invalidateQueries({ queryKey: ["/api/players"] }); 
      setEditId(null); 
      toast({ title: "تم التحديث" }); 
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/players/${id}`, { method: "DELETE" }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["/api/admin/players"] }); 
      queryClient.invalidateQueries({ queryKey: ["/api/players"] }); 
      toast({ title: "تم الحذف" }); 
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const startEdit = (p: Player) => {
    setEditId(p.id);
    setEditData({ name: p.name, handle: p.handle, teamId: p.teamId, role: p.role, nationality: p.nationality, age: p.age, imageUrl: p.imageUrl });
  };

  const roleLabels: Record<string, string> = {
    captain: "كابتن",
    player: "لاعب",
    coach: "مدرب",
    analyst: "محلل",
    substitute: "احتياطي",
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-3">
      {/* Add Player Button */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="flex items-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-4 py-2 rounded-xl text-sm font-bold transition"
      >
        <Plus className="w-4 h-4" /> إضافة لاعب
      </button>

      {/* Add Player Form */}
      {showAdd && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <h3 className="text-white font-bold text-sm">إضافة لاعب جديد</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={newPlayer.name}
              onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })}
              placeholder="الاسم الحقيقي"
              className="bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none"
            />
            <input
              value={newPlayer.handle}
              onChange={e => setNewPlayer({ ...newPlayer, handle: e.target.value })}
              placeholder="الاسم المستعار (Handle)"
              className="bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none"
            />
            <select
              value={newPlayer.teamId || ""}
              onChange={e => setNewPlayer({ ...newPlayer, teamId: e.target.value ? Number(e.target.value) : null })}
              className="bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none"
            >
              <option value="">اختر الفريق</option>
              {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select
              value={newPlayer.role}
              onChange={e => setNewPlayer({ ...newPlayer, role: e.target.value })}
              className="bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none"
            >
              {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input
              value={newPlayer.nationality || ""}
              onChange={e => setNewPlayer({ ...newPlayer, nationality: e.target.value })}
              placeholder="الجنسية"
              className="bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none"
            />
            <input
              type="number"
              value={newPlayer.age || ""}
              onChange={e => setNewPlayer({ ...newPlayer, age: e.target.value ? Number(e.target.value) : null })}
              placeholder="العمر"
              className="bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none"
            />
            <input
              value={newPlayer.imageUrl || ""}
              onChange={e => setNewPlayer({ ...newPlayer, imageUrl: e.target.value })}
              placeholder="رابط الصورة"
              className="col-span-2 bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => addMut.mutate(newPlayer)}
              disabled={!newPlayer.name || !newPlayer.handle || addMut.isPending}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
            >
              {addMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} حفظ
            </button>
            <button onClick={() => setShowAdd(false)} className="text-white/50 hover:text-white px-3 py-2 text-sm">إلغاء</button>
          </div>
        </div>
      )}

      {/* Players List */}
      <div className="space-y-2">
        {players?.map(p => {
          const team = teams?.find(t => t.id === p.teamId);
          const isEditing = editId === p.id;

          return (
            <div key={p.id} className="bg-white/5 border border-white/8 rounded-xl p-3">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editData.name}
                      onChange={e => setEditData({ ...editData, name: e.target.value })}
                      className="bg-black/50 border border-white/20 rounded-lg px-2 py-1.5 text-white text-sm outline-none"
                    />
                    <input
                      value={editData.handle}
                      onChange={e => setEditData({ ...editData, handle: e.target.value })}
                      className="bg-black/50 border border-white/20 rounded-lg px-2 py-1.5 text-white text-sm outline-none"
                    />
                    <select
                      value={editData.teamId || ""}
                      onChange={e => setEditData({ ...editData, teamId: e.target.value ? Number(e.target.value) : null })}
                      className="bg-black/50 border border-white/20 rounded-lg px-2 py-1.5 text-white text-sm outline-none"
                    >
                      <option value="">بدون فريق</option>
                      {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select
                      value={editData.role}
                      onChange={e => setEditData({ ...editData, role: e.target.value })}
                      className="bg-black/50 border border-white/20 rounded-lg px-2 py-1.5 text-white text-sm outline-none"
                    >
                      {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateMut.mutate({ id: p.id, data: editData })}
                      disabled={updateMut.isPending}
                      className="flex items-center gap-1 bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-bold"
                    >
                      {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} حفظ
                    </button>
                    <button onClick={() => setEditId(null)} className="text-white/40 hover:text-white text-xs px-2">إلغاء</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.handle} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-white/50">{p.handle.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{p.handle}</p>
                    <p className="text-white/40 text-xs">{p.name} · {team?.name || "بدون فريق"}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                    p.role === "captain" ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-white/8 border-white/20 text-white/50"
                  }`}>
                    {roleLabels[p.role] || p.role}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(p)} className="p-1.5 hover:bg-white/10 rounded-lg transition">
                      <Pencil className="w-3.5 h-3.5 text-white/40" />
                    </button>
                    <button onClick={() => deleteMut.mutate(p.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5 text-red-400/60" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {players?.length === 0 && <p className="text-white/30 text-sm text-center py-8">لا يوجد لاعبون بعد</p>}
      </div>
    </div>
  );
}

// ── Feedback Tab ──────────────────────────────────────────────────────────────
function FeedbackTab() {
  const [filterRating, setFilterRating] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/feedback"],
    queryFn: () => adminFetch("/api/admin/feedback"),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>;

  const all: any[] = data || [];
  const filtered = filterRating > 0 ? all.filter((f: any) => f.rating === filterRating) : all;

  return (
    <div className="space-y-4">
      {/* Star filter */}
      <div className="flex items-center gap-2">
        <span className="text-white/40 text-xs">فلترة:</span>
        {[0,1,2,3,4,5].map(n => (
          <button key={n} onClick={() => setFilterRating(n)}
            className={`px-2.5 py-1 rounded-lg text-xs transition border ${
              filterRating === n ? "border-amber-400 text-amber-400" : "border-white/10 text-white/40 hover:text-white"
            }`}>
            {n === 0 ? "الكل" : "★".repeat(n)}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((fb: any) => (
          <div key={fb.id} className="bg-white/5 border border-white/8 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-400 text-sm">{"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}</span>
              <span className="text-white/30 text-xs mr-auto">{new Date(fb.createdAt).toLocaleDateString("ar")}</span>
            </div>
            {fb.comment && <p className="text-white/70 text-sm">{fb.comment}</p>}
            <p className="text-white/30 text-xs mt-1">{fb.visitor?.emailOrPhone ?? "—"}</p>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-white/30 text-sm text-center py-8">لا توجد تقييمات</p>}
      </div>
    </div>
  );
}

// ── Details Tab (Brackets & Standings) ─────────────────────────────────────────
type BracketRound = "round_of_16" | "quarter_final" | "semi_final" | "final";
type BracketEntry = {
  round: BracketRound;
  position: number;
  team1Name: string;
  team1Logo?: string;
  team2Name: string;
  team2Logo?: string;
  score1?: number;
  score2?: number;
  isTbd?: number;
};
type StandingEntry = {
  position: number;
  teamName: string;
  teamLogo?: string;
  played: number;
  goalDifference: number;
  points: number;
  isCurrentTeam?: number;
};

const ROUND_LABELS: Record<BracketRound, string> = {
  round_of_16: "Round of 16",
  quarter_final: "Quarter-final",
  semi_final: "Semi-final",
  final: "Final",
};

function DetailsTab() {
  const { toast } = useToast();
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [mode, setMode] = useState<"bracket" | "standings">("bracket");
  const [saving, setSaving] = useState(false);

  // Bracket state
  const [bracketEntries, setBracketEntries] = useState<BracketEntry[]>([]);
  const [newBracket, setNewBracket] = useState<BracketEntry>({
    round: "quarter_final",
    position: 1,
    team1Name: "",
    team2Name: "",
  });

  // Standings state
  const [standingEntries, setStandingEntries] = useState<StandingEntry[]>([]);
  const [newStanding, setNewStanding] = useState<StandingEntry>({
    position: 1,
    teamName: "",
    played: 0,
    goalDifference: 0,
    points: 0,
  });

  const { data: matches } = useQuery<MatchWithRelations[]>({
    queryKey: ["/api/admin/matches"],
    queryFn: () => adminFetch("/api/admin/matches"),
  });

  // Fetch bracket data when match is selected
  const { data: bracketData, refetch: refetchBracket } = useQuery<BracketEntry[]>({
    queryKey: [`/api/matches/${selectedMatchId}/bracket`],
    queryFn: () => fetch(`/api/matches/${selectedMatchId}/bracket`).then(r => r.json()),
    enabled: !!selectedMatchId && mode === "bracket",
  });

  // Fetch standings data when match is selected
  const { data: standingsData, refetch: refetchStandings } = useQuery<StandingEntry[]>({
    queryKey: [`/api/matches/${selectedMatchId}/standings`],
    queryFn: () => fetch(`/api/matches/${selectedMatchId}/standings`).then(r => r.json()),
    enabled: !!selectedMatchId && mode === "standings",
  });

  // Load data when fetched
  useState(() => {
    if (bracketData) setBracketEntries(bracketData);
  });
  useState(() => {
    if (standingsData) setStandingEntries(standingsData);
  });

  // Update local state when data changes
  if (bracketData && bracketEntries.length === 0 && bracketData.length > 0) {
    setBracketEntries(bracketData);
  }
  if (standingsData && standingEntries.length === 0 && standingsData.length > 0) {
    setStandingEntries(standingsData);
  }

  const handleSelectMatch = (id: number) => {
    setSelectedMatchId(id);
    setBracketEntries([]);
    setStandingEntries([]);
  };

  const addBracketEntry = () => {
    if (!newBracket.team1Name || !newBracket.team2Name) return;
    setBracketEntries([...bracketEntries, { ...newBracket }]);
    setNewBracket({ round: "quarter_final", position: bracketEntries.length + 2, team1Name: "", team2Name: "" });
  };

  const removeBracketEntry = (idx: number) => {
    setBracketEntries(bracketEntries.filter((_, i) => i !== idx));
  };

  const addStandingEntry = () => {
    if (!newStanding.teamName) return;
    setStandingEntries([...standingEntries, { ...newStanding }]);
    setNewStanding({ position: standingEntries.length + 2, teamName: "", played: 0, goalDifference: 0, points: 0 });
  };

  const removeStandingEntry = (idx: number) => {
    setStandingEntries(standingEntries.filter((_, i) => i !== idx));
  };

  const saveBracket = async () => {
    if (!selectedMatchId) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/matches/${selectedMatchId}/bracket`, {
        method: "POST",
        body: JSON.stringify(bracketEntries),
      });
      toast({ title: "تم حفظ شجرة البطولة" });
      refetchBracket();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveStandings = async () => {
    if (!selectedMatchId) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/matches/${selectedMatchId}/standings`, {
        method: "POST",
        body: JSON.stringify(standingEntries),
      });
      toast({ title: "تم حفظ جدول المجموعات" });
      refetchStandings();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedMatch = matches?.find(m => m.id === selectedMatchId);

  return (
    <div className="space-y-4">
      <h2 className="text-white font-bold flex items-center gap-2">
        <GitBranch className="w-5 h-5 text-primary" />
        تفاصيل المباريات (Bracket & Standings)
      </h2>

      {/* Match Selector */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <label className="text-white/50 text-xs mb-2 block">اختر مباراة</label>
        <select
          value={selectedMatchId ?? ""}
          onChange={e => handleSelectMatch(Number(e.target.value))}
          className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none"
        >
          <option value="">-- اختر مباراة --</option>
          {matches?.map(m => (
            <option key={m.id} value={m.id}>
              {m.team1?.name ?? "?"} vs {m.team2?.name ?? "?"} — {m.tournament} ({m.status})
            </option>
          ))}
        </select>
      </div>

      {selectedMatch && (
        <>
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("bracket")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
                mode === "bracket" ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-white/50 border border-white/10"
              }`}
            >
              <GitBranch className="w-4 h-4" /> Bracket
            </button>
            <button
              onClick={() => setMode("standings")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
                mode === "standings" ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-white/50 border border-white/10"
              }`}
            >
              <Table2 className="w-4 h-4" /> Standings
            </button>
          </div>

          {/* Bracket Editor */}
          {mode === "bracket" && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
              <h3 className="text-white/70 text-sm font-bold">شجرة البطولة</h3>
              
              {/* Existing entries */}
              {bracketEntries.map((entry, idx) => (
                <div key={idx} className="bg-black/30 border border-white/10 rounded-lg p-3 flex items-center gap-3">
                  <span className="text-xs text-primary font-bold">{ROUND_LABELS[entry.round]}</span>
                  <span className="text-white text-sm">{entry.team1Name}</span>
                  <span className="text-white/30 text-xs">vs</span>
                  <span className="text-white text-sm">{entry.team2Name}</span>
                  {entry.score1 !== undefined && entry.score2 !== undefined && (
                    <span className="text-white/50 text-xs">({entry.score1} - {entry.score2})</span>
                  )}
                  <button onClick={() => removeBracketEntry(idx)} className="mr-auto text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Add new entry */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newBracket.round}
                  onChange={e => setNewBracket({ ...newBracket, round: e.target.value as BracketRound })}
                  className="col-span-2 bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-xs outline-none"
                >
                  {Object.entries(ROUND_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input
                  value={newBracket.team1Name}
                  onChange={e => setNewBracket({ ...newBracket, team1Name: e.target.value })}
                  placeholder="Team 1"
                  className="bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-xs outline-none"
                />
                <input
                  value={newBracket.team2Name}
                  onChange={e => setNewBracket({ ...newBracket, team2Name: e.target.value })}
                  placeholder="Team 2"
                  className="bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-xs outline-none"
                />
                <input
                  type="number"
                  value={newBracket.score1 ?? ""}
                  onChange={e => setNewBracket({ ...newBracket, score1: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Score 1"
                  className="bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-xs outline-none"
                />
                <input
                  type="number"
                  value={newBracket.score2 ?? ""}
                  onChange={e => setNewBracket({ ...newBracket, score2: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Score 2"
                  className="bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-xs outline-none"
                />
                <button
                  onClick={addBracketEntry}
                  disabled={!newBracket.team1Name || !newBracket.team2Name}
                  className="col-span-2 bg-primary/20 text-primary border border-primary/30 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> إضافة مباراة
                </button>
              </div>

              {/* Save button */}
              <button
                onClick={saveBracket}
                disabled={saving}
                className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                حفظ Bracket
              </button>
            </div>
          )}

          {/* Standings Editor */}
          {mode === "standings" && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
              <h3 className="text-white/70 text-sm font-bold">جدول المجموعات</h3>
              
              {/* Table header */}
              <div className="grid grid-cols-6 gap-2 text-xs text-white/40 font-bold px-2">
                <span>#</span>
                <span className="col-span-2">Team</span>
                <span>PL</span>
                <span>GD</span>
                <span>PTS</span>
              </div>

              {/* Existing entries */}
              {standingEntries.map((entry, idx) => (
                <div key={idx} className={`grid grid-cols-6 gap-2 items-center bg-black/30 border rounded-lg p-2 text-sm ${
                  entry.isCurrentTeam ? "border-amber-500/50 border-l-4 border-l-amber-400" : "border-white/10"
                }`}>
                  <span className="text-white/50">{entry.position}</span>
                  <span className="col-span-2 text-white truncate">{entry.teamName}</span>
                  <span className="text-white/70">{entry.played}</span>
                  <span className={entry.goalDifference >= 0 ? "text-green-400" : "text-red-400"}>
                    {entry.goalDifference > 0 ? "+" : ""}{entry.goalDifference}
                  </span>
                  <span className="text-white font-bold flex items-center gap-1">
                    {entry.points}
                    <button onClick={() => removeStandingEntry(idx)} className="text-red-400 hover:text-red-300 mr-auto">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              ))}

              {/* Add new entry */}
              <div className="grid grid-cols-6 gap-2">
                <input
                  type="number"
                  value={newStanding.position}
                  onChange={e => setNewStanding({ ...newStanding, position: Number(e.target.value) })}
                  placeholder="#"
                  className="bg-black/50 border border-white/20 rounded-lg px-2 py-2 text-white text-xs outline-none"
                />
                <input
                  value={newStanding.teamName}
                  onChange={e => setNewStanding({ ...newStanding, teamName: e.target.value })}
                  placeholder="Team Name"
                  className="col-span-2 bg-black/50 border border-white/20 rounded-lg px-2 py-2 text-white text-xs outline-none"
                />
                <input
                  type="number"
                  value={newStanding.played}
                  onChange={e => setNewStanding({ ...newStanding, played: Number(e.target.value) })}
                  placeholder="PL"
                  className="bg-black/50 border border-white/20 rounded-lg px-2 py-2 text-white text-xs outline-none"
                />
                <input
                  type="number"
                  value={newStanding.goalDifference}
                  onChange={e => setNewStanding({ ...newStanding, goalDifference: Number(e.target.value) })}
                  placeholder="GD"
                  className="bg-black/50 border border-white/20 rounded-lg px-2 py-2 text-white text-xs outline-none"
                />
                <input
                  type="number"
                  value={newStanding.points}
                  onChange={e => setNewStanding({ ...newStanding, points: Number(e.target.value) })}
                  placeholder="PTS"
                  className="bg-black/50 border border-white/20 rounded-lg px-2 py-2 text-white text-xs outline-none"
                />
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 text-xs text-white/50">
                  <input
                    type="checkbox"
                    checked={!!newStanding.isCurrentTeam}
                    onChange={e => setNewStanding({ ...newStanding, isCurrentTeam: e.target.checked ? 1 : 0 })}
                    className="rounded"
                  />
                  فريق المباراة الحالية
                </label>
                <button
                  onClick={addStandingEntry}
                  disabled={!newStanding.teamName}
                  className="mr-auto bg-primary/20 text-primary border border-primary/30 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> إضافة
                </button>
              </div>

              {/* Save button */}
              <button
                onClick={saveStandings}
                disabled={saving}
                className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                حفظ Standings
              </button>
            </div>
          )}
        </>
      )}

      {!selectedMatchId && (
        <div className="text-center py-12 text-white/30">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>اختر مباراة لتعديل تفاصيلها</p>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [token, setToken] = useState(getToken());
  const [tab, setTab] = useState<"dashboard" | "matches" | "details" | "games" | "teams" | "leagues" | "players" | "visitors" | "feedback">("dashboard");
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Use safe non-destructive sync instead of destructive sync
      const upRes = await adminFetch("/api/admin/sync-upcoming", { method: "POST" });
      const liveRes = await adminFetch("/api/admin/sync-live", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: `✅ تمت المزامنة — ${upRes.added + liveRes.added} مباراة جديدة` });
    } catch (e: any) {
      toast({ title: "خطأ في المزامنة", description: e.message, variant: "destructive" });
    } finally { setSyncing(false); }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
    setToken("");
  };

  if (!token) return <LoginScreen onLogin={setToken} />;

  const tabs = [
    { id: "dashboard" as const, label: "لوحة",       icon: BarChart2 },
    { id: "matches"   as const, label: "مباريات",   icon: Trophy },
    { id: "details"   as const, label: "تفاصيل",    icon: GitBranch },
    { id: "games"     as const, label: "ألعاب",      icon: Gamepad2 },
    { id: "teams"     as const, label: "فرق",        icon: Users },
    { id: "players"   as const, label: "لاعبون",    icon: UserPlus },
    { id: "leagues"   as const, label: "بطولات",    icon: Medal },
    { id: "visitors"  as const, label: "زوار",       icon: UserCheck },
    { id: "feedback"  as const, label: "تقييمات",   icon: Star },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-white/8">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-bold text-white">لوحة الإدارة</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 bg-white/8 hover:bg-white/12 border border-white/10 px-3 py-1.5 rounded-xl text-sm text-white transition"
              data-testid="button-sync"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              مزامنة
            </button>
            <button onClick={logout} className="text-white/40 hover:text-white text-sm px-2 py-1.5 transition" data-testid="button-logout">
              خروج
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-2 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition ${
                tab === t.id ? "bg-primary/20 text-primary" : "text-white/50 hover:text-white"
              }`}
              data-testid={`tab-${t.id}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "matches"   && <MatchesTab />}
        {tab === "details"   && <DetailsTab />}
        {tab === "games"     && <GamesTab />}
        {tab === "teams"     && <TeamsTab />}
        {tab === "players"   && <PlayersTab />}
        {tab === "leagues"   && <LeaguesTab />}
        {tab === "visitors"  && <VisitorsTab />}
        {tab === "feedback"  && <FeedbackTab />}
      </div>
    </div>
  );
}
