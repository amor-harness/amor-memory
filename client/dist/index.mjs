// client/src/locales.js
var memoryCatalogs = {
  en: {
    navTitle: "Memories (plugin)",
    title: "Memories",
    refresh: "Refresh",
    search: "Search memories",
    loading: "Loading\u2026",
    empty: "No memories yet.",
    "empty.title": "No memories yet",
    "empty.body": "Memories you add will show up here.",
    "empty.filtered": "No memories match your search.",
    delete: "Delete",
    deleteConfirm: 'Delete "{{key}}"?',
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    usage: "{{shown}} shown \xB7 {{total}} tokens",
    "access.denied": "You do not have permission to read memories.",
    "card.stable": "Stable",
    "card.locked": "Locked",
    "card.image": "Image",
    "card.imageUnavailable": "Image unavailable",
    "card.token": "token",
    "card.tokens": "tokens",
    "domainKind.real": "Real",
    "domainKind.fictional": "Fictional",
    "domainKind.project": "Project",
    "domainKind.sandbox": "Sandbox",
    "domainKind.study": "Study",
    "domainKind.work": "Work",
    "domains.button": "Domains",
    "domains.all": "All domains",
    "domains.search": "Search domains",
    "domains.name": "Domain name",
    "domains.add": "Add domain",
    "domains.deleteConfirm": 'Delete domain "{{name}}"? Its memories will be removed.',
    "stores.new": "New store",
    "stores.add": "Add",
    "stores.back": "Back",
    "stores.search": "Search memory stores",
    "stores.default": "Default",
    "stores.editor": "Editor",
    "stores.viewer": "Viewer",
    "stores.memories": "{{count}} memories",
    "stores.updated": "Updated {{date}}",
    "stores.rename": "Rename store",
    "stores.renameTitle": "Rename memory store",
    "stores.renamePrompt": 'New name for "{{name}}"',
    "stores.deleteTitle": "Delete memory store",
    "stores.deleteConfirm": 'Delete store "{{name}}" and all its memories?',
    "stores.clear": "Clear memory store",
    "stores.clearTitle": "Clear memory store",
    "stores.clearConfirm": 'Delete every memory in "{{name}}"? This cannot be undone.',
    "delete.title": "Delete memory",
    "delete.imageTitle": "Delete image memory",
    "delete.confirm": 'Delete "{{key}}"?',
    "delete.imageConfirm": "Delete this image memory?",
    "create.title": "Create memory",
    "edit.title": "Edit memory",
    "field.key": "Key",
    "field.value": "Value",
    "field.domain": "Domain",
    "field.stable": "Stable",
    "field.stableInfo": "Stable memories ride the system baseline instead of per-turn recall.",
    "field.locked": "Locked",
    "field.lockedInfo": "Hide from the extractor and refuse every model-written change.",
    "field.injection": "Injection",
    "field.injection.system": "System prompt",
    "field.injection.additional": "Additional context",
    history: "History",
    "history.empty": "No history yet.",
    "image.title": "Memory image",
    "preferences.use": "Use memory",
    "preferences.info": "Let agents read and write your saved memories.",
    "settings.useMemory": "Use memory",
    "settings.useMemoryInfo": "When enabled, the agent reads your memories for context and automatically extracts memories from your conversations. Disable to keep your memories out of this agent\u2019s chats.",
    "settings.store": "Memory store",
    "settings.selectStore": "Select a memory store",
    "settings.searchStores": "Search memory stores",
    "settings.clear": "Clear",
    "settings.storeRequired": "An agent without a memory store has memory disabled.",
    "settings.domains": "Memory domains",
    "settings.domainDefaultOnly": "Default domain only",
    "settings.domainAgentsHint": "New chats with this agent start with these domains active. Memories are only written into and recalled from the active domains.",
    "settings.domainNotReal": "not real",
    "settings.storeDefault": "Default",
    "cards.recalled": "Recalled saved memory",
    "cards.updated": "Updated saved memory",
    "cards.error": "Memory error",
    "cards.recalledItems": "Recalled memories",
    "cards.updatedItems": "Updated memories",
    "cards.deletedItems": "Deleted memories",
    "header.scope": "Memory scope",
    "header.domains": "Memory domains",
    "header.created": "Written by this chat",
    "header.recalled": "Recalled in this chat",
    "header.empty": "No memories in this chat yet.",
    "header.close": "Close"
  },
  "zh-Hans": {
    navTitle: "\u8BB0\u5FC6\uFF08\u63D2\u4EF6\uFF09",
    title: "\u8BB0\u5FC6",
    refresh: "\u5237\u65B0",
    search: "\u641C\u7D22\u8BB0\u5FC6",
    loading: "\u52A0\u8F7D\u4E2D\u2026",
    empty: "\u8FD8\u6CA1\u6709\u8BB0\u5FC6\u3002",
    "empty.title": "\u8FD8\u6CA1\u6709\u8BB0\u5FC6",
    "empty.body": "\u4F60\u6DFB\u52A0\u7684\u8BB0\u5FC6\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002",
    "empty.filtered": "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5FC6\u3002",
    delete: "\u5220\u9664",
    deleteConfirm: "\u5220\u9664\u201C{{key}}\u201D\uFF1F",
    edit: "\u7F16\u8F91",
    save: "\u4FDD\u5B58",
    cancel: "\u53D6\u6D88",
    usage: "\u663E\u793A {{shown}} \u6761 \xB7 {{total}} tokens",
    "access.denied": "\u4F60\u6CA1\u6709\u8BFB\u53D6\u8BB0\u5FC6\u7684\u6743\u9650\u3002",
    "card.stable": "\u7A33\u5B9A",
    "card.locked": "\u5DF2\u9501\u5B9A",
    "card.image": "\u56FE\u7247",
    "card.imageUnavailable": "\u56FE\u7247\u4E0D\u53EF\u7528",
    "card.token": "token",
    "card.tokens": "tokens",
    "domainKind.real": "\u73B0\u5B9E",
    "domainKind.fictional": "\u865A\u6784",
    "domainKind.project": "\u9879\u76EE",
    "domainKind.sandbox": "\u6C99\u76D2",
    "domainKind.study": "\u5B66\u4E60",
    "domainKind.work": "\u5DE5\u4F5C",
    "domains.button": "\u8BB0\u5FC6\u57DF",
    "domains.all": "\u5168\u90E8\u8BB0\u5FC6\u57DF",
    "domains.search": "\u641C\u7D22\u8BB0\u5FC6\u57DF",
    "domains.name": "\u8BB0\u5FC6\u57DF\u540D\u79F0",
    "domains.add": "\u65B0\u589E\u8BB0\u5FC6\u57DF",
    "domains.deleteConfirm": "\u5220\u9664\u8BB0\u5FC6\u57DF\u201C{{name}}\u201D\uFF1F\u5176\u4E2D\u7684\u8BB0\u5FC6\u4E5F\u4F1A\u88AB\u5220\u9664\u3002",
    "stores.new": "\u65B0\u5EFA\u8BB0\u5FC6\u5E93",
    "stores.add": "\u6DFB\u52A0",
    "stores.back": "\u8FD4\u56DE",
    "stores.search": "\u641C\u7D22\u8BB0\u5FC6\u5E93",
    "stores.default": "\u9ED8\u8BA4",
    "stores.editor": "\u7F16\u8F91\u8005",
    "stores.viewer": "\u67E5\u770B\u8005",
    "stores.memories": "{{count}} \u6761\u8BB0\u5FC6",
    "stores.updated": "\u66F4\u65B0\u4E8E {{date}}",
    "stores.rename": "\u91CD\u547D\u540D\u8BB0\u5FC6\u5E93",
    "stores.renameTitle": "\u91CD\u547D\u540D\u8BB0\u5FC6\u5E93",
    "stores.renamePrompt": "\u201C{{name}}\u201D\u7684\u65B0\u540D\u79F0",
    "stores.deleteTitle": "\u5220\u9664\u8BB0\u5FC6\u5E93",
    "stores.deleteConfirm": "\u5220\u9664\u8BB0\u5FC6\u5E93\u201C{{name}}\u201D\u53CA\u5176\u5168\u90E8\u8BB0\u5FC6\uFF1F",
    "stores.clear": "\u6E05\u7A7A\u8BB0\u5FC6\u5E93",
    "stores.clearTitle": "\u6E05\u7A7A\u8BB0\u5FC6\u5E93",
    "stores.clearConfirm": "\u5220\u9664\u201C{{name}}\u201D\u4E2D\u7684\u5168\u90E8\u8BB0\u5FC6\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
    "delete.title": "\u5220\u9664\u8BB0\u5FC6",
    "delete.imageTitle": "\u5220\u9664\u56FE\u7247\u8BB0\u5FC6",
    "delete.confirm": "\u5220\u9664\u201C{{key}}\u201D\uFF1F",
    "delete.imageConfirm": "\u5220\u9664\u8FD9\u5F20\u56FE\u7247\u8BB0\u5FC6\uFF1F",
    "create.title": "\u521B\u5EFA\u8BB0\u5FC6",
    "edit.title": "\u7F16\u8F91\u8BB0\u5FC6",
    "field.key": "\u952E",
    "field.value": "\u503C",
    "field.domain": "\u8BB0\u5FC6\u57DF",
    "field.stable": "\u7A33\u5B9A",
    "field.stableInfo": "\u7A33\u5B9A\u8BB0\u5FC6\u968F\u7CFB\u7EDF\u57FA\u7EBF\u6CE8\u5165\uFF0C\u800C\u4E0D\u662F\u6BCF\u8F6E\u53EC\u56DE\u3002",
    "field.locked": "\u9501\u5B9A",
    "field.lockedInfo": "\u4E0D\u53C2\u4E0E\u8BB0\u5FC6\u62BD\u53D6\uFF0C\u5E76\u62D2\u7EDD\u6A21\u578B\u5199\u5165\u7684\u6539\u52A8\u3002",
    "field.injection": "\u6CE8\u5165\u65B9\u5F0F",
    "field.injection.system": "\u7CFB\u7EDF\u63D0\u793A\u8BCD",
    "field.injection.additional": "\u9644\u52A0\u4E0A\u4E0B\u6587",
    history: "\u5386\u53F2",
    "history.empty": "\u6682\u65E0\u5386\u53F2\u3002",
    "image.title": "\u8BB0\u5FC6\u56FE\u7247",
    "preferences.use": "\u4F7F\u7528\u8BB0\u5FC6",
    "preferences.info": "\u5141\u8BB8\u667A\u80FD\u4F53\u8BFB\u53D6\u548C\u5199\u5165\u4F60\u4FDD\u5B58\u7684\u8BB0\u5FC6\u3002",
    "settings.useMemory": "\u4F7F\u7528\u8BB0\u5FC6",
    "settings.useMemoryInfo": "\u542F\u7528\u540E\uFF0C\u667A\u80FD\u4F53\u4F1A\u8BFB\u53D6\u4F60\u7684\u8BB0\u5FC6\u4F5C\u4E3A\u4E0A\u4E0B\u6587\uFF0C\u5E76\u81EA\u52A8\u4ECE\u4F60\u7684\u5BF9\u8BDD\u4E2D\u63D0\u53D6\u8BB0\u5FC6\u3002\u5173\u95ED\u53EF\u8BA9\u4F60\u7684\u8BB0\u5FC6\u5B8C\u5168\u4E0D\u8FDB\u5165\u8BE5\u667A\u80FD\u4F53\u7684\u5BF9\u8BDD\u3002",
    "settings.store": "\u8BB0\u5FC6\u5E93",
    "settings.selectStore": "\u9009\u62E9\u8BB0\u5FC6\u5E93",
    "settings.searchStores": "\u641C\u7D22\u8BB0\u5FC6\u5E93",
    "settings.clear": "\u6E05\u9664",
    "settings.storeRequired": "\u672A\u9009\u62E9\u8BB0\u5FC6\u5E93\u7684\u667A\u80FD\u4F53\u5C06\u7981\u7528\u8BB0\u5FC6\u529F\u80FD\u3002",
    "settings.domains": "\u8BB0\u5FC6\u57DF",
    "settings.domainDefaultOnly": "\u4EC5\u9ED8\u8BA4\u8BB0\u5FC6\u57DF",
    "settings.domainAgentsHint": "\u4E0E\u8BE5\u667A\u80FD\u4F53\u7684\u65B0\u5BF9\u8BDD\u4F1A\u9ED8\u8BA4\u6FC0\u6D3B\u8FD9\u4E9B\u8BB0\u5FC6\u57DF\u3002\u8BB0\u5FC6\u53EA\u4F1A\u5199\u5165\u5E76\u53EC\u56DE\u81EA\u5904\u4E8E\u6FC0\u6D3B\u72B6\u6001\u7684\u8BB0\u5FC6\u57DF\u3002",
    "settings.domainNotReal": "\u975E\u73B0\u5B9E",
    "settings.storeDefault": "\u9ED8\u8BA4",
    "cards.recalled": "\u5DF2\u56DE\u60F3\u4FDD\u5B58\u7684\u8BB0\u5FC6",
    "cards.updated": "\u5DF2\u66F4\u65B0\u4FDD\u5B58\u7684\u8BB0\u5FC6",
    "cards.error": "\u8BB0\u5FC6\u9519\u8BEF",
    "cards.recalledItems": "\u5DF2\u56DE\u60F3\u7684\u8BB0\u5FC6",
    "cards.updatedItems": "\u5DF2\u66F4\u65B0\u7684\u8BB0\u5FC6",
    "cards.deletedItems": "\u5DF2\u5220\u9664\u7684\u8BB0\u5FC6",
    "header.scope": "\u8BB0\u5FC6\u8303\u56F4",
    "header.domains": "\u8BB0\u5FC6\u57DF",
    "header.created": "\u672C\u5BF9\u8BDD\u5199\u5165",
    "header.recalled": "\u672C\u5BF9\u8BDD\u53EC\u56DE",
    "header.empty": "\u8FD9\u4E2A\u5BF9\u8BDD\u8FD8\u6CA1\u6709\u8BB0\u5FC6\u3002",
    "header.close": "\u5173\u95ED"
  }
};

