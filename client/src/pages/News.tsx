import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, Clock, Trophy, Radio, BellRing, Star, Loader2 } from "lucide-react";
import { api } from "@shared/routes";
import type { MatchWithRelations } from "@shared/schema";
import { useFavorites } from "@/hooks/use-favorites";

interface Article {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: "live" | "following" | "upcoming" | "result";
  game: string;
  date: string;
  readTime: string;
}

function formatArabicDate(value: Date): string {
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatArabicTime(value: Date): string {
  return new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function isFinishedStatus(status: string): boolean {
  return status === "finished" || status === "completed";
}

function buildArticle(match: MatchWithRelations, isFollowing: boolean): Article {
  const start = new Date(match.startTime);
  const isLive = match.status === "live";
  const isFinished = isFinishedStatus(match.status);
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const duel = `${match.team1.name} × ${match.team2.name}`;

  let category: Article["category"] = "upcoming";
  let title = `مواجهة مرتقبة: ${duel}`;
  let summary = `مباراة ${match.game.name} في بطولة ${match.tournament} تنطلق ${formatArabicDate(start)} عند ${formatArabicTime(start)}.`;
  let content = [
    `تتجه الأنظار إلى مواجهة ${duel} ضمن بطولة ${match.tournament} في لعبة ${match.game.name}.`,
    `تنطلق المباراة ${formatArabicDate(start)} عند ${formatArabicTime(start)}، ويمكنك متابعة تفاصيلها لحظة بلحظة من تبويب المباريات في Rivox.`,
    "قبل البداية، راقب حالة الفريقين وسجل المواجهات الأخيرة لتكوين صورة أوضح عن أفضلية كل طرف.",
  ].join("\n\n");

  if (isLive) {
    category = "live";
    title = `مباشر الآن: ${duel}`;
    summary = `المواجهة جارية الآن في ${match.tournament} (${match.game.name}) والنتيجة الحالية ${score1} - ${score2}.`;
    content = [
      `انطلقت مباراة ${duel} في بطولة ${match.tournament}، والمواجهة الآن في طور اللعب المباشر.`,
      `النتيجة الحالية ${score1} - ${score2}، مع احتمالية تغيّر الإيقاع في أي لحظة حسب تقدم الجولات أو المراحل.`,
      "لأفضل تجربة، افتح صفحة المباريات وتابع البطاقة المباشرة لمعرفة كل تحديث فور حدوثه.",
    ].join("\n\n");
  } else if (isFollowing) {
    category = "following";
    title = `لفريقك المتابَع: ${duel}`;
    summary = isFinished
      ? `انتهت مواجهة فريق متابَع لديك بنتيجة ${score1} - ${score2} في ${match.tournament}.`
      : `لديك فريق متابَع في هذه المواجهة ضمن ${match.tournament}. موعد البداية ${formatArabicTime(start)}.`;
    content = [
      `هذه المباراة تخص فريقاً من فرقك المتابَعة: ${duel}.`,
      isFinished
        ? `المواجهة انتهت بنتيجة ${score1} - ${score2}. راجع صفحة المباريات لتحليل السياق الكامل والنتائج المرتبطة.`
        : `موعد الانطلاق ${formatArabicDate(start)} عند ${formatArabicTime(start)}. فعّل المتابعة المباشرة حتى لا يفوتك أي تحديث مهم.`,
      "ميزة المتابعة في Rivox تضمن إبراز مبارياتك الأهم في الأولوية داخل التطبيق.",
    ].join("\n\n");
  } else if (isFinished) {
    category = "result";
    const outcome = score1 === score2
      ? "انتهت بالتعادل"
      : score1 > score2
        ? `حسمها ${match.team1.name}`
        : `حسمها ${match.team2.name}`;

    title = `نتيجة نهائية: ${duel}`;
    summary = `${outcome} بنتيجة ${score1} - ${score2} ضمن منافسات ${match.tournament}.`;
    content = [
      `أسدل الستار على مواجهة ${duel} في بطولة ${match.tournament}.`,
      `${outcome}، وانتهت المباراة بنتيجة ${score1} - ${score2}.`,
      "يمكنك الرجوع لصفحة المباريات لاستعراض بقية النتائج في نفس البطولة ومقارنة أداء الفرق عبر اليوم.",
    ].join("\n\n");
  }

  const readMinutes = Math.max(1, Math.round(content.length / 650));

  return {
    id: match.id,
    title,
    summary,
    content,
    category,
    game: match.game.name,
    date: formatArabicDate(start),
    readTime: `${readMinutes} دقيقة`,
  };
}

function buildArticles(matches: MatchWithRelations[], favorites: number[]): Article[] {
  const favoriteSet = new Set(favorites);
  const now = Date.now();

  // Filter out matches with missing teams
  const validMatches = matches.filter(m => m.team1 && m.team2);

  const priority = (m: MatchWithRelations): number => {
    if (m.status === "live") return 0;
    if (favoriteSet.has(m.team1Id) || favoriteSet.has(m.team2Id)) return 1;
    if (isFinishedStatus(m.status)) return 3;
    return 2;
  };

  return [...validMatches]
    .sort((a, b) => {
      const p = priority(a) - priority(b);
      if (p !== 0) return p;
      return Math.abs(new Date(a.startTime).getTime() - now) - Math.abs(new Date(b.startTime).getTime() - now);
    })
    .slice(0, 40)
    .map((match) => buildArticle(match, favoriteSet.has(match.team1Id) || favoriteSet.has(match.team2Id)));
}

const CATEGORY_STYLES: Record<Article["category"], { label: string; color: string; bg: string }> = {
  live: { label: "مباشر", color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
  following: { label: "متابَعة", color: "text-primary", bg: "bg-primary/20 border-primary/30" },
  upcoming: { label: "قريبًا", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
  result: { label: "نتائج", color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30" },
};

const CATEGORY_ICONS: Record<Article["category"], typeof Trophy> = {
  live: Radio,
  following: BellRing,
  upcoming: Clock,
  result: Trophy,
};

function ArticleCard({ article, onClick }: { article: Article; onClick: () => void }) {
  const cat = CATEGORY_STYLES[article.category];
  const Icon = CATEGORY_ICONS[article.category];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-white/10 rounded-2xl p-5 hover:border-primary/40 hover:bg-card/80 transition-all group"
      data-testid={`card-article-${article.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${cat.bg} ${cat.color}`}>
          <Icon className="w-3 h-3" />
          {cat.label}
        </div>
        <span className="text-[11px] text-white/40">{article.game}</span>
      </div>

      <h3 className="font-bold text-white text-sm leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {article.title}
      </h3>

      <p className="text-xs text-white/55 leading-relaxed line-clamp-2 mb-3">
        {article.summary}
      </p>

      <div className="flex items-center gap-3 text-[11px] text-white/40">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {article.date}
        </div>
        <span>•</span>
        <span>{article.readTime} قراءة</span>
      </div>
    </button>
  );
}

function ArticleView({ article, onBack }: { article: Article; onBack: () => void }) {
  const cat = CATEGORY_STYLES[article.category];
  const Icon = CATEGORY_ICONS[article.category];

  return (
    <div className="flex flex-col overflow-y-auto">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b border-white/10 px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          data-testid="button-back-news"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع للأخبار
        </button>
      </div>

      <div className="px-5 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${cat.bg} ${cat.color}`}>
            <Icon className="w-3 h-3" />
            {cat.label}
          </div>
          <span className="text-xs text-white/40">{article.game}</span>
        </div>

        <h1 className="font-bold text-white text-xl leading-snug">
          {article.title}
        </h1>

        <div className="flex items-center gap-3 text-xs text-white/40">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {article.date}
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" />
            {article.readTime} قراءة
          </div>
        </div>

        <div className="border-t border-white/10" />

        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
          <p className="text-sm text-primary/90 leading-relaxed font-medium">
            {article.summary}
          </p>
        </div>

        <div className="space-y-4 pb-6">
          {article.content.split("\n\n").map((para, idx) => (
            <p key={idx} className="text-sm text-white/70 leading-relaxed">
              {para.trim()}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NewsPage() {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const { favorites } = useFavorites();
  const { data: matches = [], isLoading } = useQuery<MatchWithRelations[]>({ queryKey: [api.matches.list.path] });

  const filtered = useMemo(
    () => buildArticles(matches, favorites),
    [matches, favorites],
  );

  if (selectedArticle) {
    return (
      <AppLayout>
        <ArticleView article={selectedArticle} onBack={() => setSelectedArticle(null)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col w-full">
        <div className="px-5 pt-5 pb-4 border-b border-white/10">
          <h1 className="font-display font-bold text-2xl text-primary mb-1">أخبار الإيسبورت</h1>
          <p className="text-xs text-white/50">آخر الأخبار والتقارير من عالم الرياضة الإلكترونية</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/50 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm">جاري تحميل أخبار المباريات…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/40">
              <Trophy className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">لا توجد أخبار متاحة الآن</p>
            </div>
          ) : (
            filtered.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={() => setSelectedArticle(article)}
              />
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
