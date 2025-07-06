if (typeof browser === 'undefined') { var browser = chrome; }

const DEFAULT_SETTINGS = {
    extensionEnabled: true,
    inactiveThresholdMinutes: 15,
    suspendedTitlePrefix: '😴',
    ignorePinned: true,
    ignoreAudio: true,
    ignoreForms: true,
    snoozeUntil: 0,
    smartGroups: [],
    exclusionList: [],
    theme: 'system',
    autoGroupNewTabs: true
};

const ALARMS = { CHECK_INACTIVE: 'checkInactiveTabsAlarm' };
const SESSION_KEYS = { ACCESS: 'tabAccessTimes', FORMS: 'formInputTabs' };

async function getSettings() { return await browser.storage.sync.get(DEFAULT_SETTINGS); }
const cleanHostname = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return null; } };

async function handleTabAwakening(tabId) {
    try {
        const tab = await browser.tabs.get(tabId);
        if (tab && tab.groupId !== -1) {
            await browser.tabs.ungroup([tabId]);
        }
    } catch (e) {}
}

async function suspendTab(tab, options = {}) {
    const { force = false } = options;
    if (!tab || !tab.id || !tab.url || !tab.url.startsWith("http") || tab.discarded) return false;
    
    const settings = await getSettings();
    if (!settings.extensionEnabled) return false;

    const hostname = cleanHostname(tab.url);
    if (!hostname || (settings.exclusionList || []).includes(hostname)) return false;
    if (settings.ignorePinned && tab.pinned) return false;

    if (!force) {
        if (settings.ignoreAudio && tab.audible) return false;
        if (settings.ignoreForms) {
            const formTabs = (await browser.storage.session.get(SESSION_KEYS.FORMS))[SESSION_KEYS.FORMS] || [];
            if (formTabs.includes(tab.id)) return false;
        }
    }

    try {
        if (settings.suspendedTitlePrefix) {
            await browser.scripting.executeScript({
                target: { tabId: tab.id },
                func: (prefix) => { if (!document.title.startsWith(prefix)) { document.title = `${prefix} ${document.title}`; } },
                args: [settings.suspendedTitlePrefix],
            }).catch(() => {});
        }
        
        await browser.tabs.discard(tab.id);
        await updateAllUi();
        return true;
    } catch (error) { return false; }
}

async function checkInactiveTabs() {
    const settings = await getSettings();
    if (!settings.extensionEnabled || Date.now() < settings.snoozeUntil) return;
    const queryOptions = { active: false, discarded: false, url: ["http://*/*", "https://*/*"] };
    if (settings.ignorePinned) queryOptions.pinned = false;
    const tabs = await browser.tabs.query(queryOptions);
    const thresholdMillis = settings.inactiveThresholdMinutes * 60 * 1000;
    const accessTimes = (await browser.storage.session.get(SESSION_KEYS.ACCESS))[SESSION_KEYS.ACCESS] || {};
    for (const tab of tabs) {
        const lastAccessed = accessTimes?.[tab.id] ?? tab.lastAccessed;
        if ((Date.now() - lastAccessed) >= thresholdMillis) await suspendTab(tab);
    }
}

async function autoGroupTab(tabId, windowId, groupTitle, groupColor) {
    try {
        const tab = await browser.tabs.get(tabId);
        if (tab && tab.groupId !== -1) {
            const currentGroup = await browser.tabGroups.get(tab.groupId);
            if (currentGroup.title === groupTitle) return; 
        }
        
        const existingGroups = await browser.tabGroups.query({ windowId, title: groupTitle });
        if (existingGroups.length > 0) {
            await browser.tabs.group({ groupId: existingGroups[0].id, tabIds: [tabId] });
        } else {
            const newGroupId = await browser.tabs.group({ tabIds: [tabId], createProperties: { windowId } });
            await browser.tabGroups.update(newGroupId, { title: groupTitle, color: groupColor, collapsed: false });
        }
    } catch (error) {}
}

async function updateAllUi() {
    try {
        await browser.runtime.sendMessage({ type: "UPDATE_UI" });
    } catch (e) {}
}

async function setAlarms() {
    await browser.alarms.clear(ALARMS.CHECK_INACTIVE);
    const { extensionEnabled, snoozeUntil } = await getSettings();
    if (extensionEnabled && Date.now() >= snoozeUntil) {
        browser.alarms.create(ALARMS.CHECK_INACTIVE, { periodInMinutes: 1 });
    }
}

