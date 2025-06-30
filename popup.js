if (typeof browser === 'undefined') { var browser = chrome; }

const UI = {
    container: document.querySelector('.container'),
    toggleExtensionBtn: document.getElementById('toggleExtensionBtn'),
    snoozeControls: document.getElementById('snoozeControls'),
    snoozeBtn: document.getElementById('snoozeBtn'),
    snoozeDuration: document.getElementById('snoozeDuration'),
    cancelSnoozeBtn: document.getElementById('cancelSnoozeBtn'),
    suspendCurrentTab: document.getElementById('suspendCurrentTab'),
    suspendOtherTabs: document.getElementById('suspendOtherTabs'),
    suspendAllWindows: document.getElementById('suspendAllWindows'),
    wakeAllTabs: document.getElementById('wakeAllTabs'),
    closeAllTabs: document.getElementById('closeAllTabs'),
    addCurrentTabToExclusion: document.getElementById('addCurrentTabToExclusion'),
    suspendedCount: document.getElementById('suspendedCount'),
    suspendedTabsList: document.getElementById('suspendedTabsList'),
    bulkActionsContainer: document.getElementById('bulkActionsContainer'),
    exclusionList: document.getElementById('exclusionList'),
    collapsibleHeader: document.querySelector('.collapsible-header'),
    settingsInputs: {
        inactiveThresholdMinutes: document.getElementById('inactiveThresholdMinutes'),
        suspendedTitlePrefix: document.getElementById('suspendedTitlePrefix'),
        ignorePinned: document.getElementById('ignorePinned'),
        ignoreAudio: document.getElementById('ignoreAudio'),
        ignoreForms: document.getElementById('ignoreForms'),
        showNotifications: document.getElementById('showNotifications'),
        showAutoSuspendNotifications: document.getElementById('showAutoSuspendNotifications'),
        groupTabsAutomatically: document.getElementById('groupTabsAutomatically'),
        groupName: document.getElementById('groupName'),
        groupColor: document.getElementById('groupColor'),
    },
    groupingOptions: document.getElementById('groupingOptions'),
    supportBtn: document.getElementById('supportBtn'),
};

const ICONS = {
    WAKE: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>`,
    REMOVE: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`
};

function applyTranslations() {
    const i18nElements = document.querySelectorAll('[data-i18n]');
    i18nElements.forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        elem.textContent = browser.i18n.getMessage(key);
    });

    const i18nTitleElements = document.querySelectorAll('[data-i18n-title]');
    i18nTitleElements.forEach(elem => {
        const key = elem.getAttribute('data-i18n-title');
        elem.title = browser.i18n.getMessage(key);
    });
    
    const loadingBtn = document.querySelector('[data-i18n-loading]');
    if (loadingBtn) {
        loadingBtn.textContent = browser.i18n.getMessage(loadingBtn.getAttribute('data-i18n-loading'));
    }
}

function setupEventListeners() {
    const sendMessage = (message) => browser.runtime.sendMessage(message);
    const saveSetting = (key, value) => sendMessage({ type: "SAVE_SETTING", setting: { [key]: value } });

    UI.toggleExtensionBtn?.addEventListener('click', () => {
        if (UI.toggleExtensionBtn.disabled) return;
        const isCurrentlyActive = UI.toggleExtensionBtn.classList.contains('active');
        saveSetting('extensionEnabled', !isCurrentlyActive);
    });

    UI.snoozeBtn?.addEventListener('click', () => {
        const duration = parseInt(UI.snoozeDuration.value, 10);
        sendMessage({ type: "SNOOZE", duration });
    });

    UI.cancelSnoozeBtn?.addEventListener('click', () => sendMessage({ type: "CANCEL_SNOOZE" }));
    
    UI.suspendCurrentTab?.addEventListener('click', () => sendMessage({ type: "SUSPEND_CURRENT_TAB" }));
    UI.suspendOtherTabs?.addEventListener('click', () => sendMessage({ type: "SUSPEND_OTHER_TABS" }));
    UI.suspendAllWindows?.addEventListener('click', () => {
        if (confirm(browser.i18n.getMessage("confirmAction"))) {
            sendMessage({ type: "SUSPEND_ALL_WINDOWS" });
        }
    });

    UI.wakeAllTabs?.addEventListener('click', () => sendMessage({ type: "WAKE_ALL_TABS" }));
    UI.closeAllTabs?.addEventListener('click', () => {
        if (confirm(browser.i18n.getMessage("confirmAction"))) {
            sendMessage({ type: "CLOSE_ALL_TABS" });
        }
    });

    UI.addCurrentTabToExclusion?.addEventListener('click', () => sendMessage({ type: "ADD_CURRENT_TAB_TO_EXCLUSION" }));

    UI.collapsibleHeader?.addEventListener('click', e => e.currentTarget.parentElement.classList.toggle('active'));

    for (const key in UI.settingsInputs) {
        const input = UI.settingsInputs[key];
        input?.addEventListener('change', e => {
            const value = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'number' ? parseInt(e.target.value) || 1 : e.target.value);
            saveSetting(key, value);
            if (key === 'groupTabsAutomatically') {
                UI.groupingOptions.style.display = e.target.checked ? 'flex' : 'none';
            }
        });
    }

    UI.suspendedTabsList?.addEventListener('click', e => {
        const wakeButton = e.target.closest('.wake-button');
        if (wakeButton) {
            browser.runtime.sendMessage({ type: "WAKE_TAB", tabId: parseInt(wakeButton.dataset.tabId) });
        }
    });

    UI.exclusionList?.addEventListener('click', e => {
        const removeButton = e.target.closest('.remove-exclusion');
        if (removeButton) {
            browser.runtime.sendMessage({ type: "REMOVE_DOMAIN_FROM_EXCLUSION", domain: removeButton.dataset.domain });
        }
    });

    UI.supportBtn?.addEventListener('click', () => {
        browser.tabs.create({ url: 'https://github.com/schwarper/smart-tab-manager' });
    });
}

