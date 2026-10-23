/** Host bindings the ported components share. `configure` is called once from
 *  activate(api), before any component renders; the exports stay live. */
import type * as ReactTypes from 'react';
import type {
  ChangeEvent,
  ComponentType,
  CSSProperties,
  DependencyList,
  Dispatch,
  EffectCallback,
  ElementType,
  FunctionComponent,
  Key,
  KeyboardEvent,
  MouseEvent,
  MutableRefObject,
  ReactElement,
  ReactNode,
  Ref,
  RefObject,
  SetStateAction,
  SVGProps,
  UIEvent,
} from 'react';
import type { MemoryCatalog, MemoryCatalogKey } from './locales.js';
import type {
  I18nService,
  Translate,
  TranslationKeys,
  TranslationValues,
  Translator,
} from '../../../i18n/client/src/types.js';

export type {
  I18nService,
  Translate,
  TranslationKeys,
  TranslationValues,
  Translator,
};
import type {
  QueryClient,
  QueryKey,
  UseMutationOptions as TanStackMutationOptions,
} from '@tanstack/react-query';
import type { OptionWithIcon, Permission, PermissionType } from './sdk.js';

export type { ReactTypes as React, ReactTypes as default };

type HostReact = typeof import('react');

export interface I18nLike {
  language?: string;
  resolvedLanguage?: string;
  on: () => void;
  off: () => void;
}

export interface ToastOptions {
  message: string;
  status: 'success' | 'error' | 'warning' | 'info';
}

export interface ToastContext {
  showToast: (options: ToastOptions) => void;
}

export interface AuthContextUser {
  id: string;
  role: string;
}

export interface AuthContext {
  user: AuthContextUser;
}

export interface HasAccessOptions {
  permissionType: PermissionType;
  permission: Permission;
}

export type QueryClientLike = Pick<QueryClient, 'invalidateQueries'>;

export interface ExpandCollapseResult {
  style: CSSProperties;
  ref: RefObject<HTMLDivElement>;
}

export interface MutationCallbacks<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

export interface UseMutationOptions<TData, TVariables, TContext = void> {
  mutationFn: (variables: TVariables) => Promise<TData> | TData;
  onMutate?: (variables: TVariables) => TContext | void | Promise<TContext | void>;
  onSuccess?: (data: TData, variables: TVariables, context?: TContext) => void;
  onError?: (error: Error, variables: TVariables, context?: TContext) => void;
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context?: TContext,
  ) => void;
}

export interface MutationResult<TData, TVariables> {
  mutate: (variables: TVariables, local?: MutationCallbacks<TData>) => void;
  isPending: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  error?: Error | null;
  data?: TData;
  reset?: () => void;
  variables?: TVariables;
}

export interface UseQueryOptions<TData> {
  queryKey: QueryKey;
  queryFn: () => Promise<TData> | TData;
  enabled?: boolean;
}

export interface QueryResult<TData> {
  data: TData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface BaseUiProps {
  children?: ReactNode;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'data-testid'?: string;
}

export interface ButtonProps extends BaseUiProps {
  variant?: string;
  size?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  ref?: Ref<HTMLButtonElement>;
  asChild?: boolean;
}

export interface LabelProps extends BaseUiProps {
  htmlFor?: string;
}

export interface SpinnerProps extends BaseUiProps {
  size?: string;
}

export type SkeletonProps = BaseUiProps;

export type IconProps = SVGProps<SVGSVGElement>;

export interface TooltipAnchorProps extends BaseUiProps {
  description?: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  render: ReactNode;
}

export interface OGDialogProps extends BaseUiProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerRef?: Ref<HTMLButtonElement>;
}

export interface OGDialogTriggerProps extends BaseUiProps {
  asChild?: boolean;
}

export interface OGDialogTemplateSelection {
  selectHandler: () => void;
  selectClasses?: string;
  selectText?: ReactNode;
  isLoading?: boolean;
}