// client/src/runtime.js
var state = { React: null, api: null, ui: null, appUi: null, translator: null };
var hImpl = null;
var Fragment = null;
function configure(api, ui, translator, appUi = null) {
  state.api = api;
  state.React = api.React;
  state.ui = ui;
  state.appUi = appUi;
  state.translator = translator;
  hImpl = api.React.createElement;
  Fragment = api.React.Fragment;
}
function h(type, props, ...children) {
  return hImpl(type, props, ...children);
}
function currentApi() {
  return state.api;
}
var useState = (...args) => state.React.useState(...args);
var useEffect = (...args) => state.React.useEffect(...args);
var useMemo = (...args) => state.React.useMemo(...args);
var useCallback = (...args) => state.React.useCallback(...args);
var useRef = (...args) => state.React.useRef(...args);
var useLayoutEffect = (...args) => state.React.useLayoutEffect(...args);
function useLocalize() {
  state.translator.useLocale();
  return state.translator.t;
}
var t = (...args) => state.translator.t(...args);
function cn(...values) {
  return values.filter(Boolean).join(" ");
}
var iconCache = /* @__PURE__ */ new Map();
function makeIcon(name) {
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
var uiCache = /* @__PURE__ */ new Map();
function makeUi(name) {
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
var Button = makeUi("Button");
var Label = makeUi("Label");
var Spinner = makeUi("Spinner");
var Skeleton = makeUi("Skeleton");
var TooltipAnchor = makeUi("TooltipAnchor");
var OGDialog = makeUi("OGDialog");
var OGDialogTrigger = makeUi("OGDialogTrigger");
var OGDialogTemplate = makeUi("OGDialogTemplate");
var OGDialogContent = makeUi("OGDialogContent");
var OGDialogFooter = makeUi("OGDialogFooter");
var OGDialogHeader = makeUi("OGDialogHeader");
var OGDialogTitle = makeUi("OGDialogTitle");
var OGDialogDescription = makeUi("OGDialogDescription");
var Input = makeUi("Input");
var Textarea = makeUi("Textarea");
var Switch = makeUi("Switch");
var ControlCombobox = makeUi("ControlCombobox");
var MultiSelect = makeUi("MultiSelect");
var Radio = makeUi("Radio");
var FieldMessage = makeUi("FieldMessage");
var VirtualList = makeUi("VirtualList");
var Checkbox = makeUi("Checkbox");
var FilterInput = makeUi("FilterInput");
var TrashIcon = makeUi("TrashIcon");
var Alert = makeUi("Alert");
var DropdownPopup = makeUi("DropdownPopup");
var appCache = /* @__PURE__ */ new Map();
function makeApp(name) {
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
var GenericGrantAccessDialog = makeApp("GenericGrantAccessDialog");
var AdminSettingsDialog = makeApp("AdminSettingsDialog");
var MenuButton = makeUi("MenuButton");
function useToastContext() {
  return { showToast: () => {
  } };
}
function PanelContent({ isLoading, isEmpty, skeleton, empty, children, className }) {
  const localize = useLocalize();
  const body = isLoading ? [
    h(
      "span",
      {
        key: "sr",
        className: "sr-only",
        "aria-live": "polite",
        "aria-atomic": "true"
      },
      localize("com_ui_loading")
    ),
    skeleton
  ] : isEmpty === true && empty != null ? empty : children;
  return h(
    "div",
    { "aria-busy": isLoading, className: cn("min-h-0 flex-1 overflow-y-auto", className) },
    body
  );
}
function PanelFooter({ children, className }) {
  return h(
    "div",
    {
      className: cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-border-light px-3 py-2",
        className
      )
    },
    children
  );
}
function useTranslation() {
  const locale = state.translator.locale;
  return {
    t,
    i18n: { language: locale, resolvedLanguage: locale, on: () => {
    }, off: () => {
    } }
  };
}
var invalidateAll = () => {
};
function setInvalidateAll(fn) {
  invalidateAll = fn;
}
function useQueryClient() {
  return { invalidateQueries: () => invalidateAll() };
}
function useHasAccess() {
  return true;
}
function useAuthContext() {
  return { user: { id: "plugin", role: "USER" } };
}

// client/src/datetime.js
var formatMemoryDateTime = (dateString) => new Date(dateString).toLocaleDateString(void 0, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
var formatterCache = /* @__PURE__ */ new Map();
function relativeFormatter(locale) {
  const key = locale ?? "";
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.RelativeTimeFormat(locale ?? void 0, { numeric: "auto" }));
  }
  return formatterCache.get(key);
}
function getMessageTimestamp(value, locale) {
  if (value == null || value === "") {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const formatter = relativeFormatter(locale);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 6e4);
  let relative;
  if (minutes < 1) {
    relative = formatter.format(0, "minute");
  } else if (minutes < 60) {
    relative = formatter.format(-minutes, "minute");
  } else if (minutes < 1440) {
    relative = formatter.format(-Math.round(minutes / 60), "hour");
  } else if (minutes < 43200) {
    relative = formatter.format(-Math.round(minutes / 1440), "day");
  } else {
    relative = new Intl.DateTimeFormat(locale ?? void 0, { dateStyle: "medium" }).format(date);
  }
  return {
    iso: date.toISOString(),
    relative,
    absolute: new Intl.DateTimeFormat(locale ?? void 0, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date)
  };
}

// client/src/utils.js
var EXTENSION_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
};
var extensionForMime = (mime) => EXTENSION_BY_MIME[mime] ?? "png";
function matchSorter(items, query, options = {}) {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return items;
  }
  const keys = options.keys ?? [];
  return items.filter(
    (item) => keys.some((key) => {
      const value = typeof key === "function" ? key(item) : item[key];
      return String(value ?? "").toLowerCase().includes(needle);
    })
  );
}
var MEMORY_KEY_PATTERN = /^[a-z0-9_]+$/;
var sameStore = (memory, storeId) => (memory.storeId ?? void 0) === (storeId ?? void 0);
function getMemoryKeyError({ key, memories, storeId, originalKey }) {
  const trimmed = key.trim();
  if (!trimmed) {
    return "com_ui_field_required";
  }
  if (!MEMORY_KEY_PATTERN.test(trimmed)) {
    return "com_ui_memory_key_validation";
  }
  if (trimmed === originalKey) {
    return null;
  }
  const isTaken = memories?.some(
    (memory) => memory.key === trimmed && sameStore(memory, storeId)
  );
  return isTaken === true ? "com_ui_memory_key_exists" : null;
}
function getMemoryValueError(value) {
  return value.trim() ? null : "com_ui_field_required";
}
function getMemoryApiErrorMessage(error, fallback) {
  const message = error?.response?.data?.error ?? error?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

// client/src/sdk.js
var passthrough = new Proxy(
  {},
  {
    get: (_target, key) => String(key)
  }
);
var Permissions = passthrough;
var PermissionTypes = passthrough;
var ResourceType = { MEMORYSTORE: "memoryStore" };
var QueryKeys = passthrough;
var MEMORY_DOMAIN_KINDS = ["real", "fictional", "project", "sandbox", "study", "work"];

// client/src/data.js
var revision = 0;
var listeners = /* @__PURE__ */ new Set();
function bump() {
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}
setInvalidateAll(bump);
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function useRevision() {
  const [value, setValue] = useState(revision);
  useEffect(() => subscribe(() => setValue(revision)), []);
  return value;
}
function useRpc(method, params, enabled = true) {
  const api = currentApi();
  const version = useRevision();
  const [state2, setState] = useState({ data: void 0, isLoading: enabled, isError: false, error: null });
  const paramsKey = JSON.stringify(params ?? {});
  useEffect(() => {
    if (!enabled) {
      setState({ data: void 0, isLoading: false, isError: false, error: null });
      return void 0;
    }
    let cancelled = false;
    setState((current) => ({ ...current, isLoading: true }));
    api.call(method, params ?? {}).then((data) => {
      if (!cancelled) {
        setState({ data, isLoading: false, isError: false, error: null });
      }
    }).catch((error) => {
      if (!cancelled) {
        setState({ data: void 0, isLoading: false, isError: true, error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [method, paramsKey, enabled, version]);
  return state2;
}
function useMutation(method, options = {}) {
  const api = currentApi();
  const [isLoading, setLoading] = useState(false);
  const mutate = (vars, local = {}) => {
    setLoading(true);
    api.call(method, vars ?? {}).then((data) => {
      setLoading(false);
      if (options.invalidate !== false) {
        bump();
      }
      options.onSuccess?.(data);
      local.onSuccess?.(data);
    }).catch((error) => {
      setLoading(false);
      options.onError?.(error);
      local.onError?.(error);
    });
  };
  return { mutate, isLoading };
}
function useMemoriesQuery(storeId, options = {}) {
  const params = storeId ? { storeId } : {};
  const result = useRpc("memories.list", params, options.enabled !== false);
  return {
    data: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: () => bump()
  };
}
function useMemoryStoresQuery() {
  const result = useRpc("memories.stores", {});
  return { data: result.data, isLoading: result.isLoading, isError: result.isError };
}
function useMemoryDomainsQuery(storeId, conversationId, options = {}) {
  const params = { ...storeId ? { storeId } : {}, ...conversationId ? { conversationId } : {} };
  const result = useRpc("memories.domains", params, options.enabled !== false);
  return { data: result.data, isLoading: result.isLoading, isError: result.isError };
}
function useGetUserQuery() {
  const result = useRpc("memories.preferences", {});
  return {
    data: result.data ? { personalization: { memories: result.data.memories } } : void 0,
    isLoading: result.isLoading
  };
}
function useConversationMemoriesQuery(conversationId, storeId, options = {}) {
  const params = {
    ...conversationId ? { conversationId } : {},
    ...storeId ? { storeId } : {}
  };
  const result = useRpc(
    "memories.conversation",
    params,
    Boolean(conversationId) && options.enabled !== false
  );
  return { data: result.data, isLoading: result.isLoading, isError: result.isError };
}
function useSetMemoryDomainActiveMutation(options) {
  return useMutation("memories.domains.setActive", options);
}
function useMemoryVersionsQuery(key, storeId, options = {}) {
  const result = useRpc(
    "memories.versions",
    { key, ...storeId ? { storeId } : {} },
    Boolean(key) && options.enabled !== false
  );
  return { data: result.data, isLoading: result.isLoading };
}
function useVFSImageSrcQuery(value, options = {}) {
  const isUrl = typeof value === "string" && value.startsWith("/memory/images/");
  const enabled = Boolean(value) && options.enabled !== false;
  const result = useRpc(
    isUrl ? "memories.image.url" : "memories.image",
    isUrl ? { url: value } : { sha256: value },
    enabled
  );
  return { data: result.data?.dataUrl, isLoading: result.isLoading };
}
var useCreateMemoryMutation = (options) => useMutation("memories.create", options);
var useUpdateMemoryMutation = (options) => useMutation("memories.update", options);
var useDeleteMemoryMutation = (options) => useMutation("memories.delete", options);
var useDeleteMemoryImageMutation = (options) => useMutation("memories.images.delete", options);
var useCreateMemoryStoreMutation = (options) => useMutation("memories.stores.create", options);
var useUpdateMemoryStoreMutation = (options) => useMutation("memories.stores.rename", options);
var useDeleteMemoryStoreMutation = (options) => useMutation("memories.stores.delete", options);
var useClearMemoryStoreMutation = (options) => useMutation("memories.stores.clear", options);
var useCreateMemoryDomainMutation = (options) => useMutation("memories.domains.create", options);
var useUpdateMemoryDomainMutation = (options) => useMutation("memories.domains.update", options);
var useDeleteMemoryDomainMutation = (options) => useMutation("memories.domains.delete", options);
var useUpdateMemoryPreferencesMutation = (options) => useMutation("memories.preferences.set", options);
var useRestoreMemoryVersionMutation = (options) => useMutation("memories.versions.restore", options);
function useUpdateMemoryPermissionsMutation(options = {}) {
  const api = currentApi();
  const [state2, setState] = useState({ isLoading: false, isSuccess: false });
  const mutate = (vars) => {
    setState({ isLoading: true, isSuccess: false });
    api.call("memories.permissions.set", {
      roleName: vars.roleName,
      updates: vars.updates
    }).then(() => {
      setState({ isLoading: false, isSuccess: true });
      options.onSuccess?.();
    }).catch((error) => {
      setState({ isLoading: false, isSuccess: false });
      options.onError?.(error);
    });
  };
  return { ...state2, mutate };
}

// client/src/components/MemoryDomainDeleteDialog.tsx
function MemoryDomainDeleteDialog({
  open,
  onOpenChange,
  domain,
  storeId,
  onDeleted
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const memoryCount = domain?.memoryCount ?? 0;
  const hasMemories = memoryCount > 0;
  const { mutate: deleteDomain, isLoading } = useDeleteMemoryDomainMutation({
    onSuccess: (_data, variables) => {
      showToast({ message: localize("com_ui_deleted"), status: "success" });
      onOpenChange(false);
      onDeleted?.(variables.domainId);
    },
    onError: () => {
      showToast({ message: localize("com_ui_error"), status: "error" });
    }
  });
  const handleDelete = () => {
    if (domain == null) {
      return;
    }
    deleteDomain({ domainId: domain.id, storeId, force: hasMemories });
  };
  return /* @__PURE__ */ h(OGDialog, { open, onOpenChange }, /* @__PURE__ */ h(
    OGDialogTemplate,
    {
      showCloseButton: false,
      title: localize("com_ui_memory_domain_delete"),
      className: "w-11/12 max-w-lg",
      main: /* @__PURE__ */ h(Label, { className: "text-left text-sm font-medium" }, hasMemories ? localize("com_ui_memory_domain_delete_confirm_count", {
        0: domain?.name ?? "",
        1: memoryCount.toLocaleString()
      }) : localize("com_ui_memory_domain_delete_confirm", { 0: domain?.name ?? "" })),
      selection: {
        selectHandler: handleDelete,
        selectClasses: "bg-surface-destructive text-text-on-status hover:bg-surface-destructive-hover",
        selectText: localize("com_ui_delete"),
        isLoading
      }
    }
  ));
}

// client/src/constants.js
var MEMORY_DOMAIN_KIND_LABEL_KEYS = {
  real: "com_ui_memory_domain_kind_real",
  fictional: "com_ui_memory_domain_kind_fictional",
  project: "com_ui_memory_domain_kind_project",
  sandbox: "com_ui_memory_domain_kind_sandbox",
  study: "com_ui_memory_domain_kind_study",
  work: "com_ui_memory_domain_kind_work"
};
var DOMAIN_KIND_BADGE_COLORS = {
  real: "border border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400",
  fictional: "border border-purple-500/30 bg-purple-500/15 text-purple-600 dark:text-purple-400",
  project: "border border-teal-500/30 bg-teal-500/15 text-teal-600 dark:text-teal-400",
  sandbox: "border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
  study: "border border-cyan-500/30 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  work: "border border-indigo-500/30 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
};
var domainKindBadgeColor = (kind) => DOMAIN_KIND_BADGE_COLORS[kind] ?? DOMAIN_KIND_BADGE_COLORS.real;

// client/src/components/MemoryDomainDialog.tsx
var KIND_BUTTON_CLASS = "rounded-full border border-transparent px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy";
var KIND_BUTTON_SELECTED_CLASS = "ring-2 ring-current font-semibold";
function MemoryDomainDialog({
  open,
  onOpenChange,
  storeId,
  domain = null
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const isEdit = domain != null;
  const [name, setName] = useState("");
  const [kind, setKind] = useState("real");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (!open) {
      return;
    }
    setName(domain?.name ?? "");
    setKind(domain?.kind ?? "real");
    setDescription(domain?.description ?? "");
  }, [open, domain]);
  const handleSuccess = (message) => {
    showToast({ message, status: "success" });
    onOpenChange(false);
  };
  const handleError = (error) => {
    const failure = error;
    const message = failure.response?.data?.error;
    const isDuplicate = failure.response?.status === 409 || message != null && message.includes("already exists");
    showToast({
      message: isDuplicate ? localize("com_ui_memory_domain_name_exists") : localize("com_ui_error"),
      status: "error"
    });
  };
  const { mutate: createDomain, isLoading: isCreating } = useCreateMemoryDomainMutation({
    onSuccess: () => handleSuccess(localize("com_ui_memory_domain_created")),
    onError: handleError
  });
  const { mutate: updateDomain, isLoading: isUpdating } = useUpdateMemoryDomainMutation({
    onSuccess: () => handleSuccess(localize("com_ui_memory_domain_updated")),
    onError: handleError
  });
  const isLoading = isCreating || isUpdating;
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const canSubmit = trimmedName !== "" && trimmedDescription !== "" && !isLoading;
  const submitLabel = isEdit ? localize("com_ui_save") : localize("com_ui_create");
  const handleSave = () => {
    if (!canSubmit) {
      return;
    }
    if (domain != null) {
      updateDomain({
        domainId: domain.id,
        storeId,
        name: trimmedName,
        kind,
        description: trimmedDescription
      });
      return;
    }
    createDomain({ storeId, name: trimmedName, kind, description: trimmedDescription });
  };
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };
  return /* @__PURE__ */ h(OGDialog, { open, onOpenChange }, /* @__PURE__ */ h(
    OGDialogTemplate,
    {
      showCloseButton: false,
      title: isEdit ? localize("com_ui_memory_domain_edit") : localize("com_ui_memory_domain_create"),
      className: "w-11/12 md:max-w-lg",
      main: /* @__PURE__ */ h("div", { className: "space-y-3" }, /* @__PURE__ */ h("div", { className: "space-y-2" }, /* @__PURE__ */ h(Label, { htmlFor: "memory-domain-name", className: "text-sm font-medium text-text-primary" }, localize("com_ui_name")), /* @__PURE__ */ h(
        Input,
        {
          id: "memory-domain-name",
          value: name,
          onChange: (e) => setName(e.target.value),
          onKeyDown: handleKeyPress,
          placeholder: localize("com_ui_name"),
          className: "w-full"
        }
      )), /* @__PURE__ */ h("div", { className: "space-y-2" }, /* @__PURE__ */ h(
        Label,
        {
          id: "memory-domain-kind-label",
          className: "text-sm font-medium text-text-primary"
        },
        localize("com_ui_memory_domain_kind")
      ), /* @__PURE__ */ h(
        "div",
        {
          role: "radiogroup",
          "aria-labelledby": "memory-domain-kind-label",
          className: "flex flex-wrap gap-1.5"
        },
        MEMORY_DOMAIN_KINDS.map((option) => {
          const selected = option === kind;
          return /* @__PURE__ */ h(
            "button",
            {
              key: option,
              type: "button",
              role: "radio",
              "aria-checked": selected,
              onClick: () => setKind(option),
              className: cn(
                KIND_BUTTON_CLASS,
                domainKindBadgeColor(option),
                selected && KIND_BUTTON_SELECTED_CLASS
              )
            },
            localize(MEMORY_DOMAIN_KIND_LABEL_KEYS[option])
          );
        })
      )), /* @__PURE__ */ h("div", { className: "space-y-2" }, /* @__PURE__ */ h(
        Label,
        {
          htmlFor: "memory-domain-description",
          className: "text-sm font-medium text-text-primary"
        },
        localize("com_ui_description")
      ), /* @__PURE__ */ h(
        Input,
        {
          id: "memory-domain-description",
          value: description,
          onChange: (e) => setDescription(e.target.value),
          onKeyDown: handleKeyPress,
          placeholder: localize("com_ui_memory_domain_description_placeholder"),
          className: "w-full"
        }
      ))),
      buttons: /* @__PURE__ */ h(
        Button,
        {
          type: "button",
          variant: "submit",
          onClick: handleSave,
          disabled: !canSubmit,
          "aria-label": submitLabel
        },
        isLoading ? /* @__PURE__ */ h(Spinner, { className: "size-4" }) : submitLabel
      )
    }
  ));
}

// client/src/components/MemoryStoreDeleteDialog.tsx
function MemoryStoreDeleteDialog({
  open,
  onOpenChange,
  store,
  onDeleted
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { mutate: deleteStore, isLoading } = useDeleteMemoryStoreMutation({
    onSuccess: (_data, variables) => {
      showToast({ message: localize("com_ui_deleted"), status: "success" });
      onOpenChange(false);
      onDeleted?.(variables.storeId);
    },
    onError: () => {
      showToast({ message: localize("com_ui_error"), status: "error" });
    }
  });
  const handleDelete = () => {
    if (store == null) {
      return;
    }
    deleteStore({ storeId: store.id });
  };
  return /* @__PURE__ */ h(OGDialog, { open, onOpenChange }, /* @__PURE__ */ h(
    OGDialogTemplate,
    {
      showCloseButton: false,
      title: localize("com_ui_delete_memory_store"),
      className: "w-11/12 max-w-lg",
      main: /* @__PURE__ */ h(Label, { className: "text-left text-sm font-medium" }, localize("com_ui_memory_store_delete_confirm", { 0: store?.name ?? "" })),
      selection: {
        selectHandler: handleDelete,
        selectClasses: "bg-surface-destructive text-text-on-status hover:bg-surface-destructive-hover",
        selectText: localize("com_ui_delete"),
        isLoading
      }
    }
  ));
}

// client/src/components/MemoryStoreClearDialog.tsx
function MemoryStoreClearDialog({
  open,
  onOpenChange,
  store
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { mutate: clearStore, isLoading } = useClearMemoryStoreMutation({
    onSuccess: () => {
      showToast({ message: localize("com_ui_deleted"), status: "success" });
      onOpenChange(false);
    },
    onError: () => {
      showToast({ message: localize("com_ui_error"), status: "error" });
    }
  });
  const handleClear = () => {
    if (store == null) {
      return;
    }
    clearStore({ storeId: store.id });
  };
  return /* @__PURE__ */ h(OGDialog, { open, onOpenChange }, /* @__PURE__ */ h(
    OGDialogTemplate,
    {
      showCloseButton: false,
      title: localize("com_ui_memory_store_clear"),
      className: "w-11/12 max-w-lg",
      main: /* @__PURE__ */ h(Label, { className: "text-left text-sm font-medium" }, localize("com_ui_memory_store_clear_confirm", { 0: store?.name ?? "" })),
      selection: {
        selectHandler: handleClear,
        selectClasses: "bg-surface-destructive text-text-on-status hover:bg-surface-destructive-hover",
        selectText: localize("com_ui_clear"),
        isLoading
      }
    }
  ));
}

// client/src/components/MemoryDomainChip.tsx
var Database = makeIcon("database");
var CHIP_CLASS = "inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";
function MemoryDomainChip({ domain, showKind = true, showName = true, className }) {
  const localize = useLocalize();
  const kindLabel = localize(MEMORY_DOMAIN_KIND_LABEL_KEYS[domain.kind]);
  return /* @__PURE__ */ h(
    "span",
    {
      className: cn(
        CHIP_CLASS,
        !showName && "shrink-0",
        domainKindBadgeColor(domain.kind),
        className
      ),
      title: localize(MEMORY_DOMAIN_KIND_LABEL_KEYS[domain.kind]),
      "data-testid": "memory-domain-chip",
      "data-domain-kind": domain.kind,
      "data-domain-id": domain.id
    },
    /* @__PURE__ */ h(Database, { className: "size-3 shrink-0", "aria-hidden": "true" }),
    /* @__PURE__ */ h("span", { className: "flex min-w-0 items-center" }, showName && /* @__PURE__ */ h("span", { className: "truncate" }, domain.name), showName && showKind && /* @__PURE__ */ h("span", { className: "mx-1 shrink-0 opacity-80", "aria-hidden": "true" }, "\xB7"), showKind && /* @__PURE__ */ h("span", { className: "shrink-0 opacity-80" }, kindLabel))
  );
}

// client/src/components/MemoryDomainList.tsx
var FolderTree = makeIcon("folderTree");
var Pencil = makeIcon("pencil");
var Trash = makeIcon("trash");
var ACTION_BUTTON_CLASS = "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-active hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy";
var DEFAULT_BADGE_CLASS = "shrink-0 rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary";
function MemoryDomainRow({ domain, canManage, onSelect, onEdit, onDelete }) {
  const localize = useLocalize();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  return /* @__PURE__ */ h(
    "div",
    {
      className: cn(
        "relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 gap-y-0.5 rounded-lg border px-1.5 py-1.5 transition-colors",
        "border-border-light bg-surface-secondary/50 hover:bg-surface-hover"
      )
    },
    /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        onClick: () => onSelect(domain),
        "aria-label": domain.name,
        className: "absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
      }
    ),
    /* @__PURE__ */ h("div", { className: "pointer-events-none col-start-1 row-start-1 flex min-w-0 items-center gap-2 px-1.5 py-0.5" }, /* @__PURE__ */ h(FolderTree, { className: "size-4 shrink-0 text-text-secondary", "aria-hidden": "true" }), /* @__PURE__ */ h("span", { className: "truncate text-sm font-medium text-text-primary" }, domain.name), domain.isDefault === true && /* @__PURE__ */ h("span", { className: DEFAULT_BADGE_CLASS }, localize("com_ui_default")), /* @__PURE__ */ h(MemoryDomainChip, { domain, showName: false })),
    /* @__PURE__ */ h("span", { className: "pointer-events-none col-span-2 row-start-2 pl-6 text-xs text-text-secondary" }, localize("com_ui_memories_count", {
      0: (domain.memoryCount ?? 0).toLocaleString(locale)
    })),
    canManage && domain.isDefault !== true && /* @__PURE__ */ h("div", { className: "relative z-10 col-start-2 row-start-1 flex shrink-0 items-center gap-0.5" }, /* @__PURE__ */ h(
      TooltipAnchor,
      {
        description: localize("com_ui_rename"),
        side: "bottom",
        render: /* @__PURE__ */ h(
          "button",
          {
            type: "button",
            className: ACTION_BUTTON_CLASS,
            "aria-label": `${localize("com_ui_rename")}: ${domain.name}`,
            onClick: () => onEdit(domain)
          },
          /* @__PURE__ */ h(Pencil, { className: "size-4", "aria-hidden": "true" })
        )
      }
    ), /* @__PURE__ */ h(
      TooltipAnchor,
      {
        description: localize("com_ui_delete"),
        side: "bottom",
        render: /* @__PURE__ */ h(
          "button",
          {
            type: "button",
            className: cn(ACTION_BUTTON_CLASS, "hover:text-text-destructive"),
            "aria-label": `${localize("com_ui_delete")}: ${domain.name}`,
            onClick: () => onDelete(domain)
          },
          /* @__PURE__ */ h(Trash, { className: "size-4", "aria-hidden": "true" })
        )
      }
    ))
  );
}
function MemoryDomainList({
  domains,
  canManage,
  isFiltered = false,
  onSelect,
  onEdit,
  onDelete
}) {
  const localize = useLocalize();
  if (domains.length === 0) {
    return /* @__PURE__ */ h("div", { className: "flex flex-col items-center justify-center rounded-lg border border-border-light p-6 text-center" }, /* @__PURE__ */ h("div", { className: "mb-2 flex size-10 items-center justify-center rounded-full bg-surface-tertiary" }, /* @__PURE__ */ h(FolderTree, { className: "size-5 text-text-secondary", "aria-hidden": "true" })), isFiltered ? /* @__PURE__ */ h("p", { className: "text-sm text-text-secondary" }, localize("com_ui_no_memory_domains_match")) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("p", { className: "text-sm font-medium text-text-primary" }, localize("com_ui_no_memory_domains_title")), /* @__PURE__ */ h("p", { className: "mt-0.5 text-xs text-text-secondary" }, localize("com_ui_no_memory_domains"))));
  }
  return /* @__PURE__ */ h("div", { className: "space-y-2", role: "list", "aria-label": localize("com_ui_memory_domains") }, domains.map((domain) => /* @__PURE__ */ h("div", { key: domain.id, role: "listitem" }, /* @__PURE__ */ h(
    MemoryDomainRow,
    {
      domain,
      canManage,
      onSelect,
      onEdit,
      onDelete
    }
  ))));
}

// client/src/components/MemoryCardSkeleton.tsx
function MemoryCardSkeleton({ count = 6 }) {
  return /* @__PURE__ */ h("div", { className: "flex flex-col gap-2", "aria-hidden": "true" }, Array.from({ length: count }, (_, i) => /* @__PURE__ */ h("div", { key: i, className: "rounded-lg border border-border-light px-3 py-2.5" }, /* @__PURE__ */ h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ h(Skeleton, { className: "h-4 w-32 rounded" }), /* @__PURE__ */ h(Skeleton, { className: "h-4 w-16 rounded-full" })), /* @__PURE__ */ h("div", { className: "mt-1.5 flex items-baseline gap-2" }, /* @__PURE__ */ h(Skeleton, { className: "h-4 flex-1 rounded" }), /* @__PURE__ */ h(Skeleton, { className: "h-3 w-20 shrink-0 rounded" })))));
}

// client/src/components/MemoryFormFields.tsx
function MemoryFlagToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  footer
}) {
  return /* @__PURE__ */ h("div", { className: "flex flex-col gap-2.5 rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5" }, /* @__PURE__ */ h("div", { className: "flex items-center justify-between gap-2" }, /* @__PURE__ */ h("div", { className: "flex min-w-0 flex-col gap-0.5" }, /* @__PURE__ */ h("span", { className: "text-sm font-medium text-text-primary" }, label), /* @__PURE__ */ h("span", { className: "text-xs text-text-secondary" }, description)), /* @__PURE__ */ h(
    Switch,
    {
      size: "small",
      "aria-label": label,
      checked,
      onCheckedChange,
      disabled,
      className: "shrink-0"
    }
  )), footer);
}
function MemoryFormFields({
  keyValue,
  onKeyChange,
  onKeyBlur,
  value,
  onValueChange,
  onValueBlur,
  onKeyDown,
  disabled = false,
  keyError,
  valueError,
  showKeyError = false,
  showValueError = false,
  showKeyHint = false,
  domains,
  domainId,
  onDomainChange,
  domainDisabled = false,
  stable = false,
  onStableChange,
  injection = "system",
  onInjectionChange,
  locked = false,
  onLockedChange,
  flagsDisabled = false
}) {
  const localize = useLocalize();
  const domainItems = (domains ?? []).map((domain) => ({
    value: domain.id,
    label: `${domain.name} \xB7 ${localize(MEMORY_DOMAIN_KIND_LABEL_KEYS[domain.kind])}`
  }));
  const selectedDomain = (domains ?? []).find((domain) => domain.id === domainId);
  const injectionOptions = [
    { value: "system", label: localize("com_ui_memory_injection_system") },
    { value: "additional", label: localize("com_ui_memory_injection_additional") }
  ];
  return /* @__PURE__ */ h("div", { className: "space-y-4" }, /* @__PURE__ */ h("div", { className: "space-y-2" }, /* @__PURE__ */ h(Label, { htmlFor: "memory-key", className: "text-sm font-medium text-text-primary" }, localize("com_ui_key")), /* @__PURE__ */ h(
    Input,
    {
      id: "memory-key",
      "aria-label": localize("com_ui_key"),
      value: keyValue,
      onChange: (event) => onKeyChange(event.target.value),
      onBlur: onKeyBlur,
      onKeyDown,
      placeholder: localize("com_ui_enter_key"),
      className: "w-full",
      disabled,
      "aria-invalid": showKeyError && keyError != null,
      "aria-describedby": keyError != null ? "memory-key-message" : void 0
    }
  ), (showKeyError && keyError != null || showKeyHint) && /* @__PURE__ */ h(
    FieldMessage,
    {
      id: "memory-key-message",
      message: showKeyError && keyError ? localize(keyError) : null,
      hint: showKeyHint ? localize("com_ui_memory_key_hint") : void 0,
      lines: 2
    }
  )), domainItems.length > 0 && onDomainChange != null && /* @__PURE__ */ h("div", { className: "space-y-2" }, /* @__PURE__ */ h(Label, { htmlFor: "memory-domain", className: "text-sm font-medium text-text-primary" }, localize("com_ui_memory_domain")), /* @__PURE__ */ h(
    ControlCombobox,
    {
      isCollapsed: false,
      ariaLabel: localize("com_ui_memory_domain"),
      selectedValue: domainId ?? "",
      displayValue: selectedDomain?.name,
      setValue: onDomainChange,
      selectPlaceholder: localize("com_ui_select_memory_domain"),
      searchPlaceholder: localize("com_ui_search_memory_domains"),
      items: domainItems,
      className: "h-9 border-border-light",
      containerClassName: "px-0",
      disabled: domainDisabled,
      portal: false
    }
  )), /* @__PURE__ */ h("div", { className: "space-y-2" }, /* @__PURE__ */ h(Label, { htmlFor: "memory-value", className: "text-sm font-medium text-text-primary" }, localize("com_ui_value")), /* @__PURE__ */ h(
    Textarea,
    {
      id: "memory-value",
      "aria-label": localize("com_ui_value"),
      value,
      onChange: (event) => onValueChange(event.target.value),
      onBlur: onValueBlur,
      onKeyDown,
      placeholder: localize("com_ui_enter_value"),
      className: "min-h-[150px] w-full resize-none rounded-lg border border-border-light bg-surface-secondary/50 px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-heavy disabled:cursor-not-allowed disabled:opacity-50",
      rows: 8,
      disabled,
      "aria-invalid": showValueError && valueError != null,
      "aria-describedby": valueError != null ? "memory-value-message" : void 0
    }
  ), showValueError && valueError != null && /* @__PURE__ */ h(FieldMessage, { id: "memory-value-message", message: localize(valueError) })), onStableChange != null && /* @__PURE__ */ h(
    MemoryFlagToggle,
    {
      label: localize("com_ui_memory_stable"),
      description: localize("com_ui_memory_stable_desc"),
      checked: stable,
      onCheckedChange: onStableChange,
      disabled: flagsDisabled,
      footer: stable && onInjectionChange != null ? /* @__PURE__ */ h("div", { className: "flex flex-col gap-2" }, /* @__PURE__ */ h("span", { id: "memory-injection-label", className: "text-xs font-medium text-text-primary" }, localize("com_ui_memory_injection")), /* @__PURE__ */ h(
        Radio,
        {
          options: injectionOptions,
          value: injection,
          onChange: (value2) => onInjectionChange(value2),
          disabled: flagsDisabled,
          fullWidth: true,
          "aria-labelledby": "memory-injection-label"
        }
      )) : null
    }
  ), onLockedChange != null && /* @__PURE__ */ h(
    MemoryFlagToggle,
    {
      label: localize("com_ui_memory_locked"),
      description: localize("com_ui_memory_locked_desc"),
      checked: locked,
      onCheckedChange: onLockedChange,
      disabled: flagsDisabled
    }
  ));
}

// client/src/components/MemoryCreateDialog.tsx
function MemoryCreateDialog({
  open,
  onOpenChange,
  children,
  triggerRef,
  storeId
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.CREATE
  });
  const { data: memData } = useMemoriesQuery(storeId);
  const { mutate: createMemory, isLoading } = useCreateMemoryMutation({
    onSuccess: (data) => {
      showToast({
        message: localize("com_ui_memory_created"),
        status: "success"
      });
      if (data?.evicted?.length) {
        showToast({
          message: localize("com_ui_memory_evicted_toast", { count: data.evicted.length }),
          status: "info"
        });
      }
      onOpenChange(false);
      setKey("");
      setValue("");
      setTouched({ key: false, value: false });
      setPendingEvict(null);
      setTimeout(() => {
        triggerRef?.current?.focus();
      }, 0);
    },
    onError: (error) => {
      const capacityError = error;
      if (capacityError.response?.data?.code === "MEMORY_CAPACITY_EVICTION") {
        setPendingEvict(capacityError.response.data.wouldEvict ?? []);
        return;
      }
      showToast({
        message: getMemoryApiErrorMessage(error, localize("com_ui_error")),
        status: "error"
      });
    }
  });
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [domainId, setDomainId] = useState(void 0);
  const [stable, setStable] = useState(false);
  const [injection, setInjection] = useState("system");
  const [locked, setLocked] = useState(false);
  const [touched, setTouched] = useState({ key: false, value: false });
  const [pendingEvict, setPendingEvict] = useState(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const { data: domainData } = useMemoryDomainsQuery(storeId, void 0, { enabled: open });
  const domains = domainData?.domains ?? [];
  const defaultDomain = domains.find((domain) => domain.isDefault === true);
  useEffect(() => {
    if (open && domainId == null && defaultDomain != null) {
      setDomainId(defaultDomain.id);
    }
  }, [open, domainId, defaultDomain]);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setKey("");
      setValue("");
      setDomainId(void 0);
      setTouched({ key: false, value: false });
      setPendingEvict(null);
    }
  }
  const keyError = getMemoryKeyError({ key, memories: memData?.memories, storeId });
  const valueError = getMemoryValueError(value);
  const hasErrors = keyError != null || valueError != null;
  const showKeyError = touched.key || key !== "";
  const showValueError = touched.value || value !== "";
  const handleSave = () => {
    if (!hasCreateAccess) {
      return;
    }
    if (keyError || valueError) {
      setTouched({ key: true, value: true });
      return;
    }
    createMemory({
      key: key.trim(),
      value: value.trim(),
      storeId,
      ...domainId != null ? { domainId } : {},
      stable,
      ...stable ? { injection } : {},
      locked
    });
  };
  const handleConfirmEvict = () => {
    createMemory({
      key: key.trim(),
      value: value.trim(),
      storeId,
      confirmEvict: true,
      ...domainId != null ? { domainId } : {},
      stable,
      ...stable ? { injection } : {},
      locked
    });
  };
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && e.ctrlKey && hasCreateAccess) {
      handleSave();
    }
  };
  return /* @__PURE__ */ h(OGDialog, { open, onOpenChange, triggerRef }, children, /* @__PURE__ */ h(
    OGDialogTemplate,
    {
      title: localize(pendingEvict ? "com_ui_memory_evict_title" : "com_ui_create_memory"),
      showCloseButton: false,
      onEscapeKeyDown: (event) => event.preventDefault(),
      className: "w-11/12 md:max-w-lg",
      main: pendingEvict ? /* @__PURE__ */ h("div", { className: "space-y-3" }, /* @__PURE__ */ h(Label, { className: "text-left text-sm font-medium text-text-primary" }, localize("com_ui_memory_evict_message")), /* @__PURE__ */ h("ul", { className: "max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border-light bg-surface-secondary p-3 text-sm text-text-primary" }, pendingEvict.map((item) => /* @__PURE__ */ h("li", { key: item.key, className: "break-all" }, item.key))), /* @__PURE__ */ h(Label, { className: "text-left text-xs text-text-secondary" }, localize("com_ui_memory_evict_note"))) : (
        /* The same fields the edit dialog edits: key, value, and the
           domain the memory belongs to. */
        /* @__PURE__ */ h(
          MemoryFormFields,
          {
            keyValue: key,
            onKeyChange: setKey,
            onKeyBlur: () => setTouched((prev) => ({ ...prev, key: true })),
            value,
            onValueChange: setValue,
            onValueBlur: () => setTouched((prev) => ({ ...prev, value: true })),
            onKeyDown: handleKeyPress,
            keyError,
            valueError,
            showKeyError,
            showValueError,
            showKeyHint: true,
            domains,
            domainId,
            onDomainChange: setDomainId,
            stable,
            onStableChange: setStable,
            injection,
            onInjectionChange: setInjection,
            locked,
            onLockedChange: setLocked
          }
        )
      ),
      buttons: pendingEvict ? /* @__PURE__ */ h("div", { className: "flex w-full justify-end gap-2" }, /* @__PURE__ */ h(
        Button,
        {
          type: "button",
          variant: "outline",
          onClick: () => setPendingEvict(null),
          disabled: isLoading
        },
        localize("com_ui_cancel")
      ), /* @__PURE__ */ h(
        Button,
        {
          type: "button",
          variant: "submit",
          onClick: handleConfirmEvict,
          disabled: isLoading,
          className: "bg-surface-destructive text-white hover:bg-surface-destructive-hover",
          "aria-label": localize("com_ui_memory_evict_confirm_button")
        },
        isLoading ? /* @__PURE__ */ h(Spinner, { className: "size-4" }) : localize("com_ui_memory_evict_confirm_button")
      )) : /* @__PURE__ */ h(
        Button,
        {
          type: "button",
          variant: "submit",
          onClick: handleSave,
          disabled: isLoading || hasErrors,
          "aria-label": localize("com_ui_create_memory")
        },
        isLoading ? /* @__PURE__ */ h(Spinner, { className: "size-4" }) : localize("com_ui_create")
      )
    }
  ));
}

