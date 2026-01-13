/**
 * Toast notification type definitions
 */

// Toast types
export type ToastType = 'success' | 'danger' | 'warning' | 'info';

// Toast type colors
export interface ToastTypeColors {
  readonly Danger: string;
  readonly Warning: string;
  readonly Success: string;
  readonly Info: string;
}

// Toast style colors
export interface ToastColors {
  bg: string;
  color: string;
}

// Toast configuration
export interface ToastConfig {
  readonly DEFAULT_DURATION: number;
  readonly AUTO_DISMISS_DURATION: {
    readonly success: number;
    readonly info: number;
    readonly warning: number;
    readonly danger: number;
  };
  readonly POSITION: {
    readonly top: string;
    readonly right: string;
  };
  readonly ANIMATION_DURATION: number;
  readonly STACK_OFFSET: number;
}

// Toast options
export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  onClick?: () => void;
  dismissible?: boolean;
}

// Toast instance interface
export interface IToast {
  element: HTMLElement | null;
  message: string;
  type: ToastType;
  time: number;

  remove(): void;
  setTopOffset?(offset: number): void;
}

// Toast manager interface
export interface IToastManager {
  show(options: ToastOptions): IToast;
  remove(id: string): void;
  clearAll(): void;
}