async function updateContextMenus() {
    await browser.contextMenus.removeAll();

    browser.contextMenus.create({ id: "suspend_this_tab", title: browser.i18n.getMessage("contextMenuSuspendThisTab"), contexts: ["page"] });
    browser.contextMenus.create({ id: "toggle_exclusion", title: browser.i18n.getMessage("contextMenuToggleExclusion"), contexts: ["page"] });
    browser.contextMenus.create({ id: "separator1", type: "separator", contexts: ["page"] });
    browser.contextMenus.create({ id: "suspend_other_tabs", title: browser.i18n.getMessage("contextMenuSuspendOtherTabs"), contexts: ["page"] });

    const { smartGroups } = await getSettings();
    if (smartGroups && smartGroups.length > 0) {
        browser.contextMenus.create({ id: "separator2", type: "separator", contexts: ["page"] });
        const parentId = browser.contextMenus.create({
            id: "add_to_smart_group",
            title: browser.i18n.getMessage("contextMenuAddToSmartGroup"),
            contexts: ["page"],
        });
        smartGroups.forEach(group => {
            browser.contextMenus.create({
                id: `add_to_group_${group.id}`,
                parentId: parentId,
                title: group.name,
                contexts: ["page"],
            });
        });
    }
}

async function handleSmartGroupAction(action, payload) {
    const { smartGroups } = await getSettings();
    let newGroups = [...smartGroups];
    switch(action) {
        case 'CREATE': newGroups.push({ id: Date.now(), ...payload }); break;
        case 'EDIT': newGroups = newGroups.map(g => g.id === payload.id ? { ...g, ...payload } : g); break;
        case 'DELETE': newGroups = newGroups.filter(g => g.id !== payload.id); break;
    }
    await browser.storage.sync.set({ smartGroups: newGroups });
    await updateContextMenus();
}

async function openSmartGroup(groupId) {
    const { smartGroups } = await getSettings();
    const groupToOpen = smartGroups.find(g => g.id === groupId);
    if (!groupToOpen || groupToOpen.domains.length === 0) return;
    
    const [currentWindow] = await browser.windows.getAll({ populate: true, windowTypes: ['normal'] });
    const existingGroups = await browser.tabGroups.query({ windowId: currentWindow.id, title: groupToOpen.name });
    
    let targetGroupId;
    if (existingGroups.length > 0) {
        targetGroupId = existingGroups[0].id;
    } else {
        const firstTab = await browser.tabs.create({ url: `https://${groupToOpen.domains[0]}`, active: false });
        targetGroupId = await browser.tabs.group({ tabIds: [firstTab.id], createProperties: { windowId: currentWindow.id } });
        await browser.tabGroups.update(targetGroupId, { title: groupToOpen.name, color: groupToOpen.color, collapsed: false });
    }

    const tabsToCreate = existingGroups.length > 0 ? groupToOpen.domains : groupToOpen.domains.slice(1);
    for (const domain of tabsToCreate) {
        const newTab = await browser.tabs.create({ url: `https://${domain}`, active: false });
        await browser.tabs.group({ groupId: targetGroupId, tabIds: [newTab.id] });
    }
}

async function handleExclusion(action, domain) {
    let { exclusionList } = await getSettings();
    const cleanDomain = domain.replace(/^www\./, '').split('/')[0];

    if (action === 'ADD' && !exclusionList.includes(cleanDomain)) {
        exclusionList.push(cleanDomain);
    } else if (action === 'REMOVE') {
        exclusionList = exclusionList.filter(d => d !== domain && d !== cleanDomain);
    }
    await browser.storage.sync.set({ exclusionList });
}

async function handleTabUpdateForAutoGrouping(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        const settings = await getSettings();
        if (settings.autoGroupNewTabs) {
            const hostname = cleanHostname(tab.url);
            if (!hostname) return;
            const smartGroup = (settings.smartGroups || []).find(g => g.domains.some(d => hostname.includes(d)));
            if (smartGroup) {
                await autoGroupTab(tab.id, tab.windowId, smartGroup.name, smartGroup.color);
            }
        }
    }
}

browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') await browser.storage.sync.set(DEFAULT_SETTINGS);
    await setAlarms();
    await updateContextMenus();
});

browser.runtime.onStartup.addListener(async () => {
    await setAlarms();
    await updateContextMenus();
});