// client/src/components/MemoryStoreDialog.tsx
function MemoryStoreDialog({
  open,
  onOpenChange,
  store = null
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const isRename = store != null;
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) {
      setName(store?.name ?? "");
    }
  }, [open, store]);
  const handleSuccess = (message) => {
    showToast({ message, status: "success" });
    onOpenChange(false);
  };
  const handleError = (error) => {
    const failure = error;
    const message = failure.response?.data?.error;
    const isDuplicate = failure.response?.status === 409 || message != null && message.includes("already exists");
    showToast({
      message: isDuplicate ? localize("com_ui_memory_store_name_exists") : localize("com_ui_error"),
      status: "error"
    });
  };
  const { mutate: createStore, isLoading: isCreating } = useCreateMemoryStoreMutation({
    onSuccess: () => handleSuccess(localize("com_ui_memory_store_created")),
    onError: handleError
  });
  const { mutate: updateStore, isLoading: isUpdating } = useUpdateMemoryStoreMutation({
    onSuccess: () => handleSuccess(localize("com_ui_memory_store_renamed")),
    onError: handleError
  });
  const isLoading = isCreating || isUpdating;
  const trimmedName = name.trim();
  const submitLabel = isRename ? localize("com_ui_save") : localize("com_ui_create");
  const handleSave = () => {
    if (trimmedName === "" || isLoading) {
      return;
    }
    if (store != null) {
      updateStore({ storeId: store.id, name: trimmedName });
      return;
    }
    createStore({ name: trimmedName });
  };
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };
  return /* @__PURE__ */ h(OGDialog, { open, onOpenChange }, /* @__PURE__ */ h(
    OGDialogTemplate,
    {
      showCloseButton: false,
      title: isRename ? localize("com_ui_rename") : localize("com_ui_create_memory_store"),
      className: "w-11/12 md:max-w-lg",
      main: /* @__PURE__ */ h("div", { className: "space-y-2" }, /* @__PURE__ */ h(Label, { htmlFor: "memory-store-name", className: "text-sm font-medium text-text-primary" }, localize("com_ui_name")), /* @__PURE__ */ h(
        Input,
        {
          id: "memory-store-name",
          value: name,
          onChange: (e) => setName(e.target.value),
          onKeyDown: handleKeyPress,
          placeholder: localize("com_ui_name"),
          className: "w-full"
        }
      )),
      buttons: /* @__PURE__ */ h(
        Button,
        {
          type: "button",
          variant: "submit",
          onClick: handleSave,
          disabled: isLoading || trimmedName === "",
          "aria-label": submitLabel
        },
        isLoading ? /* @__PURE__ */ h(Spinner, { className: "size-4" }) : submitLabel
      )
    }
  ));
}

