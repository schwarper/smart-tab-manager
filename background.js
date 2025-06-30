if (typeof browser === 'undefined') {
    var browser = chrome;
}

const DEFAULT_SETTINGS = {
    extensionEnabled: true,
    inactiveThresholdMinutes: 15,
    suspendedTitlePrefix: '😴',
    showNotifications: true,
    showAutoSuspendNotifications: true,
    groupTabsAutomatically: true,
    groupName: 'Suspended',
    groupColor: 'blue',
    ignorePinned: true,
    ignoreAudio: true,
    ignoreForms: true,
    snoozeUntil: 0
};

const ALARMS = {
    CHECK_INACTIVE: 'checkInactiveTabsAlarm',
    GROUP_AUDIT: 'groupAuditAlarm'
};

const SESSION_KEYS = {
    ACCESS: 'tabAccessTimes',
    FORMS: 'formInputTabs'
};

async function checkAndUngroupIfAwakened(tabId) {
    try {
        const tab = await browser.tabs.get(tabId);
        if (tab && !tab.discarded && tab.groupId !== -1) {
            const { groupName } = await browser.storage.sync.get(DEFAULT_SETTINGS);
            const group = await browser.tabGroups.get(tab.groupId);
            
            if (group && group.title === groupName) {
                await browser.tabs.ungroup([tabId]);
            }
        }
    } catch (e) {}
}

async function suspendTab(tab, suppressNotification = false) {
    if (!tab || !tab.id || !tab.url || !tab.url.startsWith("http") || tab.discarded) return false;
    
    const settings = await browser.storage.sync.get(DEFAULT_SETTINGS);
    if (!settings.extensionEnabled) return false;

    const exclusionList = (await browser.storage.sync.get({exclusionList: []})).exclusionList;
    try {
        if (exclusionList.includes(new URL(tab.url).hostname)) return false;
    } catch (e) { return false; }

    if ((settings.ignorePinned && tab.pinned) || (settings.ignoreAudio && tab.audible)) return false;
    
    if (settings.ignoreForms) {
        const formInputTabs = (await browser.storage.session.get(SESSION_KEYS.FORMS))[SESSION_KEYS.FORMS] || [];
        if (formInputTabs.includes(tab.id)) return false;
    }

    try {
        if (settings.groupTabsAutomatically) {
            await autoGroupTab(tab.id, tab.windowId);
        }

        if (settings.suspendedTitlePrefix) {
            await browser.scripting.executeScript({
                target: { tabId: tab.id },
                func: (prefix) => { if(!document.title.startsWith(prefix)) { document.title = `${prefix} ${document.title}`; } },
                args: [settings.suspendedTitlePrefix],
            }).catch(() => {});
        }
        
        await browser.tabs.discard(tab.id);

        if (settings.showNotifications && !suppressNotification) {
            browser.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: browser.i18n.getMessage("notificationTitleTabSuspended"),
                message: browser.i18n.getMessage("notificationMessageTabSuspended", tab.title)
            });
        }
        await updateAll();
        return true;
    } catch (error) {
        return false;
    }
}

async function checkInactiveTabs() {
    const settings = await browser.storage.sync.get(DEFAULT_SETTINGS);
    if (!settings.extensionEnabled || Date.now() < settings.snoozeUntil) return;

    const queryOptions = {
        active: false,
        discarded: false,
        url: ["http://*/*", "https://*/*"]
    };

    if (settings.ignoreAudio) {
        queryOptions.audible = false;
    }
    if (settings.ignorePinned) {
        queryOptions.pinned = false;
    }

    const tabs = await browser.tabs.query(queryOptions);
    const thresholdMillis = settings.inactiveThresholdMinutes * 60 * 1000;
    const tabsToSuspend = [];
    
    for (const tab of tabs) {
        const lastAccessed = (await browser.storage.session.get(SESSION_KEYS.ACCESS))[SESSION_KEYS.ACCESS]?.[tab.id] || tab.lastAccessed;
        if (Date.now() - lastAccessed >= thresholdMillis) {
            tabsToSuspend.push(tab);
        }
    }

    if (tabsToSuspend.length > 0) {
        let suspendedCount = 0;
        let suspendedTitles = [];
        for (const tab of tabsToSuspend) {
            const success = await suspendTab(tab, true);
            if (success) {
                suspendedCount++;
                suspendedTitles.push(tab.title);
            }
        }

        if (suspendedCount > 0 && settings.showAutoSuspendNotifications) {
            const titles = suspendedTitles.slice(0, 3).join(', ');
            const message = browser.i18n.getMessage("notificationMessageAutoSuspend", [String(suspendedCount), titles]);
            browser.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: browser.i18n.getMessage("notificationTitleAutoSuspend"),
                message: message
            });
        }
    }
}

