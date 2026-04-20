"use client";

import { useApp } from "@/context/AppContext";
import { NAV_ITEMS } from "@/components/Header";

const ALWAYS_VISIBLE = new Set(["/admin"]);

export default function NavConfigTab() {
  const { navVisibility, setNavVisibility } = useApp();

  function toggle(href) {
    if (ALWAYS_VISIBLE.has(href)) return;
    const current = navVisibility[href] !== false;
    setNavVisibility({ ...navVisibility, [href]: !current });
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-3">Visibilidad del menú</h3>
      <p className="text-xs text-[var(--color-muted)] mb-4">
        Elegí qué secciones aparecen en el menú principal. Se guarda en este dispositivo.
      </p>

      <div className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const locked = ALWAYS_VISIBLE.has(item.href);
          const visible = navVisibility[item.href] !== false;
          return (
            <label
              key={item.href}
              className={`flex items-center justify-between px-3 py-2.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg ${
                locked ? "opacity-60" : "cursor-pointer hover:border-[var(--color-accent)]"
              }`}
            >
              <div>
                <span className="text-sm font-medium">{item.label}</span>
                <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">
                  {item.href}
                </span>
                {locked && (
                  <span className="ml-2 text-xs text-[var(--color-muted)]">(fijo)</span>
                )}
              </div>
              <input
                type="checkbox"
                checked={locked ? true : visible}
                disabled={locked}
                onChange={() => toggle(item.href)}
                className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