// client/src/components/MemoryUsageBadge.tsx
var getStatusColor = (pct) => {
  if (pct > 90) {
    return "bg-status-error-subtle text-status-error";
  }
  if (pct > 75) {
    return "bg-status-warning-subtle text-status-warning";
  }
  return "bg-status-success-subtle text-status-success";
};
function MemoryUsageBadge({
  percentage,
  tokenLimit,
  totalTokens,
  tooltipCurrent,
  tooltipMax
}) {
  const localize = useLocalize();
  const tokenLabel = localize("com_ui_tokens");
  const current = tooltipCurrent ?? totalTokens;
  const max = tooltipMax ?? tokenLimit;
  const tooltipText = current !== void 0 ? `${current.toLocaleString()} / ${max.toLocaleString()} ${tokenLabel}` : `${max.toLocaleString()} ${tokenLabel}`;
  return /* @__PURE__ */ h(
    TooltipAnchor,
    {
      description: tooltipText,
      side: "top",
      render: /* @__PURE__ */ h(
        "div",
        {
          className: cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
            "text-xs font-medium",
            getStatusColor(percentage)
          ),
          role: "status",
          "aria-label": `${localize("com_ui_usage")}: ${percentage}%`
        },
        /* @__PURE__ */ h("span", null, percentage, "%"),
        /* @__PURE__ */ h("span", { className: "opacity-70" }, localize("com_ui_used").toLowerCase())
      )
    }
  );
}

// client/src/components/MemoryStoreList.tsx
var Database2 = makeIcon("database");
var Pencil2 = makeIcon("pencil");
var Share2 = makeIcon("share");
var Trash2 = makeIcon("trash");
var ACTION_BUTTON_CLASS2 = "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-active hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy";
var BADGE_CLASS = "shrink-0 rounded-full border border-border-medium bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary";
var DEFAULT_BADGE_CLASS2 = cn(BADGE_CLASS, "border-border-heavy");
function MemoryStoreRow({
  store,
  isSelected,
  canManage,
  canShare,
  onSelect,
  onRename,
  onDelete
}) {
  const localize = useLocalize();
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const shared = !store.isOwner;
  const updated = getMessageTimestamp(store.updated_at, locale)?.relative ?? "";
  return /* @__PURE__ */ h(
    "div",
    {
      className: cn(
        /** The action group only shares the title row, so the stat lines below
         *  can span the full card width instead of wrapping early. */
        "relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 gap-y-0.5 rounded-lg border px-1.5 py-1.5 transition-colors",
        isSelected ? "border-border-heavy bg-surface-active" : "border-border-light bg-surface-secondary/50 hover:bg-surface-hover"
      )
    },
    /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        onClick: () => onSelect(store),
        "aria-current": isSelected ? "true" : void 0,
        "aria-label": store.name,
        className: "absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
      }
    ),
    /* @__PURE__ */ h("div", { className: "pointer-events-none col-start-1 row-start-1 flex min-w-0 items-center gap-2 px-1.5 py-0.5" }, /* @__PURE__ */ h(Database2, { className: "size-4 shrink-0 text-text-secondary", "aria-hidden": "true" }), /* @__PURE__ */ h("span", { className: "truncate text-sm font-medium text-text-primary" }, store.name), store.isDefault === true && /* @__PURE__ */ h("span", { className: DEFAULT_BADGE_CLASS2 }, localize("com_ui_memory_store_default")), shared && /* @__PURE__ */ h("span", { className: BADGE_CLASS }, store.accessLevel === "editor" ? localize("com_ui_role_editor") : localize("com_ui_role_viewer")), shared && store.ownerName != null && store.ownerName !== "" && /* @__PURE__ */ h("span", { className: "truncate text-xs text-text-secondary" }, store.ownerName)),
    /* @__PURE__ */ h("span", { className: "pointer-events-none col-span-2 row-start-2 flex items-center gap-1.5 pl-6 text-xs text-text-secondary" }, /* @__PURE__ */ h("span", null, localize("com_ui_memories_count", {
      0: store.memoryCount.toLocaleString(locale)
    })), /* @__PURE__ */ h("span", { "aria-hidden": "true" }, "\xB7"), /* @__PURE__ */ h("span", null, `${store.totalTokens.toLocaleString(locale)} ${localize("com_ui_tokens")}`)),
    updated !== "" && /* @__PURE__ */ h("span", { className: "pointer-events-none col-span-2 row-start-3 pl-6 text-xs text-text-secondary" }, localize("com_ui_memory_store_updated", { 0: updated })),
    store.isOwner && (canManage || canShare) && /* @__PURE__ */ h("div", { className: "relative z-10 col-start-2 row-start-1 flex shrink-0 items-center gap-0.5" }, canManage && /* @__PURE__ */ h(
      TooltipAnchor,
      {
        description: localize("com_ui_rename"),
        side: "bottom",
        render: /* @__PURE__ */ h(
          "button",
          {
            type: "button",
            className: ACTION_BUTTON_CLASS2,
            "aria-label": `${localize("com_ui_rename")}: ${store.name}`,
            onClick: () => onRename(store)
          },
          /* @__PURE__ */ h(Pencil2, { className: "size-4", "aria-hidden": "true" })
        )
      }
    ), canShare && /* @__PURE__ */ h(
      GenericGrantAccessDialog,
      {
        resourceDbId: store.id,
        resourceName: store.name,
        resourceType: ResourceType.MEMORYSTORE,
        onGrantAccess: () => queryClient.invalidateQueries([QueryKeys.memoryStores])
      },
      /* @__PURE__ */ h(
        TooltipAnchor,
        {
          description: localize("com_ui_share"),
          side: "bottom",
          render: /* @__PURE__ */ h(
            "button",
            {
              type: "button",
              className: cn(ACTION_BUTTON_CLASS2, "relative"),
              "aria-label": `${localize("com_ui_share")}: ${store.name}`
            },
            /* @__PURE__ */ h(Share2, { className: "size-4", "aria-hidden": "true" }),
            store.isShared && /* @__PURE__ */ h(
              "span",
              {
                className: "absolute -right-0.5 -top-0.5 size-2 rounded-full bg-status-info ring-2 ring-presentation",
                "data-testid": "memory-store-shared-indicator",
                "aria-hidden": "true"
              }
            )
          )
        }
      )
    ), canManage && store.isDefault !== true && /* @__PURE__ */ h(
      TooltipAnchor,
      {
        description: localize("com_ui_delete"),
        side: "bottom",
        render: /* @__PURE__ */ h(
          "button",
          {
            type: "button",
            className: cn(ACTION_BUTTON_CLASS2, "hover:text-text-destructive"),
            "aria-label": `${localize("com_ui_delete")}: ${store.name}`,
            onClick: () => onDelete(store)
          },
          /* @__PURE__ */ h(Trash2, { className: "size-4", "aria-hidden": "true" })
        )
      }
    ))
  );
}
function MemoryStoreList({
  stores,
  selectedStoreId,
  canManage,
  canShare,
  isFiltered = false,
  onSelect,
  onRename,
  onDelete
}) {
  const localize = useLocalize();
  if (stores.length === 0) {
    return /* @__PURE__ */ h("div", { className: "flex flex-col items-center justify-center rounded-lg border border-border-light p-6 text-center" }, /* @__PURE__ */ h("div", { className: "mb-2 flex size-10 items-center justify-center rounded-full bg-surface-tertiary" }, /* @__PURE__ */ h(Database2, { className: "size-5 text-text-secondary", "aria-hidden": "true" })), isFiltered ? /* @__PURE__ */ h("p", { className: "text-sm text-text-secondary" }, localize("com_ui_no_memory_stores_match")) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("p", { className: "text-sm font-medium text-text-primary" }, localize("com_ui_no_memory_stores_title")), /* @__PURE__ */ h("p", { className: "mt-0.5 text-xs text-text-secondary" }, localize("com_ui_no_memory_stores"))));
  }
  return /* @__PURE__ */ h("div", { className: "space-y-2", role: "list", "aria-label": localize("com_ui_memory_stores") }, stores.map((store) => /* @__PURE__ */ h("div", { key: store.id, role: "listitem" }, /* @__PURE__ */ h(
    MemoryStoreRow,
    {
      store,
      isSelected: store.id === selectedStoreId,
      canManage,
      canShare,
      onSelect,
      onRename,
      onDelete
    }
  ))));
}

// client/src/components/AdminSettings.tsx
var permissions = [
  { permission: Permissions.CREATE, labelKey: "com_ui_memories_allow_create" },
  { permission: Permissions.UPDATE, labelKey: "com_ui_memories_allow_update" },
  { permission: Permissions.READ, labelKey: "com_ui_memories_allow_read" },
  { permission: Permissions.OPT_OUT, labelKey: "com_ui_memories_allow_opt_out" }
];
function AdminSettings() {
  const localize = useLocalize();
  const { data, isLoading, isError } = useRpc("memories.permissions", {});
  const mutation = useUpdateMemoryPermissionsMutation({
    onSuccess: () => {
    },
    onError: () => {
    }
  });
  if (isLoading || isError || (data?.roles ?? []).length === 0) {
    return null;
  }
  return /* @__PURE__ */ h(PanelFooter, null, /* @__PURE__ */ h(
    AdminSettingsDialog,
    {
      permissionType: PermissionTypes.MEMORIES,
      sectionKey: "com_ui_memories",
      permissions,
      menuId: "memory-role-dropdown",
      descriptionKey: "com_ui_memories",
      mutation
    }
  ));
}

// client/src/components/MemoryEmptyState.tsx
var Database3 = makeIcon("database");
function MemoryEmptyState({ isFiltered = false }) {
  const localize = useLocalize();
  return /* @__PURE__ */ h("div", { className: "flex flex-col items-center justify-center rounded-lg border border-border-light bg-surface-secondary/50 p-6 text-center" }, /* @__PURE__ */ h("div", { className: "mb-2 flex size-10 items-center justify-center rounded-full bg-surface-tertiary" }, /* @__PURE__ */ h(Database3, { className: "size-5 text-text-secondary", "aria-hidden": "true" })), isFiltered ? /* @__PURE__ */ h("p", { className: "text-sm text-text-secondary" }, localize("com_ui_no_memories_match")) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("p", { className: "text-sm font-medium text-text-primary" }, localize("com_ui_no_memories_title")), /* @__PURE__ */ h("p", { className: "mt-0.5 text-xs text-text-secondary" }, localize("com_ui_no_memories"))));
}

