const ToastType = {
    Danger : "#eb3b5a",
    Warning: "#fdcb6e",
    Succes : "#00b894",
}

  
class Toast {
    constructor(message,color,time){
        log('Constructor', message)
        this.message = message;
        this.color = color;
        this.time = time;
        this.element = null;
        var element = document.createElement('div');
        element.className = "toast-notification";
        this.element = element;
        var countElements = document.getElementsByClassName("toast-notification");

        element.style.opacity=0.8;

        element.style.marginBottom = (countElements.length * 55) + "px";

        element.style.backgroundColor = this.color;

        var message = document.createElement("div");
        message.className = "message-container";
        message.textContent = this.message;

        element.appendChild(message);

        var close = document.createElement("div");
        close.className = "close-notification";

        var icon = document.createElement("i");
        icon.className = "lni lni-close";

        close.appendChild(icon);

        element.append(close);

        document.body.appendChild(element);

        setTimeout(function() {
            element.remove();
        }, this.time);

        element.addEventListener("click",()=>{
            element.remove();
        })
        log('Closed')
    }

    static raiseToast(message, duration = 5000) {
        return new Toast(message, ToastType.Danger, duration)
    }
}

/* 모달(<dialog>)의 모양. 사이트마다 CSS 가 달라 인라인 스타일로 정한다.
   포커스 가두기, Esc, 뒤 화면 가림은 <dialog>.showModal() 이 맡는다. */
const MODAL_BOX_STYLE = 'border:0;outline:0;border-radius:10px;padding:20px 24px;width:360px;max-width:90vw;box-sizing:border-box;background:#fff;color:#222;font-size:14px;line-height:1.5;box-shadow:rgba(100,100,111,0.3) 0 7px 29px 0;';
const MODAL_BUTTONS_STYLE = 'justify-content:flex-end;gap:8px;margin:16px 0 0;';
const MODAL_BUTTON_STYLE = 'padding:6px 16px;border:1px solid #ccc;border-radius:6px;font-size:13px;cursor:pointer;background:#fff;color:#222;';
const MODAL_PRIMARY_STYLE = `${MODAL_BUTTON_STYLE}background:#0076c0;border-color:#0076c0;color:#fff;`;
const MODAL_SUBTEXT_STYLE = 'margin:8px 0 0;font-size:12px;color:#666;';

/**
 * 확인·취소를 묻는 모달을 페이지 안에 띄웁니다. (window.confirm 대신 쓴다)
 * @param {string} message
 * @param {string} [detail] - 질문 아래에 작게 보여 줄 설명
 * @returns {Promise<boolean>} 확인이면 true, 취소·Esc 면 false
 */
function confirmModal(message, detail) {
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.style.cssText = MODAL_BOX_STYLE;
        const text = document.createElement('p');
        text.style.cssText = 'margin:0;';
        text.textContent = message;
        const sub = document.createElement('p');
        sub.style.cssText = `${MODAL_SUBTEXT_STYLE}${detail ? '' : 'display:none;'}`;
        sub.textContent = detail || '';
        // method="dialog" 인 폼의 버튼은 누르면 모달을 닫고 자기 value 를 returnValue 로 남긴다
        const form = document.createElement('form');
        form.method = 'dialog';
        form.style.cssText = `display:flex;${MODAL_BUTTONS_STYLE}`;
        const cancel = document.createElement('button');
        cancel.value = 'cancel';
        cancel.textContent = '취소';
        cancel.style.cssText = MODAL_BUTTON_STYLE;
        const ok = document.createElement('button');
        ok.value = 'ok';
        ok.textContent = '확인';
        ok.autofocus = true;
        ok.style.cssText = MODAL_PRIMARY_STYLE;
        form.append(cancel, ok);
        dialog.append(text, sub, form);
        dialog.addEventListener('close', () => {
            dialog.remove();
            resolve(dialog.returnValue === 'ok');
        });
        document.body.appendChild(dialog);
        dialog.showModal();
    });
}

/**
 * 오래 걸리는 작업의 진행 상황을 보여 주는 모달을 띄웁니다.
 * 작업이 보이지 않는 채로 계속되지 않도록 finish() 전에는 닫히지 않는다.
 * @param {string} title
 * @returns {{update: function(object): void, pause: function(string=): void, running: function(): Promise<void>, finish: function(string, object=): void}}
 *   update({ status, note, value, max, eta, pausable }) 는 준 것만 바꾼다. max 를 주기 전에는 빈 막대다.
 *     pausable 이 true 인 동안 일시정지 버튼을 보여 준다. false 로 바꾸면 멈춰 있던 작업도 이어 간다.
 *   pause(reason) 은 일시정지 버튼을 누른 것처럼 멈추고 그 이유를 보여 준다.
 *   running() 은 멈춰 있지 않으면 바로, 멈춰 있으면 이어하기를 누를 때 끝난다. 작업은 다음 일을 시작하기 전에 이것을 기다린다.
 *   finish(message, { failed, details, onRetry, onClose }) 는 결과와 확인 버튼을 보여 준다. details 는 한 줄씩 보여 줄 목록이고,
 *     onRetry 를 주면 다시 시도 버튼도 보여 준다. 모달이 닫힌 뒤, 누른 버튼에 따라 onRetry 나 onClose 를 부른다.
 */