export interface OGDialogTemplateProps extends BaseUiProps {
  title?: ReactNode;
  description?: ReactNode;
  showCloseButton?: boolean;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  headerClassName?: string;
  mainClassName?: string;
  footerClassName?: string;
  main?: ReactNode;
  footer?: ReactNode;
  buttons?: ReactNode;
  leftButtons?: ReactNode;
  selection?: OGDialogTemplateSelection;
}

export interface OGDialogContentProps extends BaseUiProps {
  showCloseButton?: boolean;
}

export interface InputProps extends BaseUiProps {
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  autoFocus?: boolean;
}

export interface TextareaProps extends BaseUiProps {
  value?: string;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}

export interface SwitchProps extends BaseUiProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: string;
}

export interface ControlComboboxProps extends BaseUiProps {
  isCollapsed?: boolean;
  ariaLabel?: string;
  selectedValue?: string;
  displayValue?: string;
  setValue?: (value: string) => void;
  selectPlaceholder?: string;
  searchPlaceholder?: string;
  items?: OptionWithIcon[];
  iconSide?: string;
  iconAlign?: string;
  iconClassName?: string;
  SelectIcon?: ReactNode;
  disabled?: boolean;
  portal?: boolean;
  containerClassName?: string;
}

export interface MultiSelectProps extends BaseUiProps {
  items?: OptionWithIcon[];
  selectedValues?: string[];
  setSelectedValues?: (values: string[]) => void;
  label?: string;
  placeholder?: string;
  renderSelectedValues?: (values: string[], placeholder?: string) => ReactNode;
  selectClassName?: string;
  itemClassName?: string;
  labelClassName?: string;
  popoverClassName?: string;
}

export interface RadioOption {
  label: string;
  value: string;
}

export interface RadioProps extends BaseUiProps {
  options?: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  fullWidth?: boolean;
}

export interface FieldMessageProps extends BaseUiProps {
  message?: ReactNode;
  hint?: ReactNode;
  lines?: number;
}

export interface VirtualListProps<TItem extends object = object> extends BaseUiProps {
  items: readonly TItem[];
  estimateSize?: number;
  /** The host instantiates the list per item; callers type their own renderer. */
  getItemKey?: (item: TItem) => string;
  gap?: number;
  renderItem?: (item: TItem) => ReactNode;
  role?: string;
  rowRole?: string;
  ariaLabel?: string;
}

export interface CheckboxProps extends BaseUiProps {
  checked?: boolean;
  tabIndex?: number;
  onCheckedChange?: (checked: boolean) => void;
}

export interface FilterInputProps extends BaseUiProps {
  inputId?: string;
  label?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  containerClassName?: string;
}

export interface AlertProps extends BaseUiProps {
  variant?: string;
  icon?: boolean;
}

export interface UiPropsMap {
  Button: ButtonProps;
  Label: LabelProps;
  Spinner: SpinnerProps;
  Skeleton: SkeletonProps;
  TooltipAnchor: TooltipAnchorProps;
  OGDialog: OGDialogProps;
  OGDialogTrigger: OGDialogTriggerProps;
  OGDialogTemplate: OGDialogTemplateProps;
  OGDialogContent: OGDialogContentProps;
  OGDialogFooter: BaseUiProps;
  OGDialogHeader: BaseUiProps;
  OGDialogTitle: BaseUiProps;
  OGDialogDescription: BaseUiProps;
  Input: InputProps;
  Textarea: TextareaProps;
  Switch: SwitchProps;
  ControlCombobox: ControlComboboxProps;
  MultiSelect: MultiSelectProps;
  Radio: RadioProps;
  FieldMessage: FieldMessageProps;
  VirtualList: VirtualListProps<object>;
  Checkbox: CheckboxProps;
  FilterInput: FilterInputProps;
  TrashIcon: IconProps;
  Alert: AlertProps;
  DropdownPopup: BaseUiProps;
  MenuButton: BaseUiProps;
}

export interface PanelOptions {
  id: string;
  title: () => string;
  icon: string;
  component: ComponentType<never>;
}

export type HostUiComponents = { [K in keyof UiPropsMap]: ComponentType<UiPropsMap[K]> };

/** Slot components are rendered by the host with props this plugin cannot name. */
type HostSlotComponent = ComponentType<never>;