browser.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARMS.CHECK_INACTIVE) checkInactiveTabs(); });
browser.tabs.onUpdated.addListener(handleTabUpdateForAutoGrouping);
browser.tabs.onUpdated.addListener((tabId, changeInfo) => { if (changeInfo.discarded === false) handleTabAwakening(tabId); });
browser.tabs.onActivated.addListener(activeInfo => handleTabAwakening(activeInfo.tabId));
[browser.tabs.onRemoved, browser.tabGroups.onUpdated, browser.tabGroups.onRemoved].forEach(event => event.addListener(updateAllUi));

browser.contextMenus.onClicked.addListener(async (info, tab) => {
    const domain = cleanHostname(tab.url);
    if (!domain && !info.menuItemId.startsWith("suspend")) return;

    if (info.menuItemId === "suspend_this_tab") {
        await suspendTab(tab, { force: true });
    } else if (info.menuItemId === "toggle_exclusion") {
        const { exclusionList } = await getSettings();
        await handleExclusion(exclusionList.includes(domain) ? 'REMOVE' : 'ADD', domain);
    } else if (info.menuItemId === "suspend_other_tabs") {
        const otherTabs = await browser.tabs.query({ windowId: tab.windowId, active: false });
        for (const t of otherTabs) await suspendTab(t, { force: true });
    } else if (info.menuItemId.startsWith("add_to_group_")) {
        const groupId = parseInt(info.menuItemId.replace("add_to_group_", ""));
        const { smartGroups } = await getSettings();
        const newGroups = smartGroups.map(g => {
            if (g.id === groupId && !g.domains.includes(domain)) {
                return { ...g, domains: [...g.domains, domain] };
            }
            return g;
        });
        await browser.storage.sync.set({ smartGroups: newGroups });
        await updateAllUi();
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const actions = {
        "GET_DATA": async () => sendResponse({ settings: await getSettings(), suspendedTabs: await browser.tabs.query({ discarded: true }) }),
        "SAVE_SETTING": async () => {
            await browser.storage.sync.set(message.setting);
            if (Object.keys(message.setting).some(k => ['extensionEnabled', 'inactiveThresholdMinutes', 'snoozeUntil'].includes(k))) {
                await setAlarms();
            }
            if (Object.keys(message.setting).includes('smartGroups')) {
                await updateContextMenus();
            }
            await updateAllUi();
        },
        "SUSPEND_CURRENT_TAB": async () => {
            const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
            if (activeTab) await suspendTab(activeTab, { force: true });
        },
        "SUSPEND_OTHER_TABS": async () => {
            const [current] = await browser.tabs.query({ active: true, currentWindow: true });
            if(current) {
                const others = await browser.tabs.query({ windowId: current.windowId, active: false });
                for (const t of others) await suspendTab(t, { force: true });
            }
        },
        "WAKE_ALL_TABS": async () => {
            const suspended = await browser.tabs.query({ discarded: true });
            for(const t of suspended) await browser.tabs.reload(t.id);
        },
        "CLOSE_ALL_SUSPENDED_TABS": async () => {
            const suspendedTabs = await browser.tabs.query({ discarded: true });
            if (suspendedTabs.length > 0) {
                const tabIds = suspendedTabs.map(t => t.id);
                await browser.tabs.remove(tabIds);
            }
        },
        "WAKE_TAB": async () => {
            await browser.tabs.reload(message.tabId);
            const tabToActivate = await browser.tabs.get(message.tabId);
            await browser.tabs.update(message.tabId, { active: true });
            await browser.windows.update(tabToActivate.windowId, { focused: true });
        },
        "SMART_GROUP_ACTION": () => handleSmartGroupAction(message.action, message.payload).then(updateAllUi),
        "OPEN_SMART_GROUP": () => openSmartGroup(message.groupId),
        "EXCLUSION_ACTION": () => handleExclusion(message.action, message.domain).then(updateAllUi),
        "FORM_INPUT_DETECTED": async () => {
            const formTabs = (await browser.storage.session.get(SESSION_KEYS.FORMS))[SESSION_KEYS.FORMS] || [];
            if (sender.tab && !formTabs.includes(sender.tab.id)) {
                await browser.storage.session.set({ [SESSION_KEYS.FORMS]: [...formTabs, sender.tab.id] });
            }
        }
    };
    if (actions[message.type]) {
        actions[message.type]();
        return true;
    }
});