function progressModal(title) {
    let finished = false;
    let pausable = false;
    let paused = null; // 멈춰 있는 동안 { reason, promise, release }
    let after = {}; // 닫힌 뒤 부를 함수 (누른 버튼의 value 별)
    const shown = { status: '', note: '' };
    const dialog = document.createElement('dialog');
    dialog.style.cssText = MODAL_BOX_STYLE;
    dialog.setAttribute('aria-label', title);
    const heading = document.createElement('strong');
    heading.textContent = title;
    const status = document.createElement('p');
    status.setAttribute('role', 'status'); // 바뀐 문구를 화면 낭독기가 읽는다
    status.style.cssText = 'margin:8px 0;overflow-wrap:anywhere;';
    // <progress> 는 색을 인라인 스타일로 정할 수 없어(백준에서 초록·회색으로 보였다) 막대를 직접 그린다
    const bar = document.createElement('div');
    bar.setAttribute('role', 'progressbar');
    bar.style.cssText = 'height:8px;border-radius:4px;background:#e6e8eb;overflow:hidden;';
    const fill = document.createElement('div');
    fill.style.cssText = 'width:0;height:100%;background:#0076c0;transition:width 0.2s;';
    bar.append(fill);
    const count = document.createElement('p');
    count.style.cssText = 'margin:4px 0 0;min-height:18px;text-align:right;font-size:12px;color:#666;';
    const note = document.createElement('p');
    note.style.cssText = MODAL_SUBTEXT_STYLE;
    // 끝난 뒤에 보여 주는 목록 (가져오지 못한 문제와 이유)
    const list = document.createElement('div');
    list.style.cssText = 'display:none;max-height:150px;overflow:auto;margin:8px 0 0;padding:8px 10px;border-radius:6px;background:#f4f5f7;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;';
    const form = document.createElement('form');
    form.method = 'dialog';
    const pauseButton = document.createElement('button');
    pauseButton.type = 'button'; // 모달을 닫지 않는다
    const retry = document.createElement('button');
    retry.value = 'retry';
    retry.textContent = '다시 시도';
    retry.style.cssText = `${MODAL_BUTTON_STYLE}display:none;`;
    const ok = document.createElement('button');
    ok.value = 'ok';
    ok.textContent = '확인';
    ok.style.cssText = `${MODAL_PRIMARY_STYLE}display:none;`;
    form.append(pauseButton, retry, ok);
    dialog.append(heading, status, bar, count, note, list, form);

    const render = () => {
        // 멈춘 동안에도 이미 보낸 요청은 끝나며 진행 수를 바꾸므로, 멈춘 이유는 상태 문구보다 먼저 보여 준다
        status.textContent = paused ? paused.reason : shown.status;
        note.textContent = shown.note;
        fill.style.background = paused ? '#9aa0a6' : '#0076c0';
        const canPause = !finished && (pausable || paused !== null);
        pauseButton.textContent = paused ? '이어하기' : '일시정지';
        pauseButton.style.cssText = `${paused ? MODAL_PRIMARY_STYLE : MODAL_BUTTON_STYLE}${canPause ? '' : 'display:none;'}`;
        form.style.cssText = `display:${finished || canPause ? 'flex' : 'none'};${MODAL_BUTTONS_STYLE}`;
    };
    const pause = (reason = '일시정지했습니다. 이어하기를 누르면 멈춘 곳부터 계속합니다.') => {
        if (finished || paused) return;
        let release;
        const promise = new Promise((resolve) => { release = resolve; });
        paused = { reason, promise, release };
        render();
    };
    const resume = () => {
        if (!paused) return;
        const { release } = paused;
        paused = null;
        render();
        release();
    };
    pauseButton.addEventListener('click', () => (paused ? resume() : pause()));
    dialog.addEventListener('cancel', (event) => {
        if (!finished) event.preventDefault();
    });
    dialog.addEventListener('close', () => {
        // Esc 를 거듭 누르면 cancel 을 막아도 닫히므로 다시 띄운다
        if (!finished) return dialog.showModal();
        dialog.remove();
        // Esc 로 닫으면 returnValue 가 비어 있다. 확인을 누른 것으로 본다.
        const next = after[dialog.returnValue] || after.ok;
        if (next) next();
    });
    render();
    document.body.appendChild(dialog);
    dialog.showModal();
    return {
        update({ status: text, note: noteText, value, max, eta, pausable: canPause }) {
            if (text !== undefined) shown.status = text;
            if (noteText !== undefined) shown.note = noteText;
            if (max !== undefined) {
                fill.style.width = `${(value / max) * 100}%`;
                bar.setAttribute('aria-valuenow', value);
                bar.setAttribute('aria-valuemax', max);
                count.textContent = `${value} / ${max}${eta ? ` · ${eta}` : ''}`;
            }
            if (canPause !== undefined) pausable = canPause;
            if (canPause === false) resume();
            render();
        },
        pause,
        running: () => (paused ? paused.promise : Promise.resolve()),
        finish(message, { failed = false, details = [], onRetry = null, onClose = null } = {}) {
            resume();
            finished = true;
            after = { ok: onClose, retry: onRetry };
            shown.status = message;
            render();
            if (failed) status.style.color = ToastType.Danger;
            for (const el of [bar, count, note]) el.style.display = 'none';
            list.textContent = details.join('\n');
            if (details.length > 0) list.style.display = 'block';
            if (onRetry) retry.style.display = '';
            ok.style.display = '';
            ok.focus();
        },
    };
}
