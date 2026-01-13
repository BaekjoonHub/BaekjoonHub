/**
 * Toast notification system for BaekjoonHub
 *
 * Improved toast implementation with:
 * - Auto-dismiss with type-specific durations
 * - ToastManager singleton for proper stacking
 * - Fade in/out animations
 * - Click to dismiss
 */

import type { ToastType, ToastOptions, ToastConfig, ToastColors as ToastColorsType } from "@/types/toast";
import log from "./logger";

// Toast configuration
const TOAST_CONFIG: ToastConfig = {
  DEFAULT_DURATION: 4000,
  AUTO_DISMISS_DURATION: {
    success: 4000,
    info: 4000,
    warning: 5000,
    danger: 6000,
  },
  POSITION: {
    top: "30px",
    right: "30px",
  },
  ANIMATION_DURATION: 300,
  STACK_OFFSET: 70,
} as const;

// Type colors mapping
const TYPE_STYLES: Record<ToastType, { bg: string; emoji: string }> = {
  success: { bg: "#10B981", emoji: "✅" },
  danger: { bg: "#EF4444", emoji: "❌" },
  warning: { bg: "#F59E0B", emoji: "⚠️" },
  info: { bg: "#3B82F6", emoji: "ℹ️" },
};

// Legacy type colors (for backward compatibility)
export const ToastColors = {
  Danger: "#eb3b5a",
  Warning: "#fdcb6e",
  Success: "#00b894",
  Info: "#3e67ec",
} as const;

/**
 * ToastManager singleton for managing all toast instances
 */
class ToastManager {
  private static instance: ToastManager;
  private toasts: Map<string, Toast> = new Map();
  private idCounter = 0;

  static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  /**
   * Show a new toast
   */
  show(options: ToastOptions): Toast {
    const id = `bj-toast-${++this.idCounter}`;
    const toast = new Toast(id, options, () => this.remove(id));
    this.toasts.set(id, toast);
    this.repositionToasts();
    return toast;
  }

  /**
   * Remove a toast by ID
   */
  remove(id: string): void {
    this.toasts.delete(id);
    this.repositionToasts();
  }

  /**
   * Reposition all active toasts
   */
  private repositionToasts(): void {
    let offset = parseInt(TOAST_CONFIG.POSITION.top);
    this.toasts.forEach((toast) => {
      toast.setTopOffset(offset);
      offset += TOAST_CONFIG.STACK_OFFSET;
    });
  }

  /**
   * Clear all toasts
   */
  clearAll(): void {
    this.toasts.forEach((toast) => toast.remove());
    this.toasts.clear();
  }
}

/**
 * Toast class for individual toast notifications
 */
export class Toast {
  public element: HTMLElement | null = null;
  public message: string;
  public color: string;
  public time: number;
  public type: ToastType;

  private autoRemoveTimer: ReturnType<typeof setTimeout> | null = null;
  private onRemove: (() => void) | null = null;
  private id: string;

  /**
   * Create a new Toast (direct instantiation - legacy API)
   */
  constructor(
    messageOrId: string,
    colorOrOptions?: string | ToastOptions,
    timeOrCallback?: number | (() => void),
    type: ToastType | string = "info"
  ) {
    // Handle both new (internal) and old (legacy) constructor signatures
    if (typeof colorOrOptions === "object") {
      // New internal API: constructor(id, options, onRemove)
      this.id = messageOrId;
      const options = colorOrOptions as ToastOptions;
      this.message = options.message;
      this.type = options.type ?? "info";
      this.time = options.duration ?? TOAST_CONFIG.AUTO_DISMISS_DURATION[this.type];
      this.color = TYPE_STYLES[this.type].bg;
      this.onRemove = typeof timeOrCallback === "function" ? timeOrCallback : null;
    } else {
      // Legacy API: constructor(message, color, time, type)
      this.id = `bj-toast-legacy-${Date.now()}`;
      this.message = messageOrId;
      this.color = colorOrOptions ?? TYPE_STYLES.info.bg;
      this.time = typeof timeOrCallback === "number" ? timeOrCallback : TOAST_CONFIG.DEFAULT_DURATION;
      this.type = (typeof type === "string" ? type : "info") as ToastType;
      this.onRemove = null;
    }

    log.debug("Toast constructor", this.message);
    this.createToast();
    log.debug("Toast created");
  }

