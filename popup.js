if (typeof browser === 'undefined') { var browser = chrome; }

// TEK SEFERLİK TEMİZLEME KODU
browser.storage.sync.get('exclusionList').then(data => {
    console.log("TEST 1");
    if (data.exclusionList && Array.isArray(data.exclusionList)) {
        const originalLength = data.exclusionList.length;
        const cleanedList = data.exclusionList.filter(domain => {
            return typeof domain === 'string' && !domain.includes('/') && !domain.includes(':');
        });

        console.log("TEST 2 => " + originalLength + " " + cleanedList);
        if (cleanedList.length < originalLength) {
            browser.storage.sync.set({ exclusionList: cleanedList }).then(() => {
                console.log('Hatalı Exclusion List girdileri temizlendi.');
            });
        }
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const UI = {
        mainContent: document.getElementById('main-content'),
        toggleExtensionBtn: document.getElementById('toggleExtensionBtn'),
        snoozeSection: document.getElementById('snooze-section'),
        cancelSnoozeBtn: document.getElementById('cancelSnoozeBtn'),
        suspendedCount: document.getElementById('suspendedCount'),
        suspendedTabsList: document.getElementById('suspendedTabsList'),
        exclusionList: document.querySelector('#exclusionListContainer ul'),
        bulkActionsContainer: document.getElementById('bulkActionsContainer'),
        collapsibles: document.querySelectorAll('.collapsible'),
        groupModal: {
            dialog: document.getElementById('groupModal'),
            form: document.getElementById('groupForm'),
            title: document.getElementById('groupModalTitle'),
            id: document.getElementById('groupModalId'),
            name: document.getElementById('groupModalName'),
            color: document.getElementById('groupModalColor'),
            domainsList: document.getElementById('modalDomainsList'),
            domainInput: document.getElementById('domainInput'),
            addDomainBtn: document.getElementById('addDomainBtn'),
            cancelBtn: document.getElementById('cancelGroupModalBtn')
        },
        smartGroups: {
            list: document.getElementById('smartGroupsList'),
            openCreateModalBtn: document.getElementById('openCreateGroupModalBtn'),
        },
        settingsInputs: {
            theme: document.getElementById('theme'),
            autoGroupNewTabs: document.getElementById('autoGroupNewTabs'),
            inactiveThresholdMinutes: document.getElementById('inactiveThresholdMinutes'),
            suspendedTitlePrefix: document.getElementById('suspendedTitlePrefix'),
            ignorePinned: document.getElementById('ignorePinned'),
            ignoreAudio: document.getElementById('ignoreAudio'),
            ignoreForms: document.getElementById('ignoreForms'),
        },
        buttons: {
            support: document.getElementById('supportBtn'),
            snooze: document.getElementById('snoozeBtn'),
            suspendCurrent: document.getElementById('suspendCurrentTab'),
            suspendOther: document.getElementById('suspendOtherTabs'),
            wakeAll: document.getElementById('wakeAllTabs'),
            addCurrentToExclusion: document.getElementById('addCurrentTabToExclusion')
        }
    };
    
    const ICONS = {
        OPEN: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5 0V6.375c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125-1.125h-4.5A1.125 1.125 0 0113.5 10.5z" /></svg>`,
        EDIT: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>`,
        DELETE: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>`,
        REMOVE: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`,
        WAKE: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>`
    };
    
    let AppState = { settings: {} };
    let modalDomains = [];

    const sendMessage = (message) => browser.runtime.sendMessage(message);
    const saveSetting = (key, value) => sendMessage({ type: "SAVE_SETTING", setting: { [key]: value } });
    const cleanHostname = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch(e){ return null; } };

    const createIcon = (svgString) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        return doc.documentElement;
    };

    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(e => e.textContent = browser.i18n.getMessage(e.getAttribute('data-i18n')));
        document.querySelectorAll('[data-i18n-title]').forEach(e => e.title = browser.i18n.getMessage(e.getAttribute('data-i18n-title')));
        document.querySelectorAll('[data-i18n-placeholder]').forEach(e => e.placeholder = browser.i18n.getMessage(e.getAttribute('data-i18n-placeholder')));
    }

    function applyTheme(theme) {
        if (theme === 'system') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', theme);
    }
    
    function setupEventListeners() {
        UI.toggleExtensionBtn.addEventListener('click', () => saveSetting('extensionEnabled', !UI.toggleExtensionBtn.classList.contains('active')));
        UI.buttons.snooze.addEventListener('click', () => saveSetting('snoozeUntil', Date.now() + parseInt(document.getElementById('snoozeDuration').value, 10)));
        UI.cancelSnoozeBtn.addEventListener('click', () => saveSetting('snoozeUntil', 0));
        
        for (const key in UI.buttons) {
            if(UI.buttons[key]) UI.buttons[key].addEventListener('click', handleButtonClick);
        }
        
        UI.exclusionList.addEventListener('click', e => {
            const removeButton = e.target.closest('.remove-exclusion-btn');
            if(removeButton) sendMessage({ type: "EXCLUSION_ACTION", action: 'REMOVE', domain: removeButton.dataset.domain });
        });

        UI.suspendedTabsList.addEventListener('click', e => {
            const wakeButton = e.target.closest('.wake-button');
            if (wakeButton) sendMessage({ type: "WAKE_TAB", tabId: parseInt(wakeButton.dataset.tabId) });
        });

        UI.collapsibles.forEach(c => {
            const header = c.querySelector('.collapsible-header');
            if (header) header.addEventListener('click', e => e.currentTarget.parentElement.classList.toggle('active'));
        });

        for (const key in UI.settingsInputs) {
            const input = UI.settingsInputs[key];
            if(input) {
                input.addEventListener('change', e => {
                    const value = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'number' ? parseInt(e.target.value) || 1 : e.target.value);
                    saveSetting(key, value);
                    if (key === 'theme') applyTheme(value);
                });
            }
        }
        setupSmartGroupsListeners();
    }
    
    async function handleButtonClick(e) {
        const id = e.currentTarget.id;
        switch(id) {
            case 'supportBtn': 
                browser.tabs.create({ url: 'https://github.com/schwarper/smart-tab-manager' });
                break;
            case 'suspendCurrentTab': sendMessage({ type: "SUSPEND_CURRENT_TAB" }); break;
            case 'suspendOtherTabs': sendMessage({ type: "SUSPEND_OTHER_TABS" }); break;
            case 'wakeAllTabs': sendMessage({ type: "WAKE_ALL_TABS" }); break;
            case 'addCurrentTabToExclusion':
                const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
                if (activeTab && activeTab.url) sendMessage({ type: "EXCLUSION_ACTION", action: 'ADD', domain: cleanHostname(activeTab.url) });
                break;
        }
    }

    function setupSmartGroupsListeners() {
        UI.smartGroups.openCreateModalBtn.addEventListener('click', () => openGroupModal());
        UI.groupModal.cancelBtn.addEventListener('click', () => UI.groupModal.dialog.close());
        UI.groupModal.dialog.addEventListener('click', (e) => { if (e.target.id === 'groupModal') UI.groupModal.dialog.close(); });
        UI.groupModal.addDomainBtn.addEventListener('click', handleAddDomainToModal);
        UI.groupModal.domainInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDomainToModal(); }});
        UI.groupModal.domainsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-domain-btn');
            if (removeBtn) {
                modalDomains = modalDomains.filter(d => d !== removeBtn.dataset.domain);
                renderModalDomains();
            }
        });
        
        UI.groupModal.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = parseInt(UI.groupModal.id.value);
            const payload = { name: UI.groupModal.name.value.trim(), color: UI.groupModal.color.value, domains: modalDomains };
            if (!payload.name) return;
            const action = id ? 'EDIT' : 'CREATE';
            if (id) payload.id = id;
            sendMessage({ type: "SMART_GROUP_ACTION", action, payload });
            UI.groupModal.dialog.close();
        });
        
        UI.smartGroups.list.addEventListener('click', e => {
            const openBtn = e.target.closest('.open-group-btn');
            const editBtn = e.target.closest('.edit-group-btn');
            const deleteBtn = e.target.closest('.delete-group-btn');
            if (openBtn) sendMessage({ type: 'OPEN_SMART_GROUP', groupId: parseInt(openBtn.dataset.groupId) });
            if (editBtn) openGroupModal(parseInt(editBtn.dataset.groupId));
            if (deleteBtn) {
                if (confirm(browser.i18n.getMessage("confirmAction"))) {
                    sendMessage({ type: "SMART_GROUP_ACTION", action: 'DELETE', payload: { id: parseInt(deleteBtn.dataset.groupId) } });
                }
            }
        });
    }

    function handleAddDomainToModal() {
        let domain = UI.groupModal.domainInput.value.trim().toLowerCase();
        if (!domain) return;
        try {
            domain = cleanHostname("https://" + domain);
            if (domain && !modalDomains.includes(domain)) {
                modalDomains.push(domain);
                renderModalDomains();
            }
            UI.groupModal.domainInput.value = '';
            UI.groupModal.domainInput.focus();
        } catch (e) { 
            UI.groupModal.domainInput.style.borderColor = 'var(--c-danger)';
            setTimeout(()=> { UI.groupModal.domainInput.style.borderColor = ''}, 1000);
        }
    }
    
    function renderModalDomains() {
        UI.groupModal.domainsList.innerHTML = '';
        modalDomains.forEach(d => {
            const chip = document.createElement('span');
            chip.className = 'modal-domain-chip';
            chip.textContent = d;
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-domain-btn';
            removeBtn.dataset.domain = d;
            removeBtn.appendChild(createIcon(ICONS.REMOVE));

            chip.appendChild(removeBtn);
            UI.groupModal.domainsList.appendChild(chip);
        });
    }

    function openGroupModal(groupId = null) {
        UI.groupModal.form.reset();
        if (groupId) {
            const group = AppState.settings.smartGroups.find(g => g.id === groupId);
            if (!group) return;
            UI.groupModal.title.textContent = browser.i18n.getMessage("dialogEditGroupTitle");
            UI.groupModal.id.value = group.id;
            UI.groupModal.name.value = group.name;
            UI.groupModal.color.value = group.color;
            modalDomains = [...group.domains];
        } else {
            UI.groupModal.title.textContent = browser.i18n.getMessage("dialogCreateGroupTitle");
            UI.groupModal.id.value = '';
            modalDomains = [];
        }
        renderModalDomains();
        UI.groupModal.dialog.showModal();
    }

    function renderList(container, items, renderItem) {
        container.innerHTML = '';
        if (!items || items.length === 0) {
            const noItemsMessage = container.parentElement.id === 'suspendedTabsListContainer' ? "noSuspendedTabs" : "noExcludedSites";
            container.innerHTML = `<li class="list-item-info">${browser.i18n.getMessage(noItemsMessage)}</li>`;
            if (container.parentElement.id === 'suspendedTabsListContainer') {
                 UI.bulkActionsContainer.style.display = 'none';
            }
            return;
        }

        if (container.parentElement.id === 'suspendedTabsListContainer') {
            UI.bulkActionsContainer.style.display = 'block';
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => fragment.appendChild(renderItem(item)));
        container.appendChild(fragment);
    }
    
    function renderSuspendedList(tabs) {
        UI.suspendedCount.textContent = tabs.length;
        renderList(UI.suspendedTabsList, tabs, tab => {
            const li = document.createElement('li');
            li.className = 'list-item';
            
            const favicon = document.createElement('img');
            favicon.className = 'favicon';
            favicon.src = tab.favIconUrl || 'icons/icon48.png';

            const title = document.createElement('span');
            title.className = 'list-item-title';
            title.title = tab.title;
            title.textContent = tab.title;

            const actions = document.createElement('div');
            actions.className = 'list-item-actions';
            
            const wakeButton = document.createElement('button');
            wakeButton.dataset.tabId = tab.id;
            wakeButton.className = 'wake-button';
            wakeButton.title = browser.i18n.getMessage("wakeTabAction");
            wakeButton.appendChild(createIcon(ICONS.WAKE));
            
            actions.appendChild(wakeButton);
            li.append(favicon, title, actions);
            return li;
        });
    }

    function renderExclusionList(list) {
        renderList(UI.exclusionList, list, domain => {
             const li = document.createElement('li');
            li.className = 'list-item';
            
            const favicon = document.createElement('img');
            favicon.className = 'favicon';
            favicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
            
            const title = document.createElement('span');
            title.className = 'list-item-title';
            title.textContent = domain;

            const actions = document.createElement('div');
            actions.className = 'list-item-actions';
            
            const removeButton = document.createElement('button');
            removeButton.dataset.domain = domain;
            removeButton.className = 'remove-exclusion-btn';
            removeButton.title = browser.i18n.getMessage("removeExclusionAction", domain);
            removeButton.appendChild(createIcon(ICONS.DELETE));
            
            actions.appendChild(removeButton);
            li.append(favicon, title, actions);
            return li;
        });
    }

    function renderSmartGroups(groups = []) {
        UI.smartGroups.list.innerHTML = '';
        if (groups.length === 0) {
            UI.smartGroups.list.innerHTML = `<div class="list-item-info">${browser.i18n.getMessage("noSmartGroups")}</div>`;
            return;
        }
        groups.forEach(group => {
            UI.smartGroups.list.appendChild(createGroupCard(group));
        });
    }

    function createGroupCard(group) {
        const card = document.createElement('div');
        card.className = 'smart-group-card';
        
        const header = document.createElement('div');
        header.className = 'smart-group-header';
        
        const colorDot = document.createElement('span');
        colorDot.className = 'smart-group-color-dot';
        colorDot.style.backgroundColor = group.color;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'smart-group-name';
        nameSpan.textContent = group.name;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'smart-group-actions';
        
        const openBtn = document.createElement('button');
        openBtn.className = 'open-group-btn';
        openBtn.dataset.groupId = group.id;
        openBtn.title = browser.i18n.getMessage("openSmartGroupTitle");
        openBtn.appendChild(createIcon(ICONS.OPEN));

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-group-btn';
        editBtn.dataset.groupId = group.id;
        editBtn.title = browser.i18n.getMessage("editSmartGroupTitle");
        editBtn.appendChild(createIcon(ICONS.EDIT));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-group-btn';
        deleteBtn.dataset.groupId = group.id;
        deleteBtn.title = browser.i18n.getMessage("deleteSmartGroupTitle");
        deleteBtn.appendChild(createIcon(ICONS.DELETE));

        actionsDiv.append(openBtn, editBtn, deleteBtn);
        header.append(colorDot, nameSpan, actionsDiv);
        card.appendChild(header);

        if (group.domains && group.domains.length > 0) {
            const domainsDiv = document.createElement('div');
            domainsDiv.className = 'smart-group-domains-list';
            domainsDiv.innerHTML = group.domains.map(domain => `<span class="smart-group-domain-chip">${domain}</span>`).join('');
            card.appendChild(domainsDiv);
        }
        
        return card;
    }
    
    async function updateUI(data) {
        if (!data || !data.settings) return;
        AppState = data;
        const { settings, suspendedTabs } = data;
        const isSnoozed = settings.snoozeUntil > Date.now();
        
        UI.mainContent.classList.toggle('disabled', !settings.extensionEnabled || isSnoozed);
        UI.cancelSnoozeBtn.style.display = isSnoozed ? 'block' : 'none';
        UI.toggleExtensionBtn.disabled = false;

        if (isSnoozed) {
            UI.toggleExtensionBtn.textContent = browser.i18n.getMessage("toggleButtonSnoozed", String(Math.round((settings.snoozeUntil - Date.now()) / 60000)));
            UI.toggleExtensionBtn.className = 'toggle-button snoozed';
            UI.toggleExtensionBtn.disabled = true;
            UI.snoozeSection.style.display = 'none';
        } else {
            UI.toggleExtensionBtn.className = `toggle-button ${settings.extensionEnabled ? 'active' : 'inactive'}`;
            UI.toggleExtensionBtn.textContent = browser.i18n.getMessage(settings.extensionEnabled ? "toggleButtonActive" : "toggleButtonInactive");
            UI.snoozeSection.style.display = 'block';
        }

        for (const key in UI.settingsInputs) {
            const input = UI.settingsInputs[key];
            if (input && settings.hasOwnProperty(key)) {
                if (input.type === 'checkbox') input.checked = settings[key];
                else input.value = settings[key];
            }
        }
        
        applyTheme(settings.theme);
        renderSuspendedList(suspendedTabs);
        renderSmartGroups(settings.smartGroups);
        renderExclusionList(settings.exclusionList || []);

        const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
        UI.buttons.addCurrentToExclusion.disabled = !(activeTab && activeTab.url);
    }
    
    applyTranslations();
    setupEventListeners();
    browser.storage.sync.get('theme').then(data => applyTheme(data.theme || 'system'));
    sendMessage({ type: "GET_DATA" }).then(updateUI).catch(console.error);

    browser.runtime.onMessage.addListener((message) => {
        if (message.type === "UPDATE_UI") {
            sendMessage({ type: "GET_DATA" }).then(updateUI);
        }
    });
});