export type HostUiService = HostUiComponents & {
  register: (slot: string, component: HostSlotComponent) => void;
  panel: (options: PanelOptions) => void;
};

export interface GrantAccessDialogProps extends BaseUiProps {
  resourceDbId: string;
  resourceName: string;
  resourceType: string;
  onGrantAccess?: () => void;
}

export interface PermissionUpdatePayload {
  roleName: string;
  updates: Record<string, boolean>;
}

export interface MutationHandle {
  mutate: (data: PermissionUpdatePayload) => void;
  isLoading: boolean;
  isSuccess?: boolean;
}

export interface AdminSettingsDialogProps extends BaseUiProps {
  permissionType: PermissionType;
  sectionKey: string;
  permissions: ReadonlyArray<{ permission: Permission; labelKey: string }>;
  menuId: string;
  descriptionKey: string;
  mutation: MutationHandle;
}

export interface AppUiComponents {
  GenericGrantAccessDialog: GrantAccessDialogProps;
  AdminSettingsDialog: AdminSettingsDialogProps;
}

export type AppUiHostComponents = {
  [K in keyof AppUiComponents]: ComponentType<AppUiComponents[K]>;
};

export interface AppUiServiceHooks {
  useQueryClient?: () => QueryClientLike;
  useAuthContext?: () => AuthContext;
  useHasAccess?: (options: HasAccessOptions) => boolean;
  useToastContext?: () => ToastContext;
  useExpandCollapse?: (isExpanded: boolean) => ExpandCollapseResult;
  useQuery?: <TData>(options: UseQueryOptions<TData>) => QueryResult<TData>;
  useMutation?: <TData, TVariables, TContext = void>(
    options: UseMutationOptions<TData, TVariables, TContext>,
  ) => MutationResult<TData, TVariables>;
}

export type AppUiService = AppUiHostComponents & AppUiServiceHooks;

export interface PluginApi {
  React: HostReact;
  icons: Record<string, ComponentType<SVGProps<SVGSVGElement>>>;
  call: <TData>(method: string, params?: object) => Promise<TData>;
  consume: {
    (service: 'ui'): HostUiService | null;
    (service: 'app-ui'): AppUiService | null;
    (service: 'i18n'): I18nService | null;
    (service: string): object | null;
  };
  ui: HostUiService;
}

interface RuntimeState {
  React: HostReact | null;
  api: PluginApi | null;
  ui: HostUiService | null;
  appUi: AppUiService | null;
  translator: Translator | null;
}

const state: RuntimeState = {
  React: null,
  api: null,
  ui: null,
  appUi: null,
  translator: null,
};
let hImpl: HostReact['createElement'] | null = null;

export let Fragment: HostReact['Fragment'] | null = null;

function hostReact(): HostReact {
  if (state.React == null) {
    throw new Error('memory plugin runtime is not configured');
  }
  return state.React;
}

function configuredTranslator(): Translator {
  if (state.translator == null) {
    throw new Error('memory plugin runtime is not configured');
  }
  return state.translator;
}

export function configure(
  api: PluginApi,
  ui: HostUiService,
  translator: Translator,
  appUi: AppUiService | null = null,
): void {
  state.api = api;
  state.React = api.React;
  state.ui = ui;
  state.appUi = appUi;
  state.translator = translator;
  hImpl = api.React.createElement;
  Fragment = api.React.Fragment;
}

type CreateElementBoundary = (
  type: ElementType,
  props?: object | null,
  ...children: ReactNode[]
) => ReactElement;

type HostProps<P extends object> = P & { children?: ReactNode; key?: Key | null };

export function h<P extends object>(
  type: ComponentType<P>,
  props?: HostProps<P> | null,
  ...children: ReactNode[]
): ReactElement;
export function h(type: ElementType, props?: object | null, ...children: ReactNode[]): ReactElement;
export function h(
  type: ElementType,
  props?: object | null,
  ...children: ReactNode[]
): ReactElement {
  const createElement = hImpl;
  if (createElement == null) {
    throw new Error('memory plugin runtime is not configured');
  }
  return (createElement as CreateElementBoundary)(type, props, ...children);
}

