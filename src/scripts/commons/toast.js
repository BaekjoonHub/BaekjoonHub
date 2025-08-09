import log from "@/commons/logger.js";

export const ToastType = {
  Danger: "#eb3b5a",
  Warning: "#fdcb6e", 
  Success: "#00b894",
  Info: "#3e67ec",
};

export class Toast {
  constructor(message, color, time, type = "info") {
    log.debug("Constructor", message);
    this.message = message;
    this.color = color;
    this.time = time;
    this.type = type;
    this.element = null;
    
    this.createToast();
    log.debug("Toast created");
  }

  createToast() {
    const toast = document.createElement('div');
    toast.className = 'bj-toast';
    
    // 기본 스타일 설정
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#333',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '10000',
      opacity: '0',
      transition: 'all 0.3s ease-in-out',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", "Arial", sans-serif',
      minWidth: '200px',
      maxWidth: '500px',
      textAlign: 'center',
      cursor: 'pointer',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    });

    // 타입별 색상 설정
    const typeColors = {
      success: { bg: '#10B981', color: '#fff' },
      danger: { bg: '#EF4444', color: '#fff' },
      warning: { bg: '#F59E0B', color: '#fff' },
      info: { bg: '#3B82F6', color: '#fff' }
    };

    const colors = typeColors[this.type] || typeColors.info;
    toast.style.backgroundColor = colors.bg;
    toast.style.color = colors.color;

    // 타입별 이모지 추가
    const typeEmojis = {
      success: '✅',
      danger: '❌', 
      warning: '⚠️',
      info: 'ℹ️'
    };

    const emoji = typeEmojis[this.type] || '';
    toast.textContent = emoji ? `${emoji} ${this.message}` : this.message;

    // 기존 토스트들을 위로 올리기
    const existingToasts = document.querySelectorAll('.bj-toast');
    existingToasts.forEach(el => {
      const currentBottom = parseInt(el.style.bottom) || 30;
      el.style.bottom = `${currentBottom + 60}px`;
    });

    this.element = toast;
    document.body.appendChild(toast);

    // 클릭 시 바로 제거
    toast.addEventListener('click', () => {
      this.remove();
    });

    // Fade in 애니메이션
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
    });

    // 자동 제거 타이머
    this.autoRemoveTimer = setTimeout(() => {
      this.remove();
    }, this.time);
  }

  remove() {
    if (this.element && this.element.parentNode) {
      // 자동 제거 타이머가 있다면 클리어
      if (this.autoRemoveTimer) {
        clearTimeout(this.autoRemoveTimer);
        this.autoRemoveTimer = null;
      }

      // Fade out 애니메이션
      this.element.style.opacity = '0';
      this.element.style.transform = 'translateX(-50%) translateY(20px)';
      
      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.remove();
        }
      }, 300);
    }
  }

  // 정적 메서드들 - 기존 API 호환성 유지
  static raiseToast(message, duration = 4000) {
    return new Toast(message, ToastType.Danger, duration, "danger");
  }

  static success(message, duration = 4000) {
    return new Toast(message, ToastType.Success, duration, "success");
  }

  static warning(message, duration = 4000) {
    return new Toast(message, ToastType.Warning, duration, "warning");
  }

  static info(message, duration = 4000) {
    return new Toast(message, ToastType.Info, duration, "info");
  }

  static danger(message, duration = 4000) {
    return new Toast(message, ToastType.Danger, duration, "danger");
  }
}

// 글로벌 showToast 함수도 제공 (사용자가 제안한 패턴)
export function showToast(message, color = '#333', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'bj-toast';
  toast.textContent = message;

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: color,
    color: '#fff',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: '10000',
    opacity: '0',
    transition: 'all 0.3s ease-in-out',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", "Arial", sans-serif',
    minWidth: '200px',
    maxWidth: '500px',
    textAlign: 'center',
    cursor: 'pointer',
    userSelect: 'none'
  });

  // 기존 토스트가 있으면 위로 올리기
  const existingToasts = document.querySelectorAll('.bj-toast');
  existingToasts.forEach(el => {
    const currentBottom = parseInt(el.style.bottom) || 30;
    el.style.bottom = `${currentBottom + 60}px`;
  });

  document.body.appendChild(toast);

  // 클릭 시 제거
  toast.addEventListener('click', () => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  });

  // Fade in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });

  // Auto remove
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);

  return toast;
}