// client/src/components/MemoryVersionList.tsx
var Undo2 = makeIcon("undo");
var iconButtonClass = cn(
  "flex size-7 shrink-0 items-center justify-center rounded-md",
  "text-text-secondary transition-colors duration-150",
  "hover:bg-surface-hover hover:text-text-primary",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
);
function MemoryVersionList({
  memory,
  storeId,
  canRestore,
  onRestored
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { data, isLoading, isError } = useMemoryVersionsQuery(memory.key, storeId);
  const versions = useMemo(() => data?.versions ?? [], [data]);
  const {
    mutate: restoreVersion,
    isLoading: isRestoring,
    variables
  } = useRestoreMemoryVersionMutation({
    onSuccess: (result) => {
      showToast({
        message: localize("com_ui_agent_version_restore_success"),
        status: "success"
      });
      onRestored(result.memory);
    },
    onError: () => {
      showToast({
        message: localize("com_ui_agent_version_restore_error"),
        status: "error"
      });
    }
  });
  if (isLoading) {
    return /* @__PURE__ */ h("div", { className: "flex h-24 items-center justify-center" }, /* @__PURE__ */ h(Spinner, { className: "size-4 text-text-secondary" }));
  }
  if (isError) {
    return /* @__PURE__ */ h("p", { className: "py-6 text-center text-sm text-text-secondary" }, localize("com_ui_agent_version_error"));
  }
  if (versions.length === 0) {
    return /* @__PURE__ */ h("p", { className: "py-6 text-center text-sm text-text-secondary" }, localize("com_ui_agent_version_empty"));
  }
  return /* @__PURE__ */ h("ul", { className: "max-h-[55vh] space-y-2 overflow-y-auto pr-1" }, versions.map((version) => {
    const isCurrent = version.key === memory.key && version.value === memory.value;
    const isThisRestoring = isRestoring && variables?.versionId === version.id;
    return /* @__PURE__ */ h(
      "li",
      {
        key: version.id,
        className: cn(
          "flex items-start gap-3 rounded-lg border px-3 py-2",
          isCurrent ? "border-border-heavy bg-surface-secondary" : "border-border-light bg-surface-secondary/50"
        )
      },
      /* @__PURE__ */ h("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ h("span", { className: "truncate text-sm font-semibold text-text-primary" }, version.key), isCurrent && /* @__PURE__ */ h("span", { className: "shrink-0 rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary" }, localize("com_ui_agent_version_current"))), /* @__PURE__ */ h("p", { className: "mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-text-secondary" }, version.value), /* @__PURE__ */ h("span", { className: "mt-1 block text-xs text-text-secondary" }, formatMemoryDateTime(version.createdAt))),
      canRestore && /* @__PURE__ */ h(
        TooltipAnchor,
        {
          description: localize("com_ui_agent_version_restore"),
          side: "top",
          render: /* @__PURE__ */ h(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "icon",
              className: iconButtonClass,
              "aria-label": localize("com_ui_agent_version_restore"),
              disabled: isCurrent || isRestoring,
              onClick: () => restoreVersion({ key: memory.key, versionId: version.id, storeId })
            },
            isThisRestoring ? /* @__PURE__ */ h(Spinner, { className: "size-3.5" }) : /* @__PURE__ */ h(Undo2, { className: "size-3.5", "aria-hidden": "true" })
          )
        }
      )
    );
  }));
}

// client/src/components/MemoryEditDialog.tsx
var History = makeIcon("history");
var ChevronLeft = makeIcon("chevronLeft");
function MemoryEditDialog({
  memory,
  open,
  onOpenChange,
  children,
  triggerRef,
  storeId
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { data: memData } = useMemoriesQuery(storeId);
  const hasUpdateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.UPDATE
  });
  const { mutate: updateMemory, isLoading } = useUpdateMemoryMutation({
    onMutate: () => {
      onOpenChange(false);
      setTimeout(() => {
        triggerRef?.current?.focus();
      }, 0);
    },
    onSuccess: () => {
      showToast({
        message: localize("com_ui_saved"),
        status: "success"
      });
    },
    onError: (error) => {
      let errorMessage = localize("com_ui_error");
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error;
        if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error;
          if (axiosError.response?.status === 409 || errorMessage.includes("already exists")) {
            errorMessage = localize("com_ui_memory_key_exists");
          } else if (errorMessage.includes("lowercase letters, numbers, and underscores")) {
            errorMessage = localize("com_ui_memory_key_validation");
          } else if (errorMessage.includes("stable")) {
            errorMessage = localize("com_ui_memory_stable_guard");
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      showToast({
        message: errorMessage,
        status: "error"
      });
    }
  });
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [originalKey, setOriginalKey] = useState("");
  const [stable, setStable] = useState(false);
  const [injection, setInjection] = useState("system");
  const [locked, setLocked] = useState(false);
  const [domainId, setDomainId] = useState(void 0);
  const [originalDomainId, setOriginalDomainId] = useState(void 0);
  const [showHistory, setShowHistory] = useState(false);
  const loadMemory = useCallback((source) => {
    setKey(source.key);
    setValue(source.value);
    setOriginalKey(source.key);
    setStable(source.stable === true);
    setInjection(source.injection === "additional" ? "additional" : "system");
    setLocked(source.locked === true);
    setDomainId(source.domainId);
    setOriginalDomainId(source.domainId);
  }, []);
  const { data: domainData } = useMemoryDomainsQuery(storeId, void 0, { enabled: open });
  const domains = domainData?.domains ?? [];
  useEffect(() => {
    if (memory) {
      loadMemory(memory);
    }
  }, [memory, loadMemory]);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (memory) {
        loadMemory(memory);
      }
    } else {
      setShowHistory(false);
    }
  }
  const handleSave = () => {
    if (!hasUpdateAccess || !memory) {
      return;
    }
    if (!key.trim() || !value.trim()) {
      showToast({
        message: localize("com_ui_field_required"),
        status: "error"
      });
      return;
    }
    updateMemory({
      key: key.trim(),
      value: value.trim(),
      storeId,
      stable,
      locked,
      /** The injection point only rides the edit while the memory is stable:
       *  an ephemeral memory is never carried in either prompt. */
      ...stable ? { injection } : {},
      ...originalKey !== key.trim() && { originalKey },
      /** Only a changed domain rides the update: sending the unchanged one
       *  would be a pointless reassignment of every edited memory. */
      ...domainId != null && domainId !== originalDomainId && { domainId }
    });
  };
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && e.ctrlKey && hasUpdateAccess) {
      handleSave();
    }
  };
  const memoryUsage = useMemo(() => {
    if (!memory?.tokenCount || !memData?.tokenLimit) {
      return null;
    }
    const availableForMemory = memData.tokenLimit - (memData.totalTokens ?? 0) + memory.tokenCount;
    const percentage = Math.round(memory.tokenCount / availableForMemory * 100);
    return { availableForMemory, percentage };
  }, [memory?.tokenCount, memData?.tokenLimit, memData?.totalTokens]);
  const handleRestored = (restored) => {
    if (restored.key !== memory?.key) {
      onOpenChange(false);
    }
  };
  const historyButtonClass = "h-9 gap-1.5 px-3";
  const historyButton = showHistory ? /* @__PURE__ */ h(
    Button,
    {
      type: "button",
      variant: "outline",
      className: historyButtonClass,
      "aria-label": localize("com_ui_back"),
      onClick: () => setShowHistory(false)
    },
    /* @__PURE__ */ h(ChevronLeft, { className: "size-4", "aria-hidden": "true" }),
    localize("com_ui_back")
  ) : /* @__PURE__ */ h(
    Button,
    {
      type: "button",
      variant: "outline",
      className: historyButtonClass,
      "aria-label": localize("com_ui_agent_version_history"),
      onClick: () => setShowHistory(true)
    },
    /* @__PURE__ */ h(History, { className: "size-4", "aria-hidden": "true" }),
    localize("com_ui_agent_version_history")
  );
  const editorTitle = hasUpdateAccess ? localize("com_ui_edit_memory") : localize("com_ui_view_memory");
  return /* @__PURE__ */ h(OGDialog, { open, onOpenChange, triggerRef }, children, /* @__PURE__ */ h(
    OGDialogTemplate,
    {
      title: showHistory ? localize("com_ui_agent_version_history") : editorTitle,
      showCloseButton: false,
      onEscapeKeyDown: (event) => event.preventDefault(),
      className: "w-11/12 md:max-w-lg",
      main: showHistory && memory ? /* @__PURE__ */ h(
        MemoryVersionList,
        {
          memory,
          storeId,
          canRestore: hasUpdateAccess,
          onRestored: handleRestored
        }
      ) : /* @__PURE__ */ h("div", { className: "space-y-4" }, memory && /* @__PURE__ */ h("div", { className: "flex items-center justify-between rounded-lg border border-border-light bg-surface-secondary px-3 py-2" }, memory.tokenCount !== void 0 ? /* @__PURE__ */ h("span", { className: "text-xs text-text-secondary" }, memory.tokenCount.toLocaleString(), " ", localize(memory.tokenCount === 1 ? "com_ui_token" : "com_ui_tokens")) : /* @__PURE__ */ h("div", null), /* @__PURE__ */ h("span", { className: "text-xs text-text-secondary" }, formatMemoryDateTime(memory.updated_at)), memoryUsage ? /* @__PURE__ */ h(
        MemoryUsageBadge,
        {
          percentage: memoryUsage.percentage,
          tokenLimit: memData?.tokenLimit ?? 0,
          tooltipCurrent: memory.tokenCount,
          tooltipMax: memoryUsage.availableForMemory
        }
      ) : /* @__PURE__ */ h("div", null)), /* @__PURE__ */ h(
        MemoryFormFields,
        {
          keyValue: key,
          onKeyChange: setKey,
          value,
          onValueChange: setValue,
          onKeyDown: handleKeyPress,
          disabled: !hasUpdateAccess,
          domains,
          domainId,
          onDomainChange: setDomainId,
          stable,
          onStableChange: setStable,
          injection,
          onInjectionChange: setInjection,
          locked,
          onLockedChange: setLocked,
          flagsDisabled: !hasUpdateAccess,
          domainDisabled: !hasUpdateAccess
        }
      )),
      leftButtons: memory != null ? historyButton : null,
      buttons: hasUpdateAccess && !showHistory ? /* @__PURE__ */ h(
        Button,
        {
          type: "button",
          variant: "submit",
          onClick: handleSave,
          "aria-label": localize("com_ui_save"),
          disabled: isLoading || !key.trim() || !value.trim()
        },
        isLoading ? /* @__PURE__ */ h(Spinner, { className: "size-4" }) : localize("com_ui_save")
      ) : null
    }
  ));
}

// client/src/components/MemoryCardActions.tsx
var Pencil3 = makeIcon("pencil");
function MemoryCardActions({ memory, storeId, readOnly = false }) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const triggerRef = useRef(null);
  const isImage = memory.kind === "image";
  const { mutate: deleteMemory, isLoading: isDeleting } = useDeleteMemoryMutation();
  const { mutate: deleteMemoryImage, isLoading: isDeletingImage } = useDeleteMemoryImageMutation();
  const buttonBaseClass = cn(
    "flex size-7 items-center justify-center rounded-md",
    "transition-colors duration-150",
    "text-text-secondary hover:text-text-primary",
    "hover:bg-surface-active",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
  );
  const confirmDelete = () => {
    const onSuccess = () => {
      showToast({ message: localize("com_ui_deleted"), status: "success" });
      setDeleteOpen(false);
    };
    const onError = (error) => {
      let message = localize("com_ui_error");
      if (error?.message?.includes("stable")) {
        message = localize("com_ui_memory_stable_guard");
      }
      showToast({ message, status: "error" });
    };
    if (isImage) {
      deleteMemoryImage({ sha256: memory.sha256 ?? memory.key, storeId }, { onSuccess, onError });
      return;
    }
    deleteMemory({ key: memory.key, storeId }, { onSuccess, onError });
  };
  if (readOnly) {
    return null;
  }
  return /* @__PURE__ */ h("div", { className: "flex items-center gap-0.5" }, !isImage && /* @__PURE__ */ h(
    MemoryEditDialog,
    {
      open: editOpen,
      memory,
      storeId,
      onOpenChange: setEditOpen,
      triggerRef
    },
    /* @__PURE__ */ h(OGDialogTrigger, { asChild: true }, /* @__PURE__ */ h(
      TooltipAnchor,
      {
        description: localize("com_ui_edit_memory"),
        side: "top",
        render: /* @__PURE__ */ h(
          Button,
          {
            ref: triggerRef,
            variant: "ghost",
            size: "icon",
            className: buttonBaseClass,
            "aria-label": localize("com_ui_edit"),
            onClick: () => setEditOpen(true)
          },
          /* @__PURE__ */ h(Pencil3, { className: "size-3.5", "aria-hidden": "true" })
        )
      }
    ))
  ), /* @__PURE__ */ h(OGDialog, { open: deleteOpen, onOpenChange: setDeleteOpen }, /* @__PURE__ */ h(OGDialogTrigger, { asChild: true }, /* @__PURE__ */ h(
    TooltipAnchor,
    {
      description: localize("com_ui_delete_memory"),
      side: "top",
      render: /* @__PURE__ */ h(
        Button,
        {
          variant: "ghost",
          size: "icon",
          className: buttonBaseClass,
          "aria-label": localize("com_ui_delete"),
          onClick: () => setDeleteOpen(true)
        },
        isDeleting || isDeletingImage ? /* @__PURE__ */ h(Spinner, { className: "size-3.5" }) : /* @__PURE__ */ h(TrashIcon, { className: "size-3.5", "aria-hidden": "true" })
      )
    }
  )), /* @__PURE__ */ h(
    OGDialogTemplate,
    {
      showCloseButton: false,
      title: localize(isImage ? "com_ui_delete_memory_image" : "com_ui_delete_memory"),
      className: "w-11/12 max-w-lg",
      main: /* @__PURE__ */ h(Label, { className: "text-left text-sm font-medium" }, isImage ? localize("com_ui_delete_memory_image_confirm") : localize("com_ui_delete_confirm_strong", { title: memory.key })),
      selection: {
        selectHandler: confirmDelete,
        selectClasses: "bg-surface-destructive text-white hover:bg-surface-destructive-hover",
        selectText: localize("com_ui_delete")
      }
    }
  )));
}

// client/src/components/DialogImage.tsx
function DialogImage({ isOpen, onOpenChange, src, downloadImage, alt }) {
  const localize = useLocalize();
  return /* @__PURE__ */ h(OGDialog, { open: isOpen, onOpenChange }, /* @__PURE__ */ h(OGDialogContent, { className: "max-w-[90vw] p-3", showCloseButton: true }, /* @__PURE__ */ h("img", { src, alt: alt ?? "", className: "max-h-[78vh] w-full rounded-lg object-contain" }), /* @__PURE__ */ h("div", { className: "flex justify-end pt-2" }, /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      onClick: downloadImage,
      className: "rounded-lg border border-border-light px-3 py-1.5 text-sm text-text-primary hover:bg-surface-tertiary"
    },
    localize("com_ui_download")
  ))));
}

// client/src/components/MemoryCard.tsx
var Lock = makeIcon("lock");
var STATUS_CHIP_CLASS = "shrink-0 rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary";
var CARD_SURFACE_CLASS = "bg-surface-secondary/50 hover:bg-surface-hover";
var formatDate = (dateString) => new Date(dateString).toLocaleDateString(void 0, {
  month: "short",
  day: "numeric",
  year: "numeric"
});
function MemoryCard({
  memory,
  hasUpdateAccess,
  storeId,
  readOnly = false,
  domain = null
}) {
  const localize = useLocalize();
  const isImage = memory.kind === "image";
  const [previewOpen, setPreviewOpen] = useState(false);
  const triggerRef = useRef(null);
  const { data: imageSrc, isLoading: isImageLoading } = useVFSImageSrcQuery(
    isImage ? memory.sha256 : null
  );
  const downloadImage = useCallback(() => {
    if (imageSrc == null || imageSrc === "") {
      return;
    }
    const filename = `memory-${memory.key.slice(0, 12)}.${extensionForMime(memory.mime)}`;
    const link = document.createElement("a");
    link.href = imageSrc;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [imageSrc, memory.key, memory.mime]);
  return /* @__PURE__ */ h(
    "div",
    {
      className: cn(
        "rounded-lg px-3 py-2.5 transition-colors",
        memory.stable === true ? "border border-border-heavy" : "border border-border-light",
        CARD_SURFACE_CLASS
      )
    },
    /* @__PURE__ */ h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ h("span", { className: "flex min-w-0 items-center gap-1" }, memory.locked === true && /* @__PURE__ */ h(
      "span",
      {
        className: "flex shrink-0 items-center text-status-warning",
        role: "img",
        "aria-label": localize("com_ui_memory_locked"),
        title: localize("com_ui_memory_locked_desc"),
        "data-testid": "memory-locked-indicator"
      },
      /* @__PURE__ */ h(Lock, { className: "size-3.5", "aria-hidden": "true" })
    ), /* @__PURE__ */ h("span", { className: "truncate text-sm font-semibold text-text-primary" }, memory.key)), isImage && /* @__PURE__ */ h("span", { className: STATUS_CHIP_CLASS, title: memory.mime }, localize("com_ui_memory_image")), memory.stable === true && /* @__PURE__ */ h("span", { className: STATUS_CHIP_CLASS, title: localize("com_ui_memory_stable") }, localize("com_ui_memory_stable")), hasUpdateAccess && !readOnly && /* @__PURE__ */ h("div", { className: "ml-auto shrink-0" }, /* @__PURE__ */ h(MemoryCardActions, { memory, storeId, readOnly }))),
    isImage ? /* @__PURE__ */ h("div", { className: "mt-1.5 overflow-hidden rounded-md border border-border-light bg-surface-tertiary" }, isImageLoading && /* @__PURE__ */ h("div", { className: "flex h-40 w-full items-center justify-center" }, /* @__PURE__ */ h(Spinner, { className: "size-4 text-text-secondary" })), !isImageLoading && imageSrc != null && imageSrc !== "" && /* @__PURE__ */ h(
      "button",
      {
        ref: triggerRef,
        type: "button",
        "aria-label": `View ${memory.key} in dialog`,
        "aria-haspopup": "dialog",
        onClick: () => setPreviewOpen(true),
        className: "relative block w-full cursor-zoom-in p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
      },
      /* @__PURE__ */ h(
        "img",
        {
          src: imageSrc,
          alt: memory.key,
          loading: "lazy",
          className: "block h-40 w-full object-cover"
        }
      )
    ), !isImageLoading && (imageSrc == null || imageSrc === "") && /* @__PURE__ */ h("div", { className: "flex h-20 w-full items-center justify-center" }, /* @__PURE__ */ h("span", { className: "text-xs text-text-secondary" }, localize("com_ui_memory_image_unavailable")))) : /* @__PURE__ */ h(
      "p",
      {
        className: "mt-1 line-clamp-2 min-w-0 break-words text-sm leading-relaxed text-text-primary",
        title: memory.value
      },
      memory.content ?? memory.value
    ),
    !isImage && (domain != null || memory.tags != null && memory.tags.length > 0) && /* @__PURE__ */ h("div", { className: "mt-1.5 flex flex-wrap items-center gap-1" }, domain != null && /* @__PURE__ */ h(MemoryDomainChip, { domain }), memory.tags?.map((tag) => /* @__PURE__ */ h(
      "span",
      {
        key: tag,
        className: "rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary"
      },
      tag
    ))),
    /* @__PURE__ */ h("div", { className: "mt-1 flex items-center gap-2 text-xs text-text-secondary" }, /* @__PURE__ */ h("span", { className: "shrink-0" }, formatDate(memory.updated_at)), isImage && memory.width != null && memory.height != null && /* @__PURE__ */ h("span", { className: "ml-auto shrink-0" }, memory.width, "\xD7", memory.height), !isImage && memory.tokenCount !== void 0 && /* @__PURE__ */ h("span", { className: "ml-auto shrink-0" }, memory.tokenCount, " ", localize(memory.tokenCount === 1 ? "com_ui_token" : "com_ui_tokens"))),
    isImage && imageSrc != null && imageSrc !== "" && /* @__PURE__ */ h(
      DialogImage,
      {
        isOpen: previewOpen,
        onOpenChange: setPreviewOpen,
        src: imageSrc,
        downloadImage,
        triggerRef,
        alt: memory.key
      }
    )
  );
}