function createHostElement(type: ElementType, props: object | null): ReactElement | null {
  const createElement = hImpl;
  if (createElement == null) {
    throw new Error('memory plugin runtime is not configured');
  }
  return (createElement as CreateElementBoundary)(type, props);
}

export function currentApi(): PluginApi {
  if (state.api == null) {
    throw new Error('memory plugin runtime is not configured');
  }
  return state.api;
}

export function currentUi(): HostUiService {
  if (state.ui == null) {
    throw new Error('memory plugin runtime is not configured');
  }
  return state.ui;
}

export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  return hostReact().useState(initialState);
}

export function useEffect(effect: EffectCallback, deps?: DependencyList): void {
  hostReact().useEffect(effect, deps);
}

export function useMemo<T>(factory: () => T, deps: DependencyList): T {
  return hostReact().useMemo(factory, deps);
}

export function useCallback<T extends (...args: never[]) => void>(
  callback: T,
  deps: DependencyList,
): T {
  return hostReact().useCallback(callback, deps);
}

export function useRef<T>(initialValue: T): MutableRefObject<T>;
export function useRef<T>(initialValue: T | null): RefObject<T>;
export function useRef<T>(initialValue: T | null): MutableRefObject<T | null> | RefObject<T> {
  return hostReact().useRef(initialValue);
}

export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void {
  hostReact().useLayoutEffect(effect, deps);
}

export function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  return hostReact().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useLocalize(): Translate {
  const translator = configuredTranslator();
  translator.useLocale();
  return translator.t;
}