async function auditSuspendedGroups() {
    const { groupTabsAutomatically, groupName } = await browser.storage.sync.get(DEFAULT_SETTINGS);
    if (!groupTabsAutomatically) return;

    try {
        const suspendedGroups = await browser.tabGroups.query({ title: groupName });
        for (const group of suspendedGroups) {
            const tabsInGroup = await browser.tabs.query({ groupId: group.id });
            const awakenedTabs = tabsInGroup.filter(t => !t.discarded);
            if (awakenedTabs.length > 0) {
                const tabIdsToUngroup = awakenedTabs.map(t => t.id);
                await browser.tabs.ungroup(tabIdsToUngroup);
            }
        }
    } catch (error) {}
}

async function autoGroupTab(tabId, windowId) {
    const { groupName, groupColor } = await browser.storage.sync.get(DEFAULT_SETTINGS);
    try {
        const tab = await browser.tabs.get(tabId);
        if (tab && tab.groupId !== -1) return;

        const existingGroups = await browser.tabGroups.query({ windowId, title: groupName });
        let targetGroupId = existingGroups.length > 0 ? existingGroups[0].id : null;
        if (!targetGroupId) {
            const newGroupId = await browser.tabs.group({ tabIds: [tabId], createProperties: { windowId } });
            await browser.tabGroups.update(newGroupId, { title: groupName, color: groupColor });
        } else {
            await browser.tabs.group({ groupId: targetGroupId, tabIds: [tabId] });
        }
    } catch (error) {}
}

async function updateAll() {
    const suspendedTabs = await browser.tabs.query({ discarded: true });
    await browser.action.setBadgeText({ text: suspendedTabs.length > 0 ? suspendedTabs.length.toString() : '' });
    await browser.action.setBadgeBackgroundColor({ color: '#2e7d32' });
    try {
        await browser.runtime.sendMessage({ type: "UPDATE_UI" });
    } catch (e) {}
}

async function setAlarms() {
    await browser.alarms.clearAll();
    const { extensionEnabled, snoozeUntil } = await browser.storage.sync.get(DEFAULT_SETTINGS);
    if (extensionEnabled && Date.now() >= snoozeUntil) {
        browser.alarms.create(ALARMS.CHECK_INACTIVE, { periodInMinutes: 1 });
        browser.alarms.create(ALARMS.GROUP_AUDIT, { periodInMinutes: 1 });
    }
}

browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await browser.storage.sync.set(DEFAULT_SETTINGS);
    }
    await setAlarms();
    
    browser.contextMenus.create({ id: "suspend_this_tab", title: browser.i18n.getMessage("contextMenuSuspendThisTab"), contexts: ["page"] });
    browser.contextMenus.create({ id: "suspend_other_tabs", title: browser.i18n.getMessage("contextMenuSuspendOtherTabs"), contexts: ["page"] });
    browser.contextMenus.create({ id: "toggle_exclusion", title: browser.i18n.getMessage("contextMenuExcludeSite"), contexts: ["page"] });
});

browser.runtime.onStartup.addListener(setAlarms);

browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARMS.CHECK_INACTIVE) {
        checkInactiveTabs();
    } else if (alarm.name === ALARMS.GROUP_AUDIT) {
        auditSuspendedGroups();
    }
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.discarded === false || (changeInfo.status === 'complete' && !tab.discarded)) {
        await checkAndUngroupIfAwakened(tabId);
    }

    if (changeInfo.discarded === false) {
        const accessTimes = (await browser.storage.session.get(SESSION_KEYS.ACCESS))[SESSION_KEYS.ACCESS] || {};
        accessTimes[tabId] = Date.now();
        await browser.storage.session.set({ [SESSION_KEYS.ACCESS]: accessTimes });
    }
    
    if (changeInfo.status || changeInfo.discarded !== undefined || changeInfo.audible !== undefined || changeInfo.pinned !== undefined) {
        await updateAll();
    }
    
    if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
        await updateContextMenuForTab(tab);
    }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
    await checkAndUngroupIfAwakened(activeInfo.tabId);

    const accessTimes = (await browser.storage.session.get(SESSION_KEYS.ACCESS))[SESSION_KEYS.ACCESS] || {};
    accessTimes[activeInfo.tabId] = Date.now();
    await browser.storage.session.set({ [SESSION_KEYS.ACCESS]: accessTimes });

    const tab = await browser.tabs.get(activeInfo.tabId).catch(() => null);
    if (tab) await updateContextMenuForTab(tab);
    await updateAll();
});


async function updateContextMenuForTab(tab) {
    if (!tab || !tab.url || !tab.url.startsWith('http')) {
        browser.contextMenus.update("toggle_exclusion", { enabled: false });
        return;
    };
    browser.contextMenus.update("toggle_exclusion", { enabled: true });
    const { exclusionList } = await browser.storage.sync.get({exclusionList: []});
    const isExcluded = exclusionList.includes(new URL(tab.url).hostname);
    browser.contextMenus.update("toggle_exclusion", {
        title: isExcluded ? browser.i18n.getMessage("contextMenuUnexcludeSite") : browser.i18n.getMessage("contextMenuExcludeSite")
    });
}

