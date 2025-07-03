# Smart Tab Manager

A lightweight, intelligent Chrome extension to automatically suspend inactive tabs, freeing up memory and CPU resources. Manage dozens of tabs effortlessly without slowing down your browser.

---

## Why Smart Tab Manager?

In a typical Browse session, it's easy to accumulate dozens of open tabs. Each tab consumes system resources, leading to a slower computer and a drained battery. Smart Tab Suspender solves this by gracefully "parking" tabs you haven't used in a while. When you return to a suspended tab, it reloads instantly to its previous state.

## ✨ Features

* **Automatic Suspension:** Automatically suspends tabs after a user-defined period of inactivity (default is 15 minutes).
* **Manual Control:** Instantly suspend the current tab, other tabs in the window, or all tabs across all windows with a single click.
* 🧠 **Intelligent Whitelisting:**
    * Never suspends **pinned tabs**.
    * Never suspends tabs that are **playing audio**.
    * Never suspends tabs where you are **actively filling out a form**.
    * Create a custom **exclusion list** for sites you never want to suspend.
* 🚀 **Memory & CPU Saver:** Uses Chrome's native `tabs.discard` API, which is the most efficient way to unload tabs without losing their place.
* **Tab Groups:** Automatically organizes suspended tabs into a neat group for better management.
* **Snooze Functionality:** Temporarily disable suspension for a set period when you need all tabs active.
* ⚙️ **Highly Customizable:**
    * Adjust the inactivity timer.
    * Set a custom prefix (like 😴) for suspended tab titles.
    * Enable or disable notifications.
    * Configure automatic tab grouping options.
* **Visual Feedback:** A badge on the extension icon shows the current number of suspended tabs.

## 🚀 Installation

#### 1. Install from the Chrome Web Store (Recommended)
[Smart Tab Manager - Chrome Web Store](https://chromewebstore.google.com/detail/smart-tab-manager/dcnghodhfiinlgdhidhifjmifmmlanep)

#### 2. Install from Source (For Developers)

1.  **Download or Clone:** Clone this repository to your local machine.
    ```bash
    git clone https://github.com/schwarper/smart-tab-manager.git
    ```
2.  **Open Chrome Extensions:** Open Google Chrome and navigate to `chrome://extensions`.
3.  **Enable Developer Mode:** In the top right corner, toggle the "Developer mode" switch to ON.
4.  **Load the Extension:** Click the "Load unpacked" button and select the directory where you cloned the repository.
5.  The extension should now be installed and ready to use!

## 🛠️ Usage

* **Main Popup:** Click the extension icon in your Chrome toolbar to open the main control panel. From here, you can access all quick actions, see the list of suspended tabs, manage your exclusion list, and change settings.
* **Right-Click Menu:** Right-click on any webpage to quickly suspend the current tab, other tabs, or add the site to your exclusion list.

## ❤️ Support & Contribution

If you find this extension useful, please consider showing your support or contributing to its development.

* **Contribute:** Found a bug or have a feature request? Feel free to [open an issue](https://github.com/schwarper/smart-tab-manager/issues) or submit a pull request. Contributions are highly welcome!
* **Donate:** If you'd like to support the developer, you can
    <a href="https://www.buymeacoffee.com/schwarper" target="_blank">buy me a coffee</a>!

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
