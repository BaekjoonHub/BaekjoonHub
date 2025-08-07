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
    this.overlay = null;

    // 오버레이 생성
    const overlay = document.createElement("div");
    overlay.className = "toast-overlay";
    this.overlay = overlay;

    const element = document.createElement("div");
    element.className = "toast-notification sweetalert2-style";
    element.setAttribute("data-type", type);
    this.element = element;

    // sweetalert2 스타일로 중앙 배치
    element.style.opacity = "0";
    element.style.transform = "scale(0.5)";

    // sweetalert2 스타일 적용
    element.style.cssText = `
      min-width: 400px;
      max-width: 500px;
      padding: 40px;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.5);
      z-index: 1000001;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.215, 0.61, 0.355, 1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif;
    `;

    // 오버레이 스타일
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      z-index: 1000000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // 아이콘 컨테이너
    const iconContainer = document.createElement("div");
    iconContainer.className = "swal2-icon-container";
    iconContainer.style.cssText = `
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      position: relative;
    `;

    // 타입별 아이콘 생성
    const iconElement = this.createIcon(type);
    iconContainer.appendChild(iconElement);

    const messageElement = document.createElement("div");
    messageElement.className = "message-container";
    messageElement.style.cssText = `
      width: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif;
      color: #545454;
      font-weight: 400;
      font-size: 18px;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      word-break: keep-all;
    `;

    // 메시지 텍스트를 span으로 감싸서 추이1 나중에 아이콘을 추가할 수 있도록 함
    const textSpan = document.createElement("span");
    textSpan.textContent = this.message;
    messageElement.appendChild(textSpan);

    element.appendChild(iconContainer);
    element.appendChild(messageElement);

    // 확인 버튼 추가 (sweetalert2 스타일)
    const confirmButton = document.createElement("button");
    confirmButton.className = "swal2-confirm";
    confirmButton.textContent = "확인";
    confirmButton.style.cssText = `
      margin-top: 25px;
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      color: white;
      outline: none;
    `;

    // 타입별 버튼 색상
    const buttonColors = {
      success: "#10B981",
      danger: "#EF4444",
      warning: "#F59E0B",
      info: "#3B82F6",
    };
    confirmButton.style.background = buttonColors[type] || buttonColors.info;

    element.appendChild(confirmButton);

    document.body.appendChild(overlay);
    document.body.appendChild(element);

    // 애니메이션 시작
    setTimeout(() => {
      overlay.style.opacity = "1";
      element.style.opacity = "1";
      element.style.transform = "translate(-50%, -50%) scale(1)";
    }, 10);

    // 자동 삭제 타이머
    const autoRemoveTimer = setTimeout(() => {
      this.remove();
    }, this.time);

    // 확인 버튼 클릭 시 삭제
    confirmButton.addEventListener("click", () => {
      clearTimeout(autoRemoveTimer);
      this.remove();
    });

    // 오버레이 클릭 시 삭제
    overlay.addEventListener("click", () => {
      clearTimeout(autoRemoveTimer);
      this.remove();
    });

    // ESC 키로 닫기
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        clearTimeout(autoRemoveTimer);
        this.remove();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);

    // 버튼 호버 효과
    confirmButton.addEventListener("mouseenter", () => {
      confirmButton.style.transform = "scale(1.05)";
      confirmButton.style.boxShadow = "0 5px 15px rgba(0, 0, 0, 0.2)";
    });

    confirmButton.addEventListener("mouseleave", () => {
      confirmButton.style.transform = "scale(1)";
      confirmButton.style.boxShadow = "none";
    });

    log.debug("Toast created");
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.style.opacity = "0";
      this.element.style.transform = "translate(-50%, -50%) scale(0.5)";
      if (this.overlay) {
        this.overlay.style.opacity = "0";
      }
      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.remove();
        }
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.remove();
        }
      }, 300);
    }
  }

  createIcon(type) {
    const iconWrapper = document.createElement("div");
    iconWrapper.className = `swal2-icon swal2-${type}`;

    const iconStyles = {
      success: {
        borderColor: "#10B981",
        color: "#10B981",
      },
      danger: {
        borderColor: "#EF4444",
        color: "#EF4444",
      },
      warning: {
        borderColor: "#F59E0B",
        color: "#F59E0B",
      },
      info: {
        borderColor: "#3B82F6",
        color: "#3B82F6",
      },
    };

    const style = iconStyles[type] || iconStyles.info;

    iconWrapper.style.cssText = `
      width: 80px;
      height: 80px;
      border: 4px solid ${style.borderColor};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      box-sizing: border-box;
      animation: swal2-animate-icon 0.5s;
    `;

    // 아이콘 내부 요소
    if (type === "success") {
      iconWrapper.innerHTML = `
        <div style="
          width: 80%;
          height: 50%;
          border: 3px solid ${style.color};
          border-top: none;
          border-right: none;
          transform: rotate(-45deg);
          margin-top: -10%;
        "></div>
      `;
    } else if (type === "danger") {
      iconWrapper.innerHTML = `
        <span style="
          font-size: 46px;
          line-height: 1;
          color: ${style.color};
          font-weight: 300;
        ">×</span>
      `;
    } else if (type === "warning") {
      iconWrapper.innerHTML = `
        <span style="
          font-size: 46px;
          line-height: 1;
          color: ${style.color};
          font-weight: 600;
        ">!</span>
      `;
    } else if (type === "info") {
      iconWrapper.innerHTML = `
        <span style="
          font-size: 40px;
          line-height: 1;
          color: ${style.color};
          font-weight: 600;
        ">i</span>
      `;
    }

    return iconWrapper;
  }

  static raiseToast(message, duration = 5000) {
    return new Toast(message, ToastType.Danger, duration, "danger");
  }

  static success(message, duration = 5000) {
    return new Toast(message, ToastType.Success, duration, "success");
  }

  static warning(message, duration = 5000) {
    return new Toast(message, ToastType.Warning, duration, "warning");
  }

  static info(message, duration = 5000) {
    return new Toast(message, ToastType.Info, duration, "info");
  }

  static danger(message, duration = 5000) {
    return new Toast(message, ToastType.Danger, duration, "danger");
  }
}
