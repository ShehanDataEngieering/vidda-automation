# UI Component Libraries — Dialog, Toast, Tabs/Tooltip, Dashboard Cards

Primary-source research pass on four gaps in the frontend's shadcn/ui-style component set (`frontend/src/components/ui/`), done ahead of implementing `dialog.tsx`, `alert-dialog.tsx`, a toast solution, `tabs.tsx`/`tooltip.tsx`, and a dashboard stat-card primitive. Findings are decision-ready — code shapes below are meant to be copied into this repo, adapted to its existing conventions.

Compiled 2026-09-05.

**Repo convention baseline** (read from the existing `ui/*.tsx` files before writing anything below): every primitive wraps a single `@radix-ui/react-*` package (not the consolidated `radix-ui` meta-package), uses `React.forwardRef` + `.displayName = '...'` (not shadcn's newer `data-slot` function-component style), imports `cn` from `@/lib/utils`, and — where variants exist — uses `cva`. See [`frontend/src/components/ui/button.tsx`](../../frontend/src/components/ui/button.tsx), [`badge.tsx`](../../frontend/src/components/ui/badge.tsx), and [`dropdown-menu.tsx`](../../frontend/src/components/ui/dropdown-menu.tsx). shadcn/ui's own repo has since moved to a `new-york-v4` registry that imports from the consolidated `"radix-ui"` package and uses `data-slot` function components instead of `forwardRef` — that newer file shape is **not** what this repo should copy verbatim; the component *anatomy* (which Radix parts get wrapped, in what order) is the primary-source fact worth taking, the file-authoring style should stay consistent with this repo's existing `dropdown-menu.tsx`.

**Setup gap already latent in this repo:** `frontend/tailwind.config.js` has `plugins: []` and `frontend/package.json` has no `tailwindcss-animate` dependency, yet [`dropdown-menu.tsx`](../../frontend/src/components/ui/dropdown-menu.tsx) already ships `data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 zoom-in-95` classes, and [`RiskAssessment.tsx`](../../frontend/src/screens/RiskAssessment.tsx)'s hand-rolled modal uses `animate-in fade-in duration-150`. `animate-in`/`fade-in-*`/`zoom-in-*`/`slide-in-from-*` are not core Tailwind utilities — they are defined by the [`tailwindcss-animate`](https://github.com/jamiebuilds/tailwindcss-animate) plugin, which shadcn/ui's own project templates register by default. Because it isn't installed or registered here, every such class currently generates no CSS and silently no-ops. Any new Dialog/AlertDialog/Tabs/Tooltip component copied from shadcn's reference will carry the same classes, so this should be fixed once, centrally: add `"tailwindcss-animate": "^1.0.7"` to `frontend/package.json` devDependencies and `require('tailwindcss-animate')` to the `plugins: []` array in `frontend/tailwind.config.js`. Package/source: [`jamiebuilds/tailwindcss-animate` on GitHub](https://github.com/jamiebuilds/tailwindcss-animate).

---

## 1. Dialog / AlertDialog

### What Radix gives for free
[Radix UI's Dialog primitive docs](https://www.radix-ui.com/primitives/docs/components/dialog) state the component "adheres to the [Dialog WAI-ARIA design pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)" and that "Focus is automatically trapped within the modal" and Escape "closes the dialog and moves focus to `Dialog.Trigger`" — exactly the behavior this repo's hand-rolled modal in [`RiskAssessment.tsx`](../../frontend/src/screens/RiskAssessment.tsx) (the `modalDim` override modal, lines ~330–388: a raw `fixed inset-0` div with a manual `X` close button, no focus trap, no Escape handling, no `aria-modal`) does not have.

The anatomy per Radix's own docs:
```jsx
import { Dialog } from "radix-ui";
<Dialog.Root>
  <Dialog.Trigger />
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title />
      <Dialog.Description />
      <Dialog.Close />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```
Source: [Radix UI — Dialog](https://www.radix-ui.com/primitives/docs/components/dialog).

### AlertDialog is a separate package
[Radix UI's Alert Dialog docs](https://www.radix-ui.com/primitives/docs/components/alert-dialog) confirm AlertDialog "Adheres to the [Alert and Message Dialogs WAI-ARIA design pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)" and exports `Root, Trigger, Portal, Overlay, Content, Title, Description, Cancel, Action` — note **`Cancel`/`Action`** replace plain `Close`, because an alert dialog must force an explicit accept-or-cancel choice rather than a dismiss-anywhere close. Confirmed via `npm view @radix-ui/react-alert-dialog dependencies`: it depends on `@radix-ui/react-dialog@1.1.23` internally (AlertDialog is built as a stricter wrapper *around* Dialog) but ships as its **own installable npm package**, `@radix-ui/react-alert-dialog` — this repo's `package.json` does not have it yet (it has `@radix-ui/react-dialog@^1.1.15` only) and it will need to be added.

### shadcn/ui's reference file shape
Pulled from shadcn/ui's own repo (`shadcn-ui/ui`, `apps/v4/registry/new-york-v4/ui/dialog.tsx` and `alert-dialog.tsx` — the current official reference implementation): [dialog.tsx source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/dialog.tsx), [alert-dialog.tsx source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/alert-dialog.tsx). Structurally both wrap the Radix anatomy above 1:1, plus:
- `DialogContent` renders `DialogOverlay` + `DialogPrimitive.Content` inside a `DialogPortal`, and includes a built-in `X` close button (lucide's `XIcon`) with `<span className="sr-only">Close</span>`, toggleable via a `showCloseButton` prop.
- Both add `DialogHeader`/`DialogFooter` and `AlertDialogHeader`/`AlertDialogFooter` as plain styled `<div>`s (not Radix parts) for layout.
- `AlertDialogAction`/`AlertDialogCancel` render the repo's own `Button` via `asChild`, so they visually match `variant="default"`/`variant="outline"` buttons instead of being unstyled Radix elements.
- Overlay: `fixed inset-0 z-50 bg-black/50` with `data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0`.
- Content: centered via `fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]`, `data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95`.

### Adapted to this repo's exact style
`frontend/src/components/ui/dialog.tsx` (mirrors `dropdown-menu.tsx`'s forwardRef pattern, single-package import):
```tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-sm font-semibold leading-none tracking-tight', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-xs text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger,
  DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
};
```

`frontend/src/components/ui/alert-dialog.tsx` follows the identical shape but imports `@radix-ui/react-alert-dialog` (new dependency to add), swaps `DialogClose` for `AlertDialogCancel`/`AlertDialogAction` built on the existing `Button` via `asChild`, and drops the free-floating `X` close button (an alert dialog should not be dismissible except via an explicit choice):
```tsx
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { buttonVariants } from '@/components/ui/button';
// ...same Overlay/Content/Header/Footer/Title/Description shapes as dialog.tsx...
// (only buttonVariants is needed here, not Button itself — this repo's tsconfig
//  has noUnusedLocals-style checks, per dropdown-menu.tsx's own
//  `// suppress unused imports` comment, so don't import Button unused)

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel ref={ref} className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0')} {...props} />
));
```

### Applying it to the two flagged spots
- **`RiskAssessment.tsx`'s Override Modal**: replace the raw `{modalDim && (<div className="fixed inset-0 ...">`  block (lines 330–388) with `<Dialog open={!!modalDim} onOpenChange={(o) => !o && setModalDim(null)}><DialogContent>...</DialogContent></Dialog>` — gets focus trap, Escape-to-close, and `aria-modal` for free, removing the need for the manual `X`-button `Button` at line 335.
- **`AMLRMapping.tsx`'s `regenerateAMLR`** (line 124–136, currently `if (!confirm('Regenerating will replace all current mappings...')) return;`): replace `window.confirm` with an `AlertDialog` — `AlertDialogAction` fires the existing regenerate logic (the `api(...).then(...)` chain), `AlertDialogCancel` does nothing (dialog just closes). This is the textbook case Radix's own docs describe the AlertDialog for: a destructive action needing an accessible, styleable, non-native confirm.

**Package(s):** `@radix-ui/react-dialog` (already a dependency), `@radix-ui/react-alert-dialog` (to add).
**Source(s):** [Radix UI — Dialog](https://www.radix-ui.com/primitives/docs/components/dialog), [Radix UI — Alert Dialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog), [shadcn/ui — dialog.tsx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/dialog.tsx), [shadcn/ui — alert-dialog.tsx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/alert-dialog.tsx).
**Recommendation:** Build both. Add `@radix-ui/react-alert-dialog` as a new dependency (it is not a re-export of `react-dialog`, despite depending on it internally). Use `Dialog` for `RiskAssessment.tsx`'s override modal and `AlertDialog` for `AMLRMapping.tsx`'s `regenerateAMLR` confirm — the latter is a one-line swap (`confirm(...)` → an `AlertDialog` with the same message as the description) that removes a native-browser dialog that cannot be styled, tested, or made consistent with the rest of the UI.

---

## 2. Toast / notification

### Two real options, one already deprecated by its own maintainer
**Option A — `@radix-ui/react-toast`.** [Radix UI's Toast docs](https://www.radix-ui.com/primitives/docs/components/toast) show the anatomy as `Provider, Viewport, Root, Title, Description, Action, Close`, and state plainly: "The provider that wraps your toasts and toast viewport. It usually wraps the application" — i.e. `Toast.Provider` + `Toast.Viewport` must be mounted once near the app root, and then each toast is its own `Toast.Root` mounted (usually via a small state store) into that viewport. It supports `aria-live` semantics via a `type` prop (`"foreground"` announces immediately, `"background"` waits its turn) — genuinely more primitive-level accessibility control than a toast library typically exposes, but at the cost of the caller having to build the queue/store themselves; Radix does not ship a `toast()` function, only the DOM primitives.

**Option B — [sonner](https://github.com/emilkowalski/sonner).** Not a Radix primitive; a standalone, opinionated toast library. Its own README shows the entire setup as:
```jsx
import { Toaster, toast } from 'sonner';

function App() {
  return (
    <div>
      <Toaster />
      <button onClick={() => toast('My first toast')}>Give me a toast</button>
    </div>
  );
}
```
Source: [sonner README](https://github.com/emilkowalski/sonner/blob/main/README.md). One `<Toaster />` mounted once, then `toast(...)` (and `toast.success(...)`, `toast.error(...)`, `toast.promise(...)`) callable from anywhere — no manual state/queue management, unlike Radix's Toast.

**shadcn/ui's own position, verified from source, not inferred:** shadcn/ui's current documentation source (`shadcn-ui/ui` repo, `apps/v4/content/docs/components/radix/toast.mdx`) contains, verbatim, as the entire page body:
> "The toast component has been deprecated. Use the [sonner](/docs/components/radix/sonner) component instead."

Source: [shadcn/ui — toast.mdx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/components/radix/toast.mdx) (raw source; the old `@radix-ui/react-toast`-based `Toast`/`Toaster`/`useToast` component has been fully removed from shadcn's current registry — there is no `toast.tsx` in `apps/v4/registry/new-york-v4/ui/` any more, confirmed by listing that directory's contents, only `sonner.tsx` remains). shadcn/ui's `sonner.mdx` docs page confirms the install path is `npx shadcn@latest add sonner`, which installs `sonner` + `next-themes` and drops in a `components/ui/sonner.tsx` wrapper. Source: [shadcn/ui — sonner.mdx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/components/radix/sonner.mdx).

### shadcn's reference wrapper (adapt, don't copy verbatim)
```tsx
// shadcn/ui reference — apps/v4/registry/new-york-v4/ui/sonner.tsx
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "next-themes"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  return (
    <Sonner theme={theme as ToasterProps["theme"]} className="toaster group"
      style={{ "--normal-bg": "var(--popover)", "--normal-text": "var(--popover-foreground)", "--normal-border": "var(--border)" } as React.CSSProperties}
      {...props} />
  )
}
```
Source: [shadcn/ui — sonner.tsx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/sonner.tsx). This repo is a Vite SPA, not Next.js, so `next-themes` doesn't apply — swap `useTheme` for the repo's own hook at [`frontend/src/components/theme-provider.tsx`](../../frontend/src/components/theme-provider.tsx) (`import { useTheme } from '@/components/theme-provider'`, already used by [`components/theme-toggle.tsx`](../../frontend/src/components/theme-toggle.tsx)), which exposes the same `theme: 'light' | 'dark' | 'system'` shape sonner's `theme` prop expects. `frontend/src/components/ui/sonner.tsx`:
```tsx
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/components/theme-provider';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();
  return <Sonner theme={theme as ToasterProps['theme']} className="toaster group" {...props} />;
};
export { Toaster };
```
Mount once in `frontend/src/App.tsx` (inside `<ThemeProvider>`, alongside the router): `<Toaster />`. Fire from any screen: `import { toast } from 'sonner'; toast.error('Failed to load dashboard');`.

### Applying it to the flagged gap
`PipelinePage.tsx`'s `loadDashboard` (lines 69–85) has two separate failure paths, neither surfaced to the user. First, `fetch` (and this repo's `api()` wrapper around it) does not reject on HTTP error statuses — a 401/500 response resolves normally, so `plansRes.ok`/`assignRes.ok` is simply `false` and the surrounding `if (plansRes.ok) {...}` has no `else`: nothing runs, nothing throws, the dashboard just renders empty with no error shown. Second, the `try {...} finally { setLoading(false) }` block has **no `catch`**, and the call site is `void loadDashboard();` (line 65) with no `.catch()` either — so if `api()` itself throws (e.g. a network failure, matching the `catch { setError('Connection error'); }` pattern already used for the same call in `RiskAssessment.tsx`/`AMLRMapping.tsx`), the rejection is never caught anywhere and becomes an unhandled promise rejection, while `setLoading(false)` still runs via `finally`. Minimal fix once sonner is wired up, closing both paths:
```tsx
async function loadDashboard() {
  setLoading(true);
  try {
    const plansRes = await api('/api/pipeline');
    if (plansRes.ok) setPlans(await plansRes.json());
    else toast.error('Could not load plans');
    const assignRes = await api('/api/pipeline/assignments/all');
    if (assignRes.ok) setAssignments(await assignRes.json());
    else toast.error('Could not load assignments');
  } catch {
    toast.error('Connection error — dashboard may be out of date');
  } finally {
    setLoading(false);
  }
}
```
The same pattern (a local `error` string state rendered as a static red banner div) recurs in `RiskAssessment.tsx` and `AMLRMapping.tsx` — those can stay as inline banners for *persistent* validation-type errors tied to a specific section of the page, but transient async failures (a fetch that failed, a save that succeeded) are exactly what toasts are for, and migrating those `setError(...)` calls to `toast.error(...)`/`toast.success(...)` removes several near-duplicate banner-rendering blocks.

Beyond plain `toast(...)`, sonner's own API reference documents `toast.success(...)` ("renders a checkmark icon in front of the message"), `toast.error(...)` ("renders an error icon in front of the message"), `toast.loading(...)`, and `toast.promise(...)` ("starts in a loading state and will update automatically after the promise resolves or fails") — confirmed on sonner's own docs site, not assumed. Source: [sonner — Toast API reference](https://sonner.emilkowal.ski/toast).

**Package(s):** `sonner` (recommended, new dependency) vs. `@radix-ui/react-toast` (not recommended, not currently a dependency).
**Source(s):** [Radix UI — Toast](https://www.radix-ui.com/primitives/docs/components/toast), [sonner README](https://github.com/emilkowalski/sonner/blob/main/README.md), [sonner — Toast API reference](https://sonner.emilkowal.ski/toast), [shadcn/ui — toast.mdx (deprecation notice)](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/components/radix/toast.mdx), [shadcn/ui — sonner.mdx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/components/radix/sonner.mdx).
**Recommendation:** Use **sonner**, not `@radix-ui/react-toast`. shadcn/ui — the exact pattern this repo already follows for every other primitive — has fully deprecated its Radix-toast-based component in favor of sonner; building fresh on the deprecated primitive today would mean adopting a pattern shadcn itself no longer maintains or documents. sonner is also simply less code to own: no manual `Provider`/`Viewport`/queue-state wiring, just one `<Toaster />` and a `toast()` call, which fits the "swap `setError` local state for one line" use case described above far better than assembling a queue on top of Radix's raw primitives would.

---

## 3. Tabs / Tooltip

### Tabs — accessibility Radix gives for free that the hand-rolled version lacks
[Radix UI's Tabs docs](https://www.radix-ui.com/primitives/docs/components/tabs) list the exported parts as `Root, List, Trigger, Content`, state the component "adheres to the [Tabs WAI-ARIA design pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)", and specify keyboard behavior: **Tab** moves focus into/out of the tab list to the active content; **Arrow Left/Right (or Up/Down for vertical)** move focus *and activate* the adjacent trigger; **Home/End** jump to the first/last trigger. This is **roving tabindex** — only the active trigger is in the normal Tab order (`tabIndex=0`), every other trigger is `tabIndex=-1` and reachable only by arrow keys — plus the correct ARIA role wiring (`role="tablist"` on the list, `role="tab"` + `aria-selected` + `aria-controls` on each trigger, `role="tabpanel"` + `aria-labelledby` on the content), all managed internally by Radix's `Root`/`List`/`Trigger`/`Content` state machine.

None of that exists in this repo's two hand-rolled tab bars in [`TrainingPlan.tsx`](../../frontend/src/screens/TrainingPlan.tsx):
- **"Training Plan | Audit Trail"** (lines ~127–137): two raw `<button>`s, each independently focusable via normal Tab order (not roving), no `role`, no `aria-selected`, active state driven purely by a manual `activeTab === 'plan' ? '...' : '...'` className ternary.
- **Q1–Q4 quarter tabs** (lines ~210–224): same pattern — a `.map` over `['Q1','Q2','Q3','Q4']` rendering raw `<button>`s with a manual `active` boolean and no keyboard support beyond default button Tab/Enter/Space.

shadcn/ui's reference (`apps/v4/registry/new-york-v4/ui/tabs.tsx`, [source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/tabs.tsx)) wraps `Root/List/Trigger/Content` with Tailwind classes keyed off Radix's own `data-state=active` / `data-orientation` attributes — no manual boolean/ternary needed at all, the active-state styling is driven by Radix's internal state via CSS attribute selectors. Adapted to this repo's forwardRef style:
```tsx
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn('inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground', className)} {...props} />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger ref={ref} className={cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
    className
  )} {...props} />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn('mt-2', className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```
`TrainingPlan.tsx`'s top bar becomes `<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'plan' | 'audit')}><TabsList><TabsTrigger value="plan">Training Plan</TabsTrigger><TabsTrigger value="audit">Audit Trail</TabsTrigger></TabsList></Tabs>`, with the existing `{activeTab === 'plan' && <>...}` blocks becoming `<TabsContent value="plan">`/`<TabsContent value="audit">`. Same transform for the Q1–Q4 bar, `value` typed as the union `'Q1'|'Q2'|'Q3'|'Q4'`.

### Tooltip — for icon-only buttons with only an `aria-label`
[Radix UI's Tooltip docs](https://www.radix-ui.com/primitives/docs/components/tooltip) give the anatomy `Provider, Root, Trigger, Content, Arrow` — `Provider` wraps the app once (controls shared `delayDuration` etc.), each tooltip instance is its own `Root`/`Trigger`/`Content`. This matters distinctly from `aria-label`: an `aria-label` is announced to screen-reader users but is invisible to *sighted* mouse/keyboard users, who currently have no way to discover what an icon-only button does except guessing or trial-and-error. A visible Radix tooltip on hover/focus makes the same label discoverable to everyone, closing that gap for spots like the theme toggle ([`components/theme-toggle.tsx`](../../frontend/src/components/theme-toggle.tsx), which currently only has a `title="Toggle theme"` attribute — a native browser tooltip, inconsistent styling, delayed/inconsistent across browsers) and the bare `<button onClick={...}><Trash2 /></button>` delete icons with no label at all in [`AMLRMapping.tsx`](../../frontend/src/screens/AMLRMapping.tsx) line 305 and [`TrainingPlan.tsx`](../../frontend/src/screens/TrainingPlan.tsx) line 267.

shadcn/ui's reference (`apps/v4/registry/new-york-v4/ui/tooltip.tsx`, [source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/tooltip.tsx)) wraps `Provider` (with `delayDuration = 0` as the shadcn default), `Root`, `Trigger`, and a `Content` that renders inside `TooltipPrimitive.Portal` with an `Arrow`. Adapted:
```tsx
import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content ref={ref} sideOffset={sideOffset}
      className={cn('z-50 overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs text-background animate-in fade-in-0 zoom-in-95', className)}
      {...props} />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
```
One `<TooltipProvider>` should wrap the app root (e.g. in `App.tsx`, alongside `ThemeProvider`); each icon button becomes `<Tooltip><TooltipTrigger asChild><button aria-label="Delete mapping" onClick={...}><Trash2 className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Delete mapping</TooltipContent></Tooltip>` — keep the `aria-label` (screen readers still benefit from it being on the trigger element directly) and add the visible `TooltipContent` on top of it, they are complementary, not a replacement for each other. One exception: [`components/theme-toggle.tsx`](../../frontend/src/components/theme-toggle.tsx) currently has both `aria-label`-equivalent semantics *and* a native `title="Toggle theme"` attribute — when wrapping this specific button in a Radix `Tooltip`, remove the `title` attribute (keep `aria-label`), otherwise the browser's native title tooltip and the new Radix tooltip both render on hover.

**Package(s):** `@radix-ui/react-tabs`, `@radix-ui/react-tooltip` (both already dependencies — currently unused).
**Source(s):** [Radix UI — Tabs](https://www.radix-ui.com/primitives/docs/components/tabs), [Radix UI — Tooltip](https://www.radix-ui.com/primitives/docs/components/tooltip), [shadcn/ui — tabs.tsx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/tabs.tsx), [shadcn/ui — tooltip.tsx](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/tooltip.tsx), [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
**Recommendation:** Build both — the packages are already installed and unused, so there's no new dependency weight, only the wrapper files above. Replace both hand-rolled tab bars in `TrainingPlan.tsx` with `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (gets roving tabindex + correct ARIA roles for free, and deletes the manual active-state ternaries). Add `Tooltip` around the theme toggle and every icon-only delete/trash button, keeping the existing `aria-label`s in place rather than removing them.

---

## 4. Dashboard stat cards / charts

### The three existing hand-rolled versions
- [`PipelinePage.tsx`](../../frontend/src/screens/PipelinePage.tsx) lines 19–50: a local `MetricCard({ label, value, sub, icon, trend })` function, built from the existing `Card`/`CardContent` primitives, rendering an icon in a rounded box, a label, a big value, an optional `sub` line, and an optional green `trend` line with a `TrendingUp` icon.
- [`LMSView.tsx`](../../frontend/src/screens/LMSView.tsx) line 62–65: an inline `grid grid-cols-3 gap-4` of three `<Card className="shadow-sm"><CardContent className="py-4 text-center">` blocks, each just a big `<p className="text-3xl font-bold">` value and an `<p className="text-xs text-muted-foreground">` label — no icon, no trend, centered text instead of `MetricCard`'s left-aligned icon layout.
- [`UserManagement.tsx`](../../frontend/src/screens/UserManagement.tsx) lines 158–191: another inline `grid grid-cols-3 gap-3` of three `<Card><CardContent className="pt-4 pb-4 flex items-center gap-3">` blocks — a third distinct layout (icon-left, text-right, flex row) for conceptually the same "one number + one label" stat tile.

Three screens, three different hand-authored layouts for the same UI concept (a labeled number in a card), none sharing code.

### Option (a): extract a shared `StatCard`
No new dependency — built on the `Card`/`CardContent` primitives already in `frontend/src/components/ui/card.tsx` ([source](../../frontend/src/components/ui/card.tsx)), which is itself already a hand-vendored copy of shadcn's `Card` convention. A single component absorbs all three current shapes via optional props:
```tsx
// frontend/src/components/ui/stat-card.tsx
import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label, value, sub, icon: Icon, trend, className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ElementType;
  trend?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          {trend && <p className="text-xs text-emerald-600 mt-1.5">{trend}</p>}
        </div>
        {Icon && (
          <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```
`LMSView.tsx`'s three tiles become `<StatCard label="Completion" value={`${pct}%`} />`, etc. (icon omitted, matches its current no-icon look); `UserManagement.tsx`'s become `<StatCard icon={Users} label="..." value={...} />`; `PipelinePage.tsx`'s `MetricCard` calls become `StatCard` calls unchanged in shape. This deletes the local `MetricCard` function and the two inline grids, replacing all three with one imported component — zero new runtime dependency, zero new bundle weight.

### Option (b): Tremor (`@tremor/react`)
Tremor's own docs ([npm.tremor.so/docs/ui/card](https://npm.tremor.so/docs/ui/card)) show `Card` taking a `decoration`/`decorationColor` prop for a colored accent border, and combine it with `Metric`/`Text` for the number/label pair: `import { Card, Metric, Text } from '@tremor/react'`. Its `BadgeDelta` component ([npm.tremor.so/docs/ui/badges](https://npm.tremor.so/docs/ui/badges)) takes `deltaType` (`"increase" | "moderateIncrease" | "unchanged" | "moderateDecrease" | "decrease"`, default `"increase"`), `isIncreasePositive` (boolean, default `true`, controls whether an increase renders green or red), and `size`, e.g.:
```jsx
import { BadgeDelta, Card } from '@tremor/react';
<Card><BadgeDelta deltaType="moderateIncrease" isIncreasePositive size="xs">+9.3%</BadgeDelta></Card>
```
Tremor also ships full chart components (`AreaChart`, `BarChart`, `LineChart`, etc., built on Recharts) under the same package — this is the part of Tremor that would actually earn its dependency weight, not the stat-tile primitives, which are simple enough to hand-build. Current published version confirmed via `npm view @tremor/react`: `3.18.7`, peer deps `react@^18.0.0` (compatible with this repo's React 18).

### The deciding fact
A repo-wide search for actual chart usage (`grep -rli "chart\|recharts\|sparkline" frontend/src`) turns up exactly three hits — `ComparisonView.tsx`, `PipelinePage.tsx`, `RiskAssessment.tsx` — and every one of them is the lucide-react `BarChart3` **icon**, not a rendered chart. There is no line chart, bar chart, sparkline, or trend visualization anywhere in the current codebase; every "metric" so far is a single static number in a card. Pulling in a ~react peer-dependent component library whose main differentiator is its chart set, to render three static numbers, is dependency weight with no corresponding payoff yet.

**Package(s):** Option (a): none (uses existing `Card`/`CardContent`). Option (b): `@tremor/react` (not currently a dependency).
**Source(s):** [Tremor — Card docs](https://npm.tremor.so/docs/ui/card), [Tremor — Badges/BadgeDelta docs](https://npm.tremor.so/docs/ui/badges), [`frontend/src/components/ui/card.tsx`](../../frontend/src/components/ui/card.tsx).
**Recommendation:** **Option (a) — extract a shared `StatCard`.** No new dependency, matches the pattern this repo already follows for every other primitive (hand-vendor a small component on top of existing building blocks), and directly eliminates the three duplicated layouts. Revisit Tremor only if/when an actual chart (e.g. a completion-rate trend line, a module-status-over-time visualization) is scoped — at that point Tremor's `AreaChart`/`BarChart` (not its `Card`/`Metric`/`BadgeDelta`, which `StatCard` already covers) would be the concrete justification for the dependency.

---

## Summary of gaps (stated explicitly per research standards)

- No primary source was found for exact `toast.success`/`toast.error`/`toast.promise` *signatures* (argument shapes, return types) beyond the prose description on sonner's own docs site — the doc above cites what that page states in words, not a verified TypeScript signature; confirm exact call shapes against `node_modules/sonner`'s own `.d.ts` at implementation time rather than trusting the docs prose alone.
- shadcn/ui's registry has moved twice in its history (classic `apps/www/registry/default` → `apps/v4/registry/new-york-v4`, now further split into `bases/{radix,base,aria}`); the classic `apps/www/registry/default/ui/*.tsx` paths this repo's existing files most closely resemble in authoring style no longer exist in shadcn's repo at `main` — the code shapes above were hand-adapted from the current `new-york-v4`/`radix` base back to this repo's older forwardRef convention, not copied from an existing shadcn file written in that exact style.