// client/src/components/MemoryList.tsx
var MEMORY_ROW_ESTIMATE = 120;
var MEMORY_ROW_GAP = 8;
function MemoryList({
  memories,
  hasUpdateAccess,
  isFiltered = false,
  storeId,
  readOnly = false,
  domainsById
}) {
  const localize = useLocalize();
  const getItemKey = useCallback((memory) => `${memory.storeId ?? ""}:${memory.key}`, []);
  const renderMemory = useCallback(
    (memory) => {
      const domain = memory.domainId != null ? domainsById?.get(memory.domainId) ?? null : null;
      return /* @__PURE__ */ h(
        MemoryCard,
        {
          memory,
          hasUpdateAccess,
          storeId,
          readOnly,
          domain
        }
      );
    },
    [domainsById, hasUpdateAccess, readOnly, storeId]
  );
  if (memories.length === 0) {
    return /* @__PURE__ */ h(MemoryEmptyState, { isFiltered });
  }
  return /* @__PURE__ */ h(
    VirtualList,
    {
      items: memories,
      estimateSize: MEMORY_ROW_ESTIMATE,
      getItemKey,
      gap: MEMORY_ROW_GAP,
      renderItem: renderMemory,
      role: "list",
      rowRole: "listitem",
      ariaLabel: localize("com_ui_memories")
    }
  );
}

// client/src/components/MemoryPanel.tsx
var Plus = makeIcon("plus");
var Eraser = makeIcon("eraser");
var ChevronLeft2 = makeIcon("chevronLeft");
var FolderTree2 = makeIcon("folderTree");
function MemoryStoreListSkeleton({ count = 4 }) {
  return /* @__PURE__ */ h("div", { className: "flex flex-col gap-2", "aria-hidden": "true" }, Array.from({ length: count }, (_, i) => /* @__PURE__ */ h("div", { key: i, className: "rounded-lg border border-border-light px-3 py-3" }, /* @__PURE__ */ h(Skeleton, { className: "h-4 w-40 rounded" }))));
}
function MemoryPanel() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { data: userData } = useGetUserQuery();
  const { data: storesData, isLoading: storesLoading } = useMemoryStoresQuery();
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const { data: memData, isLoading: memoriesLoading } = useMemoriesQuery(
    selectedStoreId ?? void 0,
    { enabled: selectedStoreId != null }
  );
  const { showToast } = useToastContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [storeToRename, setStoreToRename] = useState(null);
  const [storeToDelete, setStoreToDelete] = useState(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [referenceSavedMemories, setReferenceSavedMemories] = useState(true);
  const [showDomains, setShowDomains] = useState(false);
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [domainToEdit, setDomainToEdit] = useState(null);
  const [domainToDelete, setDomainToDelete] = useState(null);
  const [selectedDomainId, setSelectedDomainId] = useState(null);
  const { data: domainsData, isLoading: domainsLoading } = useMemoryDomainsQuery(
    selectedStoreId ?? void 0,
    void 0,
    { enabled: selectedStoreId != null }
  );
  const updateMemoryPreferencesMutation = useUpdateMemoryPreferencesMutation({
    onSuccess: () => {
      showToast({
        message: localize("com_ui_preferences_updated"),
        status: "success"
      });
    },
    onError: () => {
      showToast({
        message: localize("com_ui_error_updating_preferences"),
        status: "error"
      });
      setReferenceSavedMemories((prev) => !prev);
    }
  });
  useEffect(() => {
    if (userData?.personalization?.memories !== void 0) {
      setReferenceSavedMemories(userData.personalization.memories);
    }
  }, [userData?.personalization?.memories]);
  const handleMemoryToggle = (checked) => {
    setReferenceSavedMemories(checked);
    updateMemoryPreferencesMutation.mutate({ memories: checked });
  };
  const hasReadAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.READ
  });
  const hasUpdateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.UPDATE
  });
  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.CREATE
  });
  const hasOptOutAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.OPT_OUT
  });
  const hasShareAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.SHARE
  });
  const stores = useMemo(() => {
    const list = storesData?.stores ?? [];
    return [...list].sort((a, b) => Number(b.isOwner) - Number(a.isOwner));
  }, [storesData]);
  const filteredStores = useMemo(() => {
    if (storeSearchQuery.trim() === "") {
      return stores;
    }
    return matchSorter(stores, storeSearchQuery, { keys: ["name", "ownerName"] });
  }, [stores, storeSearchQuery]);
  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) ?? null,
    [stores, selectedStoreId]
  );
  const domains = useMemo(() => domainsData?.domains ?? [], [domainsData]);
  const domainsById = useMemo(
    () => new Map(domains.map((domain) => [domain.id, domain])),
    [domains]
  );
  const domainFilterItems = useMemo(
    () => [
      { label: localize("com_ui_memory_domain_all"), value: "" },
      ...domains.map((domain) => ({
        label: `${domain.name} \xB7 ${localize("com_ui_memories_count", {
          0: domain.memoryCount ?? 0
        })}`,
        value: domain.id
      }))
    ],
    [domains, localize]
  );
  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) ?? null,
    [domains, selectedDomainId]
  );
  useEffect(() => {
    if (selectedDomainId != null && !domainsLoading && selectedDomain == null) {
      setSelectedDomainId(null);
    }
  }, [selectedDomainId, selectedDomain, domainsLoading]);
  useEffect(() => {
    if (selectedStoreId != null && stores.length > 0 && selectedStore == null) {
      setSelectedStoreId(null);
    }
  }, [selectedStoreId, stores, selectedStore]);
  const memories = useMemo(() => {
    const list = memData?.memories ?? [];
    return [...list].sort((a, b) => {
      const stableDelta = Number(b.stable === true) - Number(a.stable === true);
      if (stableDelta !== 0) {
        return stableDelta;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [memData]);
  const domainMemories = useMemo(
    () => selectedDomainId == null ? memories : memories.filter((memory) => memory.domainId === selectedDomainId),
    [memories, selectedDomainId]
  );
  const filteredMemories = useMemo(() => {
    if (searchQuery.trim() === "") {
      return domainMemories;
    }
    return matchSorter(domainMemories, searchQuery, {
      /** Tags are matched as one searchable string: match-sorter reads a key's
       *  value as text, so the array is joined rather than handed over as is. */
      keys: ["key", "value", (memory) => (memory.tags ?? []).join(" ")]
    });
  }, [domainMemories, searchQuery]);
  if (!hasReadAccess) {
    return /* @__PURE__ */ h("div", { className: "flex h-full w-full items-center justify-center p-4" }, /* @__PURE__ */ h("div", { className: "text-center" }, /* @__PURE__ */ h("p", { className: "text-sm text-text-secondary" }, localize("com_ui_no_read_access"))));
  }
  const tokenLimit = memData?.tokenLimit ?? null;
  const showUsageBadge = tokenLimit != null;
  const isMemoryView = selectedStore != null;
  const isDomainView = isMemoryView && showDomains;
  const canWrite = selectedStore?.canWrite !== false && memData?.canWrite !== false;
  const handleSelectStore = (store) => {
    setSearchQuery("");
    setStoreSearchQuery("");
    setSelectedDomainId(null);
    setShowDomains(false);
    setSelectedStoreId(store.id);
  };
  const handleBackToStores = () => {
    setSearchQuery("");
    setStoreSearchQuery("");
    setSelectedDomainId(null);
    setShowDomains(false);
    setSelectedStoreId(null);
  };
  const handleSelectDomain = (domain) => {
    setSelectedDomainId(domain.id);
    setSearchQuery("");
    setShowDomains(false);
  };
  const handleStoreDeleted = (storeId) => {
    if (storeId === selectedStoreId) {
      setSelectedStoreId(null);
    }
  };
  const memoryToggle = hasOptOutAccess ? /* @__PURE__ */ h(
    Button,
    {
      size: "sm",
      variant: "outline",
      className: cn(
        isMemoryView && showUsageBadge && "ml-auto",
        isMemoryView && !showUsageBadge && "w-full",
        !isMemoryView && !hasCreateAccess && "w-full",
        referenceSavedMemories && "bg-surface-hover hover:bg-surface-hover"
      ),
      onClick: () => handleMemoryToggle(!referenceSavedMemories),
      "aria-label": localize("com_ui_use_memory"),
      "aria-pressed": referenceSavedMemories,
      disabled: updateMemoryPreferencesMutation.isLoading
    },
    /* @__PURE__ */ h(
      Checkbox,
      {
        checked: referenceSavedMemories,
        tabIndex: -1,
        "aria-hidden": "true",
        "aria-label": localize("com_ui_use_memory"),
        className: "pointer-events-none"
      }
    ),
    localize("com_ui_use_memory")
  ) : null;
  const clearStoreControl = canWrite && hasUpdateAccess && memories.length > 0 ? /* @__PURE__ */ h(
    Button,
    {
      size: "sm",
      variant: "outline",
      className: "shrink-0 gap-1.5 bg-transparent",
      onClick: () => setClearDialogOpen(true),
      "aria-label": localize("com_ui_memory_store_clear")
    },
    /* @__PURE__ */ h(Eraser, { className: "size-4", "aria-hidden": "true" }),
    localize("com_ui_memory_store_clear")
  ) : null;
  return /* @__PURE__ */ h(
    "div",
    {
      role: "region",
      "aria-label": localize("com_ui_memories"),
      className: "flex h-full w-full flex-col overflow-hidden pt-2"
    },
    /* @__PURE__ */ h("div", { className: "shrink-0 space-y-2 px-3 pb-2" }, isDomainView ? /* @__PURE__ */ h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ h(
      TooltipAnchor,
      {
        description: localize("com_ui_back"),
        side: "bottom",
        render: /* @__PURE__ */ h(
          Button,
          {
            variant: "outline",
            size: "icon",
            className: "size-9 shrink-0 bg-transparent",
            "aria-label": localize("com_ui_back"),
            onClick: () => setShowDomains(false)
          },
          /* @__PURE__ */ h(ChevronLeft2, { className: "size-4", "aria-hidden": "true" })
        )
      }
    ), /* @__PURE__ */ h("span", { className: "min-w-0 flex-1 truncate text-sm font-semibold text-text-primary" }, localize("com_ui_memory_domains")), hasCreateAccess && canWrite && /* @__PURE__ */ h(
      TooltipAnchor,
      {
        description: localize("com_ui_memory_domain_create"),
        side: "bottom",
        render: /* @__PURE__ */ h(
          Button,
          {
            variant: "outline",
            size: "icon",
            className: "size-9 shrink-0 bg-transparent",
            "aria-label": localize("com_ui_memory_domain_create"),
            onClick: () => setDomainDialogOpen(true)
          },
          /* @__PURE__ */ h(Plus, { className: "size-4", "aria-hidden": "true" })
        )
      }
    )) : isMemoryView ? /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ h(
      TooltipAnchor,
      {
        description: localize("com_ui_back_to_memory_stores"),
        side: "bottom",
        render: /* @__PURE__ */ h(
          Button,
          {
            variant: "outline",
            size: "icon",
            className: "size-9 shrink-0 bg-transparent",
            "aria-label": localize("com_ui_back_to_memory_stores"),
            onClick: handleBackToStores
          },
          /* @__PURE__ */ h(ChevronLeft2, { className: "size-4", "aria-hidden": "true" })
        )
      }
    ), /* @__PURE__ */ h(
      "span",
      {
        className: "min-w-0 flex-1 truncate text-sm font-semibold text-text-primary",
        title: selectedStore.name
      },
      selectedStore.name
    ), domains.length > 0 && /* @__PURE__ */ h(
      TooltipAnchor,
      {
        description: localize("com_ui_memory_domains"),
        side: "bottom",
        render: /* @__PURE__ */ h(
          Button,
          {
            variant: "outline",
            size: "icon",
            className: "size-9 shrink-0 bg-transparent",
            "aria-label": localize("com_ui_memory_domains"),
            onClick: () => setShowDomains(true)
          },
          /* @__PURE__ */ h(FolderTree2, { className: "size-4", "aria-hidden": "true" })
        )
      }
    ), hasCreateAccess && canWrite && /* @__PURE__ */ h(
      MemoryCreateDialog,
      {
        open: createDialogOpen,
        onOpenChange: setCreateDialogOpen,
        storeId: selectedStore.id
      },
      /* @__PURE__ */ h(OGDialogTrigger, { asChild: true }, /* @__PURE__ */ h(
        TooltipAnchor,
        {
          description: localize("com_ui_create_memory"),
          side: "bottom",
          render: /* @__PURE__ */ h(
            Button,
            {
              variant: "outline",
              size: "icon",
              className: "size-9 shrink-0 bg-transparent",
              "aria-label": localize("com_ui_create_memory"),
              onClick: () => setCreateDialogOpen(true)
            },
            /* @__PURE__ */ h(Plus, { className: "size-4", "aria-hidden": "true" })
          )
        }
      ))
    )), /* @__PURE__ */ h(
      FilterInput,
      {
        inputId: "memory-search",
        label: localize("com_ui_memories_filter"),
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        containerClassName: "w-full"
      }
    ), domains.length > 1 && /* @__PURE__ */ h(
      ControlCombobox,
      {
        isCollapsed: false,
        ariaLabel: localize("com_ui_memory_domain_filter"),
        selectedValue: selectedDomainId ?? "",
        displayValue: selectedDomain?.name ?? localize("com_ui_memory_domain_all"),
        setValue: (value) => setSelectedDomainId(value === "" ? null : value),
        selectPlaceholder: localize("com_ui_memory_domain_all"),
        searchPlaceholder: localize("com_ui_search_memory_domains"),
        items: domainFilterItems,
        className: "h-9 border-border-light",
        containerClassName: "w-full px-0"
      }
    ), (showUsageBadge || clearStoreControl != null) && /* @__PURE__ */ h("div", { className: "flex items-center justify-between gap-2" }, showUsageBadge && /* @__PURE__ */ h(
      MemoryUsageBadge,
      {
        percentage: memData?.usagePercentage ?? 0,
        tokenLimit,
        totalTokens: memData?.totalTokens ?? 0
      }
    ), clearStoreControl)) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("div", { className: "flex items-center justify-between gap-2" }, memoryToggle, hasCreateAccess && /* @__PURE__ */ h(
      TooltipAnchor,
      {
        description: localize("com_ui_create_memory_store"),
        side: "bottom",
        render: /* @__PURE__ */ h(
          Button,
          {
            variant: "outline",
            size: "icon",
            className: "size-9 shrink-0 bg-transparent",
            "aria-label": localize("com_ui_create_memory_store"),
            onClick: () => setStoreDialogOpen(true)
          },
          /* @__PURE__ */ h(Plus, { className: "size-4", "aria-hidden": "true" })
        )
      }
    )), /* @__PURE__ */ h(
      FilterInput,
      {
        inputId: "memory-store-search",
        label: localize("com_ui_search_memory_stores"),
        value: storeSearchQuery,
        onChange: (e) => setStoreSearchQuery(e.target.value),
        containerClassName: "w-full"
      }
    ))),
    isMemoryView && !canWrite && /* @__PURE__ */ h("p", { className: "shrink-0 px-3 pb-2 text-xs text-text-secondary" }, localize("com_ui_memory_store_shared_readonly")),
    isDomainView ? /* @__PURE__ */ h(
      PanelContent,
      {
        isLoading: domainsLoading,
        skeleton: /* @__PURE__ */ h(MemoryStoreListSkeleton, null),
        className: "px-3 pb-3"
      },
      /* @__PURE__ */ h(
        MemoryDomainList,
        {
          domains,
          canManage: hasUpdateAccess && canWrite,
          onSelect: handleSelectDomain,
          onEdit: setDomainToEdit,
          onDelete: setDomainToDelete
        }
      )
    ) : isMemoryView ? /* @__PURE__ */ h(
      PanelContent,
      {
        isLoading: memoriesLoading,
        skeleton: /* @__PURE__ */ h(MemoryCardSkeleton, null),
        className: "px-3 pb-3"
      },
      /* @__PURE__ */ h(
        MemoryList,
        {
          memories: filteredMemories,
          hasUpdateAccess,
          isFiltered: searchQuery.length > 0,
          storeId: selectedStore.id,
          readOnly: !canWrite,
          domainsById
        }
      )
    ) : /* @__PURE__ */ h(
      PanelContent,
      {
        isLoading: storesLoading,
        skeleton: /* @__PURE__ */ h(MemoryStoreListSkeleton, null),
        className: "px-3 pb-3"
      },
      /* @__PURE__ */ h(
        MemoryStoreList,
        {
          stores: filteredStores,
          selectedStoreId,
          canManage: hasUpdateAccess,
          canShare: hasShareAccess,
          isFiltered: storeSearchQuery.trim() !== "",
          onSelect: handleSelectStore,
          onRename: setStoreToRename,
          onDelete: setStoreToDelete
        }
      )
    ),
    /* @__PURE__ */ h(AdminSettings, null),
    /* @__PURE__ */ h(MemoryStoreDialog, { open: storeDialogOpen, onOpenChange: setStoreDialogOpen }),
    /* @__PURE__ */ h(
      MemoryStoreDialog,
      {
        open: storeToRename != null,
        onOpenChange: (open) => {
          if (!open) {
            setStoreToRename(null);
          }
        },
        store: storeToRename
      }
    ),
    /* @__PURE__ */ h(
      MemoryStoreClearDialog,
      {
        open: clearDialogOpen,
        onOpenChange: setClearDialogOpen,
        store: selectedStore
      }
    ),
    /* @__PURE__ */ h(
      MemoryDomainDialog,
      {
        open: domainDialogOpen,
        onOpenChange: setDomainDialogOpen,
        storeId: selectedStore?.id
      }
    ),
    /* @__PURE__ */ h(
      MemoryDomainDialog,
      {
        open: domainToEdit != null,
        onOpenChange: (open) => {
          if (!open) {
            setDomainToEdit(null);
          }
        },
        storeId: selectedStore?.id,
        domain: domainToEdit
      }
    ),
    /* @__PURE__ */ h(
      MemoryDomainDeleteDialog,
      {
        open: domainToDelete != null,
        onOpenChange: (open) => {
          if (!open) {
            setDomainToDelete(null);
          }
        },
        domain: domainToDelete,
        storeId: selectedStore?.id,
        onDeleted: (domainId) => {
          if (domainId === selectedDomainId) {
            setSelectedDomainId(null);
          }
        }
      }
    ),
    /* @__PURE__ */ h(
      MemoryStoreDeleteDialog,
      {
        open: storeToDelete != null,
        onOpenChange: (open) => {
          if (!open) {
            setStoreToDelete(null);
          }
        },
        store: storeToDelete,
        onDeleted: handleStoreDeleted
      }
    )
  );
}

