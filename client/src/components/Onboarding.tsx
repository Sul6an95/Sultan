import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

const VISITOR_KEY = "rivox_visitor_id";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^\+?[0-9\s\-().]{7,20}$/;

function validate(value: string): string | null {
  const v = value.trim();
  if (!v) return "الحقل مطلوب";
  if (!emailRe.test(v) && !phoneRe.test(v))
    return "يرجى إدخال بريد إلكتروني أو رقم جوال صحيح";
  return null;
}

export function hasRegistered(): boolean {
  return !!localStorage.getItem(VISITOR_KEY);
}

interface Props {
  onDone: () => void;
}

export default function Onboarding({ onDone }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(value);
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "حدث خطأ");
      localStorage.setItem(VISITOR_KEY, String(data.id));
      onDone();
    } catch (e: any) {
      setError(e.message || "حدث خطأ، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0f] px-4"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          {/* Logo / Brand */}
          <div className="flex flex-col items-center mb-10 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M6 16L16 6L26 16L16 26L6 16Z" fill="white" fillOpacity="0.9" />
                <path d="M11 16L16 11L21 16L16 21L11 16Z" fill="white" fillOpacity="0.3" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Rivox</h1>
            <p className="text-white/50 text-sm text-center leading-relaxed">
              منصتك لمتابعة نتائج وبطولات الألعاب الإلكترونية
            </p>
          </div>

          {/* Card */}
          <form
            onSubmit={submit}
            className="bg-white/4 border border-white/10 rounded-3xl p-6 space-y-5 shadow-xl shadow-black/40"
          >
            <div>
              <p className="text-white font-bold text-base mb-1">مرحباً بك! 👋</p>
              <p className="text-white/50 text-sm">أدخل بريدك الإلكتروني أو رقم جوالك للمتابعة</p>
            </div>

            <div className="space-y-1.5">
              <input
                type="text"
                value={value}
                onChange={e => { setValue(e.target.value); setError(""); }}
                placeholder="example@mail.com أو 05xxxxxxxx"
                autoFocus
                style={{ color: "#ffffff", caretColor: "#ffffff" }}
                className={`w-full bg-white/[0.08] border rounded-xl px-4 py-3 text-sm outline-none placeholder:text-white/30 transition ${
                  error ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-violet-500"
                }`}
              />
              {error && (
                <p className="text-red-400 text-xs px-1">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition text-sm"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التسجيل...</>
                : "ادخل التطبيق →"
              }
            </button>

            <p className="text-white/25 text-xs text-center">
              بياناتك محمية ولن تُشارك مع أي طرف ثالث
            </p>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
