import { Card } from "@/components/ui/card";
import { Sparkles, Rocket, Zap, Heart } from "lucide-react";

export function TestTab() {
  return (
    <Card className="p-10 border-border overflow-hidden relative" style={{ background: "var(--gradient-card)" }}>
      <div
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-3xl opacity-20"
        style={{ background: "var(--gradient-hero)" }}
      />

      <div className="relative flex flex-col items-center text-center gap-6">
        <div
          className="size-20 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse"
          style={{ background: "var(--gradient-hero)" }}
        >
          <Sparkles className="size-10 text-primary-foreground" />
        </div>

        <div>
          <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--gradient-hero)" }}>
            Обновление работает! 🎉
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Если ты видишь этот таб — значит загрузка архива через панель прошла успешно,
            фронт пересобрался и сервис перезапустился без ручного вмешательства.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full max-w-md">
          {[
            { icon: Rocket, label: "Деплой", color: "text-cyan-400" },
            { icon: Zap, label: "Скорость", color: "text-yellow-400" },
            { icon: Heart, label: "Без боли", color: "text-pink-400" },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="p-4 rounded-xl bg-secondary/40 border border-border flex flex-col items-center gap-2 hover:scale-105 transition-transform">
              <Icon className={`size-6 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-muted-foreground font-mono">
          build marker: v-test-{new Date().toISOString().slice(0, 10)}
        </div>
      </div>
    </Card>
  );
}