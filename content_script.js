let formInputDetected = false;
const detectFormInput = () => {
    if (formInputDetected) return;
    formInputDetected = true;
    try {
        chrome.runtime.sendMessage({ type: "FORM_INPUT_DETECTED" });
    } catch (e) { }
};
window.addEventListener('input', detectFormInput, { once: true, capture: true });