export function t(key: TranslationKeys, values?: TranslationValues): string {
  return configuredTranslator().t(key, values);
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** A lucide icon from the host registry, as a component. */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const iconCache = new Map<string, IconComponent>();

export function makeIcon(name: string): IconComponent {
  const cached = iconCache.get(name);
  if (cached != null) {
    return cached;
  }
  const Icon: FunctionComponent<SVGProps<SVGSVGElement>> = (props) => {
    const Base = state.api?.icons?.[name];
    return Base ? createHostElement(Base, props) : null;
  };
  Icon.displayName = `Icon(${name})`;
  iconCache.set(name, Icon);
  return Icon;
}

/** A host UI primitive, as a component. */
const uiCache = new Map<string, ElementType>();

export function makeUi<K extends keyof UiPropsMap>(name: K): ComponentType<UiPropsMap[K]> {
  const cached = uiCache.get(name);
  if (cached != null) {
    return cached as ComponentType<UiPropsMap[K]>;
  }
  const Component: FunctionComponent<UiPropsMap[K]> = (props) => {
    const Base = state.ui?.[name];
    return Base ? createHostElement(Base, props) : null;
  };
  Component.displayName = `Ui(${name})`;
  uiCache.set(name, Component);
  return Component;
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
export const VirtualList = makeUi('VirtualList') as <TItem extends object>(
  props: VirtualListProps<TItem>,
) => ReactElement;
export const Checkbox = makeUi('Checkbox');
export const FilterInput = makeUi('FilterInput');
export const TrashIcon = makeUi('TrashIcon');
export const Alert = makeUi('Alert');
export const DropdownPopup = makeUi('DropdownPopup');

const appCache = new Map<string, ElementType>();

/** A component the app itself owns (sharing, role permissions). */
export function makeApp<K extends keyof AppUiComponents>(
  name: K,
): ComponentType<AppUiComponents[K]> {
  const cached = appCache.get(name);
  if (cached != null) {
    return cached as ComponentType<AppUiComponents[K]>;
  }
  const Component: FunctionComponent<AppUiComponents[K]> = (props) => {
    const Base = state.appUi?.[name];
    return Base ? createHostElement(Base, props) : null;
  };
  Component.displayName = `App(${name})`;
  appCache.set(name, Component);
  return Component;
}

export const GenericGrantAccessDialog = makeApp('GenericGrantAccessDialog');
export const AdminSettingsDialog = makeApp('AdminSettingsDialog');
export const MenuButton = makeUi('MenuButton');

export function useToastContext(): ToastContext {
  return { showToast: () => {} };
}

export interface PanelContentProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  skeleton?: ReactNode;
  empty?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Panel body wrapper with the app's loading/empty structure. */
export function PanelContent({
  isLoading,
  isEmpty,
  skeleton,
  empty,
  children,
  className,
}: PanelContentProps): ReactElement {
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

export interface PanelFooterProps {
  children?: ReactNode;
  className?: string;
}

export function PanelFooter({ children, className }: PanelFooterProps): ReactElement {
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

export interface TransProps {
  i18nKey: TranslationKeys;
  values?: TranslationValues;
}

export function Trans({ i18nKey, values }: TransProps): string {
  const text = t(i18nKey, values);
  return String(text).replace(/<[^>]+>/g, '');
}

export interface UseTranslationResult {
  t: Translate;
  i18n: I18nLike;
}

export function useTranslation(): UseTranslationResult {
  const locale = configuredTranslator().locale;
  return {
    t,
    i18n: { language: locale, resolvedLanguage: locale, on: () => {}, off: () => {} },
  };
}

export function useQueryClient(): QueryClientLike {
  return state.appUi?.useQueryClient?.() ?? { invalidateQueries: async () => {} };
}

export function useAuthContext(): AuthContext {
  return state.appUi?.useAuthContext?.() ?? { user: { id: 'plugin', role: 'USER' } };
}

export function useHasAccess(options: HasAccessOptions): boolean {
  const check = state.appUi?.useHasAccess;
  return typeof check === 'function' ? check(options) === true : true;
}

export function useExpandCollapse(isExpanded: boolean): ExpandCollapseResult {
  const host = state.appUi?.useExpandCollapse;
  if (typeof host === 'function') {
    return host(isExpanded);
  }
  const ref = hostReact().useRef<HTMLDivElement>(null);
  const style = hostReact().useMemo<CSSProperties>(
    () => ({
      display: 'grid',
      gridTemplateRows: isExpanded ? '1fr' : '0fr',
      transition: 'grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    }),
    [isExpanded],
  );
  return { style, ref };
}

export function useQuery<TData>(options: UseQueryOptions<TData>): QueryResult<TData> {
  const host = state.appUi?.useQuery;
  if (typeof host === 'function') {
    return host<TData>(options);
  }
  const [result, setResult] = hostReact().useState<QueryResult<TData>>({
    data: undefined,
    isLoading: options.enabled !== false,
    isError: false,
    error: null,
    refetch: () => {},
  });
  const key = JSON.stringify(options.queryKey ?? []);
  hostReact().useEffect(() => {
    if (options.enabled === false) {
      setResult((current) => ({ ...current, isLoading: false }));
      return undefined;
    }
    let cancelled = false;
    setResult((current) => ({ ...current, isLoading: true }));
    Promise.resolve()
      .then(() => options.queryFn())
      .then((data) => {
        if (!cancelled) {
          setResult({
            data,
            isLoading: false,
            isError: false,
            error: null,
            refetch: () => {},
          });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setResult({
            data: undefined,
            isLoading: false,
            isError: true,
            error,
            refetch: () => {},
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, options.enabled]);
  return result;
}

export function useMutation<TData, TVariables, TContext = void>(
  options: UseMutationOptions<TData, TVariables, TContext>,
): MutationResult<TData, TVariables> {
  const host = state.appUi?.useMutation;
  if (typeof host === 'function') {
    return host<TData, TVariables, TContext>(options);
  }
  const [isPending, setPending] = hostReact().useState(false);
  const mutate = (variables: TVariables, local: MutationCallbacks<TData> = {}): void => {
    setPending(true);
    options.onMutate?.(variables);
    Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((data) => {
        setPending(false);
        options.onSuccess?.(data, variables);
        local.onSuccess?.(data);
      })
      .catch((error: Error) => {
        setPending(false);
        options.onError?.(error, variables);
        local.onError?.(error);
      });
  };
  return { mutate, isPending };
}

export type {
  ChangeEvent,
  ComponentType,
  CSSProperties,
  KeyboardEvent,
  MutableRefObject,
  ReactElement,
  ReactNode,
  RefObject,
  SVGProps,
  UIEvent,
};
