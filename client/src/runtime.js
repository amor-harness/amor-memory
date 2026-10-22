/** Host bindings the ported components share. `configure` is called once from
 *  activate(api), before any component renders; the exports stay live. */
const state = { React: null, api: null, ui: null, appUi: null, translator: null };
let hImpl = null;

export let Fragment = null;

export function configure(api, ui, translator, appUi = null) {
  state.api = api;
  state.React = api.React;
  state.ui = ui;
  state.appUi = appUi;
  state.translator = translator;
  hImpl = api.React.createElement;
  Fragment = api.React.Fragment;
}

export function h(type, props, ...children) {
  return hImpl(type, props, ...children);
}

export function currentApi() {
  return state.api;
}

export function currentUi() {
  return state.ui;
}

export const useState = (...args) => state.React.useState(...args);
export const useEffect = (...args) => state.React.useEffect(...args);
export const useMemo = (...args) => state.React.useMemo(...args);
export const useCallback = (...args) => state.React.useCallback(...args);
export const useRef = (...args) => state.React.useRef(...args);
export const useLayoutEffect = (...args) => state.React.useLayoutEffect(...args);
export const useSyncExternalStore = (...args) => state.React.useSyncExternalStore(...args);

export function useLocalize() {
  state.translator.useLocale();
  return state.translator.t;
}

export const t = (...args) => state.translator.t(...args);

export function cn(...values) {
  return values.filter(Boolean).join(' ');
}

/** A lucide icon from the host registry, as a component. */
const iconCache = new Map();
export function makeIcon(name) {
  if (!iconCache.has(name)) {
    const Icon = (props) => {
      const Base = state.api?.icons?.[name];
      return Base ? hImpl(Base, props) : null;
    };
    Icon.displayName = `Icon(${name})`;
    iconCache.set(name, Icon);
  }
  return iconCache.get(name);
}

/** A host UI primitive, as a component. */
const uiCache = new Map();
export function makeUi(name) {
  if (!uiCache.has(name)) {
    const Component = (props) => {
      const Base = state.ui?.[name];
      return Base ? hImpl(Base, props) : null;
    };
    Component.displayName = `Ui(${name})`;
    uiCache.set(name, Component);
  }
  return uiCache.get(name);
}

export const Button = makeUi('Button');
export const Label = makeUi('Label');
export const Spinner = makeUi('Spinner');
export const Skeleton = makeUi('Skeleton');
export const TooltipAnchor = makeUi('TooltipAnchor');
export const OGDialog = makeUi('OGDialog');
export const OGDialogTrigger = makeUi('OGDialogTrigger');
export const OGDialogTemplate = makeUi('OGDialogTemplate');
export const OGDialogContent = makeUi('OGDialogContent');
export const OGDialogFooter = makeUi('OGDialogFooter');
export const OGDialogHeader = makeUi('OGDialogHeader');
export const OGDialogTitle = makeUi('OGDialogTitle');
export const OGDialogDescription = makeUi('OGDialogDescription');
export const Input = makeUi('Input');
export const Textarea = makeUi('Textarea');
export const Switch = makeUi('Switch');
export const ControlCombobox = makeUi('ControlCombobox');
export const MultiSelect = makeUi('MultiSelect');
export const Radio = makeUi('Radio');
export const FieldMessage = makeUi('FieldMessage');
export const VirtualList = makeUi('VirtualList');
export const Checkbox = makeUi('Checkbox');
export const FilterInput = makeUi('FilterInput');
export const TrashIcon = makeUi('TrashIcon');
export const Alert = makeUi('Alert');
export const DropdownPopup = makeUi('DropdownPopup');

const appCache = new Map();
/** A component the app itself owns (sharing, role permissions). */
export function makeApp(name) {
  if (!appCache.has(name)) {
    const Component = (props) => {
      const Base = state.appUi?.[name];
      return Base ? hImpl(Base, props) : null;
    };
    Component.displayName = `App(${name})`;
    appCache.set(name, Component);
  }
  return appCache.get(name);
}

export const GenericGrantAccessDialog = makeApp('GenericGrantAccessDialog');
export const AdminSettingsDialog = makeApp('AdminSettingsDialog');
export const MenuButton = makeUi('MenuButton');

export function useToastContext() {
  return { showToast: () => {} };
}

/** Panel body wrapper with the app's loading/empty structure. */
export function PanelContent({ isLoading, isEmpty, skeleton, empty, children, className }) {
  const localize = useLocalize();
  const body = isLoading
    ? [
        h(
          'span',
          {
            key: 'sr',
            className: 'sr-only',
            'aria-live': 'polite',
            'aria-atomic': 'true',
          },
          localize('com_ui_loading'),
        ),
        skeleton,
      ]
    : isEmpty === true && empty != null
      ? empty
      : children;
  return h(
    'div',
    { 'aria-busy': isLoading, className: cn('min-h-0 flex-1 overflow-y-auto', className) },
    body,
  );
}

export function PanelFooter({ children, className }) {
  return h(
    'div',
    {
      className: cn(
        'flex shrink-0 items-center justify-end gap-2 border-t border-border-light px-3 py-2',
        className,
      ),
    },
    children,
  );
}

export function Trans({ i18nKey, values }) {
  const text = t(i18nKey, values);
  return String(text).replace(/<[^>]+>/g, '');
}

export function useTranslation() {
  const locale = state.translator.locale;
  return {
    t,
    i18n: { language: locale, resolvedLanguage: locale, on: () => {}, off: () => {} },
  };
}

let invalidateAll = () => {};
export function setInvalidateAll(fn) {
  invalidateAll = fn;
}
export function useQueryClient() {
  return { invalidateQueries: () => invalidateAll() };
}

export function useHasAccess() {
  return true;
}

export function useAuthContext() {
  return { user: { id: 'plugin', role: 'USER' } };
}