browser.tabs.onRemoved.addListener(updateAll);
browser.tabGroups.onUpdated.addListener(updateAll);
browser.tabGroups.onRemoved.addListener(updateAll);

browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "suspend_this_tab") await suspendTab(tab);
    else if (info.menuItemId === "suspend_other_tabs") {
        const otherTabs = await browser.tabs.query({ windowId: tab.windowId, active: false });
        for (const t of otherTabs) await suspendTab(t);
    } else if (info.menuItemId === "toggle_exclusion") {
        const url = new URL(tab.url);
        let { exclusionList } = await browser.storage.sync.get({exclusionList: []});
        if (exclusionList.includes(url.hostname)) {
            exclusionList = exclusionList.filter(h => h !== url.hostname);
        } else {
            exclusionList.push(url.hostname);
        }
        await browser.storage.sync.set({ exclusionList });
        await updateContextMenuForTab(tab);
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        switch (message.type) {
            case "GET_DATA":
                const [settings, suspendedTabs, exclusionData] = await Promise.all([
                    browser.storage.sync.get(DEFAULT_SETTINGS),
                    browser.tabs.query({ discarded: true }),
                    browser.storage.sync.get({exclusionList: []})
                ]);
                sendResponse({
                    settings: settings,
                    suspendedTabs: suspendedTabs,
                    exclusionList: exclusionData.exclusionList
                });
                break;
            case "SAVE_SETTING":
                await browser.storage.sync.set(message.setting);
                if (message.setting.hasOwnProperty('extensionEnabled') || message.setting.hasOwnProperty('inactiveThresholdMinutes')) {
                    await setAlarms();
                }
                await updateAll();
                break;
            case "SNOOZE":
                await browser.storage.sync.set({ snoozeUntil: Date.now() + message.duration });
                await setAlarms();
                await updateAll();
                break;
            case "CANCEL_SNOOZE":
                await browser.storage.sync.set({ snoozeUntil: 0 });
                await setAlarms();
                await updateAll();
                break;
            case "SUSPEND_CURRENT_TAB":
                const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
                if (activeTab) await suspendTab(activeTab);
                break;
            case "SUSPEND_OTHER_TABS":
                const [current] = await browser.tabs.query({ active: true, currentWindow: true });
                if(current) {
                    const others = await browser.tabs.query({ windowId: current.windowId, active: false });
                    for (const t of others) await suspendTab(t);
                }
                break;
            case "SUSPEND_ALL_WINDOWS":
                const allTabs = await browser.tabs.query({ url: ["http://*/*", "https://*/*"] });
                for (const t of allTabs) await suspendTab(t);
                break;
            case "WAKE_TAB":
                await browser.tabs.reload(message.tabId);
                const tabToActivate = await browser.tabs.get(message.tabId);
                await browser.tabs.update(message.tabId, { active: true });
                await browser.windows.update(tabToActivate.windowId, { focused: true });
                break;
            case "WAKE_ALL_TABS":
                const suspended = await browser.tabs.query({ discarded: true });
                for (const t of suspended) await browser.tabs.reload(t.id);
                break;
            case "CLOSE_ALL_TABS":
                const suspendedIds = (await browser.tabs.query({ discarded: true })).map(t => t.id);
                if(suspendedIds.length > 0) await browser.tabs.remove(suspendedIds);
                break;
            case "ADD_CURRENT_TAB_TO_EXCLUSION":
                 const [tabToExclude] = await browser.tabs.query({ active: true, currentWindow: true });
                 if (tabToExclude && tabToExclude.url && tabToExclude.url.startsWith('http')) {
                     const domain = new URL(tabToExclude.url).hostname;
                     let { exclusionList } = await browser.storage.sync.get({exclusionList: []});
                     if (!exclusionList.includes(domain)) {
                         exclusionList.push(domain);
                         await browser.storage.sync.set({ 'exclusionList': exclusionList });
                         await updateAll();
                     }
                 }
                 break;
            case "REMOVE_DOMAIN_FROM_EXCLUSION":
                let { exclusionList } = await browser.storage.sync.get({exclusionList: []});
                exclusionList = exclusionList.filter(d => d !== message.domain);
                await browser.storage.sync.set({ 'exclusionList': exclusionList });
                await updateAll();
                break;
            case "FORM_INPUT_DETECTED":
                const formTabs = (await browser.storage.session.get(SESSION_KEYS.FORMS))[SESSION_KEYS.FORMS] || [];
                if (!formTabs.includes(sender.tab.id)) {
                    await browser.storage.session.set({ [SESSION_KEYS.FORMS]: [...formTabs, sender.tab.id] });
                }
                break;
        }
    })();
    return true;
});