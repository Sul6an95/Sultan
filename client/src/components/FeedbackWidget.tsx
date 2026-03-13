import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Loader2 } from "lucide-react";

const FEEDBACK_KEY = "rivox_feedback_done";
const VISITOR_KEY  = "rivox_visitor_id";

export default function FeedbackWidget() {
  const [gone,    setGone]    = useState(() => !!localStorage.getItem(FEEDBACK_KEY));
  const [open,    setOpen]    = useState(false);
  const [rating,  setRating]  = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  if (gone) return null;

  const close = () => {
    localStorage.setItem(FEEDBACK_KEY, "1");
    setOpen(false);
    setTimeout(() => setGone(true), 300);
  };

  const submit = async () => {
    if (rating === 0) return;
    const visitorId = Number(localStorage.getItem(VISITOR_KEY));
    setLoading(true);
    try {
      if (visitorId) {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId, rating, comment: comment.trim() || null }),
        });
      }
      setDone(true);
      setTimeout(close, 1500);
    } catch {
      close();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Fixed star button — bottom-left, above nav */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-40 w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center hover:bg-amber-500/30 transition shadow-lg"
        aria-label="تقييم التطبيق"
      >
        <Star className="w-5 h-5 text-amber-400" fill="#f59e0b" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={close}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none"
            >
              <div
                className="bg-[#141420] border border-white/10 rounded-2xl p-5 shadow-2xl w-full max-w-sm pointer-events-auto"
                dir="rtl"
                onClick={(e) => e.stopPropagation()}
              >
                {done ? (
                  <div className="flex flex-col items-center py-4 gap-2">
                    <span className="text-3xl">🎉</span>
                    <p className="text-white font-bold text-sm">شكراً على تقييمك!</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-white font-bold text-sm">كيف تجد التطبيق؟</p>
                      <button onClick={close} className="text-white/30 hover:text-white transition">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-4">
                      {[1,2,3,4,5].map((n) => (
                        <button
                          key={n}
                          onMouseEnter={() => setHovered(n)}
                          onMouseLeave={() => setHovered(0)}
                          onClick={() => setRating(n)}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            className="w-8 h-8 transition-colors"
                            fill={(hovered || rating) >= n ? "#f59e0b" : "transparent"}
                            stroke={(hovered || rating) >= n ? "#f59e0b" : "#ffffff40"}
                          />
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="ملاحظة اختيارية..."
                      rows={2}
                      style={{ color: "#ffffff", caretColor: "#ffffff" }}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm outline-none placeholder:text-white/25 resize-none mb-3 focus:border-violet-500 transition"
                    />

                    <button
                      onClick={submit}
                      disabled={rating === 0 || loading}
                      className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition text-sm"
                    >
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإرسال...</> : "أرسل التقييم"}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
