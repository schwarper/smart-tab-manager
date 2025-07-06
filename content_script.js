let formInputDetected = false;

const detectFormInteraction = (event) => {
    if (formInputDetected) return;
    if (event.target.matches('input, textarea, [contenteditable="true"]')) {
        formInputDetected = true;
        try {
            chrome.runtime.sendMessage({ type: "FORM_INPUT_DETECTED" });
        } catch (e) {}
    }
};

window.addEventListener('focusin', detectFormInteraction, { capture: true });
window.addEventListener('input', detectFormInteraction, { once: true, capture: true });