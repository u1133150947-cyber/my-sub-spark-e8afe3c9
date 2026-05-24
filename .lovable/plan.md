# Переход на Sidebar + TopBar архитектуру

Большой структурный рефакторинг: текущие Tabs в `Index.tsx` заменяются на левый Sidebar + верхний TopBar, а вкладки превращаются в полноценные роуты React Router.

## Что изменится

### Новые файлы

```
src/modules/layout/
├── navConfig.ts        — конфигурация меню (секции + пункты)
├── AppSidebar.tsx      — левая панель на shadcn Sidebar (collapsible="icon")
└── AppTopBar.tsx       — шапка: SidebarTrigger, поиск, онлайн, меню

src/modules/dashboard/DashboardPage.tsx   — обёртка над StatsDashboard
src/modules/subs/SubsListPage.tsx         — обёртка над SubsTab
src/modules/subs/SubsCreatePage.tsx       — форма создания (из текущего SubsTab)
src/modules/subs/SubsBulkPage.tsx         — bulk операции
src/modules/panels/PanelsListPage.tsx     — обёртка над PanelsManager
src/modules/panels/InboundsPage.tsx       — обёртка над InboundsManager
src/modules/panels/HealthPage.tsx         — health check
src/modules/logs/ClientLogsPage.tsx       — клиентские appLogs
src/modules/serverLogs/ServerLogsPage.tsx — серверные (переиспользовать LogsTab)
```

### Изменяемые файлы

- `src/pages/Index.tsx` — превращается в shell: Sidebar + TopBar + `<Routes>` для подстраниц. Вся текущая логика `useSubsManager` поднимается в shell и передаётся через Outlet context (или используется на страницах напрямую).
- `src/App.tsx` — маршрут `/` теперь рендерит Index с вложенными роутами (`/dashboard`, `/subs`, `/subs/create`, `/subs/bulk`, `/panels`, `/inbounds`, `/health`, `/logs/client`, `/logs/server`).

### Используемые компоненты

Использую shadcn `Sidebar` (`src/components/ui/sidebar.tsx`) согласно guideline: `collapsible="icon"`, `SidebarTrigger` в шапке, активный пункт через `NavLink`/`useLocation`. **Не** делаю кастомный `<aside>` из примера пользователя — shadcn даёт mobile drawer, keyboard shortcut и стейт автоматически.

## Технические детали

- **Состояние `useSubsManager`**: вызывается один раз в `Index` shell, прокидывается через `Outlet context` (`useOutletContext`), чтобы не дублировать загрузку данных и сохранить онлайн-счётчик.
- **Гитнор**: папка `src/modules/logs` ранее попадала под `logs` в `.gitignore`. `ClientLogsPage.tsx` положу в `src/modules/clientLogs/`, серверный лог остаётся в `src/modules/serverLogs/`.
- **Иконки**: lucide-react (LayoutDashboard, Key, Plus, Settings, Server, Network, Activity, User, Terminal, LogOut) — не эмодзи, чтобы соответствовать дизайн-системе.
- **Дизайн-токены**: только семантические классы (`bg-sidebar`, `text-sidebar-foreground`, `bg-primary` и т.д.), без хардкода цветов.
- **Mobile**: shadcn Sidebar сам переключается в Sheet < md.
- **Fallback роут**: `/` → redirect на `/dashboard`.

## Объём и риски

- ~12 новых файлов, переписывание `Index.tsx` и `App.tsx`.
- Риск: текущий `useSubsManager` (689 строк) тесно связан с Tabs (`activeTab`). Нужно проверить, что переключение по роутам не ломает lazy-загрузку вкладок (где есть `active={activeTab === "..."}` пропсы — заменить на `true` на своей странице).
- Существующие компоненты (`SubsTab`, `PanelsManager`, `InboundsManager`, `StatsDashboard`, `OnlineClients`, `LogsTab`) **не трогаю** — только оборачиваю в Page-компоненты.
- После рефакторинга `Index.tsx` сократится с ~156 строк до ~40 (только shell с роутами).

## Что НЕ входит

- Поиск в TopBar — добавлю заглушку с TODO, реальный глобальный поиск отдельной задачей.
- Уведомления (Bell) — пропускаю до отдельного запроса.
- Тема оформления в dropdown — пропускаю.
- Перенос логики формы создания подписки из `SubsTab` в отдельный `SubsCreatePage` — на первой итерации `SubsCreatePage` просто рендерит `<SubsTab defaultMode="create" />` (если такой пропс есть) или дублирует существующий UI. Полное разделение — отдельная задача.

## Подтверждение

Это большой рефакторинг (~1.5-2 часа работы агента, много токенов). Подтверди:
1. Делать в один проход всё, или поэтапно (сначала Sidebar+TopBar+routing, потом расщепление страниц)?
2. ОК использовать shadcn Sidebar вместо кастомного `<aside>` из твоего примера?
3. Оставлять текущий `Index.tsx` с Tabs до полной готовности нового, или сразу заменять?