// client/src/components/MemoryScopeDialog.tsx
function DomainLabel({ domain, name }) {
  if (domain != null) {
    return /* @__PURE__ */ h(MemoryDomainChip, { domain });
  }
  if (name == null || name === "") {
    return null;
  }
  return /* @__PURE__ */ h("span", { className: "inline-flex min-w-0 items-center rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary" }, /* @__PURE__ */ h("span", { className: "truncate" }, name));
}
function MemoryScopeRow({
  memory,
  domain,
  /** `recalled`: the row already sits under its domain, so no domain chip and a
   *  single "recalled N times" chip. `created`: the chat's own write, labelled
   *  created or updated. */
  variant
}) {
  const localize = useLocalize();
  const [expanded, setExpanded] = useState(false);
  const summary = memory.content ?? memory.value ?? "";
  const expandable = summary !== "";
  return /* @__PURE__ */ h(
    "li",
    {
      className: "rounded-lg border border-border-light bg-surface-secondary px-3 py-2",
      "data-testid": "memory-scope-row"
    },
    /* @__PURE__ */ h(
      "div",
      {
        className: cn("flex items-start justify-between gap-3", expandable && "cursor-pointer"),
        ...expandable ? {
          role: "button",
          tabIndex: 0,
          "aria-expanded": expanded,
          onClick: () => setExpanded((value) => !value),
          onKeyDown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setExpanded((value) => !value);
            }
          }
        } : {}
      },
      /* @__PURE__ */ h("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ h("div", { className: "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1" }, /* @__PURE__ */ h("span", { className: "truncate text-sm font-medium text-text-primary" }, memory.key), variant === "created" && /* @__PURE__ */ h(DomainLabel, { domain, name: memory.domainName }), memory.stable === true && /* @__PURE__ */ h("span", { className: "shrink-0 rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary" }, localize("com_ui_memory_stable"))), expandable && /* @__PURE__ */ h(
        "p",
        {
          className: cn(
            "mt-1 text-xs text-text-secondary [overflow-wrap:anywhere]",
            /** Collapsed shows the first two lines; a click reveals the
             *  whole value, another click folds it back. */
            !expanded && "line-clamp-2"
          ),
          "data-testid": "memory-scope-content"
        },
        summary
      )),
      /* @__PURE__ */ h("div", { className: "flex shrink-0 flex-col items-end gap-1 text-xs" }, /* @__PURE__ */ h(
        "span",
        {
          className: cn(
            "rounded-full border px-2 py-0.5 font-medium",
            variant === "created" ? "border-border-heavy bg-surface-tertiary text-text-primary" : "border-border-light text-text-secondary"
          ),
          "data-testid": variant === "created" ? "memory-scope-created-chip" : "memory-scope-recall-count"
        },
        variant === "created" ? localize(
          memory.created === true ? "com_ui_memory_scope_created" : "com_ui_memory_scope_updated"
        ) : localize("com_ui_memory_scope_recall_count", { 0: memory.recallCount })
      ))
    )
  );
}
function MemoryScopeDialog({
  open,
  onOpenChange,
  conversationId
}) {
  const localize = useLocalize();
  const enabled = open && Boolean(conversationId);
  const {
    data: domainData,
    isLoading: domainsLoading,
    isError: domainsError
  } = useMemoryDomainsQuery(void 0, conversationId, { enabled });
  const {
    data: conversationData,
    isLoading: memoriesLoading,
    isError: memoriesError
  } = useConversationMemoriesQuery(conversationId, void 0, { enabled });
  const setActive = useSetMemoryDomainActiveMutation({ invalidate: false });
  const [optimisticActiveIds, setOptimisticActiveIds] = useState(null);
  const domains = domainData?.domains ?? [];
  const memories = conversationData?.memories ?? [];
  const domainById = useMemo(
    () => new Map(domains.map((domain) => [domain.id, domain])),
    [domains]
  );
  const defaultDomain = useMemo(
    () => domains.find((domain) => domain.isDefault === true),
    [domains]
  );
  const activeIds = useMemo(() => {
    const stored = optimisticActiveIds ?? domainData?.activeDomainIds;
    const ids = new Set(stored ?? []);
    if (stored == null && defaultDomain != null) {
      ids.add(defaultDomain.id);
    }
    return ids;
  }, [optimisticActiveIds, domainData?.activeDomainIds, defaultDomain]);
  useEffect(() => {
    setOptimisticActiveIds(null);
  }, [domainData?.activeDomainIds]);
  const recalled = useMemo(() => memories.filter((memory) => memory.recallCount > 0), [memories]);
  const recalledGroups = useMemo(() => {
    const groups = /* @__PURE__ */ new Map();
    for (const memory of recalled) {
      const key = memory.domainId ?? "";
      const rows = groups.get(key) ?? [];
      rows.push(memory);
      groups.set(key, rows);
    }
    const order = new Map(domains.map((domain, index) => [domain.id, index]));
    const rank = (domainId) => domainId === "" ? Number.MAX_SAFE_INTEGER : order.get(domainId) ?? domains.length;
    return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
  }, [recalled, domains]);
  const createdMemories = useMemo(
    () => memories.filter((memory) => memory.extracted).sort(
      (a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
    ),
    [memories]
  );
  const toggleDomain = (domain, next) => {
    if (conversationId == null) {
      return;
    }
    const ids = new Set(activeIds);
    if (next) {
      ids.add(domain.id);
    } else {
      ids.delete(domain.id);
    }
    const nextIds = [...ids];
    setOptimisticActiveIds(nextIds);
    setActive.mutate(
      {
        conversationId,
        storeId: domainData?.storeId,
        domainIds: nextIds
      },
      {
        onSuccess: (data) => setOptimisticActiveIds(data?.activeDomainIds ?? nextIds),
        onError: () => setOptimisticActiveIds(null)
      }
    );
  };
  const spinner = /* @__PURE__ */ h(Spinner, { className: "my-2 size-4" });
  const errorLine = /* @__PURE__ */ h("p", { className: "text-xs text-text-secondary", role: "alert" }, localize("com_ui_error"));
  const emptyLine = (key) => /* @__PURE__ */ h("p", { className: "text-xs text-text-secondary" }, localize(key));
  return /* @__PURE__ */ h(OGDialog, { open, onOpenChange }, /* @__PURE__ */ h(
    OGDialogTemplate,
    {
      title: localize("com_ui_memory_scope_title"),
      description: localize("com_ui_memory_scope_description"),
      showCloseButton: true,
      className: "flex max-h-[90vh] w-11/12 flex-col overflow-hidden md:max-w-2xl",
      headerClassName: "shrink-0",
      mainClassName: "min-h-0 flex-1 overflow-y-auto",
      footerClassName: "shrink-0",
      main: /* @__PURE__ */ h("div", { className: "space-y-5 pr-1", "data-testid": "memory-scope-dialog" }, /* @__PURE__ */ h("section", { "aria-labelledby": "memory-scope-domains" }, /* @__PURE__ */ h("h3", { id: "memory-scope-domains", className: "text-sm font-semibold text-text-primary" }, localize("com_ui_memory_scope_active_domains")), /* @__PURE__ */ h("p", { className: "mt-0.5 text-xs text-text-secondary" }, localize("com_ui_memory_scope_active_hint")), /* @__PURE__ */ h("div", { className: "mt-2 space-y-1.5" }, domainsLoading ? spinner : domainsError ? errorLine : domains.length === 0 ? emptyLine("com_ui_memory_scope_no_domains") : domains.map((domain) => {
        const active = activeIds.has(domain.id);
        return /* @__PURE__ */ h(
          "div",
          {
            key: domain.id,
            className: "flex items-center justify-between gap-3 rounded-lg border border-border-light bg-surface-secondary px-3 py-2",
            "data-testid": "memory-scope-domain-row"
          },
          /* @__PURE__ */ h("div", { className: "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1" }, /* @__PURE__ */ h(MemoryDomainChip, { domain }), /* @__PURE__ */ h("span", { className: "text-xs text-text-secondary" }, localize("com_ui_memories_count", {
            0: domain.memoryCount ?? 0
          }))),
          /* @__PURE__ */ h(
            Switch,
            {
              size: "small",
              className: "shrink-0",
              checked: active,
              disabled: setActive.isLoading,
              "aria-label": localize(
                active ? "com_ui_memory_scope_deactivate" : "com_ui_memory_scope_activate"
              ),
              onCheckedChange: (next) => toggleDomain(domain, next)
            }
          )
        );
      }))), /* @__PURE__ */ h("section", { "aria-labelledby": "memory-scope-recalled" }, /* @__PURE__ */ h("h3", { id: "memory-scope-recalled", className: "text-sm font-semibold text-text-primary" }, localize("com_ui_memory_scope_recalled_by_domain")), /* @__PURE__ */ h("div", { className: "mt-2 space-y-3" }, memoriesLoading ? spinner : memoriesError ? errorLine : recalledGroups.length === 0 ? emptyLine("com_ui_memory_scope_no_recalls") : recalledGroups.map(([domainId, rows]) => /* @__PURE__ */ h("div", { key: domainId === "" ? "unassigned" : domainId }, /* @__PURE__ */ h("div", { className: "mb-1 flex items-center gap-2" }, /* @__PURE__ */ h(
        DomainLabel,
        {
          domain: domainId === "" ? void 0 : domainById.get(domainId),
          name: domainId === "" ? defaultDomain?.name ?? localize("com_ui_memory_store_default") : domainById.get(domainId)?.name
        }
      ), /* @__PURE__ */ h("span", { className: "text-xs text-text-secondary" }, localize("com_ui_memories_count", { 0: rows.length }))), /* @__PURE__ */ h("ul", { className: "space-y-1.5" }, rows.map((memory) => /* @__PURE__ */ h(
        MemoryScopeRow,
        {
          key: memory.key,
          variant: "recalled",
          memory,
          domain: memory.domainId != null ? domainById.get(memory.domainId) : void 0
        }
      ))))))), /* @__PURE__ */ h("section", { "aria-labelledby": "memory-scope-all" }, /* @__PURE__ */ h("h3", { id: "memory-scope-all", className: "text-sm font-semibold text-text-primary" }, localize("com_ui_memory_scope_conversation")), memoriesLoading ? /* @__PURE__ */ h("div", { className: "mt-2" }, spinner) : memoriesError ? /* @__PURE__ */ h("div", { className: "mt-2" }, errorLine) : createdMemories.length === 0 ? /* @__PURE__ */ h("div", { className: "mt-2" }, emptyLine("com_ui_memory_scope_empty")) : /* @__PURE__ */ h("ul", { className: "mt-2 space-y-1.5" }, createdMemories.map((memory) => /* @__PURE__ */ h(
        MemoryScopeRow,
        {
          key: memory.key,
          variant: "created",
          memory,
          domain: memory.domainId != null ? domainById.get(memory.domainId) : void 0
        }
      )))))
    }
  ));
}

// client/src/components/MemoryInfo.tsx
function formatStoredAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(void 0, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}
function imageTitleOf(artifact) {
  const parts = [];
  const storedAt = artifact.updatedAt != null ? formatStoredAt(artifact.updatedAt) : null;
  if (storedAt != null) {
    parts.push(storedAt);
  }
  if (artifact.width != null && artifact.height != null) {
    parts.push(`(${artifact.width}\xD7${artifact.height})`);
  }
  return parts.length > 0 ? parts.join(" ") : artifact.key;
}
function MemoryDomainAndTags({ artifact }) {
  const { data } = useMemoryDomainsQuery(artifact.storeId);
  const domains = data?.domains;
  const domain = artifact.domainId != null ? domains?.find((entry) => entry.id === artifact.domainId) : void 0;
  const tags = artifact.tags;
  if (domain == null && (tags == null || tags.length === 0)) {
    return null;
  }
  return /* @__PURE__ */ h("div", { className: "mt-1.5 flex flex-wrap items-center gap-1" }, domain != null && /* @__PURE__ */ h(MemoryDomainChip, { domain }), tags?.map((tag) => /* @__PURE__ */ h(
    "span",
    {
      key: tag,
      className: "rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary"
    },
    tag
  )));
}
function RecalledMemoryItem({ artifact }) {
  const localize = useLocalize();
  const isImage = artifact.kind === "image";
  const title = isImage ? imageTitleOf(artifact) : artifact.key;
  const [previewOpen, setPreviewOpen] = useState(false);
  const triggerRef = useRef(null);
  const { data: imageSrc, isLoading } = useVFSImageSrcQuery(
    isImage && artifact.url != null ? artifact.url : null
  );
  const hasImage = imageSrc != null && imageSrc !== "";
  const downloadImage = useCallback(() => {
    if (imageSrc == null || imageSrc === "") {
      return;
    }
    const link = document.createElement("a");
    link.href = imageSrc;
    link.download = `memory-image.${extensionForMime(artifact.mime)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [imageSrc, artifact.mime]);
  return /* @__PURE__ */ h("div", { className: "rounded-lg p-3" }, /* @__PURE__ */ h("div", { className: "mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary" }, title), isImage ? (
    /** `w-fit` keeps the framed box sized to the picture instead of
     *  stretching to the panel width; `max-w-full` still caps a picture
     *  wider than the card. */
    /* @__PURE__ */ h("div", { className: "w-fit max-w-full overflow-hidden rounded-md border border-border-light bg-surface-tertiary" }, isLoading && /* @__PURE__ */ h("div", { className: "flex h-20 w-40 items-center justify-center" }, /* @__PURE__ */ h(Spinner, { className: "size-4 text-text-secondary" })), !isLoading && hasImage && /* @__PURE__ */ h(
      "button",
      {
        ref: triggerRef,
        type: "button",
        "aria-label": `View ${title} in dialog`,
        "aria-haspopup": "dialog",
        onClick: () => setPreviewOpen(true),
        className: "relative block cursor-zoom-in p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
      },
      /* @__PURE__ */ h(
        "img",
        {
          src: imageSrc,
          alt: title,
          loading: "lazy",
          className: "block h-auto max-h-48 w-auto max-w-full object-contain"
        }
      )
    ), !isLoading && !hasImage && /* @__PURE__ */ h("span", { className: "block px-3 py-6 text-xs text-text-secondary" }, localize("com_ui_memory_image_unavailable")))
  ) : /* @__PURE__ */ h("div", { className: "whitespace-pre-wrap text-sm text-text-primary" }, artifact.value), !isImage && /* @__PURE__ */ h(MemoryDomainAndTags, { artifact }), isImage && hasImage && /* @__PURE__ */ h(
    DialogImage,
    {
      isOpen: previewOpen,
      onOpenChange: setPreviewOpen,
      src: imageSrc,
      downloadImage,
      triggerRef
    }
  ));
}
function MemoryInfo({ memoryArtifacts }) {
  const localize = useLocalize();
  const { recalledMemories, updatedMemories, deletedMemories, errorMessages } = useMemo(() => {
    const recalled = memoryArtifacts.filter((art) => art.type === "recall");
    const updated = memoryArtifacts.filter((art) => art.type === "update");
    const deleted = memoryArtifacts.filter((art) => art.type === "delete");
    const errors = memoryArtifacts.filter((art) => art.type === "error");
    const messages = errors.map((artifact) => {
      try {
        const errorData = JSON.parse(artifact.value);
        if (errorData.errorType === "already_exceeded") {
          return localize("com_ui_memory_already_exceeded", {
            tokens: errorData.tokenCount
          });
        } else if (errorData.errorType === "would_exceed") {
          return localize("com_ui_memory_would_exceed", {
            tokens: errorData.tokenCount
          });
        } else {
          return localize("com_ui_memory_error");
        }
      } catch {
        return localize("com_ui_memory_error");
      }
    });
    return {
      recalledMemories: recalled,
      updatedMemories: updated,
      deletedMemories: deleted,
      errorMessages: messages
    };
  }, [memoryArtifacts, localize]);
  if (memoryArtifacts.length === 0) {
    return null;
  }
  if (recalledMemories.length === 0 && updatedMemories.length === 0 && deletedMemories.length === 0 && errorMessages.length === 0) {
    return null;
  }
  return /* @__PURE__ */ h("div", { className: "space-y-4 p-4" }, recalledMemories.length > 0 && /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h4", { className: "mb-2 text-sm font-semibold text-text-primary" }, localize("com_ui_memory_recalled_items")), /* @__PURE__ */ h("div", { className: "space-y-2" }, recalledMemories.map((artifact) => /* @__PURE__ */ h(
    RecalledMemoryItem,
    {
      key: `recall-${artifact.key}-${artifact.section ?? ""}`,
      artifact
    }
  )))), updatedMemories.length > 0 && /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h4", { className: "mb-2 text-sm font-semibold text-text-primary" }, localize("com_ui_memory_updated_items")), /* @__PURE__ */ h("div", { className: "space-y-2" }, updatedMemories.map((artifact) => /* @__PURE__ */ h("div", { key: `update-${artifact.key}`, className: "rounded-lg p-3" }, /* @__PURE__ */ h("div", { className: "mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary" }, artifact.key), /* @__PURE__ */ h("div", { className: "whitespace-pre-wrap text-sm text-text-primary" }, artifact.content ?? artifact.value), /* @__PURE__ */ h(MemoryDomainAndTags, { artifact }))))), deletedMemories.length > 0 && /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h4", { className: "mb-2 text-sm font-semibold text-text-primary" }, localize("com_ui_memory_deleted_items")), /* @__PURE__ */ h("div", { className: "space-y-2" }, deletedMemories.map((artifact) => /* @__PURE__ */ h("div", { key: `delete-${artifact.key}`, className: "rounded-lg p-3 opacity-60" }, /* @__PURE__ */ h("div", { className: "mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary" }, artifact.key), /* @__PURE__ */ h("div", { className: "text-sm italic text-text-secondary" }, localize("com_ui_memory_deleted")))))), errorMessages.length > 0 && /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h4", { className: "mb-2 text-sm font-semibold text-text-destructive" }, localize("com_ui_memory_storage_full")), /* @__PURE__ */ h("div", { className: "space-y-2" }, errorMessages.map((errorMessage) => /* @__PURE__ */ h(Alert, { key: errorMessage, variant: "error", icon: false, className: "rounded-md p-3" }, errorMessage)))));
}

// client/src/hooks.js
var BOUNDED_BODY_CLASS = "max-h-[40dvh] overflow-x-hidden overflow-y-auto [contain:paint]";
function useExpandCollapse(isExpanded) {
  const ref = useRef(null);
  const style = useMemo(
    () => ({
      display: "grid",
      gridTemplateRows: isExpanded ? "1fr" : "0fr",
      transition: "grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
    }),
    [isExpanded]
  );
  return { style, ref };
}
function useBoundedBody() {
  const bodyRef = useRef(null);
  return { bodyRef, bodyStyle: void 0, onScroll: () => {
  } };
}

// client/src/components/MemoryArtifacts.tsx
var Tools = { memory: "memory" };
function MemoryArtifacts({ attachments }) {
  const localize = useLocalize();
  const [showInfo, setShowInfo] = useState(false);
  const { style: expandStyle, ref: expandRef } = useExpandCollapse(showInfo);
  const { bodyRef, bodyStyle, onScroll } = useBoundedBody({ enabled: showInfo });
  const { hasErrors, memoryArtifacts } = useMemo(() => {
    let hasErrors2 = false;
    const result = [];
    if (!attachments || attachments.length === 0) {
      return { hasErrors: hasErrors2, memoryArtifacts: result };
    }
    for (const attachment of attachments) {
      if (attachment?.[Tools.memory] != null) {
        result.push(attachment[Tools.memory]);
        if (!hasErrors2 && attachment[Tools.memory].type === "error") {
          hasErrors2 = true;
        }
      }
    }
    return { hasErrors: hasErrors2, memoryArtifacts: result };
  }, [attachments]);
  const recalledOnly = memoryArtifacts.length > 0 && memoryArtifacts.every((artifact) => artifact.type === "recall");
  const hasArtifacts = memoryArtifacts.length > 0;
  const hadArtifactsRef = useRef(false);
  useLayoutEffect(() => {
    if (hasArtifacts && !hadArtifactsRef.current) {
      setShowInfo(false);
    }
    hadArtifactsRef.current = hasArtifacts;
  }, [hasArtifacts]);
  if (!hasArtifacts) {
    return null;
  }
  let memoryLabel = localize("com_ui_memory_updated");
  if (hasErrors) {
    memoryLabel = localize("com_ui_memory_error");
  } else if (recalledOnly) {
    memoryLabel = localize("com_ui_memory_recalled");
  }
  return /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("div", { className: "flex items-center" }, /* @__PURE__ */ h("div", { className: "inline-block" }, /* @__PURE__ */ h(
    "button",
    {
      className: cn(
        "flex items-center gap-1 py-1.5 text-sm font-semibold transition-colors",
        hasErrors ? "text-status-error" : "text-text-secondary-alt hover:text-text-primary"
      ),
      type: "button",
      onClick: () => setShowInfo((prev) => !prev),
      "aria-expanded": showInfo,
      "aria-label": memoryLabel
    },
    /* @__PURE__ */ h(
      "svg",
      {
        width: "20",
        height: "20",
        viewBox: "0 0 18 18",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        className: "mb-[-1px]"
      },
      /* @__PURE__ */ h(
        "path",
        {
          d: "M6 3C4.89543 3 4 3.89543 4 5V13C4 14.1046 4.89543 15 6 15L6 3Z",
          fill: "currentColor"
        }
      ),
      /* @__PURE__ */ h(
        "path",
        {
          d: "M7 3V15H8.18037L8.4899 13.4523C8.54798 13.1619 8.69071 12.8952 8.90012 12.6858L12.2931 9.29289C12.7644 8.82153 13.3822 8.58583 14 8.58578V3.5C14 3.22386 13.7761 3 13.5 3H7Z",
          fill: "currentColor"
        }
      ),
      /* @__PURE__ */ h(
        "path",
        {
          d: "M11.3512 15.5297L9.73505 15.8529C9.38519 15.9229 9.07673 15.6144 9.14671 15.2646L9.46993 13.6484C9.48929 13.5517 9.53687 13.4628 9.60667 13.393L12.9996 10C13.5519 9.44771 14.4473 9.44771 14.9996 10C15.5519 10.5523 15.5519 11.4477 14.9996 12L11.6067 15.393C11.5369 15.4628 11.448 15.5103 11.3512 15.5297Z",
          fill: "currentColor"
        }
      )
    ),
    memoryLabel
  ))), /* @__PURE__ */ h("div", { style: expandStyle, "aria-hidden": !showInfo || void 0 }, /* @__PURE__ */ h("div", { className: "overflow-hidden", ref: expandRef }, /* @__PURE__ */ h(
    "div",
    {
      className: cn(
        // The offset lives inside the clipped element: a margin on the
        // 0fr grid item itself still reserves space while collapsed.
        // `lc-card-surface` puts the card on the content-card alpha
        // (`style.css`): its own tone is a role that rule cannot name.
        // `overflow-hidden` keeps the scrolled content off the card's
        // rounded corners.
        "lc-card-surface mt-2 overflow-hidden rounded-xl border border-border-light bg-surface-primary-alt shadow-md",
        showInfo && "shadow-lg"
      )
    },
    /* @__PURE__ */ h("div", { ref: bodyRef, onScroll, style: bodyStyle, className: BOUNDED_BODY_CLASS }, /* @__PURE__ */ h(MemoryInfo, { memoryArtifacts }))
  ))));
}

// client/src/index.js
var inject = ["ui", "app-ui", "i18n"];
function activate(api) {
  const { React } = api;
  const h2 = React.createElement;
  const { useState: useState2 } = React;
  const ui = api.consume("ui");
  const appUi = api.consume("app-ui");
  const i18n = api.consume("i18n");
  if (ui == null) {
    throw new Error("memory plugin requires the ui service");
  }
  if (i18n == null) {
    throw new Error("memory plugin requires the i18n service");
  }
  const translator = i18n.scope("memory", memoryCatalogs);
  configure(api, ui, translator, appUi);
  const t2 = translator.t;
  const STORE_TAG_CLASS = "shrink-0 rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary";
  const STORE_OWNER_TAG_CLASS = "shrink-0 rounded-full border border-status-success-border bg-status-success-subtle px-2 py-0.5 text-xs font-medium text-status-success";
  function storeTag(store) {
    if (store.isDefault && store.isOwner) {
      return h2("span", { key: "default", className: STORE_TAG_CLASS }, t2("settings.storeDefault"));
    }
    if (!store.isOwner && store.ownerName) {
      return h2("span", { key: "owner", className: STORE_OWNER_TAG_CLASS }, store.ownerName);
    }
    return void 0;
  }
  function AgentMemorySettings(props) {
    translator.useLocale();
    const { Switch: Switch2, ControlCombobox: ControlCombobox2, MultiSelect: MultiSelect2, Label: Label2 } = ui;
    const { data: storesData } = useRpc("memories.stores", {});
    const storeId = typeof props.memoryStore === "string" && props.memoryStore !== "" ? props.memoryStore : void 0;
    const { data: domainsData } = useRpc(
      "memories.domains",
      { storeId },
      storeId != null
    );
    const stores = storesData?.stores ?? props.stores ?? [];
    const domains = (domainsData?.domains ?? props.domains ?? []).map((domain) => ({
      ...domain,
      kindLabel: t2(`com_ui_memory_domain_kind_${domain.kind}`),
      isNonReal: ["fictional", "sandbox", "study"].includes(domain.kind)
    }));
    const selected = stores.find((store) => store.id === props.memoryStore);
    const storeItems = stores.map((store) => ({
      label: store.name,
      value: store.id,
      icon: storeTag(store)
    }));
    storeItems.push({ label: t2("settings.clear"), value: "" });
    const domainItems = domains.map((domain) => ({
      label: `${domain.name} \xB7 ${domain.kindLabel}${domain.isNonReal ? ` (${t2("settings.domainNotReal")})` : ""}`,
      value: domain.id
    }));
    const domainNameOf = (id) => domains.find((domain) => domain.id === id)?.name ?? id;
    return h2("div", { className: "mb-3" }, [
      h2("div", { key: "row", className: "mb-1 flex items-center justify-between gap-2" }, [
        h2(
          Label2,
          {
            key: "label",
            htmlFor: "use-memory-switch",
            className: "block text-[11px] font-medium uppercase tracking-wide text-text-secondary"
          },
          t2("settings.useMemory")
        ),
        h2(Switch2, {
          key: "switch",
          id: "use-memory-switch",
          checked: props.useMemory !== false,
          onCheckedChange: (checked) => props.setUseMemory(checked),
          "aria-label": t2("settings.useMemory")
        })
      ]),
      h2(
        "p",
        { key: "info", className: "text-xs leading-relaxed text-text-secondary" },
        t2("settings.useMemoryInfo")
      ),
      props.useMemory !== false ? h2("div", { key: "store", className: "mt-2 flex flex-col" }, [
        h2(ControlCombobox2, {
          key: "combobox",
          isCollapsed: false,
          ariaLabel: t2("settings.store"),
          selectedValue: props.memoryStore ?? "",
          displayValue: selected?.name,
          setValue: (value) => props.setMemoryStore(value || void 0),
          selectPlaceholder: t2("settings.selectStore"),
          searchPlaceholder: t2("settings.searchStores"),
          items: storeItems,
          className: "h-9 border-border-light",
          containerClassName: "px-0",
          iconSide: "right",
          iconAlign: "inline",
          iconClassName: "h-auto w-auto gap-1 overflow-visible rounded-none",
          SelectIcon: selected ? storeTag(selected) : void 0
        }),
        h2(
          "p",
          { key: "hint", className: "mt-1 text-xs leading-relaxed text-text-secondary" },
          t2("settings.storeRequired")
        ),
        domainItems.length > 1 ? h2("div", { key: "domains", className: "mt-2 flex flex-col" }, [
          h2(MultiSelect2, {
            key: "multiselect",
            items: domainItems,
            selectedValues: props.memoryDomains ?? [],
            setSelectedValues: (values) => props.setMemoryDomains(values.length > 0 ? values : void 0),
            label: t2("settings.domains"),
            placeholder: t2("settings.domainDefaultOnly"),
            renderSelectedValues: (values, placeholder) => values.length === 0 ? placeholder ?? "" : values.map((value) => domainNameOf(value)).join(", "),
            className: "w-full",
            selectClassName: "rounded-lg py-1.5 text-xs max-md:w-full max-md:[&>span]:block",
            itemClassName: "text-xs",
            labelClassName: "mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-secondary",
            popoverClassName: "!min-w-max max-w-[min(90vw,40rem)]"
          }),
          h2(
            "p",
            {
              key: "domain-hint",
              className: "mt-1 text-xs leading-relaxed text-text-secondary"
            },
            t2("settings.domainAgentsHint")
          )
        ]) : null
      ]) : null
    ]);
  }
  function MemoryArtifactIcon(props) {
    return h2(
      "svg",
      {
        width: 20,
        height: 20,
        viewBox: "0 0 18 18",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        className: "mb-[-1px]",
        "aria-hidden": true,
        ...props
      },
      [
        h2("path", {
          key: "a",
          d: "M6 3C4.89543 3 4 3.89543 4 5V13C4 14.1046 4.89543 15 6 15L6 3Z",
          fill: "currentColor"
        }),
        h2("path", {
          key: "b",
          d: "M7 3V15H8.18037L8.4899 13.4523C8.54798 13.1619 8.69071 12.8952 8.90012 12.6858L12.2931 9.29289C12.7644 8.82153 13.3822 8.58583 14 8.58578V3.5C14 3.22386 13.7761 3 13.5 3H7Z",
          fill: "currentColor"
        }),
        h2("path", {
          key: "c",
          d: "M11.3512 15.5297L9.73505 15.8529C9.38519 15.9229 9.07673 15.6144 9.14671 15.2646L9.46993 13.6484C9.48929 13.5517 9.53687 13.4628 9.60667 13.393L12.9996 10C13.5519 9.44771 14.4473 9.44771 14.9996 10C15.5519 10.5523 15.5519 11.4477 14.9996 12L11.6067 15.393C11.5369 15.4628 11.448 15.5103 11.3512 15.5297Z",
          fill: "currentColor"
        })
      ]
    );
  }
  function HeaderMemoryButton(props) {
    translator.useLocale();
    const [open, setOpen] = useState2(false);
    if (!props.conversationId) {
      return null;
    }
    return h2(React.Fragment, null, [
      h2(
        "button",
        {
          key: "button",
          type: "button",
          title: t2("header.scope"),
          "aria-label": t2("header.scope"),
          onClick: () => setOpen(true),
          className: "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-light bg-presentation/75 text-text-primary backdrop-blur-xl transition-all ease-in-out hover:bg-surface-tertiary"
        },
        h2(api.icons.database, { key: "icon", className: "size-[18px]", "aria-hidden": true })
      ),
      open ? h2(MemoryScopeDialog, {
        key: "dialog",
        open: true,
        conversationId: props.conversationId,
        onOpenChange: setOpen
      }) : null
    ]);
  }
  api.ui.register("chat.header.actions", HeaderMemoryButton);
  api.ui.register("agent.settings.memory", AgentMemorySettings);
  api.ui.register("chat.message.cards", MemoryArtifacts);
  api.ui.panel({ id: "memories", title: () => t2("navTitle"), icon: "database", component: MemoryPanel });
}
export {
  activate as default,
  inject
};