function renderSuspendedList(tabs = []) {
    UI.suspendedCount.textContent = tabs.length;
    UI.suspendedTabsList.innerHTML = '';
    UI.bulkActionsContainer.style.display = tabs.length > 0 ? 'flex' : 'none';

    if (tabs.length === 0) {
        UI.suspendedTabsList.innerHTML = `<li class="list-item-info">${browser.i18n.getMessage("noSuspendedTabs")}</li>`;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    tabs.forEach(tab => {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
            <img class="favicon" src="${tab.favIconUrl || 'icons/icon48.png'}">
            <span class="list-item-title" title="${tab.title}">${tab.title}</span>
            <div class="list-item-actions">
                <button data-tab-id="${tab.id}" class="wake-button" title="${browser.i18n.getMessage("wakeTabAction")}">
                    ${ICONS.WAKE}
                </button>
            </div>`;
        fragment.appendChild(li);
    });
    UI.suspendedTabsList.appendChild(fragment);
}

function renderExclusionList(list = []) {
    if (!UI.exclusionList) return;
    UI.exclusionList.innerHTML = '';

    if (list.length === 0) {
        UI.exclusionList.innerHTML = `<li class="list-item-info">${browser.i18n.getMessage("noExcludedSites")}</li>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    list.forEach(domain => {
        const li = document.createElement('li');
        li.className = 'list-item';
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        li.innerHTML = `
            <img class="favicon" src="${faviconUrl}" alt="">
            <span class="list-item-title">${domain}</span>
            <div class="list-item-actions">
                <button data-domain="${domain}" class="remove-exclusion" title="${browser.i18n.getMessage("removeExclusionAction", domain)}">
                    ${ICONS.REMOVE}
                </button>
            </div>`;
        fragment.appendChild(li);
    });
    UI.exclusionList.appendChild(fragment);
}

function updateUI(data) {
    if (!data || !data.settings) return;
    const { settings, suspendedTabs, exclusionList } = data;
    const isSnoozed = settings.snoozeUntil > Date.now();
    
    UI.container.classList.toggle('disabled', !settings.extensionEnabled || isSnoozed);
    
    if (isSnoozed) {
        const remainingMinutes = Math.round((settings.snoozeUntil - Date.now()) / 60000);
        UI.toggleExtensionBtn.textContent = browser.i18n.getMessage("toggleButtonSnoozed", String(remainingMinutes));
        UI.toggleExtensionBtn.className = 'toggle-button snoozed';
        UI.toggleExtensionBtn.disabled = true;
        UI.snoozeControls.style.display = 'none';
        UI.cancelSnoozeBtn.style.display = 'block';
    } else {
        UI.toggleExtensionBtn.className = `toggle-button ${settings.extensionEnabled ? 'active' : 'inactive'}`;
        // BURADAKİ YAZIM HATASI DÜZELTİLDİ
        UI.toggleExtensionBtn.textContent = browser.i18n.getMessage(settings.extensionEnabled ? "toggleButtonActive" : "toggleButtonInactive");
        UI.toggleExtensionBtn.disabled = false;
        UI.snoozeControls.style.display = 'flex';
        UI.cancelSnoozeBtn.style.display = 'none';
    }

    for (const key in UI.settingsInputs) {
        const input = UI.settingsInputs[key];
        if(input && settings.hasOwnProperty(key)) {
            if (input.type === 'checkbox') input.checked = settings[key];
            else input.value = settings[key];
        }
    }
    UI.groupingOptions.style.display = settings.groupTabsAutomatically ? 'flex' : 'none';

    renderSuspendedList(suspendedTabs);
    renderExclusionList(exclusionList);
}

document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    setupEventListeners();
    browser.runtime.sendMessage({ type: "GET_DATA" })
        .then(updateUI)
        .catch(e => {
            console.error("Error loading extension data:", e);
            document.body.innerHTML = "Error loading extension data. Please reopen the popup.";
        });
});

browser.runtime.onMessage.addListener((message) => {
    if (message.type === "UPDATE_UI") {
        browser.runtime.sendMessage({ type: "GET_DATA" }).then(updateUI);
    }
});