import { nanoid } from "nanoid";
import { create } from "zustand";

export type Screen =
  | "projects"
  | "settings"
  | "entities"
  | "auth"
  | "endpoints"
  | "generate"
  | "documentation";

export type ToastKind = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  /** Technical details shown behind a copy action. */
  detail?: string;
}

export type DesignerTab = "entities" | "enums";

interface UiStore {
  screen: Screen;
  designerTab: DesignerTab;
  selectedEntityId: string | null;
  selectedFieldId: string | null;
  selectedEnumId: string | null;
  toasts: Toast[];
  validationOpen: boolean;
  setScreen: (screen: Screen) => void;
  setValidationOpen: (open: boolean) => void;
  setDesignerTab: (tab: DesignerTab) => void;
  selectEntity: (entityId: string | null) => void;
  selectField: (fieldId: string | null) => void;
  selectEnum: (enumId: string | null) => void;
  pushToast: (toast: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiStore>()((set, get) => ({
  screen: "projects",
  designerTab: "entities",
  selectedEntityId: null,
  selectedFieldId: null,
  selectedEnumId: null,
  toasts: [],
  validationOpen: false,

  setScreen: (screen) => set({ screen }),

  setValidationOpen: (validationOpen) => set({ validationOpen }),

  setDesignerTab: (designerTab) => set({ designerTab }),

  selectEntity: (selectedEntityId) => set({ selectedEntityId, selectedFieldId: null }),

  selectField: (selectedFieldId) => set({ selectedFieldId }),

  selectEnum: (selectedEnumId) => set({ selectedEnumId }),

  pushToast: (toast) => {
    const id = `toast_${nanoid(8)}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    window.setTimeout(() => {
      get().dismissToast(id);
    }, 6000);
    return id;
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