  /**
   * Create the toast DOM element
   */
  private createToast(): void {
    const toast = document.createElement("div");
    toast.className = "bj-toast";
    toast.id = this.id;

    // Base styles
    Object.assign(toast.style, {
      position: "fixed",
      top: TOAST_CONFIG.POSITION.top,
      right: TOAST_CONFIG.POSITION.right,
      transform: "none",
      backgroundColor: TYPE_STYLES[this.type]?.bg ?? this.color ?? "#333",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      zIndex: "10000",
      opacity: "0",
      transition: `all ${TOAST_CONFIG.ANIMATION_DURATION}ms ease-in-out`,
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", "Arial", sans-serif',
      minWidth: "200px",
      maxWidth: "500px",
      textAlign: "center",
      cursor: "pointer",
      userSelect: "none",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    });

    // Add emoji and message
    const style = TYPE_STYLES[this.type];
    const emoji = style?.emoji ?? "";
    toast.textContent = emoji ? `${emoji} ${this.message}` : this.message;

    // Stack existing toasts (only for legacy API without manager)
    if (!this.onRemove) {
      const existingToasts = document.querySelectorAll(".bj-toast");
      existingToasts.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const currentTop = parseInt(htmlEl.style.top) || 30;
        htmlEl.style.top = `${currentTop + TOAST_CONFIG.STACK_OFFSET}px`;
      });
    }

    this.element = toast;
    document.body.appendChild(toast);

    // Click to dismiss
    toast.addEventListener("click", () => {
      this.remove();
    });

    // Fade in animation
    requestAnimationFrame(() => {
      if (this.element) {
        this.element.style.opacity = "1";
      }
    });

    // Auto-remove timer
    if (this.time > 0) {
      this.autoRemoveTimer = setTimeout(() => {
        this.remove();
      }, this.time);
    }
  }

  /**
   * Set the top offset for stacking
   */
  setTopOffset(offset: number): void {
    if (this.element) {
      this.element.style.top = `${offset}px`;
    }
  }

  /**
   * Remove the toast
   */
  remove(): void {
    if (this.autoRemoveTimer) {
      clearTimeout(this.autoRemoveTimer);
      this.autoRemoveTimer = null;
    }

    if (this.element && this.element.parentNode) {
      // Fade out animation
      this.element.style.opacity = "0";
      this.element.style.transform = "translateY(-20px)";

      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.remove();
          this.element = null;
        }
        // Call onRemove callback if provided (for manager integration)
        if (this.onRemove) {
          this.onRemove();
        }
      }, TOAST_CONFIG.ANIMATION_DURATION);
    }
  }

  // ============ Static convenience methods ============

  /**
   * Show a success toast
   */
  static success(message: string, duration?: number): Toast {
    return ToastManager.getInstance().show({
      message,
      type: "success",
      duration: duration ?? TOAST_CONFIG.AUTO_DISMISS_DURATION.success,
    });
  }

  /**
   * Show a danger/error toast
   */
  static danger(message: string, duration?: number): Toast {
    return ToastManager.getInstance().show({
      message,
      type: "danger",
      duration: duration ?? TOAST_CONFIG.AUTO_DISMISS_DURATION.danger,
    });
  }

  /**
   * Show a warning toast
   */
  static warning(message: string, duration?: number): Toast {
    return ToastManager.getInstance().show({
      message,
      type: "warning",
      duration: duration ?? TOAST_CONFIG.AUTO_DISMISS_DURATION.warning,
    });
  }

  /**
   * Show an info toast
   */
  static info(message: string, duration?: number): Toast {
    return ToastManager.getInstance().show({
      message,
      type: "info",
      duration: duration ?? TOAST_CONFIG.AUTO_DISMISS_DURATION.info,
    });
  }

  /**
   * Legacy API compatibility - show error toast
   */
  static raiseToast(message: string, duration = 4000): Toast {
    return Toast.danger(message, duration);
  }

  /**
   * Clear all active toasts
   */
  static clearAll(): void {
    ToastManager.getInstance().clearAll();
  }
}

// Default export
export default Toast;
